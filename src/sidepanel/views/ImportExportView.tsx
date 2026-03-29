import { useState, useRef, useCallback, useEffect } from 'react';
import { Download, Upload, FileJson, FileText, Table2, AlignLeft, FileCode, Cloud, CloudDownload, type LucideIcon } from 'lucide-react';
import Button from '@shared/components/Button';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { ExportFormat, DashboardSyncResponse } from '@core/types/messages.types';

export default function ImportExportView() {
  const { sessions } = useSession();
  const { sendMessage } = useMessaging();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard export/import state
  const [exportingDashboard, setExportingDashboard] = useState(false);
  const [importingDashboard, setImportingDashboard] = useState(false);
  const [dashboardImportResult, setDashboardImportResult] = useState<string | null>(null);
  const [showDashboardWarning, setShowDashboardWarning] = useState(false);
  const dashboardFileInputRef = useRef<HTMLInputElement>(null);

  // Cloud dashboard sync state
  const [syncingDashboard, setSyncingDashboard] = useState(false);
  const [pullingDashboard, setPullingDashboard] = useState(false);
  const [cloudSyncResult, setCloudSyncResult] = useState<string | null>(null);
  const [cloudSyncQuota, setCloudSyncQuota] = useState<{ used: number; limit: number } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const mimeTypes: Record<string, string> = {
    json: 'application/json',
    html: 'text/html',
    markdown: 'text/markdown',
    csv: 'text/csv',
    text: 'text/plain',
  };

  const handleExport = async () => {
    const sessionIds = sessions.map((s) => s.id);
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds, format: exportFormat },
    });

    if (response.success && response.data) {
      const blob = new Blob([response.data], {
        type: mimeTypes[exportFormat] ?? 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `browser-hub-export.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const processImportFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const source = file.name.endsWith('.json') ? 'json' : file.name.endsWith('.html') ? 'html' : 'url_list';

      const response = await sendMessage({
        action: 'IMPORT_SESSIONS',
        payload: { data: text, source },
      });

      setImportResult(response.success ? 'Import successful!' : response.error ?? 'Import failed');
    } catch {
      setImportResult('Failed to read file');
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [sendMessage]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImportFile(file);
  };

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
      // Silent fail — loading state clears
    }
    setExportingDashboard(false);
  };

  const processDashboardImportFile = useCallback(async (file: File) => {
    setImportingDashboard(true);
    setDashboardImportResult(null);

    try {
      const text = await file.text();
      const { importDashboardFromJSON } = await import('@core/services/newtab-export.service');
      const result = await importDashboardFromJSON(text);

      if (result.success && result.counts) {
        const { boards, categories, entries, todoItems } = result.counts;
        setDashboardImportResult(
          `Dashboard imported: ${boards} board${boards !== 1 ? 's' : ''}, ` +
          `${categories} widget${categories !== 1 ? 's' : ''}, ` +
          `${entries} bookmark${entries !== 1 ? 's' : ''}, ` +
          `${todoItems} todo item${todoItems !== 1 ? 's' : ''}`,
        );
      } else {
        setDashboardImportResult(result.error ?? 'Import failed');
      }
    } catch {
      setDashboardImportResult('Failed to read file');
    }

    setImportingDashboard(false);
    setShowDashboardWarning(false);
    if (dashboardFileInputRef.current) dashboardFileInputRef.current.value = '';
  }, []);

  const handleDashboardImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processDashboardImportFile(file);
  };

  useEffect(() => {
    void (async () => {
      const res = await sendMessage<{ isAuthenticated: boolean; quota: { dashboard_syncs_limit: number | null } | null }>({
        action: 'SYNC_GET_STATUS',
        payload: {},
      });
      if (res.success && res.data) {
        setIsAuthenticated(res.data.isAuthenticated);
        const limit = res.data.quota?.dashboard_syncs_limit ?? 0;
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
        setCloudSyncResult(`Dashboard synced! (${d.syncsUsedThisMonth}/${d.syncsLimit} syncs used this month)`);
      } else {
        setCloudSyncResult(res.data?.error ?? res.error ?? 'Sync failed');
      }
    } catch {
      setCloudSyncResult('Failed to sync dashboard');
    }
    setSyncingDashboard(false);
  };

  // In the sidepanel we can't call importDashboardFromJSON directly (newtab IDB).
  // Instead we download the cloud config as a JSON file for the user to re-import.
  const handlePullDashboardFromCloud = async () => {
    setPullingDashboard(true);
    setCloudSyncResult(null);
    try {
      const res = await sendMessage<DashboardSyncResponse>({
        action: 'PULL_DASHBOARD',
        payload: {},
      });
      if (res.success && res.data?.config) {
        const blob = new Blob([res.data.config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `browser-hub-dashboard-cloud-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setCloudSyncResult('Cloud backup downloaded. Use "Import Dashboard" above to apply it.');
      } else {
        setCloudSyncResult(res.data?.error ?? res.error ?? 'No cloud backup found');
      }
    } catch {
      setCloudSyncResult('Failed to fetch dashboard backup');
    }
    setPullingDashboard(false);
  };

  return (
    <div className="flex-1 overflow-auto p-3 space-y-6">
      {/* Export Sessions */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Download size={16} />
          Export Sessions
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <FormatOption
              icon={FileJson}
              label="JSON"
              description="Full backup"
              selected={exportFormat === 'json'}
              onClick={() => setExportFormat('json')}
            />
            <FormatOption
              icon={FileText}
              label="HTML"
              description="Bookmarks"
              selected={exportFormat === 'html'}
              onClick={() => setExportFormat('html')}
            />
            <FormatOption
              icon={FileCode}
              label="Markdown"
              description="Readable"
              selected={exportFormat === 'markdown'}
              onClick={() => setExportFormat('markdown')}
            />
            <FormatOption
              icon={Table2}
              label="CSV"
              description="Spreadsheet"
              selected={exportFormat === 'csv'}
              onClick={() => setExportFormat('csv')}
            />
            <FormatOption
              icon={AlignLeft}
              label="Text"
              description="URL list"
              selected={exportFormat === 'text'}
              onClick={() => setExportFormat('text')}
            />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Export {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
          <Button icon={Download} size="sm" fullWidth onClick={handleExport}>
            Export All Sessions
          </Button>
        </div>
      </section>

      {/* Export Dashboard */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Download size={16} />
          Export Dashboard
        </h3>
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Exports all boards, widgets, bookmarks, quick links, todo lists, and settings as JSON.
            Wallpaper images are not included.
          </p>
          <Button
            icon={Download}
            size="sm"
            fullWidth
            loading={exportingDashboard}
            onClick={handleExportDashboard}
          >
            Export Dashboard as JSON
          </Button>
        </div>
      </section>

      {/* Import Sessions */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Upload size={16} />
          Import Sessions
        </h3>
        <div
          className="border-2 border-dashed border-[var(--color-border)] rounded-card p-6 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) processImportFile(file);
          }}
        >
          <Upload size={24} className="mx-auto mb-2 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Drop a file here or click to browse
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Supports: JSON, HTML bookmarks, URL list
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.html,.txt"
          onChange={handleImport}
          className="hidden"
        />
        {importing && (
          <p className="text-sm text-primary mt-2">Importing...</p>
        )}
        {importResult && (
          <p className={`text-sm mt-2 ${importResult.includes('success') ? 'text-success' : 'text-error'}`}>
            {importResult}
          </p>
        )}
      </section>

      {/* Import Dashboard */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Upload size={16} />
          Import Dashboard
        </h3>
        {!showDashboardWarning ? (
          <div className="space-y-3">
            <div className="rounded-card border border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
              <strong>This will replace all existing dashboard data</strong> — boards, widgets,
              bookmarks, quick links, and todos — with the contents of the file. This cannot be
              undone. Wallpaper images will not be affected.
            </div>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={() => setShowDashboardWarning(true)}
            >
              I understand, choose a file
            </Button>
          </div>
        ) : (
          <>
            <div
              className="border-2 border-dashed border-[var(--color-border)] rounded-card p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => dashboardFileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) processDashboardImportFile(file);
              }}
            >
              <Upload size={24} className="mx-auto mb-2 text-[var(--color-text-secondary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Drop a dashboard JSON file here or click to browse
              </p>
            </div>
            <input
              ref={dashboardFileInputRef}
              type="file"
              accept=".json"
              onChange={handleDashboardImportChange}
              className="hidden"
            />
          </>
        )}
        {importingDashboard && (
          <p className="text-sm text-primary mt-2">Importing dashboard data...</p>
        )}
        {dashboardImportResult && (
          <p className={`text-sm mt-2 ${dashboardImportResult.includes('imported') ? 'text-success' : 'text-error'}`}>
            {dashboardImportResult}
          </p>
        )}

        {/* Cloud Sync */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Cloud size={13} />
            Cloud Sync
          </h4>
          {!isAuthenticated ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Sign in to Cloud Sync to back up and restore your dashboard.
            </p>
          ) : cloudSyncQuota?.limit === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Dashboard sync requires a Pro or Max plan.
            </p>
          ) : (
            <>
              <Button
                icon={Cloud}
                size="sm"
                fullWidth
                loading={syncingDashboard}
                disabled={cloudSyncQuota != null && cloudSyncQuota.used >= cloudSyncQuota.limit}
                onClick={() => { void handleSyncDashboardToCloud(); }}
              >
                Sync to Cloud
              </Button>
              <Button
                icon={CloudDownload}
                size="sm"
                fullWidth
                loading={pullingDashboard}
                onClick={() => { void handlePullDashboardFromCloud(); }}
              >
                Download Cloud Backup
              </Button>
              {cloudSyncQuota && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {cloudSyncQuota.used}/{cloudSyncQuota.limit} syncs used this month
                  {cloudSyncQuota.used >= cloudSyncQuota.limit && ' — limit reached'}
                </p>
              )}
            </>
          )}
          {cloudSyncResult && (
            <p className={`text-xs mt-1 ${cloudSyncResult.includes('synced') || cloudSyncResult.includes('downloaded') ? 'text-success' : 'text-error'}`}>
              {cloudSyncResult}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function FormatOption({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-card border text-left transition-colors ${
        selected
          ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
          : 'border-[var(--color-border)] hover:border-gray-400'
      }`}
    >
      <Icon size={20} className={selected ? 'text-primary' : 'text-[var(--color-text-secondary)]'} />
      <p className="text-sm font-medium mt-1">{label}</p>
      <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
    </button>
  );
}
