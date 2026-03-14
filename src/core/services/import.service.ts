import type { Session, Tab } from '@core/types/session.types';
import { isValidSession, isValidUrl } from '@core/utils/validators';
import { generateId } from '@core/utils/uuid';
import { nowISO } from '@core/utils/date';
import { CURRENT_SCHEMA_VERSION } from '@core/types/storage.types';

interface ImportResult {
  sessions: Session[];
  errors: string[];
}

export function importFromJSON(jsonString: string): ImportResult {
  const errors: string[] = [];
  const sessions: Session[] = [];

  try {
    const parsed = JSON.parse(jsonString);
    const data = parsed.sessions ?? (Array.isArray(parsed) ? parsed : [parsed]);

    for (let i = 0; i < data.length; i++) {
      const raw = data[i];
      if (isValidSession(raw)) {
        const now = nowISO();
        sessions.push({
          id: generateId(),
          name: String(raw.name ?? 'Imported Session'),
          createdAt: String(raw.createdAt ?? now),
          updatedAt: now,
          tabs: Array.isArray(raw.tabs) ? raw.tabs.map((t: Tab) => ({
            id: generateId(),
            url: String(t.url),
            title: String(t.title ?? t.url),
            favIconUrl: String(t.favIconUrl ?? ''),
            index: Number(t.index ?? 0),
            pinned: Boolean(t.pinned),
            groupId: Number(t.groupId ?? -1),
            active: false,
            scrollPosition: { x: 0, y: 0 },
          })) : [],
          tabGroups: Array.isArray(raw.tabGroups) ? raw.tabGroups : [],
          windowId: Number(raw.windowId ?? -1),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          isPinned: Boolean(raw.isPinned),
          isStarred: Boolean(raw.isStarred),
          isLocked: false,
          isAutoSave: Boolean(raw.isAutoSave),
          autoSaveTrigger: raw.autoSaveTrigger ?? 'manual',
          notes: String(raw.notes ?? ''),
          tabCount: Array.isArray(raw.tabs) ? raw.tabs.length : 0,
          version: CURRENT_SCHEMA_VERSION,
        });
      } else {
        errors.push(`Item ${i + 1}: Invalid session format`);
      }
    }
  } catch (e) {
    errors.push(`Parse error: ${String(e)}`);
  }

  return { sessions, errors };
}

export function importFromHTML(htmlString: string): ImportResult {
  const errors: string[] = [];
  const sessions: Session[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const folders = doc.querySelectorAll('DT > H3');

    folders.forEach((folder) => {
      const name = folder.textContent?.trim() || 'Imported Session';
      const dl = folder.nextElementSibling;
      if (!dl || dl.tagName !== 'DL') return;

      const tabs: Tab[] = [];
      const links = dl.querySelectorAll('DT > A');

      links.forEach((link, index) => {
        const url = link.getAttribute('HREF') ?? '';
        if (!isValidUrl(url)) return;

        tabs.push({
          id: generateId(),
          url,
          title: link.textContent?.trim() || url,
          favIconUrl: '',
          index,
          pinned: false,
          groupId: -1,
          active: false,
          scrollPosition: { x: 0, y: 0 },
        });
      });

      if (tabs.length > 0) {
        const now = nowISO();
        sessions.push({
          id: generateId(),
          name,
          createdAt: now,
          updatedAt: now,
          tabs,
          tabGroups: [],
          windowId: -1,
          tags: ['imported'],
          isPinned: false,
          isStarred: false,
          isLocked: false,
          isAutoSave: false,
          autoSaveTrigger: 'manual',
          notes: '',
          tabCount: tabs.length,
          version: CURRENT_SCHEMA_VERSION,
        });
      }
    });

    if (sessions.length === 0) {
      errors.push('No valid bookmark folders found in HTML');
    }
  } catch (e) {
    errors.push(`Parse error: ${String(e)}`);
  }

  return { sessions, errors };
}

export function importFromURLList(text: string): ImportResult {
  const errors: string[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const tabs: Tab[] = [];
  lines.forEach((url, index) => {
    if (isValidUrl(url)) {
      tabs.push({
        id: generateId(),
        url,
        title: url,
        favIconUrl: '',
        index,
        pinned: false,
        groupId: -1,
        active: false,
        scrollPosition: { x: 0, y: 0 },
      });
    } else {
      errors.push(`Line ${index + 1}: Invalid URL "${url}"`);
    }
  });

  const sessions: Session[] = [];
  if (tabs.length > 0) {
    const now = nowISO();
    sessions.push({
      id: generateId(),
      name: `Imported URLs — ${new Date().toLocaleDateString()}`,
      createdAt: now,
      updatedAt: now,
      tabs,
      tabGroups: [],
      windowId: -1,
      tags: ['imported'],
      isPinned: false,
      isStarred: false,
      isLocked: false,
      isAutoSave: false,
      autoSaveTrigger: 'manual',
      notes: '',
      tabCount: tabs.length,
      version: CURRENT_SCHEMA_VERSION,
    });
  }

  return { sessions, errors };
}
