import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Users, Crown, UserPlus, Clock } from 'lucide-react'

export default function AdminOverviewPage() {
  const stats = [
    { label: 'Total Users', value: '—', icon: Users, iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Premium Users', value: '—', icon: Crown, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Free Users', value: '—', icon: UserPlus, iconBg: 'bg-stone-100 dark:bg-stone-800', iconColor: 'text-stone-600 dark:text-stone-400' },
    { label: 'Total Sessions Saved', value: '—', icon: Clock, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent sign-ups */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Recent Sign-ups</h2>
            <Badge variant="secondary">Latest</Badge>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            No users yet. Data will appear once connected to Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
