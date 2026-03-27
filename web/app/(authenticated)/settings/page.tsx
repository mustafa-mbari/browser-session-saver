'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/lib/theme'
import { Sun, Moon, Monitor, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security'>('profile')
  const { theme, setTheme } = useTheme()

  const tabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'appearance' as const, label: 'Appearance' },
    { id: 'security' as const, label: 'Security' },
  ]

  return (
    <div className="max-w-3xl animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 dark:border-[var(--dark-border)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'appearance' && <AppearanceTab theme={theme} setTheme={setTheme} />}
      {activeTab === 'security' && <SecurityTab />}
    </div>
  )
}

// ----------------------------------------------------------------

function ProfileTab() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setDisplayName(data?.display_name ?? '')
          setLoading(false)
        })
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)

    if (error) {
      toast.error('Failed to save profile.')
    } else {
      toast.success('Profile updated.')
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex items-center gap-2 text-stone-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input disabled value={email} placeholder="you@example.com" />
              <p className="text-xs text-stone-400">Email cannot be changed here</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------

function AppearanceTab({ theme, setTheme }: { theme: string; setTheme: (t: 'light' | 'dark' | 'system') => void }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light' as const, label: 'Light', icon: Sun },
            { value: 'dark' as const, label: 'Dark', icon: Moon },
            { value: 'system' as const, label: 'System', icon: Monitor },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors',
                theme === opt.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-stone-200 dark:border-[var(--dark-border)] hover:bg-stone-50 dark:hover:bg-[var(--dark-hover)]'
              )}
            >
              <opt.icon className={cn('h-5 w-5', theme === opt.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-500')} />
              <span className={cn('text-sm', theme === opt.value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-stone-600 dark:text-stone-400')}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------

function SecurityTab() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat new password"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</> : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
