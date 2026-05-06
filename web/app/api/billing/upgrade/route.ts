import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const VALID_PLANS = ['free', 'pro', 'lifetime'] as const
type PlanId = typeof VALID_PLANS[number]
type BillingCycle = 'monthly' | 'yearly'

export async function POST(request: Request) {
  const body = await request.json() as { plan_id: PlanId; billing_cycle?: BillingCycle }
  const { plan_id, billing_cycle = 'monthly' } = body

  if (!VALID_PLANS.includes(plan_id)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Downgrade to free: cancel Stripe subscription and update DB directly
  if (plan_id === 'free') {
    const serviceClient = await createServiceClient()
    const { data: userPlan } = await serviceClient
      .from('user_plans')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single()

    if (userPlan?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(userPlan.stripe_subscription_id).catch(() => null)
    }

    await serviceClient
      .from('user_plans')
      .update({
        plan_id: 'free',
        status: 'active',
        source: 'stripe',
        billing_cycle: null,
        current_period_start: null,
        current_period_end: null,
        stripe_subscription_id: null,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  }

  // Fetch plan row to get Stripe price ID
  const serviceClient = await createServiceClient()
  const { data: plan } = await serviceClient
    .from('plans')
    .select('id, name, stripe_price_monthly, stripe_price_yearly')
    .eq('id', plan_id)
    .single()

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const isLifetime = plan_id === 'lifetime'
  const priceId = isLifetime
    ? plan.stripe_price_monthly
    : billing_cycle === 'yearly'
      ? plan.stripe_price_yearly
      : plan.stripe_price_monthly

  if (!priceId || priceId.startsWith('REPLACE_')) {
    return NextResponse.json({ error: 'Stripe price not configured for this plan' }, { status: 500 })
  }

  // Get or create Stripe customer
  const { data: userPlan } = await serviceClient
    .from('user_plans')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = userPlan?.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    await serviceClient
      .from('user_plans')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', user.id)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isLifetime ? 'payment' : 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { plan_id, billing_cycle: isLifetime ? 'one_time' : billing_cycle },
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/billing`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
