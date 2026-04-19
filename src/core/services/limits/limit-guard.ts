import { checkAndIncrementAction } from './action-tracker';
import { supabase } from '@core/supabase/client';
import { getOrCreateGuestId } from '@core/services/guest.service';

// Re-exported so call sites that import ActionLimitError from this module continue to work.
export { ActionLimitError } from './action-tracker';

/**
 * Call BEFORE a mutation. Atomically checks the limit and increments the counter.
 * Throws ActionLimitError if the daily or monthly limit would be exceeded.
 */
export async function guardAction(count = 1): Promise<void> {
  await checkAndIncrementAction(count);
}

/**
 * Call AFTER a successful mutation. Fire-and-forgets an upsert to Supabase so
 * the web dashboard can display counts. The local counter is already incremented
 * by guardAction — this function only handles remote reporting.
 */
export async function trackAction(_count = 1): Promise<void> {
  void reportActionToSupabase();
}

async function reportActionToSupabase(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const dailyDate    = new Date().toISOString().slice(0, 10);
    const monthlyMonth = new Date().toISOString().slice(0, 7);

    if (session?.user) {
      await supabase.rpc('upsert_action_usage', {
        p_user_id:       session.user.id,
        p_daily_date:    dailyDate,
        p_monthly_month: monthlyMonth,
      });
      return;
    }

    // Guest path: track usage so counts can be merged when the user later signs in.
    // Uses getOrCreateGuestId — creates a guest_id on first tracked action.
    const guestId = await getOrCreateGuestId();
    await supabase.rpc('upsert_guest_action_usage', {
      p_guest_id:      guestId,
      p_daily_date:    dailyDate,
      p_monthly_month: monthlyMonth,
    });
  } catch {
    // Non-critical — local counter is the source of truth
  }
}
