// Deno Edge Function — Supabase hosted runtime
// Merges a guest's action counts into the authenticated user's record on sign-in.
// Idempotent: safe to call multiple times (second call returns {merged:false}).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the caller via JWT ──────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.slice('Bearer '.length),
    );
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = user.id;

    // ── 2. Parse and validate request body ─────────────────────────────────
    let guestId: string | undefined;
    try {
      const body = await req.json() as { guest_id?: string };
      guestId = body.guest_id;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!guestId || typeof guestId !== 'string') {
      return json({ merged: false, reason: 'no_guest_id' }, 200);
    }

    // ── 3. Use service-role client to bypass RLS ────────────────────────────
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── 4. Read guest counts ────────────────────────────────────────────────
    const { data: guestRow, error: readError } = await serviceClient
      .from('guest_action_usage')
      .select('daily_date, daily_count, monthly_month, monthly_count')
      .eq('guest_id', guestId)
      .maybeSingle();

    if (readError) throw readError;

    if (!guestRow) {
      return json({ merged: false, reason: 'guest_not_found' }, 200);
    }

    const guestDaily        = guestRow.daily_count   as number;
    const guestMonthly      = guestRow.monthly_count as number;
    const guestDailyDate    = guestRow.daily_date    as string;
    const guestMonthlyMonth = guestRow.monthly_month as string;

    // ── 5. Read existing user counts (may not exist yet) ───────────────────
    const { data: userRow } = await serviceClient
      .from('user_action_usage')
      .select('daily_date, daily_count, monthly_month, monthly_count')
      .eq('user_id', userId)
      .maybeSingle();

    const today     = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Merge today's counts only when both dates match today — prevents stale
    // guest counts from inflating the user's current-day total.
    const userDailyCount   = userRow?.daily_date   === today   ? (userRow.daily_count   as number) : 0;
    const userMonthlyCount = userRow?.monthly_month === thisMonth ? (userRow.monthly_count as number) : 0;
    const guestDailyAdded   = guestDailyDate    === today     ? guestDaily   : 0;
    const guestMonthlyAdded = guestMonthlyMonth === thisMonth ? guestMonthly : 0;

    const newDailyCount   = userDailyCount   + guestDailyAdded;
    const newMonthlyCount = userMonthlyCount + guestMonthlyAdded;

    // ── 6. Upsert user_action_usage with merged counts ──────────────────────
    const { error: upsertError } = await serviceClient
      .from('user_action_usage')
      .upsert({
        user_id:       userId,
        daily_date:    today,
        daily_count:   newDailyCount,
        monthly_month: thisMonth,
        monthly_count: newMonthlyCount,
        updated_at:    new Date().toISOString(),
      });

    if (upsertError) throw upsertError;

    // ── 7. Delete guest row (makes the operation idempotent) ─────────────────
    const { error: deleteError } = await serviceClient
      .from('guest_action_usage')
      .delete()
      .eq('guest_id', guestId);

    if (deleteError) throw deleteError;

    return json({ merged: true, daily: newDailyCount, monthly: newMonthlyCount }, 200);

  } catch (err) {
    console.error('merge-guest error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
