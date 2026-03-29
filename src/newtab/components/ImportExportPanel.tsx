import { useState, useRef, useCallback, useEffect } from 'react';
import { Download, Upload, FileJson, FileText, FileSpreadsheet, FileCode, File, Cloud, CloudDownload } from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { ExportFormat, DashboardSyncResponse } from '@core/types/messages.types';
import { PromptStorage } from '@core/storage/prompt-storage';

const EXPORT_FORMATS: { key: ExportFormat; label: string; desc: string; icon: typeof FileJson }[] = [
  { key: 'json', label: 'JSON', desc: 'Full backup with all metadata', icon: FileJson },
  { key: 'html', label: 'HTML', desc: 'Netscape bookmark format', icon: FileCode },
  { key: 'markdown', label: 'Markdown', desc: 'Readable text with links', icon: FileText },
  { key: 'csv', label: 'CSV', desc: 'Spreadsheet compatible', icon: FileSpreadsheet },
  { key: 'text', label: 'Plain Text', desc: 'URL list, one per line', icon: File },
];

const EXT: Record<string, string> = { json: 'json', html: 'html', markdown: 'md', csv: 'csv', text: 'txt' };
const MIME: Record<string, string> = {
  json: 'application/json',
  html: 'text/html',
  markdown: 'text/markdown',
  csv: 'text/csv',
  text: 'text/plain',
};

export default function ImportExportPanel() {
  const { sessions, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dashboard export/import state
  const [exportingDashboard, setExportingDashboard] = useState(false);
  const [importingDashboard, setImportingDashboard] = useState(false);
  const [dashboardImportResult, setDashboardImportResult] = useState<string | null>(null);
  const [showDashboardWarning, setShowDashboardWarning] = useState(false);
  const dashboardFileRef = useRef<HTMLInputElement>(null);

  // Cloud dashboard sync state
  const [syncingDashboard, setSyncingDashboard] = useState(false);
  const [pullingDashboard, setPullingDashboard] = useState(false);
  const [cloudSyncResult, setCloudSyncResult] = useState<string | null>(null);
  const [cloudSyncQuota, setCloudSyncQuota] = useState<{ used: number; limit: number } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleExport = async () => {
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: sessions.map((s) => s.id), format: exportFormat },
    });
    if (response.success && response.data) {
      const blob = new Blob([response.data as string], { type: MIME[exportFormat] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `browser-hub-export.${EXT[exportFormat]}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const processFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const source = file.name.endsWith('.json') ? 'json' : file.name.endsWith('.html') ? 'html' : 'url_list';
      const response = await sendMessage<{ imported: number; errors: string[] }>({
        action: 'IMPORT_SESSIONS',
        payload: { data: text, source },
      });
      if (response.success && response.data) {
        setImportResult(response.data);
        await refreshSessions();
      } else {
        setImportResult({ imported: 0, errors: [response.error ?? 'Import failed'] });
      }
    } catch {
      setImportResult({ imported: 0, errors: ['Failed to read file'] });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [sendMessage, refreshSessions]);

  const handleExportDashboard = async () => {
    setExportingDashboard(true);
    try {
      const { exportDashboardAsJSON } = await import('@core/services/newtab-export.service');
      const json = await exportDashboardAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `browser-hub-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail
    }
    setExportingDashboard(false);
  };

  useEffect(() => {
    void (async () => {
      const res = await sendMessage<{ isAuthenticated: boolean; quota: { dashboard_syncs_limit: number | null } | null; usage: { dashboardSyncsThisMonth?: number } | null }>({
        action: 'SYNC_GET_STATUS',
        payload: {},
      });
      if (res.success && res.data) {
        setIsAuthenticated(res.data.isAuthenticated);
        const limit = res.data.quota?.dashboard_syncs_limit ?? 0;
        // usage comes from get_user_usage which is fetched in the web dashboard,
        // not directly from the extension status. We start with used=0 and update after sync.
        setCloudSyncQuota((prev) => prev ?? (res.data!.isAuthenticated ? { used: 0, limit } : null));
      }
    })();
  }, [sendMessage]);

  const handleSyncDashboardToCloud = async () => {
    setSyncingDashboard(true);
    setCloudSyncResult(null);
    try {
      const { exportDashboardAsJSON } = await import('@core/services/newtab-export.service');
      const config = await exportDashboardAsJSON();
      const res = await sendMessage<DashboardSyncResponse>({
        action: 'SYNC_DASHBOARD',
        payload: { config },
      });
      if (res.success && res.data) {
        const d = res.data;
        setCloudSyncQuota({ used: d.syncsUsedThisMonth, limit: d.syncsLimit });
        setCloudSyncResult(`Dashboard synced to cloud. (${d.syncsUsedThisMonth}/${d.syncsLimit} syncs used this month)`);
      } else {
        setCloudSyncResult(res.data?.error ?? res.error ?? 'Sync failed');
      }
    } catch {
      setCloudSyncResult('Failed to sync dashboard');
    }
    setSyncingDashboard(false);
  };

  const handlePullDashboardFromCloud = async () => {
    setPullingDashboard(true);
    setCloudSyncResult(null);
    try {
      const res = await sendMessage<DashboardSyncResponse>({
        action: 'PULL_DASHBOARD',
        payload: {},
      });
      if (res.success && res.data?.config) {
        const { importDashboardFromJSON } = await import('@core/services/newtab-export.service');
        const result = await importDashboardFromJSON(res.data.config);
        if (result.success && result.counts) {
          const { boards, categories, entries, todoItems } = result.counts;
          setCloudSyncResult(
            `Restored from cloud: ${boards} board${boards !== 1 ? 's' : ''}, ` +
            `${categories} widget${categories !== 1 ? 's' : ''}, ` +
            `${entries} bookmark${entries !== 1 ? 's' : ''}, ` +
            `${todoItems} todo item${todoItems !== 1 ? 's' : ''}. Reloading…`,
          );
          await Promise.all([
            PromptStorage.seedAppFolders(),
            PromptStorage.seedDemoData(),
          ]);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setCloudSyncResult(result.error ?? 'Import failed');
        }
      } else {
        setCloudSyncResult(res.data?.error ?? res.error ?? 'No cloud backup found');
      }
    } catch {
      setCloudSyncResult('Failed to restore dashboard');
    }
    setPullingDashboard(false);
  };

  const processDashboardFile = useCallback(async (file: File) => {
    setImportingDashboard(true);
    setDashboardImportResult(null);
    try {
      const text = await file.text();
      const { importDashboardFromJSON } = await import('@core/services/newtab-export.service');
      const result = await importDashboardFromJSON(text);
      if (result.success && result.counts) {
        const { boards, categories, entries, todoItems } = result.counts;
        setDashboardImportResult(
          `Imported: ${boards} board${boards !== 1 ? 's' : ''}, ` +
          `${categories} widget${categories !== 1 ? 's' : ''}, ` +
          `${entries} bookmark${entries !== 1 ? 's' : ''}, ` +
          `${todoItems} todo item${todoItems !== 1 ? 's' : ''}. Reloading…`,
        );
        // Ensure prompts exist before reload so any Prompts widget renders correctly.
        // seedDemoData is idempotent — it skips IDs that already exist.
        await Promise.all([
          PromptStorage.seedAppFolders(),
          PromptStorage.seedDemoData(),
        ]);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setDashboardImportResult(result.error ?? 'Import failed');
      }
    } catch {
      setDashboardImportResult('Failed to read file');
    }
    setImportingDashboard(false);
    setShowDashboardWarning(false);
    if (dashboardFileRef.current) dashboardFileRef.current.value = '';
  }, []);

  return (
    <div className="pt-4 w-full">
      <h2 className="text-xl font-semibold mb-5" style={{ color: 'var(--newtab-text)' }}>
        Import / Export
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Export Sessions ── */}
        <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
            <Download size={15} className="opacity-70" />
            Export Sessions
          </h3>
          <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
            Export all {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>

          <div className="flex flex-col gap-1.5">
            {EXPORT_FORMATS.map(({ key, label, desc, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setExportFormat(key)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  exportFormat === key ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Icon size={15} style={{ color: exportFormat === key ? 'var(--newtab-text)' : 'var(--newtab-text-secondary)' }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--newtab-text)' }}>{label}</p>
                  <p className="text-[11px]" style={{ color: 'var(--newtab-text-secondary)' }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { void handleExport(); }}
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/25"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--newtab-text)' }}
          >
            <Download size={14} />
            Export as {EXPORT_FORMATS.find((f) => f.key === exportFormat)?.label}
          </button>
        </div>

        {/* ── Import Sessions ── */}
        <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
            <Upload size={15} className="opacity-70" />
            Import Sessions
          </h3>

          <div
            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void processFile(file);
            }}
          >
            <Upload size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--newtab-text)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>
              Drop a file or click to browse
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--newtab-text-secondary)' }}>
              JSON, HTML bookmarks, URL list (.txt)
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,.html,.txt"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f); }}
            className="hidden"
          />

          {importing && (
            <p className="text-xs text-center" style={{ color: 'var(--newtab-text-secondary)' }}>
              Importing...
            </p>
          )}

          {importResult && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: importResult.imported > 0 ? 'rgba(52,200,89,0.15)' : 'rgba(255,69,58,0.15)',
                color: importResult.imported > 0 ? '#34c859' : '#ff453a',
              }}
            >
              {importResult.imported > 0 && (
                <p>Imported {importResult.imported} session{importResult.imported !== 1 ? 's' : ''}</p>
              )}
              {importResult.errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
              {importResult.errors.length > 3 && (
                <p>…and {importResult.errors.length - 3} more</p>
              )}
            </div>
          )}
        </div>

        {/* ── Export Dashboard ── */}
        <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
            <Download size={15} className="opacity-70" />
            Export Dashboard
          </h3>
          <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
            Exports all boards, widgets, bookmarks, quick links, todo lists, and settings as a
            JSON file. Wallpaper images are not included.
          </p>

          <button
            onClick={() => { void handleExportDashboard(); }}
            disabled={exportingDashboard}
            className="mt-auto flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/25 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--newtab-text)' }}
          >
            {exportingDashboard ? (
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export Dashboard as JSON
          </button>
        </div>

        {/* ── Import Dashboard ── */}
        <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
            <Upload size={15} className="opacity-70" />
            Import Dashboard
          </h3>

          {!showDashboardWarning ? (
            <>
              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{ background: 'rgba(255,159,10,0.15)', color: 'rgba(255,159,10,0.9)' }}
              >
                <strong>This will replace all existing dashboard data</strong> — boards, widgets,
                bookmarks, quick links, and todos. This cannot be undone. Wallpaper images will
                not be affected.
              </div>
              <button
                onClick={() => setShowDashboardWarning(true)}
                className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-500/30"
                style={{ background: 'rgba(255,69,58,0.2)', color: '#ff453a' }}
              >
                I understand, choose a file
              </button>
            </>
          ) : (
            <>
              <div
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
                onClick={() => dashboardFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void processDashboardFile(file);
                }}
              >
                <Upload size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--newtab-text)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>
                  Drop dashboard JSON or click to browse
                </p>
              </div>
              <input
                ref={dashboardFileRef}
                type="file"
                accept=".json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void processDashboardFile(f); }}
                className="hidden"
              />
            </>
          )}

          {importingDashboard && (
            <p className="text-xs text-center" style={{ color: 'var(--newtab-text-secondary)' }}>
              Importing dashboard data...
            </p>
          )}

          {dashboardImportResult && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: dashboardImportResult.includes('Imported') ? 'rgba(52,200,89,0.15)' : 'rgba(255,69,58,0.15)',
                color: dashboardImportResult.includes('Imported') ? '#34c859' : '#ff453a',
              }}
            >
              {dashboardImportResult}
            </div>
          )}

          {/* ── Cloud Sync ── */}
          <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
            <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--newtab-text)' }}>
              <Cloud size={13} className="opacity-70" />
              Cloud Sync
            </h4>

            {!isAuthenticated ? (
              <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
                Sign in to Cloud Sync to back up and restore your dashboard.
              </p>
            ) : cloudSyncQuota?.limit === 0 ? (
              <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
                Dashboard sync requires a Pro or Max plan.
              </p>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => { void handleSyncDashboardToCloud(); }}
                    disabled={syncingDashboard || (cloudSyncQuota != null && cloudSyncQuota.used >= cloudSyncQuota.limit)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20 disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--newtab-text)' }}
                  >
                    {syncingDashboard ? (
                      <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Cloud size={12} />
                    )}
                    Sync to Cloud
                  </button>
                  <button
                    onClick={() => { void handlePullDashboardFromCloud(); }}
                    disabled={pullingDashboard}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/20 disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--newtab-text)' }}
                  >
                    {pullingDashboard ? (
                      <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CloudDownload size={12} />
                    )}
                    Restore from Cloud
                  </button>
                </div>

                {cloudSyncQuota && (
                  <p className="text-[11px]" style={{ color: 'var(--newtab-text-secondary)' }}>
                    {cloudSyncQuota.used}/{cloudSyncQuota.limit} syncs used this month
                    {cloudSyncQuota.used >= cloudSyncQuota.limit && ' — limit reached, resets on the 1st'}
                  </p>
                )}
              </>
            )}

            {cloudSyncResult && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: cloudSyncResult.includes('synced') || cloudSyncResult.includes('Restored') ? 'rgba(52,200,89,0.15)' : 'rgba(255,69,58,0.15)',
                  color: cloudSyncResult.includes('synced') || cloudSyncResult.includes('Restored') ? '#34c859' : '#ff453a',
                }}
              >
                {cloudSyncResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
