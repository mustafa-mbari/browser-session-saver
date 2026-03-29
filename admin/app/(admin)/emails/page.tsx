'use client'

import { useState } from 'react'
import { BarChart3, Send, Eye, FileText, ShieldCheck } from 'lucide-react'
import DashboardTab  from './DashboardTab'
import SendTestTab   from './SendTestTab'
import TemplatesTab  from './TemplatesTab'
import LogsTab       from './LogsTab'
import SpamCheckTab  from './SpamCheckTab'

const TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: BarChart3    },
  { id: 'send',      label: 'Send & Test', icon: Send         },
  { id: 'templates', label: 'Templates',  icon: Eye          },
  { id: 'logs',      label: 'Logs',       icon: FileText     },
  { id: 'spam',      label: 'Spam Check', icon: ShieldCheck  },
] as const

type TabId = (typeof TABS)[number]['id']

export default function EmailsPage() {
  const [tab, setTab] = useState<TabId>('dashboard')

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6">Emails</h1>

      <div className="border-b border-stone-200 dark:border-[var(--dark-border)]">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(t => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'send'      && <SendTestTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'logs'      && <LogsTab />}
      {tab === 'spam'      && <SpamCheckTab />}
    </div>
  )
}
