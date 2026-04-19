import { useState, useRef, useCallback } from 'react';
import {
  Download, Upload, FileJson, FileText, Table2, AlignLeft, FileCode,
  CheckSquare, Square, type LucideIcon,
} from 'lucide-react';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useIsPremium } from '@shared/hooks/useIsPremium';
import { PromptStorage } from '@core/storage/prompt-storage';
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

const SESSION_FORMATS: { key: ExportFormat; label: string; desc: string; icon: LucideIcon }[] = [
  { key: 'json', label: 'JSON', desc: 'Full backup with all metadata', icon: FileJson },
  { key: 'html', label: 'HTML', desc: 'Netscape bookmark format', icon: FileCode },
  { key: 'markdown', label: 'Markdown', desc: 'Readable text with links', icon: FileText },
  { key: 'csv', label: 'CSV', desc: 'Spreadsheet compatible', icon: Table2 },
  { key: 'text', label: 'Plain Text', desc: 'URL list, one per line', icon: AlignLeft },
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

export default function ImportExportPanel() {
  const { sessions, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const { isPremium, loading: planLoading } = useIsPremium();

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
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  // Legacy
  const [legacyImportResult, setLegacyImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [legacyImporting, setLegacyImporting] = useState(false);


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
        response.data as string,
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
      const sel: ModuleSelection = { ...NO_MODULES_SELECTED };
      preview.availableModules.forEach((m) => { sel[m] = true; });
      setImportModuleSelection(sel);
      setShowPreviewModal(true);
    } catch {
      setImportPreview({
        fileType: 'unknown',
        availableModules: [],
        counts: { sessions: 0, prompts: 0, promptFolders: 0, promptCategories: 0, promptTags: 0, subscriptions: 0, subscriptionCategories: 0, tabGroupTemplates: 0, dashboardBoards: 0, dashboardCategories: 0, dashboardEntries: 0, dashboardQuickLinks: 0, dashboardTodoLists: 0, dashboardTodoItems: 0 },
        warnings: [],
        errors: ['Failed to read file'],
      });
      setShowPreviewModal(true);
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
      setShowPreviewModal(false);
      setImportPreview(null);
      // Seed prompt data and reload if dashboard was imported
      if (result.importedCounts.dashboardBoards !== undefined) {
        await Promise.all([PromptStorage.seedAppFolders(), PromptStorage.seedDemoData()]);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        await refreshSessions();
      }
    } catch (e) {
      setImportResult({ success: false, importedCounts: {}, skippedModules: [], errors: [String(e)], moduleStatus: {} });
      setShowPreviewModal(false);
    }
    setImporting(false);
  };

  const resetImport = () => {
    setImportPreview(null);
    setPreviewRawText(null);
    setImportResult(null);
    setAutoBackupDownloaded(false);
    setShowPreviewModal(false);
    if (jsonFileRef.current) jsonFileRef.current.value = '';
  };

  const handleLegacyImport = useCallback(async (file: File) => {
    setLegacyImporting(true);
    setLegacyImportResult(null);
    try {
      const text = await file.text();
      const source = file.name.endsWith('.json') ? 'json' : file.name.endsWith('.html') ? 'html' : 'url_list';
      const response = await sendMessage<{ imported: number; errors: string[] }>({
        action: 'IMPORT_SESSIONS',
        payload: { data: text, source },
      });
      if (response.success && response.data) {
        setLegacyImportResult(response.data);
        await refreshSessions();
      } else {
        setLegacyImportResult({ imported: 0, errors: [response.error ?? 'Import failed'] });
      }
    } catch {
      setLegacyImportResult({ imported: 0, errors: ['Failed to read file'] });
    }
    setLegacyImporting(false);
    if (legacyFileRef.current) legacyFileRef.current.value = '';
  }, [sendMessage, refreshSessions]);


  // ── Render ───────────────────────────────────────────────────────────────────

  const anyModuleSelected = Object.values(moduleSelection).some(Boolean);

  return (
    <div className="pt-4 w-full relative">
      <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--newtab-text)' }}>
        Import / Export
      </h2>

      {/* Tab bar */}
      <div
        className="flex rounded-xl mb-5 p-1 gap-1"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        {(['export', 'import'] as ImportExportTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
            style={{ color: activeTab === tab ? 'var(--newtab-text)' : 'var(--newtab-text-secondary)' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Premium gate ─────────────────────────────────────────────────── */}
      {!planLoading && !isPremium && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
            Import &amp; Export is a PRO feature
          </p>
          <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
            Upgrade to PRO or Lifetime to back up and restore all your data.
          </p>
        </div>
      )}

      {/* ── EXPORT TAB ──────────────────────────────────────────────────── */}
      {isPremium && activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Full Backup */}
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
              <Download size={15} className="opacity-70" />
              Full Backup
            </h3>
            <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
              Exports selected data as a single versioned JSON file (v2.0).
            </p>
            <div className="space-y-1.5">
              {BACKUP_MODULE_ORDER.map((mod) => {
                const checked = moduleSelection[mod];
                const label = mod === 'sessions'
                  ? `${MODULE_LABELS[mod]} (${sessions.length})`
                  : MODULE_LABELS[mod];
                return (
                  <label key={mod} className="flex items-center gap-2 cursor-pointer select-none">
                    <span style={{ color: checked ? 'var(--newtab-text)' : 'var(--newtab-text-secondary)' }}>
                      {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => setModuleSelection((prev) => ({ ...prev, [mod]: e.target.checked }))}
                    />
                    <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>{label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModuleSelection({ ...ALL_MODULES_SELECTED })}
                className="text-xs hover:opacity-80"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                Select All
              </button>
              <button
                onClick={() => setModuleSelection({ ...NO_MODULES_SELECTED })}
                className="text-xs hover:opacity-80"
                style={{ color: 'var(--newtab-text-secondary)' }}
              >
                Deselect All
              </button>
            </div>
            {exportError && (
              <p className="text-xs" style={{ color: '#ff453a' }}>{exportError}</p>
            )}
            <button
              onClick={() => { void handleFullExport(); }}
              disabled={exporting || !anyModuleSelected}
              className="mt-auto flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/25 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--newtab-text)' }}
            >
              {exporting ? (
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download Full Backup
            </button>
          </div>

          {/* Supplementary + Session Formats */}
          <div className="flex flex-col gap-5">
            {/* Session export */}
            <div className="glass-panel rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
                <Download size={15} className="opacity-70" />
                Export Sessions
              </h3>
              <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
                Export all {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-col gap-1.5">
                {SESSION_FORMATS.map(({ key, label, desc, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSessionExportFormat(key)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      sessionExportFormat === key ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    <Icon size={14} style={{ color: sessionExportFormat === key ? 'var(--newtab-text)' : 'var(--newtab-text-secondary)' }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--newtab-text)' }}>{label}</p>
                      <p className="text-[11px]" style={{ color: 'var(--newtab-text-secondary)' }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { void handleSessionExport(); }}
                className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/25"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--newtab-text)' }}
              >
                <Download size={14} />
                Export as {SESSION_FORMATS.find((f) => f.key === sessionExportFormat)?.label}
              </button>
            </div>

            {/* Supplementary */}
            <div className="glass-panel rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
                Supplementary Formats
              </h3>
              {([
                { fmt: 'subscriptions-csv' as SupplementaryFormat, label: 'Subscriptions as CSV' },
                { fmt: 'prompts-markdown' as SupplementaryFormat, label: 'Prompts as Markdown' },
                { fmt: 'todos-csv' as SupplementaryFormat, label: 'Todos as CSV' },
              ]).map(({ fmt, label }) => (
                <div key={fmt} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>{label}</span>
                  <button
                    onClick={() => { void handleSuppExport(fmt); }}
                    disabled={exportingSupp === fmt}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-white/15 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--newtab-text)' }}
                  >
                    {exportingSupp === fmt ? (
                      <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={11} />
                    )}
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT TAB ──────────────────────────────────────────────────── */}
      {isPremium && activeTab === 'import' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* JSON full backup import */}
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
              <Upload size={15} className="opacity-70" />
              Import (Full / Dashboard / Sessions)
            </h3>

            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>Mode:</span>
              <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                {(['merge', 'replace'] as ImportMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setImportMode(m)}
                    className="px-3 py-1 text-xs capitalize transition-colors"
                    style={{
                      background: importMode === m ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: 'var(--newtab-text)',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {importResult ? (
              <ImportResultPanelGlass result={importResult} onReset={resetImport} />
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
                  onClick={() => jsonFileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) void handleJsonFileDrop(file);
                  }}
                >
                  <Upload size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--newtab-text)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>
                    Drop a JSON file or click to browse
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--newtab-text-secondary)' }}>
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
              </>
            )}
          </div>

          {/* Legacy session import */}
          <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--newtab-text)' }}>
              <Upload size={15} className="opacity-70" />
              Import Sessions (HTML / URL list)
            </h3>
            <div
              className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
              onClick={() => legacyFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) void handleLegacyImport(file);
              }}
            >
              <Upload size={28} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--newtab-text)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>
                Drop a file or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--newtab-text-secondary)' }}>
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
              <p className="text-xs text-center" style={{ color: 'var(--newtab-text-secondary)' }}>
                Importing...
              </p>
            )}
            {legacyImportResult && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: legacyImportResult.imported > 0 ? 'rgba(52,200,89,0.15)' : 'rgba(255,69,58,0.15)',
                  color: legacyImportResult.imported > 0 ? '#34c859' : '#ff453a',
                }}
              >
                {legacyImportResult.imported > 0 && (
                  <p>Imported {legacyImportResult.imported} session{legacyImportResult.imported !== 1 ? 's' : ''}</p>
                )}
                {legacyImportResult.errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        </div>
      )}


      {/* ── Preview Modal (newtab overlay) ─────────────────────────────── */}
      {showPreviewModal && importPreview && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) resetImport(); }}
        >
          <div className="glass-panel rounded-xl p-5 w-full max-w-md space-y-4">
            {importPreview.errors.length > 0 ? (
              <>
                <p className="text-sm font-semibold" style={{ color: '#ff453a' }}>Cannot import this file</p>
                {importPreview.errors.map((err, i) => (
                  <p key={i} className="text-xs" style={{ color: '#ff453a' }}>{err}</p>
                ))}
                <button onClick={resetImport} className="text-xs hover:opacity-80" style={{ color: 'var(--newtab-text-secondary)' }}>
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
                      {importPreview.fileType === 'full-backup-v2' ? 'Full Backup v2.0' :
                       importPreview.fileType === 'dashboard-v1' ? 'Dashboard Backup v1' : 'Sessions Backup'}
                    </p>
                    {importPreview.exportedAt && (
                      <p className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
                        Exported {new Date(importPreview.exportedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button onClick={resetImport} className="text-xs hover:opacity-80" style={{ color: 'var(--newtab-text-secondary)' }}>
                    Cancel
                  </button>
                </div>

                {/* Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>Mode:</span>
                  <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                    {(['merge', 'replace'] as ImportMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setImportMode(m)}
                        className="px-3 py-1 text-xs capitalize transition-colors"
                        style={{
                          background: importMode === m ? 'rgba(255,255,255,0.25)' : 'transparent',
                          color: 'var(--newtab-text)',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module checkboxes */}
                <div className="space-y-2">
                  {BACKUP_MODULE_ORDER.map((mod) => {
                    const available = importPreview.availableModules.includes(mod);
                    const checked = importModuleSelection[mod] && available;
                    const c = importPreview.counts;
                    const detail = moduleCountDetail(mod, c);
                    return (
                      <label
                        key={mod}
                        className={`flex items-center gap-2 select-none ${available ? 'cursor-pointer' : 'opacity-40'}`}
                      >
                        <span style={{ color: checked ? 'var(--newtab-text)' : 'var(--newtab-text-secondary)' }}>
                          {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={!available}
                          onChange={(e) => available && setImportModuleSelection((prev) => ({ ...prev, [mod]: e.target.checked }))}
                        />
                        <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>
                          {MODULE_LABELS[mod]}
                          {available && detail && (
                            <span style={{ color: 'var(--newtab-text-secondary)' }}> — {detail}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Replace warning */}
                {importMode === 'replace' && (
                  <div
                    className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,159,10,0.15)', color: 'rgba(255,159,10,0.9)' }}
                  >
                    Replace mode overwrites existing data for selected modules.
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {importMode === 'replace' && (
                    <button
                      onClick={() => { void handleDownloadAutoBackup(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/15"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--newtab-text)' }}
                    >
                      <Download size={11} />
                      {autoBackupDownloaded ? 'Backup saved ✓' : 'Download Backup'}
                    </button>
                  )}
                  <button
                    onClick={() => { void handleConfirmImport(); }}
                    disabled={importing || !Object.values(importModuleSelection).some(Boolean)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/25 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--newtab-text)' }}
                  >
                    {importing ? (
                      <span className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    Import Selected
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Glassmorphism sub-components ──────────────────────────────────────────────

function ImportResultPanelGlass({ result, onReset }: { result: FullImportResult; onReset: () => void }) {
  const entries = Object.entries(result.importedCounts).filter(([, v]) => v !== undefined && (v as number) > 0);
  return (
    <div
      className="rounded-xl px-4 py-3 text-xs space-y-1"
      style={{
        background: result.success ? 'rgba(52,200,89,0.15)' : 'rgba(255,69,58,0.15)',
        color: result.success ? '#34c859' : '#ff453a',
      }}
    >
      <p className="font-medium">{result.success ? 'Import complete' : 'Import completed with errors'}</p>
      {entries.map(([key, count]) => <p key={key}>✓ {key}: {count}</p>)}
      {result.errors.map((e, i) => <p key={i}>✗ {e}</p>)}
      <button onClick={onReset} className="mt-1 underline opacity-80 hover:opacity-100">
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

function moduleCountDetail(mod: BackupModule, c: import('@core/types/import-export.types').FullBackupCounts): string {
  switch (mod) {
    case 'sessions': return `${c.sessions} session${c.sessions !== 1 ? 's' : ''}`;
    case 'settings': return 'extension preferences';
    case 'prompts': return `${c.prompts} prompts, ${c.promptFolders} folders`;
    case 'subscriptions': return `${c.subscriptions} subscriptions`;
    case 'tabGroupTemplates': return `${c.tabGroupTemplates} templates`;
    case 'dashboard': return `${c.dashboardBoards} boards, ${c.dashboardCategories} categories, ${c.dashboardEntries} bookmarks`;
  }
}
