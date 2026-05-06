import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const serviceClient = await createServiceClient()
  const { data: userPlan } = await serviceClient
    .from('user_plans')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const customerId = userPlan?.stripe_customer_id as string | null
  if (!customerId) {
    return new Response('No billing account found', { status: 404 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/billing`,
  })

  return Response.redirect(session.url, 303)
}
