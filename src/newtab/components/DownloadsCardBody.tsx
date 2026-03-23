import { useEffect, useState, useCallback } from 'react';
import type { SpanValue } from '@core/types/newtab.types';

interface Props {
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

interface DownloadItem {
  id: number;
  filename: string;
  url: string;
  fileSize: number;
  state: string;
  startTime: string;
  mime: string;
}

const MAX_ITEMS = 5;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getFileIcon(mime: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return '🖼️';
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return '🎬';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) return '🎵';
  if (mime === 'application/pdf' || ext === 'pdf') return '📄';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return '📦';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return '📊';
  if (['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'appimage'].includes(ext)) return '⚙️';
  return '📎';
}

function getBaseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DownloadsCardBody({ colSpan: _colSpan, rowSpan: _rowSpan }: Props) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await chrome.downloads.search({ orderBy: ['-startTime'], limit: MAX_ITEMS });
      setDownloads(
        items.map((item) => ({
          id: item.id,
          filename: item.filename,
          url: item.url,
          fileSize: item.fileSize,
          state: item.state,
          startTime: item.startTime,
          mime: item.mime ?? '',
        })),
      );
    } catch {
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-6">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }}
          role="status"
          aria-label="Loading downloads"
        />
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-6 gap-2 text-center">
        <span className="text-3xl" role="img" aria-label="No downloads">📭</span>
        <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>No recent downloads</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ul className="flex-1 overflow-y-auto">
        {downloads.map((item) => {
          const name = getBaseName(item.filename);
          const icon = getFileIcon(item.mime, name);
          const isComplete = item.state === 'complete';
          const isInterrupted = item.state === 'interrupted';
          const isInProgress = item.state === 'in_progress';

          return (
            <li
              key={item.id}
              className="flex items-center gap-2 px-3 py-2 group transition-colors hover:bg-white/5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-base shrink-0 leading-none" role="img" aria-hidden="true">
                {icon}
              </span>

              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: 'var(--newtab-text)' }}
                  title={name}
                >
                  {name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}>
                    {formatBytes(item.fileSize)}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.3 }}>·</span>
                  <span className="text-[10px]" style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}>
                    {formatRelativeTime(item.startTime)}
                  </span>
                </div>
              </div>

              {/* State indicator */}
              {isInProgress && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                  style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                  title="Downloading"
                >
                  ↓
                </span>
              )}
              {isInterrupted && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                  title="Failed"
                >
                  ✕
                </span>
              )}

              {/* Hover actions for completed downloads */}
              {isComplete && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => {
                      try { chrome.downloads.open(item.id); }
                      catch (e) { console.error('[Downloads] open failed:', e); }
                    }}
                    className="p-1 rounded transition-colors hover:bg-white/10"
                    title="Open file"
                    aria-label="Open file"
                    style={{ color: 'var(--newtab-text-secondary)' }}
                  >
                    {/* External link icon */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      try { chrome.downloads.show(item.id); }
                      catch (e) { console.error('[Downloads] show failed:', e); }
                    }}
                    className="p-1 rounded transition-colors hover:bg-white/10"
                    title="Show in folder"
                    aria-label="Show in folder"
                    style={{ color: 'var(--newtab-text-secondary)' }}
                  >
                    {/* Folder icon */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div
        className="px-3 py-1.5 flex items-center justify-between shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px] opacity-40" style={{ color: 'var(--newtab-text-secondary)' }}>
          Last {downloads.length} download{downloads.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { void load(); }}
          className="text-[10px] opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--newtab-text-secondary)' }}
          title="Refresh"
          aria-label="Refresh downloads"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
