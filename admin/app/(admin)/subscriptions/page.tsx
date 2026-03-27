'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

export default function SubscriptionsPage() {
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('premium')
  const [loading, setLoading] = useState(false)

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to Supabase
    toast.success('Subscription granted!')
    setEmail('')
    setLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Subscriptions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grant Form */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Grant Subscription</h2>
            <form onSubmit={handleGrant} className="space-y-3">
              <div className="space-y-1.5">
                <Label>User Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <select
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-elevated)] px-3 py-2 text-sm"
                >
                  <option value="premium">Premium</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Granting...' : 'Grant Access'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Active Subscriptions</h2>
                <Badge variant="secondary">0 active</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-stone-500 dark:text-stone-400 py-8">
                      No active subscriptions.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
