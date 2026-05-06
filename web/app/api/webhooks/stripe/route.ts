export const dynamic = 'force-dynamic'

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildBillingNotificationEmail } from '@/lib/email/templates/billingNotification'

// Minimal shapes we need — avoids breakage across Stripe API versions
interface SubInfo {
  id: string
  status: string
  current_period_end: number
  customer: string
}
interface InvoiceInfo {
  customer: string
  subscription: string | null
  billing_reason?: string
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('[stripe webhook] Signature error:', msg)
    return new Response(`Webhook error: ${msg}`, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Log every event before processing
  await supabase.from('webhook_events').insert({
    source: 'stripe',
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    status: 'pending',
  })

  try {
    await handleEvent(event, supabase)

    // Mark as processed
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('source', 'stripe')
      .eq('event_type', event.type)
      .is('processed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[stripe webhook] Error handling ${event.type}:`, msg)

    await supabase
      .from('webhook_events')
      .update({ status: 'failed', error_msg: msg })
      .eq('source', 'stripe')
      .eq('event_type', event.type)
      .is('processed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
  }

  return Response.json({ received: true })
}

type SupabaseClient = Awaited<ReturnType<typeof createServiceClient>>

async function handleEvent(event: Stripe.Event, supabase: SupabaseClient) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase)
      break
    case 'invoice.payment_succeeded':
      await handleInvoiceSucceeded(event.data.object as Stripe.Invoice, supabase)
      break
    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice, supabase)
      break
    default:
      // Unhandled but logged — no error
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: SupabaseClient) {
  const userId = session.client_reference_id
  if (!userId) return

  const planId = session.metadata?.plan_id
  const billingCycle = session.metadata?.billing_cycle ?? 'monthly'
  const isOneTime = billingCycle === 'one_time'

  if (!planId) return

  let periodEnd: string | null = null
  let subscriptionId: string | null = null

  if (!isOneTime && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as SubInfo
    subscriptionId = sub.id
    periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  }

  await supabase.from('user_plans').upsert({
    user_id: userId,
    plan_id: planId,
    status: 'active',
    source: 'stripe',
    billing_cycle: isOneTime ? null : billingCycle,
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscriptionId,
  }, { onConflict: 'user_id' })

  await sendBillingEmail(userId, planId, 'subscription_created', periodEnd, supabase)
}

async function handleSubscriptionUpdated(rawSub: Stripe.Subscription, supabase: SupabaseClient) {
  const sub = rawSub as unknown as SubInfo
  const customerId = sub.customer
  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('user_id, plan_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userPlan) return

  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  await supabase.from('user_plans').update({
    status: sub.status === 'active' ? 'active' : sub.status,
    current_period_end: periodEnd,
    stripe_subscription_id: sub.id,
  }).eq('stripe_customer_id', customerId)
}

async function handleSubscriptionDeleted(rawSub: Stripe.Subscription, supabase: SupabaseClient) {
  const sub = rawSub as unknown as SubInfo
  const customerId = sub.customer
  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('user_id, plan_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!userPlan) return

  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  await supabase.from('user_plans').update({
    plan_id: 'free',
    status: 'canceled',
    billing_cycle: null,
    current_period_end: periodEnd,
    stripe_subscription_id: null,
  }).eq('stripe_customer_id', customerId)

  await sendBillingEmail(userPlan.user_id, userPlan.plan_id, 'subscription_cancelled', periodEnd, supabase)
}

async function handleInvoiceSucceeded(rawInvoice: Stripe.Invoice, supabase: SupabaseClient) {
  const invoice = rawInvoice as unknown as InvoiceInfo
  // Only act on renewals (not the first payment — that's handled by checkout.session.completed)
  if (invoice.billing_reason !== 'subscription_cycle') return

  const customerId = invoice.customer
  const sub = invoice.subscription
    ? await stripe.subscriptions.retrieve(invoice.subscription) as unknown as SubInfo
    : null

  if (!sub) return

  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

  await supabase.from('user_plans').update({
    status: 'active',
    current_period_end: periodEnd,
  }).eq('stripe_customer_id', customerId)

  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('user_id, plan_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (userPlan) {
    await sendBillingEmail(userPlan.user_id, userPlan.plan_id, 'subscription_renewed', periodEnd, supabase)
  }
}

async function handleInvoiceFailed(rawInvoice: Stripe.Invoice, supabase: SupabaseClient) {
  const invoice = rawInvoice as unknown as InvoiceInfo
  const customerId = invoice.customer
  await supabase.from('user_plans').update({ status: 'past_due' }).eq('stripe_customer_id', customerId)
}

async function sendBillingEmail(
  userId: string,
  planId: string,
  event: 'subscription_created' | 'subscription_renewed' | 'subscription_cancelled',
  periodEnd: string | null,
  supabase: SupabaseClient,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (!profile?.email) return

  const { data: plan } = await supabase
    .from('plans')
    .select('name')
    .eq('id', planId)
    .single()

  const { subject, html } = buildBillingNotificationEmail({
    event,
    planName: plan?.name ?? planId,
    displayName: profile.full_name ?? null,
    periodEnd: periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null,
  })

  await sendEmail({ to: profile.email, subject, html, type: 'billing_notification' })
}
