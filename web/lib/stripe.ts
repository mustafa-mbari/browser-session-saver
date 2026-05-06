import Stripe from 'stripe'

// Use '' fallback so module loads even before env var is set — API calls will
// fail with a clear Stripe error rather than crashing the whole route handler.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-04-22.dahlia',
})
