import { Card, CardContent } from '@/components/ui/card'
import { LayoutDashboard, Globe, Layers, Clock } from 'lucide-react'

export default function DashboardPage() {
  const stats = [
    { label: 'Saved Sessions', value: '—', icon: Layers, iconBg: 'bg-indigo-100 dark:bg-indigo-900/30', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Tabs', value: '—', icon: Globe, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Auto-Saves', value: '—', icon: Clock, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
    { label: 'Tab Groups', value: '—', icon: LayoutDashboard, iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400' },
  ]

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Dashboard</h1>

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

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Dashboard will show your session analytics and recent activity once connected to Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
