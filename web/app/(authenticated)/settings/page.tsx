'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/lib/theme'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input disabled placeholder="you@example.com" />
              <p className="text-xs text-stone-400">Email cannot be changed</p>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
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
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">Change Password</h3>
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" />
            </div>
            <Button>Update Password</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
