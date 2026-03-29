import { createServiceClient } from '@/lib/supabase/server'

export interface EmailLogRow {
  id: string
  to_email: string
  type: string | null
  template: string | null
  subject: string
  status: string
  message_id: string | null
  error_msg: string | null
  metadata: Record<string, unknown>
  sent_at: string
  sent_by: string | null
}

export async function getEmailLogs(
  limit = 50,
  offset = 0,
  typeFilter?: string
): Promise<{ logs: EmailLogRow[]; total: number }> {
  const supabase = await createServiceClient()

  let query = supabase
    .from('email_log')
    .select('*', { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (typeFilter) {
    query = query.eq('type', typeFilter)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[emailLogs] getEmailLogs error:', error)
    return { logs: [], total: 0 }
  }

  return { logs: (data || []) as EmailLogRow[], total: count || 0 }
}

export async function getEmailStats(): Promise<{
  today: number
  week: number
  month: number
  failed: number
}> {
  const supabase = await createServiceClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).toISOString()

  const [todayRes, weekRes, monthRes, failedRes] = await Promise.all([
    supabase.from('email_log').select('id', { count: 'exact', head: true }).gte('sent_at', todayStart),
    supabase.from('email_log').select('id', { count: 'exact', head: true }).gte('sent_at', weekStart),
    supabase.from('email_log').select('id', { count: 'exact', head: true }).gte('sent_at', monthStart),
    supabase.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ])

  return {
    today:  todayRes.count  || 0,
    week:   weekRes.count   || 0,
    month:  monthRes.count  || 0,
    failed: failedRes.count || 0,
  }
}

export async function getDailyEmailCounts(
  days = 30
): Promise<Array<{ date: string; sent: number; failed: number }>> {
  const supabase = await createServiceClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from('email_log')
    .select('status, sent_at')
    .gte('sent_at', since.toISOString())
    .limit(5000)

  if (error || !data) return []

  const map = new Map<string, { sent: number; failed: number }>()
  for (const row of data) {
    const key = row.sent_at.slice(0, 10) // 'YYYY-MM-DD'
    const bucket = map.get(key) || { sent: 0, failed: 0 }
    if (row.status === 'sent')   bucket.sent++
    else if (row.status === 'failed') bucket.failed++
    map.set(key, bucket)
  }

  // Fill all days including zero-count days for a continuous chart
  const result: Array<{ date: string; sent: number; failed: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    result.push({ date: key, ...(map.get(key) || { sent: 0, failed: 0 }) })
  }
  return result
}

export async function getEmailCountByType(): Promise<Array<{ type: string; count: number }>> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('email_log')
    .select('type, template')
    .limit(10000)

  if (error || !data) return []

  const map = new Map<string, number>()
  for (const row of data) {
    const t = row.type || row.template || 'unknown'
    map.set(t, (map.get(t) || 0) + 1)
  }

  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getRecentFailures(limit = 5): Promise<EmailLogRow[]> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('email_log')
    .select('*')
    .eq('status', 'failed')
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data || []) as EmailLogRow[]
}
