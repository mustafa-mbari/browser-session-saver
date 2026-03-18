import type { Session } from '@core/types/session.types';

interface ExportEnvelope {
  version: string;
  exportedAt: string;
  sessionCount: number;
  sessions: Session[];
}

export function exportAsJSON(sessions: Session[]): string {
  const envelope: ExportEnvelope = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    sessions,
  };
  return JSON.stringify(envelope, null, 2);
}

export function exportAsHTML(sessions: Session[]): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Browser Hub Export</TITLE>',
    '<H1>Browser Hub Export</H1>',
    '<DL><p>',
  ];

  for (const session of sessions) {
    const timestamp = Math.floor(new Date(session.createdAt).getTime() / 1000);
    lines.push(`  <DT><H3 ADD_DATE="${timestamp}">${escapeHtml(session.name)}</H3>`);
    lines.push('  <DL><p>');

    // Group tabs by tab group
    const grouped = new Map<number, typeof session.tabs>();
    for (const tab of session.tabs) {
      const key = tab.groupId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tab);
    }

    for (const [groupId, tabs] of grouped) {
      const group = session.tabGroups.find((g) => g.id === groupId);
      if (group) {
        lines.push(`    <DT><H3>${escapeHtml(group.title || 'Group')}</H3>`);
        lines.push('    <DL><p>');
      }

      for (const tab of tabs) {
        lines.push(
          `      <DT><A HREF="${escapeHtml(tab.url)}" ADD_DATE="${timestamp}">${escapeHtml(tab.title || tab.url)}</A>`,
        );
      }

      if (group) {
        lines.push('    </DL><p>');
      }
    }

    lines.push('  </DL><p>');
  }

  lines.push('</DL><p>');
  return lines.join('\n');
}

export function exportAsMarkdown(sessions: Session[]): string {
  const lines: string[] = ['# Browser Hub Export', ''];

  for (const session of sessions) {
    lines.push(`## ${session.name}`);
    lines.push(`*${session.createdAt} — ${session.tabCount} tabs*`);
    lines.push('');

    for (const group of session.tabGroups) {
      const groupTabs = session.tabs.filter((t) => t.groupId === group.id);
      if (groupTabs.length > 0) {
        lines.push(`### ${group.title || 'Group'} (${group.color})`);
        for (const tab of groupTabs) {
          lines.push(`- [${tab.title || tab.url}](${tab.url})`);
        }
        lines.push('');
      }
    }

    const ungrouped = session.tabs.filter((t) => t.groupId === -1);
    if (ungrouped.length > 0) {
      if (session.tabGroups.length > 0) lines.push('### Ungrouped');
      for (const tab of ungrouped) {
        lines.push(`- [${tab.title || tab.url}](${tab.url})`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function exportAsCSV(sessions: Session[]): string {
  const rows: string[] = ['Session,Group,Title,URL,Pinned,Created'];

  for (const session of sessions) {
    for (const tab of session.tabs) {
      const group = session.tabGroups.find((g) => g.id === tab.groupId);
      rows.push(
        [
          csvEscape(session.name),
          csvEscape(group?.title ?? ''),
          csvEscape(tab.title),
          csvEscape(tab.url),
          tab.pinned ? 'Yes' : 'No',
          session.createdAt,
        ].join(','),
      );
    }
  }

  return rows.join('\n');
}

export function exportAsText(sessions: Session[]): string {
  const urls: string[] = [];
  for (const session of sessions) {
    for (const tab of session.tabs) {
      urls.push(tab.url);
    }
  }
  return urls.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function csvEscape(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
