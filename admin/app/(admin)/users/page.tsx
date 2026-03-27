import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createServiceClient } from '@/lib/supabase/server'

type UserRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string
  created_at: string
  user_plans: { plan_id: string; status: string; billing_cycle: string | null }[]
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  pro:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  max:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  canceled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

async function getUsers(search: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { users: [], total: 0 }
  const supabase = await createServiceClient()
  let query = supabase
    .from('profiles')
    .select('id, email, display_name, role, created_at, user_plans(plan_id, status, billing_cycle)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)
  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }
  const { data, count } = await query
  return { users: (data ?? []) as UserRow[], total: count ?? 0 }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const search = params.search ?? ''
  const { users, total } = await getUsers(search)

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Users</h1>
        <Badge variant="secondary">{total} total</Badge>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="mb-4">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search by email or name…"
              className="w-full max-w-sm rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400"
            />
          </form>

          {users.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-8 text-center">
              {process.env.NEXT_PUBLIC_SUPABASE_URL
                ? (search ? `No users matching "${search}".` : 'No users yet.')
                : 'Connect Supabase to see user data.'}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => {
                    const plan = user.user_plans?.[0]
                    const planId = plan?.plan_id ?? 'free'
                    const status = plan?.status ?? 'active'
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium text-stone-800 dark:text-stone-100">{user.display_name || '—'}</p>
                          <p className="text-xs text-stone-400">{user.email}</p>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_COLOR[planId] ?? PLAN_COLOR.free}`}>
                            {planId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[status] ?? STATUS_COLOR.active}`}>
                            {status.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-stone-500 dark:text-stone-400 capitalize">{user.role}</span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-stone-500 dark:text-stone-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {total > 50 && (
                <p className="mt-3 text-xs text-stone-400 text-center">Showing first 50 of {total} users. Use search to filter.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
