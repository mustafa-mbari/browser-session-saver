import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileJson, FileText, Table2, AlignLeft, FileCode,
  CheckSquare, Square, type LucideIcon,
} from 'lucide-react';
import Button from '@shared/components/Button';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { ExportFormat } from '@core/types/messages.types';
import type {
  ImportExportTab,
  BackupModule,
  ModuleSelection,
  ImportMode,
  ImportPreview,
  FullImportResult,
  SupplementaryFormat,
} from '@core/types/import-export.types';
import { ALL_MODULES_SELECTED, NO_MODULES_SELECTED } from '@core/types/import-export.types';

// ── Format options ─────────────────────────────────────────────────────────────

const SESSION_FORMATS: { key: ExportFormat; icon: LucideIcon; label: string; description: string }[] = [
  { key: 'json', icon: FileJson, label: 'JSON', description: 'Full backup' },
  { key: 'html', icon: FileText, label: 'HTML', description: 'Bookmarks' },
  { key: 'markdown', icon: FileCode, label: 'Markdown', description: 'Readable' },
  { key: 'csv', icon: Table2, label: 'CSV', description: 'Spreadsheet' },
  { key: 'text', icon: AlignLeft, label: 'Text', description: 'URL list' },
];

const MIME: Record<string, string> = {
  json: 'application/json', html: 'text/html', markdown: 'text/markdown',
  csv: 'text/csv', text: 'text/plain',
};
const EXT: Record<string, string> = {
  json: 'json', html: 'html', markdown: 'md', csv: 'csv', text: 'txt',
};

const MODULE_LABELS: Record<BackupModule, string> = {
  sessions: 'Sessions',
  settings: 'Extension Settings',
  prompts: 'Prompts & Folders',
  subscriptions: 'Subscriptions',
  tabGroupTemplates: 'Tab Group Templates',
  dashboard: 'Dashboard (boards, bookmarks, todos)',
};

const BACKUP_MODULE_ORDER: BackupModule[] = [
  'sessions', 'settings', 'prompts', 'subscriptions', 'tabGroupTemplates', 'dashboard',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportExportView() {
  const { sessions } = useSession();
  const { sendMessage } = useMessaging();

  // ── Tab routing ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ImportExportTab>('export');

  // ── Export tab ───────────────────────────────────────────────────────────────
  const [sessionExportFormat, setSessionExportFormat] = useState<ExportFormat>('json');
  const [moduleSelection, setModuleSelection] = useState<ModuleSelection>({ ...ALL_MODULES_SELECTED });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingSupp, setExportingSupp] = useState<SupplementaryFormat | null>(null);

  // ── Import tab ───────────────────────────────────────────────────────────────
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const legacyFileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [previewRawText, setPreviewRawText] = useState<string | null>(null);
  const [importModuleSelection, setImportModuleSelection] = useState<ModuleSelection>({ ...ALL_MODULES_SELECTED });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<FullImportResult | null>(null);
  const [autoBackupDownloaded, setAutoBackupDownloaded] = useState(false);
  // Legacy session import
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyImportResult, setLegacyImportResult] = useState<string | null>(null);


  // ── Export handlers ──────────────────────────────────────────────────────────

  const handleFullExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { exportFullBackup } = await import('@core/services/full-export.service');
      const json = await exportFullBackup(moduleSelection);
      triggerDownload(json, `browser-hub-backup-${dateStamp()}.json`, 'application/json');
    } catch (e) {
      setExportError(String(e));
    }
    setExporting(false);
  };

  const handleSessionExport = async () => {
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds: sessions.map((s) => s.id), format: sessionExportFormat },
    });
    if (response.success && response.data) {
      triggerDownload(
        response.data,
        `browser-hub-sessions.${EXT[sessionExportFormat]}`,
        MIME[sessionExportFormat] ?? 'application/octet-stream',
      );
    }
  };

  const handleSuppExport = async (fmt: SupplementaryFormat) => {
    setExportingSupp(fmt);
    try {
      const { exportSupplementary } = await import('@core/services/full-export.service');
      const content = await exportSupplementary(fmt);
      const { filename, mime } = suppMeta(fmt);
      triggerDownload(content, filename, mime);
    } catch {
      // silent
    }
    setExportingSupp(null);
  };

  // ── Import handlers ──────────────────────────────────────────────────────────

  const handleJsonFileDrop = useCallback(async (file: File) => {
    setImportPreview(null);
    setImportResult(null);
    setAutoBackupDownloaded(false);
    try {
      const text = await file.text();
      const { previewImport } = await import('@core/services/full-import.service');
      const preview = previewImport(text);
      setPreviewRawText(text);
      setImportPreview(preview);
      // Pre-select only modules present in the file
      const sel: ModuleSelection = { ...NO_MODULES_SELECTED };
      preview.availableModules.forEach((m) => { sel[m] = true; });
      setImportModuleSelection(sel);
    } catch {
      setImportPreview({
        fileType: 'unknown',
        availableModules: [],
        counts: { sessions: 0, prompts: 0, promptFolders: 0, promptCategories: 0, promptTags: 0, subscriptions: 0, subscriptionCategories: 0, tabGroupTemplates: 0, dashboardBoards: 0, dashboardCategories: 0, dashboardEntries: 0, dashboardQuickLinks: 0, dashboardTodoLists: 0, dashboardTodoItems: 0 },
        warnings: [],
        errors: ['Failed to read file'],
      });
    }
  }, []);

  const handleDownloadAutoBackup = async () => {
    const modules = (Object.keys(importModuleSelection) as BackupModule[]).filter(
      (m) => importModuleSelection[m],
    );
    try {
      const { createAutoBackup } = await import('@core/services/full-import.service');
      const json = await createAutoBackup(modules);
      triggerDownload(json, `browser-hub-pre-import-backup-${dateStamp()}.json`, 'application/json');
      setAutoBackupDownloaded(true);
    } catch {
      // silent
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !previewRawText) return;
    setImporting(true);
    try {
      const { executeImport } = await import('@core/services/full-import.service');
      const result = await executeImport(previewRawText, importPreview, importModuleSelection, importMode);
      setImportResult(result);
      setImportPreview(null);
      // Reload if dashboard was imported
      if (result.importedCounts.dashboardBoards !== undefined) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      setImportResult({ success: false, importedCounts: {}, skippedModules: [], errors: [String(e)], moduleStatus: {} });
    }
    setImporting(false);
  };

  const resetImport = () => {
    setImportPreview(null);
    setPreviewRawText(null);
    setImportResult(null);
    setAutoBackupDownloaded(false);
    if (jsonFileRef.current) jsonFileRef.current.value = '';
  };

  const handleLegacyImport = useCallback(async (file: File) => {
    setLegacyImporting(true);
    setLegacyImportResult(null);
    try {
      const text = await file.text();
      const source = file.name.endsWith('.json') ? 'json' : file.name.endsWith('.html') ? 'html' : 'url_list';
      const response = await sendMessage({ action: 'IMPORT_SESSIONS', payload: { data: text, source } });
      setLegacyImportResult(response.success ? 'Import successful!' : response.error ?? 'Import failed');
    } catch {
      setLegacyImportResult('Failed to read file');
    }
    setLegacyImporting(false);
    if (legacyFileRef.current) legacyFileRef.current.value = '';
  }, [sendMessage]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const anyModuleSelected = Object.values(moduleSelection).some(Boolean);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-border)] shrink-0">
        {(['export', 'import'] as ImportExportTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {/* ── EXPORT TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'export' && (
          <div className="space-y-5">
            {/* Full Backup */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Download size={15} />
                Full Backup
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Exports selected data as a single versioned JSON file (v2.0).
              </p>
              <div className="space-y-1.5 mb-3">
                {BACKUP_MODULE_ORDER.map((mod) => {
                  const checked = moduleSelection[mod];
                  const label = mod === 'sessions'
                    ? `${MODULE_LABELS[mod]} (${sessions.length})`
                    : MODULE_LABELS[mod];
                  return (
                    <label key={mod} className="flex items-center gap-2 cursor-pointer select-none group">
                      <span className={`text-[var(--color-text-secondary)] group-hover:text-primary ${checked ? 'text-primary' : ''}`}>
                        {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) => setModuleSelection((prev) => ({ ...prev, [mod]: e.target.checked }))}
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setModuleSelection({ ...ALL_MODULES_SELECTED })}
                  className="text-xs text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-xs text-[var(--color-text-secondary)]">·</span>
                <button
                  onClick={() => setModuleSelection({ ...NO_MODULES_SELECTED })}
                  className="text-xs text-[var(--color-text-secondary)] hover:underline"
                >
                  Deselect All
                </button>
              </div>
              {exportError && (
                <p className="text-xs text-error mb-2">{exportError}</p>
              )}
              <Button
                icon={Download}
                size="sm"
                fullWidth
                loading={exporting}
                disabled={!anyModuleSelected}
                onClick={() => { void handleFullExport(); }}
              >
                Download Full Backup
              </Button>
            </section>

            <hr className="border-[var(--color-border)]" />

            {/* Session Formats */}
            <section>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Download size={15} />
                Export Sessions
              </h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {SESSION_FORMATS.map(({ key, icon: Icon, label, description }) => (
                  <button
                    key={key}
                    onClick={() => setSessionExportFormat(key)}
                    className={`p-3 rounded-card border text-left transition-colors ${
                      sessionExportFormat === key
                        ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                        : 'border-[var(--color-border)] hover:border-gray-400'
                    }`}
                  >
                    <Icon size={18} className={sessionExportFormat === key ? 'text-primary' : 'text-[var(--color-text-secondary)]'} />
                    <p className="text-sm font-medium mt-1">{label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Export {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
              <Button icon={Download} size="sm" fullWidth onClick={() => { void handleSessionExport(); }}>
                Export as {SESSION_FORMATS.find((f) => f.key === sessionExportFormat)?.label}
              </Button>
            </section>

            <hr className="border-[var(--color-border)]" />

            {/* Supplementary formats */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Supplementary Formats</h3>
              {([
                { fmt: 'subscriptions-csv' as SupplementaryFormat, label: 'Subscriptions as CSV' },
                { fmt: 'prompts-markdown' as SupplementaryFormat, label: 'Prompts as Markdown' },
                { fmt: 'todos-csv' as SupplementaryFormat, label: 'Todos as CSV' },
              ]).map(({ fmt, label }) => (
                <div key={fmt} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-xs">{label}</span>
                  <button
                    onClick={() => { void handleSuppExport(fmt); }}
                    disabled={exportingSupp === fmt}
                    className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
                  >
                    {exportingSupp === fmt ? (
                      <span className="h-3 w-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    Download
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* ── IMPORT TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'import' && (
          <div className="space-y-5">
            {/* Result state */}
            {importResult ? (
              <ImportResultPanel result={importResult} onReset={resetImport} />
            ) : importPreview ? (
              /* Preview state */
              <ImportPreviewPanel
                preview={importPreview}
                moduleSelection={importModuleSelection}
                importMode={importMode}
                importing={importing}
                autoBackupDownloaded={autoBackupDownloaded}
                onModuleToggle={(mod, val) => setImportModuleSelection((prev) => ({ ...prev, [mod]: val }))}
                onModeChange={setImportMode}
                onDownloadAutoBackup={() => { void handleDownloadAutoBackup(); }}
                onConfirm={() => { void handleConfirmImport(); }}
                onCancel={resetImport}
              />
            ) : (
              /* Drop zone state */
              <>
                {/* Mode toggle */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">Mode:</span>
                  <div className="flex rounded-full border border-[var(--color-border)] overflow-hidden">
                    {(['merge', 'replace'] as ImportMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setImportMode(m)}
                        className={`px-3 py-1 text-xs capitalize transition-colors ${
                          importMode === m
                            ? 'bg-primary text-white'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {importMode === 'replace' && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Overwrites existing data</span>
                  )}
                </div>

                <div
                  className="border-2 border-dashed border-[var(--color-border)] rounded-card p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => jsonFileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) void handleJsonFileDrop(file);
                  }}
                >
                  <Upload size={24} className="mx-auto mb-2 text-[var(--color-text-secondary)]" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Drop a JSON file or click to browse
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                    Full backup, dashboard backup, or sessions backup
                  </p>
                </div>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleJsonFileDrop(f); }}
                  className="hidden"
                />

                <hr className="border-[var(--color-border)]" />

                {/* Legacy import */}
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Upload size={15} />
                    Import Sessions (HTML / URL list)
                  </h3>
                  <div
                    className="border-2 border-dashed border-[var(--color-border)] rounded-card p-5 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => legacyFileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) void handleLegacyImport(file);
                    }}
                  >
                    <Upload size={20} className="mx-auto mb-1.5 text-[var(--color-text-secondary)]" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      HTML bookmarks or URL list (.txt)
                    </p>
                  </div>
                  <input
                    ref={legacyFileRef}
                    type="file"
                    accept=".html,.txt"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLegacyImport(f); }}
                    className="hidden"
                  />
                  {legacyImporting && (
                    <p className="text-xs text-primary mt-2">Importing...</p>
                  )}
                  {legacyImportResult && (
                    <p className={`text-xs mt-2 ${legacyImportResult.includes('success') ? 'text-success' : 'text-error'}`}>
                      {legacyImportResult}
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ImportPreviewPanel({
  preview,
  moduleSelection,
  importMode,
  importing,
  autoBackupDownloaded,
  onModuleToggle,
  onModeChange,
  onDownloadAutoBackup,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  moduleSelection: ModuleSelection;
  importMode: ImportMode;
  importing: boolean;
  autoBackupDownloaded: boolean;
  onModuleToggle: (mod: BackupModule, val: boolean) => void;
  onModeChange: (m: ImportMode) => void;
  onDownloadAutoBackup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (preview.errors.length > 0) {
    return (
      <div className="rounded-card border border-error bg-red-50 dark:bg-red-900/20 p-4 space-y-2">
        <p className="text-sm font-medium text-error">Cannot import this file</p>
        {preview.errors.map((e, i) => <p key={i} className="text-xs text-error">{e}</p>)}
        <button onClick={onCancel} className="text-xs text-[var(--color-text-secondary)] hover:underline">
          Choose a different file
        </button>
      </div>
    );
  }

  const fileTypeLabel: Record<ImportPreview['fileType'], string> = {
    'full-backup-v2': 'Full Backup v2.0',
    'dashboard-v1': 'Dashboard Backup v1',
    'sessions-v1': 'Sessions Backup',
    'unknown': 'Unknown',
  };

  const moduleCountText = (mod: BackupModule): string => {
    const c = preview.counts;
    switch (mod) {
      case 'sessions': return `${c.sessions} session${c.sessions !== 1 ? 's' : ''}`;
      case 'settings': return 'extension preferences';
      case 'prompts': return `${c.prompts} prompts, ${c.promptFolders} folders`;
      case 'subscriptions': return `${c.subscriptions} subscriptions`;
      case 'tabGroupTemplates': return `${c.tabGroupTemplates} templates`;
      case 'dashboard': return `${c.dashboardBoards} boards, ${c.dashboardCategories} categories, ${c.dashboardEntries} bookmarks`;
    }
  };

  const anySelected = Object.values(moduleSelection).some(Boolean);

  return (
    <div className="rounded-card border border-[var(--color-border)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{fileTypeLabel[preview.fileType]}</p>
          {preview.exportedAt && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Exported {new Date(preview.exportedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <button onClick={onCancel} className="text-xs text-[var(--color-text-secondary)] hover:underline">
          Cancel
        </button>
      </div>

      {/* Mode */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-secondary)]">Mode:</span>
        <div className="flex rounded-full border border-[var(--color-border)] overflow-hidden">
          {(['merge', 'replace'] as ImportMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 text-xs capitalize transition-colors ${
                importMode === m
                  ? 'bg-primary text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Module checkboxes */}
      <div className="space-y-1.5">
        {BACKUP_MODULE_ORDER.map((mod) => {
          const available = preview.availableModules.includes(mod);
          const checked = moduleSelection[mod] && available;
          return (
            <label
              key={mod}
              className={`flex items-center gap-2 select-none ${available ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className={checked ? 'text-primary' : 'text-[var(--color-text-secondary)]'}>
                {checked ? <CheckSquare size={14} /> : <Square size={14} />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={!available}
                onChange={(e) => available && onModuleToggle(mod, e.target.checked)}
              />
              <span className="text-xs flex-1">
                {MODULE_LABELS[mod]}
                {available && (
                  <span className="text-[var(--color-text-secondary)]"> — {moduleCountText(mod)}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {/* Replace mode warning */}
      {importMode === 'replace' && (
        <div className="rounded-card border border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          Replace mode will overwrite existing data for selected modules.
          {!autoBackupDownloaded && ' Download a backup first to be safe.'}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {importMode === 'replace' && (
          <button
            onClick={onDownloadAutoBackup}
            className="text-xs flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-btn px-2.5 py-1.5 hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Download size={12} />
            {autoBackupDownloaded ? 'Backup saved ✓' : 'Download Backup'}
          </button>
        )}
        <Button
          size="sm"
          loading={importing}
          disabled={!anySelected}
          onClick={onConfirm}
        >
          Import Selected
        </Button>
      </div>
    </div>
  );
}

function ImportResultPanel({
  result,
  onReset,
}: {
  result: FullImportResult;
  onReset: () => void;
}) {
  const entries = Object.entries(result.importedCounts).filter(([, v]) => v !== undefined && v > 0);
  return (
    <div className={`rounded-card border p-4 space-y-2 ${result.success ? 'border-success bg-green-50 dark:bg-green-900/20' : 'border-error bg-red-50 dark:bg-red-900/20'}`}>
      <p className={`text-sm font-semibold ${result.success ? 'text-success' : 'text-error'}`}>
        {result.success ? 'Import complete' : 'Import completed with errors'}
      </p>
      {entries.map(([key, count]) => (
        <p key={key} className="text-xs text-[var(--color-text)]">✓ {key}: {count}</p>
      ))}
      {result.errors.map((e, i) => (
        <p key={i} className="text-xs text-error">✗ {e}</p>
      ))}
      <button onClick={onReset} className="text-xs text-primary hover:underline">
        Import another file
      </button>
    </div>
  );
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function suppMeta(fmt: SupplementaryFormat): { filename: string; mime: string } {
  switch (fmt) {
    case 'subscriptions-csv': return { filename: `subscriptions-${dateStamp()}.csv`, mime: 'text/csv' };
    case 'prompts-markdown': return { filename: `prompts-${dateStamp()}.md`, mime: 'text/markdown' };
    case 'todos-csv': return { filename: `todos-${dateStamp()}.csv`, mime: 'text/csv' };
  }
}
