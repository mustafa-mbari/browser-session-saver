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

export default function PromosPage() {
  const [code, setCode] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: Connect to Supabase
    toast.success('Promo code created!')
    setCode('')
    setMaxUses('')
    setLoading(false)
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Promo Codes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Create Promo Code</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} required placeholder="BROWSERHUB2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses</Label>
                <Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="100" />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Code'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Codes */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Active Promo Codes</h2>
                <Badge variant="secondary">0 codes</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-stone-500 dark:text-stone-400 py-8">
                      No promo codes yet.
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
