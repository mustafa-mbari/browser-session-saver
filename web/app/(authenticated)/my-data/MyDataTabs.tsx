'use client'

import { useState, useCallback, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Globe, Pin, Star, CheckSquare, Square, Folder, FolderOpen, ChevronRight } from 'lucide-react'

// Matches GROUP_COLORS in src/core/constants/tab-group-colors.ts
const TAB_GROUP_COLORS: Record<string, string> = {
  grey: '#9e9e9e',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#1e8e3e',
  pink: '#e52592',
  purple: '#8430ce',
  cyan: '#007b83',
  orange: '#fa903e',
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  low: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  none: 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  trial: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  canceling: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  paused: 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400',
  canceled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-stone-400 dark:text-stone-500 text-sm">
      {message}
    </div>
  )
}

type BmFolder = { id: string; name: string; parent_folder_id: string | null; card_type: string }
type BmEntry = { id: string; title: string; url: string; fav_icon_url: string | null }

function EntryRow({ entry }: { entry: BmEntry }) {
  let hostname = ''
  try { hostname = new URL(entry.url).hostname } catch { /* invalid url */ }

  return (
    <a
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors group min-w-0"
    >
      {entry.fav_icon_url ? (
        <img
          src={entry.fav_icon_url}
          alt=""
          width={14}
          height={14}
          className="shrink-0 rounded-sm opacity-80 group-hover:opacity-100"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <Globe className="h-3.5 w-3.5 shrink-0 text-stone-300 dark:text-stone-600" />
      )}
      <span className="flex-1 truncate text-sm text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">
        {entry.title || entry.url}
      </span>
      {hostname && (
        <span className="shrink-0 text-[11px] text-stone-400 dark:text-stone-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[160px]">
          {hostname}
        </span>
      )}
    </a>
  )
}

function FolderNode({
  folder,
  childrenMap,
  entriesByFolder,
  openIds,
  onToggle,
  depth,
}: {
  folder: BmFolder
  childrenMap: Map<string | null, BmFolder[]>
  entriesByFolder: Record<string, BmEntry[]>
  openIds: Set<string>
  onToggle: (id: string) => void
  depth: number
}) {
  const entries = entriesByFolder[folder.id] ?? []
  const children = childrenMap.get(folder.id) ?? []
  const total = entries.length + children.length
  const isOpen = openIds.has(folder.id)
  const hasContent = total > 0

  return (
    <div className={depth > 0 ? 'ml-2 pl-3 border-l border-stone-200 dark:border-stone-700/60' : ''}>
      {/* Folder header — full-width clickable button */}
      <button
        onClick={() => hasContent && onToggle(folder.id)}
        disabled={!hasContent}
        aria-expanded={isOpen}
        className={[
          'w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors text-left',
          hasContent
            ? 'hover:bg-stone-100 dark:hover:bg-stone-800/60 cursor-pointer'
            : 'cursor-default opacity-50',
        ].join(' ')}
      >
        {/* Rotating chevron */}
        <ChevronRight
          className={[
            'h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform duration-200',
            isOpen ? 'rotate-90' : '',
            !hasContent ? 'invisible' : '',
          ].join(' ')}
        />

        {/* Open/closed folder icon */}
        {isOpen
          ? <FolderOpen className={`shrink-0 text-amber-500 ${depth === 0 ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
          : <Folder    className={`shrink-0 text-amber-400 ${depth === 0 ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
        }

        <span className={[
          'flex-1 truncate text-sm',
          depth === 0
            ? 'font-semibold text-stone-800 dark:text-stone-100'
            : 'font-medium text-stone-700 dark:text-stone-200',
        ].join(' ')}>
          {folder.name}
        </span>

        {/* Item count pill — always visible */}
        {hasContent && (
          <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
            {total}
          </span>
        )}
      </button>

      {/* Animated content — grid-template-rows trick for smooth height */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms ease',
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-0.5 pb-1">
            {/* Bookmark entries */}
            {entries.map(entry => <EntryRow key={entry.id} entry={entry} />)}

            {/* Nested sub-folders */}
            {children.length > 0 && (
              <div className="mt-1 flex flex-col">
                {children.map(child => (
                  <FolderNode
                    key={child.id}
                    folder={child}
                    childrenMap={childrenMap}
                    entriesByFolder={entriesByFolder}
                    openIds={openIds}
                    onToggle={onToggle}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  sessions: Array<{ id: string; name: string; created_at: string; tab_count: number | null }>
  prompts: Array<{ id: string; title: string; folder_id: string | null; is_favorite: boolean; is_pinned: boolean; usage_count: number; created_at: string }>
  folderMap: Record<string, string>
  subscriptions: Array<{ id: string; name: string; price: number | null; currency: string; billing_cycle: string; next_billing_date: string | null; status: string }>
  bookmarkFolders: BmFolder[]
  entriesByFolder: Record<string, BmEntry[]>
  tabGroups: Array<{ key: string; title: string; color: string; tabs: unknown[]; saved_at: string }>
  todoLists: Array<{ id: string; name: string; icon: string | null }>
  itemsByList: Record<string, Array<{ id: string; text: string; completed: boolean; priority: string }>>
}

export default function MyDataTabs({
  sessions,
  prompts,
  folderMap,
  subscriptions,
  bookmarkFolders,
  entriesByFolder,
  tabGroups,
  todoLists,
  itemsByList,
}: Props) {
  // Build parent→children map for the bookmark folder tree (only bookmark-type folders)
  const bmChildrenMap = useMemo(() => {
    const map = new Map<string | null, BmFolder[]>()
    for (const f of bookmarkFolders) {
      if (f.card_type !== 'bookmark') continue
      const key = f.parent_folder_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return map
  }, [bookmarkFolders])

  const bmRootFolders = bmChildrenMap.get(null) ?? []

  // Collapse/expand state — root folders open by default, sub-folders closed
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(bmRootFolders.map(f => f.id)))

  const toggleFolder = useCallback((id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setOpenIds(new Set(bookmarkFolders.filter(f => f.card_type === 'bookmark').map(f => f.id)))
  }, [bookmarkFolders])

  const collapseAll = useCallback(() => setOpenIds(new Set()), [])

  return (
    <Tabs defaultValue="todos">
      <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-stone-100 dark:bg-[var(--dark-card)] p-1">
        <TabsTrigger value="todos">Todos</TabsTrigger>
        <TabsTrigger value="prompts">Prompts</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="tab-groups">Tab Groups</TabsTrigger>
      </TabsList>

      {/* ── Todos ─────────────────────────────────────────────────────── */}
      <TabsContent value="todos">
        {todoLists.length === 0 ? (
          <EmptyState message="No todos synced yet." />
        ) : (
          <div className="flex flex-col gap-4">
            {todoLists.map(list => {
              const items = itemsByList[list.id] ?? []
              return (
                <Card key={list.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      {list.icon && <span className="text-base">{list.icon}</span>}
                      <span className="font-semibold text-stone-800 dark:text-stone-100">{list.name}</span>
                      <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-stone-400 dark:text-stone-500">No items in this list.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {items.map(item => (
                          <li key={item.id} className="flex items-start gap-2 text-sm">
                            {item.completed
                              ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              : <Square className="h-4 w-4 text-stone-300 dark:text-stone-600 shrink-0 mt-0.5" />}
                            <span className={item.completed ? 'line-through text-stone-400 dark:text-stone-500' : 'text-stone-700 dark:text-stone-300'}>
                              {item.text}
                            </span>
                            {item.priority && item.priority !== 'none' && (
                              <span className={`ml-auto shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-medium capitalize ${PRIORITY_BADGE[item.priority] ?? PRIORITY_BADGE.none}`}>
                                {item.priority}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </TabsContent>

      {/* ── Prompts ───────────────────────────────────────────────────── */}
      <TabsContent value="prompts">
        {prompts.length === 0 ? (
          <EmptyState message="No prompts synced yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {prompts.map(prompt => (
              <Card key={prompt.id}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{prompt.title}</p>
                    {prompt.folder_id && folderMap[prompt.folder_id] && (
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 truncate">
                        {folderMap[prompt.folder_id]}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {prompt.is_pinned && (
                      <span title="Pinned" className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                        <Pin className="h-3 w-3" /> Pinned
                      </span>
                    )}
                    {prompt.is_favorite && (
                      <span title="Favorite" className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">
                        <Star className="h-3 w-3" /> Favorite
                      </span>
                    )}
                    {prompt.usage_count > 0 && (
                      <span className="text-[11px] text-stone-400 dark:text-stone-500">
                        {prompt.usage_count} use{prompt.usage_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Subscriptions ─────────────────────────────────────────────── */}
      <TabsContent value="subscriptions">
        {subscriptions.length === 0 ? (
          <EmptyState message="No subscriptions synced yet." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-[var(--dark-border)]">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Next Billing</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[var(--dark-border)]">
                    {subscriptions.map(sub => (
                      <tr key={sub.id} className="hover:bg-stone-50 dark:hover:bg-[var(--dark-hover)] transition-colors">
                        <td className="py-3 px-4 font-medium text-stone-800 dark:text-stone-100">{sub.name}</td>
                        <td className="py-3 px-4 text-stone-600 dark:text-stone-300">
                          {sub.price != null
                            ? `${sub.currency} ${Number(sub.price).toFixed(2)} / ${sub.billing_cycle}`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-stone-500 dark:text-stone-400">
                          {sub.next_billing_date
                            ? new Date(sub.next_billing_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[sub.status] ?? STATUS_BADGE.active}`}>
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ── Bookmarks ─────────────────────────────────────────────────── */}
      <TabsContent value="bookmarks">
        {bmRootFolders.length === 0 ? (
          <EmptyState message="No bookmark folders synced yet." />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400 dark:text-stone-500">
                {bmRootFolders.length} folder{bmRootFolders.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                >
                  Expand all
                </button>
                <span className="text-stone-300 dark:text-stone-600 select-none">·</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                >
                  Collapse all
                </button>
              </div>
            </div>

            {/* Folder tree */}
            <Card>
              <CardContent className="py-2 px-2">
                <div className="flex flex-col">
                  {bmRootFolders.map((folder, i) => (
                    <div key={folder.id}>
                      {i > 0 && (
                        <div className="mx-2 my-1 h-px bg-stone-100 dark:bg-stone-800" />
                      )}
                      <FolderNode
                        folder={folder}
                        childrenMap={bmChildrenMap}
                        entriesByFolder={entriesByFolder}
                        openIds={openIds}
                        onToggle={toggleFolder}
                        depth={0}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      {/* ── Sessions ──────────────────────────────────────────────────── */}
      <TabsContent value="sessions">
        {sessions.length === 0 ? (
          <EmptyState message="No sessions synced yet." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-[var(--dark-border)]">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Name</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Tabs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[var(--dark-border)]">
                    {sessions.map(session => (
                      <tr key={session.id} className="hover:bg-stone-50 dark:hover:bg-[var(--dark-hover)] transition-colors">
                        <td className="py-3 px-4 font-medium text-stone-800 dark:text-stone-100 max-w-[280px] truncate">{session.name}</td>
                        <td className="py-3 px-4 text-stone-500 dark:text-stone-400 whitespace-nowrap">
                          {new Date(session.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 px-4">
                          {session.tab_count != null && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                              {session.tab_count} tab{session.tab_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* ── Tab Groups ────────────────────────────────────────────────── */}
      <TabsContent value="tab-groups">
        {tabGroups.length === 0 ? (
          <EmptyState message="No tab groups synced yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {tabGroups.map(group => {
              const tabCount = Array.isArray(group.tabs) ? group.tabs.length : 0
              const color = TAB_GROUP_COLORS[group.color] ?? TAB_GROUP_COLORS.grey
              return (
                <Card key={group.key}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 font-medium text-stone-800 dark:text-stone-100 truncate">{group.title}</span>
                    <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-medium">
                      {tabCount} tab{tabCount !== 1 ? 's' : ''}
                    </span>
                    <span className="shrink-0 text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">
                      {new Date(group.saved_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
