export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/services/auth'
import MyDataTabs from './MyDataTabs'

async function getMyData(userId: string) {
  const supabase = await createClient()

  const [
    sessionsRes,
    promptsRes,
    promptFoldersRes,
    subsRes,
    bmFoldersRes,
    bmEntriesRes,
    tabGroupsRes,
    todoListsRes,
    todoItemsRes,
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, name, created_at, tab_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('prompts')
      .select('id, title, folder_id, is_favorite, is_pinned, usage_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('prompt_folders')
      .select('id, name')
      .eq('user_id', userId),

    supabase
      .from('tracked_subscriptions')
      .select('id, name, price, currency, billing_cycle, next_billing_date, status')
      .eq('user_id', userId)
      .order('next_billing_date', { ascending: true }),

    supabase
      .from('bookmark_folders')
      .select('id, name')
      .eq('user_id', userId)
      .eq('card_type', 'bookmark'),

    supabase
      .from('bookmark_entries')
      .select('id, folder_id, title, url, fav_icon_url')
      .eq('user_id', userId)
      .order('position', { ascending: true }),

    supabase
      .from('tab_group_templates')
      .select('key, title, color, tabs, saved_at')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false }),

    supabase
      .from('todo_lists')
      .select('id, name, icon')
      .eq('user_id', userId),

    supabase
      .from('todo_items')
      .select('id, list_id, text, completed, priority')
      .eq('user_id', userId),
  ])

  // Build lookup maps for relational joins
  const folderMap: Record<string, string> = {}
  for (const f of promptFoldersRes.data ?? []) {
    folderMap[f.id] = f.name
  }

  const entriesByFolder: Record<string, Array<{ id: string; title: string; url: string; fav_icon_url: string | null }>> = {}
  for (const e of bmEntriesRes.data ?? []) {
    if (!entriesByFolder[e.folder_id]) entriesByFolder[e.folder_id] = []
    entriesByFolder[e.folder_id].push(e)
  }

  const itemsByList: Record<string, Array<{ id: string; text: string; completed: boolean; priority: string }>> = {}
  for (const item of todoItemsRes.data ?? []) {
    if (!itemsByList[item.list_id]) itemsByList[item.list_id] = []
    itemsByList[item.list_id].push(item)
  }

  return {
    sessions: sessionsRes.data ?? [],
    prompts: promptsRes.data ?? [],
    folderMap,
    subscriptions: subsRes.data ?? [],
    bookmarkFolders: bmFoldersRes.data ?? [],
    entriesByFolder,
    tabGroups: tabGroupsRes.data ?? [],
    todoLists: todoListsRes.data ?? [],
    itemsByList,
  }
}

export default async function MyDataPage() {
  const user = await requireAuth()
  const data = await getMyData(user.id)

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">My Data</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Browse everything synced to the cloud from your Browser Hub extension.
        </p>
      </div>

      <MyDataTabs {...data} />
    </div>
  )
}
