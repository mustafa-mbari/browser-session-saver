import type { Message, MessageResponse, SessionDiffResponse, SaveSessionResponse, GetSessionsResponse, SyncSignInResponse, DashboardSyncResponse } from '@core/types/messages.types';
import type { Session } from '@core/types/session.types';
import type { Settings } from '@core/types/settings.types';
import { STORAGE_KEYS } from '@core/types/storage.types';
import type { StorageMetadata } from '@core/types/storage.types';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { getSettingsStorage, getSessionRepository } from '@core/storage/storage-factory';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { exportAsJSON, exportAsHTML, exportAsMarkdown, exportAsCSV, exportAsText } from '@core/services/export.service';
import { importFromJSON, importFromHTML, importFromURLList } from '@core/services/import.service';
import { generateId } from '@core/utils/uuid';
import { isValidUrl, isValidSession } from '@core/utils/validators';
import { MAX_IMPORT_SIZE_BYTES } from '@core/constants/limits';
import { syncSignIn, syncSignOut, getSyncUserId } from '@core/services/sync-auth.service';
import { syncAll, getSyncStatus, pushSession, deleteRemoteSession, syncDashboard, pullDashboard, pullAll } from '@core/services/sync.service';
import {
  getSettings as getSelectiveSyncSettings,
  updateSettings as updateSelectiveSyncSettings,
  pauseSyncFor,
  clearPause,
} from '@core/sync/state/selective-sync-settings';
import {
  getTrips as getMassDeleteTrips,
  clearTrip as clearMassDeleteTrip,
  clearAllTrips as clearAllMassDeleteTrips,
} from '@core/sync/state/mass-delete-guard';
import { ALL_SYNC_ENTITY_KEYS, type SyncEntityKey } from '@core/sync/types/syncable';
import { getSyncEngine } from '@core/sync/handlers';

export function registerEventListeners(): void {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; // keep message channel open for async response
  });
}

async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.action) {
    case 'SAVE_SESSION':
      return handleSaveSession(message.payload);
    case 'RESTORE_SESSION':
      return handleRestoreSession(message.payload);
    case 'DELETE_SESSION':
      return handleDeleteSession(message.payload);
    case 'GET_SESSIONS':
      return handleGetSessions(message.payload);
    case 'GET_CURRENT_TABS':
      return handleGetCurrentTabs();
    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(message.payload);
    case 'GET_SETTINGS':
      return handleGetSettings();
    case 'AUTO_SAVE_STATUS':
      return handleAutoSaveStatus();
    case 'UPDATE_SESSION':
      return handleUpdateSession(message.payload);
    case 'EXPORT_SESSIONS':
      return handleExportSessions(message.payload);
    case 'IMPORT_SESSIONS':
      return handleImportSessions(message.payload);
    case 'UNDELETE_SESSION':
      return handleUndeleteSession(message.payload);
    case 'MERGE_SESSIONS':
      return handleMergeSessions(message.payload);
    case 'DIFF_SESSIONS':
      return handleDiffSessions(message.payload);
    case 'RESTORE_SELECTED_TABS':
      return handleRestoreSelectedTabs(message.payload);
    case 'UPDATE_SESSION_TABS':
      return handleUpdateSessionTabs(message.payload);
    case 'OPEN_DOWNLOAD':
      return handleOpenDownload(message.payload);
    case 'SHOW_DOWNLOAD':
      return handleShowDownload(message.payload);
    case 'SYNC_GET_STATUS':
      return handleSyncGetStatus();
    case 'SYNC_SIGN_IN':
      return handleSyncSignIn(message.payload);
    case 'SYNC_SIGN_OUT':
      return handleSyncSignOut();
    case 'SYNC_NOW':
      return handleSyncNow();
    case 'SYNC_PUSH':
      return handleSyncPush();
    case 'SYNC_DASHBOARD':
      return handleSyncDashboard(message.payload);
    case 'PULL_DASHBOARD':
      return handlePullDashboard();
    case 'SYNC_PULL_ALL':
      return handlePullAll();
    case 'SYNC_MUTATION':
      return handleSyncMutation();
    case 'SYNC_GET_SETTINGS':
      return handleSyncGetSettings();
    case 'SYNC_UPDATE_SETTINGS':
      return handleSyncUpdateSettings(message.payload);
    case 'SYNC_PAUSE':
      return handleSyncPause(message.payload);
    case 'SYNC_CLEAR_PAUSE':
      return handleSyncClearPause();
    case 'SYNC_GET_MASS_DELETE_TRIPS':
      return handleSyncGetMassDeleteTrips();
    case 'SYNC_CLEAR_MASS_DELETE_TRIP':
      return handleSyncClearMassDeleteTrip(message.payload);
    case 'SYNC_CLEAR_ALL_MASS_DELETE_TRIPS':
      return handleSyncClearAllMassDeleteTrips();
    case 'SYNC_GET_DIRTY_COUNTS':
      return handleSyncGetDirtyCounts();
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ── Debounced mutation-triggered sync ───────────────────────────────────────
// Coalesces bursts of deletes/updates (e.g. deleting 30 bookmarks in a row)
// into a single sync a short while after the last mutation.

let _mutationSyncTimer: ReturnType<typeof setTimeout> | null = null;
const MUTATION_SYNC_DEBOUNCE_MS = 1500;

function scheduleMutationSync(): void {
  if (_mutationSyncTimer) clearTimeout(_mutationSyncTimer);
  _mutationSyncTimer = setTimeout(() => {
    _mutationSyncTimer = null;
    void (async () => {
      try {
        const userId = await getSyncUserId();
        if (!userId) return;
        await syncAll();
      } catch (err) {
        try {
          const stored = await chrome.storage.local.get('cloud_sync_status');
          const current = (stored['cloud_sync_status'] as Record<string, unknown>) ?? {};
          await chrome.storage.local.set({
            cloud_sync_status: { ...current, error: `Mutation sync failed: ${String(err)}` },
          });
        } catch {
          /* best-effort */
        }
      }
    })();
  }, MUTATION_SYNC_DEBOUNCE_MS);
}

async function handleSyncMutation(): Promise<MessageResponse> {
  scheduleMutationSync();
  return { success: true };
}

async function handleSaveSession(payload: {
  windowId?: number;
  name?: string;
  closeAfter?: boolean;
  allWindows?: boolean;
}): Promise<MessageResponse<SaveSessionResponse>> {
  if (payload.allWindows) {
    const windows = await chrome.windows.getAll({ populate: false });
    const sessions: Session[] = [];
    for (const win of windows) {
      if (!win.id) continue;
      const chromeTabs = await chrome.tabs.query({ windowId: win.id });
      if (chromeTabs.length === 0) continue;
      const chromeGroups = await chrome.tabGroups.query({ windowId: win.id });
      const { tabs, tabGroups } = captureTabGroups(chromeTabs, chromeGroups);
      const session = await SessionService.saveSession(tabs, tabGroups, {
        name: payload.name,
        windowId: win.id,
      });
      sessions.push(session);
    }
    return { success: true, data: { session: sessions, isDuplicate: false } };
  }

  const windowId = payload.windowId ?? (await getCurrentWindowId());
  const chromeTabs = await chrome.tabs.query({ windowId });
  const chromeGroups = await chrome.tabGroups.query({ windowId });

  const { tabs, tabGroups } = captureTabGroups(chromeTabs, chromeGroups);

  const tabUrls = chromeTabs.map((t) => t.url ?? '').filter(Boolean);
  const isDuplicate = await SessionService.checkDuplicate(tabUrls);

  const session = await SessionService.saveSession(tabs, tabGroups, {
    name: payload.name,
    windowId,
  });

  if (payload.closeAfter) {
    const tabIds = chromeTabs.map((t) => t.id).filter((id): id is number => id !== undefined);
    if (tabIds.length > 0) {
      await chrome.tabs.create({ windowId });
      await chrome.tabs.remove(tabIds);
    }
  }

  // Fire-and-forget sync — does not block the save response
  void syncAfterMutation(session);

  return { success: true, data: { session, isDuplicate } };
}

async function handleRestoreSession(payload: {
  sessionId: string;
  mode: 'new_window' | 'current' | 'append';
}): Promise<MessageResponse<{ failedUrls: string[] }>> {
  const session = await SessionService.getSession(payload.sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const failedUrls: string[] = [];
  // Sort all tabs by their original index so they open in the right order.
  // Groups and ungrouped tabs are interleaved exactly as they were at save time.
  const sortedTabs = [...session.tabs].sort((a, b) => a.index - b.index);

  // Track which newly created Chrome tab IDs belong to each saved group ID.
  const groupTabIds = new Map<number, number[]>();
  function trackGroupTab(savedGroupId: number, chromeTabId: number) {
    if (savedGroupId === -1) return;
    const list = groupTabIds.get(savedGroupId);
    if (list) list.push(chromeTabId);
    else groupTabIds.set(savedGroupId, [chromeTabId]);
  }

  let windowId: number;

  if (payload.mode === 'new_window') {
    const firstTab = sortedTabs[0];
    let win: chrome.windows.Window;
    try {
      win = await chrome.windows.create({ url: firstTab?.url ? (isValidUrl(firstTab.url) ? firstTab.url : undefined) : undefined, focused: true });
    } catch {
      return { success: false, error: 'Failed to create window' };
    }
    if (!win.id) return { success: false, error: 'Failed to create window' };
    windowId = win.id;
    // Capture the first tab's ID for group tracking
    const firstId = win.tabs?.[0]?.id;
    if (firstId && firstTab) trackGroupTab(firstTab.groupId, firstId);

    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];
      if (!isValidUrl(tab.url)) { failedUrls.push(tab.url); continue; }
      try {
        const created = await chrome.tabs.create({ url: tab.url, windowId, pinned: tab.pinned, active: false });
        if (created.id) trackGroupTab(tab.groupId, created.id);
      } catch {
        failedUrls.push(tab.url);
      }
    }
  } else {
    windowId = await getCurrentWindowId();
    const existing = payload.mode === 'current' ? await chrome.tabs.query({ windowId }) : [];

    for (const tab of sortedTabs) {
      if (!isValidUrl(tab.url)) { failedUrls.push(tab.url); continue; }
      try {
        const created = await chrome.tabs.create({ url: tab.url, windowId, pinned: tab.pinned, active: false });
        if (created.id) trackGroupTab(tab.groupId, created.id);
      } catch {
        failedUrls.push(tab.url);
      }
    }

    if (payload.mode === 'current' && existing.length > 0) {
      const existingIds = existing.map((t) => t.id).filter((id): id is number => id !== undefined);
      await chrome.tabs.remove(existingIds);
    }
  }

  // Re-apply tab groups. Sort groups by the index of their first tab so groups
  // are formed in the same order they appeared in the original tab strip.
  const sortedGroups = [...session.tabGroups].sort((a, b) => {
    const aMin = sortedTabs.find((t) => t.groupId === a.id)?.index ?? Infinity;
    const bMin = sortedTabs.find((t) => t.groupId === b.id)?.index ?? Infinity;
    return aMin - bMin;
  });

  for (const group of sortedGroups) {
    const tabIds = groupTabIds.get(group.id) ?? [];
    if (tabIds.length === 0) continue;
    const newGroupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(newGroupId, {
      title: group.title,
      color: group.color,
      collapsed: group.collapsed,
    });
  }

  // Activate the tab that was focused when the session was saved
  const activeSavedTab = sortedTabs.find((t) => t.active);
  if (activeSavedTab) {
    const allWindowTabs = await chrome.tabs.query({ windowId });
    const match = allWindowTabs.find((t) => t.url === activeSavedTab.url);
    if (match?.id) await chrome.tabs.update(match.id, { active: true });
  }

  return {
    success: true,
    data: failedUrls.length > 0 ? { failedUrls } : undefined,
  };
}

async function handleDeleteSession(payload: {
  sessionId: string;
}): Promise<MessageResponse> {
  const deleted = await SessionService.deleteSession(payload.sessionId);
  if (deleted) {
    void deleteRemoteSession(payload.sessionId);
  }
  return deleted
    ? { success: true }
    : { success: false, error: 'Session not found or locked' };
}

async function handleGetSessions(
  payload: { filter?: Parameters<typeof SessionService.getAllSessions>[0]; sort?: Parameters<typeof SessionService.getAllSessions>[1]; limit?: number; offset?: number },
): Promise<MessageResponse<GetSessionsResponse>> {
  const all = await SessionService.getAllSessions(payload.filter, payload.sort);
  const totalCount = all.length;
  const offset = payload.offset ?? 0;
  const sessions = payload.limit
    ? all.slice(offset, offset + payload.limit)
    : offset > 0 ? all.slice(offset) : all;
  return { success: true, data: { sessions, totalCount } };
}

async function handleGetCurrentTabs(): Promise<MessageResponse> {
  const windowId = await getCurrentWindowId();
  const tabs = await chrome.tabs.query({ windowId });
  const groups = await chrome.tabGroups.query({ windowId });
  return {
    success: true,
    data: {
      tabCount: tabs.length,
      groupCount: groups.length,
      windowId,
    },
  };
}

async function handleGetSettings(): Promise<MessageResponse> {
  const storage = getSettingsStorage();
  const settings = (await storage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? { ...DEFAULT_SETTINGS };
  return { success: true, data: settings };
}

async function handleUpdateSettings(
  updates: Partial<Settings>,
): Promise<MessageResponse> {
  const storage = getSettingsStorage();
  const current = (await storage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? { ...DEFAULT_SETTINGS };
  const updated = { ...current, ...updates };
  await storage.set(STORAGE_KEYS.SETTINGS, updated);
  return { success: true, data: updated };
}

async function handleAutoSaveStatus(): Promise<MessageResponse> {
  const storage = getSettingsStorage();
  const settings = (await storage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? DEFAULT_SETTINGS;
  const metadata = await storage.get<StorageMetadata>(STORAGE_KEYS.METADATA);
  return {
    success: true,
    data: {
      isActive: settings.enableAutoSave,
      lastAutoSave: metadata?.lastAutoSave ?? null,
    },
  };
}

async function handleUpdateSession(payload: {
  sessionId: string;
  updates: Partial<Session>;
}): Promise<MessageResponse<Session>> {
  const updated = await SessionService.updateSession(payload.sessionId, payload.updates);
  if (updated) {
    void syncAfterMutation(updated);
  }
  return updated
    ? { success: true, data: updated }
    : { success: false, error: 'Session not found' };
}

async function handleExportSessions(payload: {
  sessionIds: string[];
  format: string;
}): Promise<MessageResponse<string>> {
  const sessions: Session[] = [];
  for (const id of payload.sessionIds) {
    const session = await SessionService.getSession(id);
    if (session) sessions.push(session);
  }

  let data: string;
  switch (payload.format) {
    case 'html':
      data = exportAsHTML(sessions);
      break;
    case 'markdown':
      data = exportAsMarkdown(sessions);
      break;
    case 'csv':
      data = exportAsCSV(sessions);
      break;
    case 'text':
      data = exportAsText(sessions);
      break;
    case 'json':
    default:
      data = exportAsJSON(sessions);
      break;
  }

  return { success: true, data };
}

async function handleImportSessions(payload: {
  data: string;
  source: string;
}): Promise<MessageResponse> {
  if (payload.data.length > MAX_IMPORT_SIZE_BYTES) {
    return { success: false, error: 'Import data too large (max 5 MB)' };
  }

  let result;
  switch (payload.source) {
    case 'html':
      result = importFromHTML(payload.data);
      break;
    case 'url_list':
      result = importFromURLList(payload.data);
      break;
    case 'json':
    default:
      result = importFromJSON(payload.data);
      break;
  }

  const validSessions = result.sessions.filter(isValidSession);
  const invalidCount = result.sessions.length - validSessions.length;
  if (invalidCount > 0) {
    result.errors.push(`${invalidCount} session(s) failed schema validation and were skipped`);
  }

  const repo = getSessionRepository();
  await Promise.all(validSessions.map(s => repo.save(s)));

  return {
    success: validSessions.length > 0,
    data: { imported: validSessions.length, errors: result.errors },
    error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
  };
}

async function handleUndeleteSession(payload: {
  session: Session;
}): Promise<MessageResponse<Session>> {
  if (!isValidSession(payload.session)) {
    return { success: false, error: 'Invalid session data' };
  }
  const repo = getSessionRepository();
  await repo.save(payload.session);
  return { success: true, data: payload.session };
}

async function handleMergeSessions(payload: {
  sessionIds: string[];
  targetName: string;
}): Promise<MessageResponse<Session>> {
  const sessions: Session[] = [];
  for (const id of payload.sessionIds) {
    const s = await SessionService.getSession(id);
    if (s) sessions.push(s);
  }
  if (sessions.length < 2) return { success: false, error: 'Need at least 2 sessions to merge' };

  // Deduplicate tabs by URL, preserving first occurrence; flatten tab groups
  const seenUrls = new Set<string>();
  const mergedTabs = sessions.flatMap((session) =>
    session.tabs.filter((tab) => {
      if (seenUrls.has(tab.url)) return false;
      seenUrls.add(tab.url);
      return true;
    }).map((tab) => ({ ...tab, id: generateId(), groupId: -1 as const })),
  );

  const merged = await SessionService.saveSession(mergedTabs, [], {
    name: payload.targetName,
  });
  return { success: true, data: merged };
}

async function handleDiffSessions(payload: {
  sessionIdA: string;
  sessionIdB: string;
}): Promise<MessageResponse<SessionDiffResponse>> {
  const sessionA = await SessionService.getSession(payload.sessionIdA);
  const sessionB = await SessionService.getSession(payload.sessionIdB);
  if (!sessionA || !sessionB) return { success: false, error: 'Session not found' };

  const urlsA = new Set(sessionA.tabs.map((t) => t.url));
  const urlsB = new Set(sessionB.tabs.map((t) => t.url));

  const added = sessionB.tabs.filter((t) => !urlsA.has(t.url));
  const removed = sessionA.tabs.filter((t) => !urlsB.has(t.url));
  const unchanged = sessionA.tabs.filter((t) => urlsB.has(t.url));

  return { success: true, data: { added, removed, unchanged } };
}

async function handleRestoreSelectedTabs(payload: {
  sessionId: string;
  tabIds: string[];
  mode: 'new_window' | 'current' | 'append';
}): Promise<MessageResponse> {
  const session = await SessionService.getSession(payload.sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const selectedSet = new Set(payload.tabIds);
  const tabsToOpen = [...session.tabs]
    .filter((t) => selectedSet.has(t.id))
    .sort((a, b) => a.index - b.index);
  if (tabsToOpen.length === 0) return { success: false, error: 'No tabs selected' };

  const failedUrls: string[] = [];

  if (payload.mode === 'new_window') {
    const firstUrl = isValidUrl(tabsToOpen[0].url) ? tabsToOpen[0].url : undefined;
    let win: chrome.windows.Window;
    try {
      win = await chrome.windows.create({ url: firstUrl, focused: true });
    } catch {
      return { success: false, error: 'Failed to create window' };
    }
    if (!win.id) return { success: false, error: 'Failed to create window' };
    const windowId = win.id;
    for (let i = 1; i < tabsToOpen.length; i++) {
      if (!isValidUrl(tabsToOpen[i].url)) { failedUrls.push(tabsToOpen[i].url); continue; }
      try {
        await chrome.tabs.create({ url: tabsToOpen[i].url, windowId, pinned: tabsToOpen[i].pinned, active: false });
      } catch {
        failedUrls.push(tabsToOpen[i].url);
      }
    }
  } else {
    const windowId = await getCurrentWindowId();
    if (payload.mode === 'current') {
      const existing = await chrome.tabs.query({ windowId });
      for (const tab of tabsToOpen) {
        if (!isValidUrl(tab.url)) { failedUrls.push(tab.url); continue; }
        try {
          await chrome.tabs.create({ url: tab.url, windowId, pinned: tab.pinned, active: false });
        } catch {
          failedUrls.push(tab.url);
        }
      }
      const existingIds = existing.map((t) => t.id).filter((id): id is number => id !== undefined);
      if (existingIds.length > 0) await chrome.tabs.remove(existingIds);
    } else {
      for (const tab of tabsToOpen) {
        if (!isValidUrl(tab.url)) { failedUrls.push(tab.url); continue; }
        try {
          await chrome.tabs.create({ url: tab.url, windowId, pinned: tab.pinned, active: false });
        } catch {
          failedUrls.push(tab.url);
        }
      }
    }
  }

  return {
    success: true,
    data: failedUrls.length > 0 ? { failedUrls } : undefined,
  };
}

async function handleUpdateSessionTabs(payload: {
  sessionId: string;
}): Promise<MessageResponse<{ addedCount: number; removedCount: number }>> {
  const session = await SessionService.getSession(payload.sessionId);
  if (!session) return { success: false, error: 'Session not found' };

  const windowId = await getCurrentWindowId();
  const [chromeTabs, chromeGroups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
  ]);

  const { tabs: currentTabs, tabGroups: currentTabGroups } = captureTabGroups(chromeTabs, chromeGroups);

  const settingsStorage = getSettingsStorage();
  const settings = (await settingsStorage.get<Settings>(STORAGE_KEYS.SETTINGS)) ?? DEFAULT_SETTINGS;

  const existingUrls = new Set(session.tabs.map((t) => t.url));
  const currentUrls = new Set(currentTabs.map((t) => t.url));

  // Always add new tabs
  const newTabs = currentTabs.filter((t) => !existingUrls.has(t.url));
  let finalTabs = [...session.tabs, ...newTabs];
  let removedCount = 0;

  // Optionally remove tabs no longer open
  if (settings.removeClosedTabsOnUpdate) {
    const beforeLen = finalTabs.length;
    finalTabs = finalTabs.filter((t) => currentUrls.has(t.url));
    removedCount = beforeLen - finalTabs.length;
  }

  // Merge tab groups (add new ones by title+color key)
  const existingGroupKeys = new Set(session.tabGroups.map((g) => `${g.title}-${g.color}`));
  const newGroups = currentTabGroups.filter((g) => !existingGroupKeys.has(`${g.title}-${g.color}`));
  const finalGroups = [...session.tabGroups, ...newGroups];

  await SessionService.updateSession(payload.sessionId, {
    tabs: finalTabs,
    tabGroups: finalGroups,
    tabCount: finalTabs.length,
  });

  return { success: true, data: { addedCount: newTabs.length, removedCount } };
}

async function handleOpenDownload(payload: { downloadId: number }): Promise<MessageResponse> {
  try {
    chrome.downloads.open(payload.downloadId);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function handleShowDownload(payload: { downloadId: number }): Promise<MessageResponse> {
  try {
    chrome.downloads.show(payload.downloadId);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getCurrentWindowId(): Promise<number> {
  const window = await chrome.windows.getCurrent();
  if (!window.id) throw new Error('Could not determine current window ID');
  return window.id;
}

// ─── Cloud Sync handlers ─────────────────────────────────────────────────────

async function handleSyncGetStatus(): Promise<MessageResponse> {
  const status = await getSyncStatus();
  return { success: true, data: status };
}

async function handleSyncSignIn(payload: {
  email: string;
  password: string;
}): Promise<MessageResponse<SyncSignInResponse>> {
  const result = await syncSignIn(payload.email, payload.password);

  if (!result.success) {
    return { success: false, data: result, error: result.error };
  }

  const userId = await getSyncUserId();

  if (!userId) {
    // Session not yet readable — degrade gracefully (skip pulls).
    await chrome.storage.local.set({ cloud_last_pull_at: Date.now() });
    return { success: true, data: { success: true, email: result.email } };
  }

  // Run entity pull and dashboard config fetch in parallel.
  const [pullOutcome, dashOutcome] = await Promise.allSettled([
    pullAll(),
    pullDashboard(userId),
  ]);

  const pull =
    pullOutcome.status === 'fulfilled' && pullOutcome.value.success
      ? pullOutcome.value.pulled
      : null;

  const dashValue = dashOutcome.status === 'fulfilled' ? dashOutcome.value : null;
  const hasConfig = dashValue?.success === true && typeof dashValue.config === 'string';

  if (hasConfig && dashValue?.config) {
    try {
      JSON.parse(dashValue.config); // validate before storing
      await chrome.storage.local.set({ pending_dashboard_restore: dashValue.config });
    } catch {
      // malformed JSON — skip
    }
  }

  // Signal newtab pages to reload. Written AFTER pending_dashboard_restore so the
  // key is already in storage when the onChanged listener fires on open pages.
  await chrome.storage.local.set({ cloud_last_pull_at: Date.now() });

  return {
    success: true,
    data: {
      success: true,
      email: result.email,
      pulled: pull ?? { sessions: 0, prompts: 0, subs: 0, tabGroups: 0, folders: 0, todos: 0 },
      hasDashboardConfig: hasConfig,
    },
  };
}

async function handleSyncSignOut(): Promise<MessageResponse> {
  await syncSignOut();
  return { success: true };
}

async function handleSyncNow(): Promise<MessageResponse> {
  // Bidirectional: pull remote changes down FIRST, then push local data up.
  // Pull-first is critical: if local state is smaller than remote (e.g. local
  // IDB was cleared, a previous sync truncated local, or this is a fresh
  // install on a second device), pushing first would NOT delete remote rows
  // (orphan-delete has been removed) but pulling first still ensures the user
  // sees their cloud data immediately rather than waiting for the next pull
  // tick. The push afterwards is a no-op if nothing changed locally.
  const pullResult = await pullAll();
  if (pullResult.success) {
    try { await chrome.storage.local.set({ cloud_last_pull_at: Date.now() }); } catch {}
  }
  const syncResult = await syncAll();
  if (!syncResult.success) return { success: false, error: syncResult.error };
  const status = await getSyncStatus();
  return { success: true, data: status };
}

async function handleSyncPush(): Promise<MessageResponse> {
  // Push-only: upload local changes without pulling remote data back.
  // Used by mutation handlers to avoid a full data reload overwriting
  // the optimistic UI update that was already applied.
  const syncResult = await syncAll();
  return { success: syncResult.success, error: syncResult.error };
}

async function handleSyncDashboard(payload: { config: string }): Promise<MessageResponse<DashboardSyncResponse>> {
  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated', data: { success: false, syncsUsedThisMonth: 0, syncsLimit: 0, error: 'Not authenticated' } };
  }
  const result = await syncDashboard(payload.config, userId);
  return { success: result.success, data: result, error: result.error };
}

async function handlePullDashboard(): Promise<MessageResponse<DashboardSyncResponse>> {
  const userId = await getSyncUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated', data: { success: false, syncsUsedThisMonth: 0, syncsLimit: 0, error: 'Not authenticated' } };
  }
  const result = await pullDashboard(userId);
  return { success: result.success, data: result, error: result.error };
}

async function handlePullAll(): Promise<MessageResponse> {
  const userId = await getSyncUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };
  // Pull first so that deletions made on other devices are applied locally before
  // we push. This prevents a stale device from reviving remotely-deleted items.
  // SYNC_PUSH (fired on every mutation) ensures our own deletions are already on
  // Supabase by the time the user triggers a manual Restore.
  const result = await pullAll();
  if (result.success) {
    try { await chrome.storage.local.set({ cloud_last_pull_at: Date.now() }); } catch {}
  }
  // Push after pull so any new local items/changes reach Supabase.
  await syncAll();
  return { success: result.success, data: result, error: result.error };
}

// ─── Phase 2: Selective sync + mass-delete handlers ─────────────────────────

async function handleSyncGetSettings(): Promise<MessageResponse> {
  const settings = await getSelectiveSyncSettings();
  return { success: true, data: settings };
}

async function handleSyncUpdateSettings(payload: {
  syncEnabled?: boolean;
  entities?: Record<string, boolean>;
}): Promise<MessageResponse> {
  // Only allow known entity keys through.
  const filteredEntities: Partial<Record<SyncEntityKey, boolean>> = {};
  if (payload.entities) {
    for (const key of ALL_SYNC_ENTITY_KEYS) {
      if (key in payload.entities) filteredEntities[key] = !!payload.entities[key];
    }
  }
  const next = await updateSelectiveSyncSettings({
    syncEnabled: payload.syncEnabled,
    entities: filteredEntities as Record<SyncEntityKey, boolean>,
  });
  return { success: true, data: next };
}

async function handleSyncPause(payload: {
  minutes: number;
  reason?: string;
}): Promise<MessageResponse> {
  const minutes = Math.max(1, Math.min(payload.minutes | 0, 60 * 24 * 7));
  await pauseSyncFor(minutes, payload.reason);
  const settings = await getSelectiveSyncSettings();
  return { success: true, data: settings };
}

async function handleSyncClearPause(): Promise<MessageResponse> {
  await clearPause();
  const settings = await getSelectiveSyncSettings();
  return { success: true, data: settings };
}

async function handleSyncGetMassDeleteTrips(): Promise<MessageResponse> {
  const trips = await getMassDeleteTrips();
  return { success: true, data: trips };
}

async function handleSyncClearMassDeleteTrip(payload: {
  entity: string;
}): Promise<MessageResponse> {
  if (!(ALL_SYNC_ENTITY_KEYS as readonly string[]).includes(payload.entity)) {
    return { success: false, error: 'Unknown entity key' };
  }
  await clearMassDeleteTrip(payload.entity as SyncEntityKey);
  return { success: true };
}

async function handleSyncClearAllMassDeleteTrips(): Promise<MessageResponse> {
  await clearAllMassDeleteTrips();
  return { success: true };
}

async function handleSyncGetDirtyCounts(): Promise<MessageResponse> {
  try {
    const engine = getSyncEngine();
    const counts = await engine.getDirtyCounts();
    return { success: true, data: counts };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Fire-and-forget helper: push a single session to Supabase after a local mutation.
 * Does NOT block the caller. On failure, writes the error to the persisted sync
 * status so CloudSyncView can surface it next time the user opens the panel.
 */
async function syncAfterMutation(session: Session): Promise<void> {
  try {
    const userId = await getSyncUserId();
    if (!userId) return;
    await pushSession(session, userId);
  } catch (err) {
    try {
      const stored = await chrome.storage.local.get('cloud_sync_status');
      const current = (stored['cloud_sync_status'] as Record<string, unknown>) ?? {};
      await chrome.storage.local.set({
        cloud_sync_status: { ...current, error: `Background sync failed: ${String(err)}` },
      });
    } catch {
      // Best-effort — don't crash the service worker over a status write
    }
  }
}
