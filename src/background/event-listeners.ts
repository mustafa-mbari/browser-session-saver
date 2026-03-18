import type { Message, MessageResponse, SessionDiffResponse, SaveSessionResponse, GetSessionsResponse } from '@core/types/messages.types';
import type { Session } from '@core/types/session.types';
import type { Settings } from '@core/types/settings.types';
import { STORAGE_KEYS } from '@core/types/storage.types';
import type { StorageMetadata } from '@core/types/storage.types';
import * as SessionService from '@core/services/session.service';
import { captureTabGroups } from '@core/services/tab-group.service';
import { getSettingsStorage, getSessionStorage } from '@core/storage/storage-factory';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { exportAsJSON, exportAsHTML, exportAsMarkdown, exportAsCSV, exportAsText } from '@core/services/export.service';
import { importFromJSON, importFromHTML, importFromURLList } from '@core/services/import.service';
import { generateId } from '@core/utils/uuid';

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
    default:
      return { success: false, error: 'Unknown action' };
  }
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
    const win = await chrome.windows.create({ url: firstTab?.url, focused: true });
    windowId = win.id!;
    // Capture the first tab's ID for group tracking
    const firstId = win.tabs?.[0]?.id;
    if (firstId && firstTab) trackGroupTab(firstTab.groupId, firstId);

    for (let i = 1; i < sortedTabs.length; i++) {
      const tab = sortedTabs[i];
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
      lastTrigger: null,
    },
  };
}

async function handleUpdateSession(payload: {
  sessionId: string;
  updates: Partial<Session>;
}): Promise<MessageResponse<Session>> {
  const updated = await SessionService.updateSession(payload.sessionId, payload.updates);
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

  const storage = getSessionStorage();
  for (const session of result.sessions) {
    await storage.set(session.id, session);
  }

  return {
    success: result.sessions.length > 0,
    data: { imported: result.sessions.length, errors: result.errors },
    error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
  };
}

async function handleUndeleteSession(payload: {
  session: Session;
}): Promise<MessageResponse<Session>> {
  const storage = getSessionStorage();
  await storage.set(payload.session.id, payload.session);
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
    const firstUrl = tabsToOpen[0].url;
    const window = await chrome.windows.create({ url: firstUrl, focused: true });
    const windowId = window.id!;
    for (let i = 1; i < tabsToOpen.length; i++) {
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

async function getCurrentWindowId(): Promise<number> {
  const window = await chrome.windows.getCurrent();
  return window.id!;
}
