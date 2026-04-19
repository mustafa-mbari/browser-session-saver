import type { LimitStatus } from '@core/types/limits.types';
import { getLimitStatus, incrementAction } from './action-tracker';

export class ActionLimitError extends Error {
  readonly status: LimitStatus;

  constructor(status: LimitStatus) {
    super('Action limit reached');
    this.name = 'ActionLimitError';
    this.status = status;
  }
}

/**
 * Call BEFORE a mutation. Throws ActionLimitError if the user is at their
 * daily or monthly limit.
 */
export async function guardAction(): Promise<void> {
  const status = await getLimitStatus();
  if (status.dailyBlocked || status.monthlyBlocked) {
    throw new ActionLimitError(status);
  }
}

/**
 * Call AFTER a successful mutation. Increments the local counter and,
 * for signed-in users, fire-and-forgets an upsert to Supabase so the
 * web dashboard can display counts.
 */
export async function trackAction(count = 1): Promise<void> {
  await incrementAction(count);
  // Fire-and-forget remote upsert for signed-in users
  void reportActionToSupabase();
}

async function reportActionToSupabase(): Promise<void> {
  try {
    const { supabase } = await import('@core/supabase/client');
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
    // Uses getGuestId (non-creating) — if no guest_id exists yet this is a no-op.
    const { getOrCreateGuestId } = await import('@core/services/guest.service');
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
