'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

const DEFAULT_QUOTAS = [
  { key: 'max_sessions', label: 'Max Saved Sessions', free: '25', premium: 'Unlimited' },
  { key: 'max_tabs_per_session', label: 'Max Tabs per Session', free: '100', premium: '500' },
  { key: 'max_auto_saves', label: 'Max Auto-Saves', free: '10', premium: '50' },
  { key: 'max_tab_groups', label: 'Max Tab Group Templates', free: '5', premium: '25' },
  { key: 'sync_enabled', label: 'Cloud Sync', free: 'No', premium: 'Yes' },
]

export default function QuotasPage() {
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    // TODO: Connect to Supabase
    toast.success('Quotas updated!')
    setLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Quotas</h1>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Limit</TableHead>
                <TableHead>Free Plan</TableHead>
                <TableHead>Premium Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEFAULT_QUOTAS.map(q => (
                <TableRow key={q.key}>
                  <TableCell className="font-medium text-stone-900 dark:text-stone-100">{q.label}</TableCell>
                  <TableCell>
                    <Input defaultValue={q.free} className="max-w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Input defaultValue={q.premium} className="max-w-[120px]" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
