import { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileJson, FileText, FileSpreadsheet, FileCode, File } from 'lucide-react';
import Button from '@shared/components/Button';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useDashboardStore } from '../stores/dashboard.store';
import type { ExportFormat } from '@core/types/messages.types';

const exportFormats: { key: ExportFormat; label: string; description: string; icon: typeof FileJson }[] = [
  { key: 'json', label: 'JSON', description: 'Full backup with all metadata', icon: FileJson },
  { key: 'html', label: 'HTML', description: 'Netscape bookmark format', icon: FileCode },
  { key: 'markdown', label: 'Markdown', description: 'Readable text with links', icon: FileText },
  { key: 'csv', label: 'CSV', description: 'Spreadsheet compatible', icon: FileSpreadsheet },
  { key: 'text', label: 'Plain Text', description: 'URL list, one per line', icon: File },
];

export default function ImportExportPage() {
  const { sessions, refreshSessions } = useSession();
  const { sendMessage } = useMessaging();
  const { selectedSessionIds } = useDashboardStore();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionsToExport = selectedSessionIds.size > 0
    ? sessions.filter((s) => selectedSessionIds.has(s.id))
    : sessions;

  const handleExport = async () => {
    const sessionIds = sessionsToExport.map((s) => s.id);
    const response = await sendMessage<string>({
      action: 'EXPORT_SESSIONS',
      payload: { sessionIds, format: exportFormat },
    });

    if (response.success && response.data) {
      const mimeTypes: Record<string, string> = {
        json: 'application/json',
        html: 'text/html',
        markdown: 'text/markdown',
        csv: 'text/csv',
        text: 'text/plain',
      };
      const extensions: Record<string, string> = {
        json: 'json',
        html: 'html',
        markdown: 'md',
        csv: 'csv',
        text: 'txt',
      };

      const blob = new Blob([response.data], { type: mimeTypes[exportFormat] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-saver-export.${extensions[exportFormat]}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const processImportFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const source = file.name.endsWith('.json')
        ? 'json'
        : file.name.endsWith('.html')
          ? 'html'
          : 'url_list';

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [sendMessage, refreshSessions]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImportFile(file);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Import / Export</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Export */}
        <section className="rounded-card border border-[var(--color-border)] p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download size={20} />
            Export Sessions
          </h3>

          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {selectedSessionIds.size > 0
              ? `Exporting ${selectedSessionIds.size} selected session${selectedSessionIds.size !== 1 ? 's' : ''}`
              : `Exporting all ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
          </p>

          <div className="space-y-2 mb-4">
            {exportFormats.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.key}
                  onClick={() => setExportFormat(fmt.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-left transition-colors ${
                    exportFormat === fmt.key
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-primary'
                      : 'border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <Icon size={18} className={exportFormat === fmt.key ? 'text-primary' : 'text-[var(--color-text-secondary)]'} />
                  <div>
                    <p className="text-sm font-medium">{fmt.label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{fmt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <Button icon={Download} fullWidth onClick={handleExport}>
            Export as {exportFormats.find((f) => f.key === exportFormat)?.label}
          </Button>
        </section>

        {/* Import */}
        <section className="rounded-card border border-[var(--color-border)] p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload size={20} />
            Import Sessions
          </h3>

          <div
            className="border-2 border-dashed border-[var(--color-border)] rounded-card p-10 text-center cursor-pointer hover:border-primary hover:bg-[var(--color-bg-secondary)] transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) processImportFile(file);
            }}
          >
            <Upload size={36} className="mx-auto mb-3 text-[var(--color-text-secondary)]" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2">
              Supported formats: JSON, HTML bookmarks, URL list (.txt)
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
            <div className="mt-4 p-3 rounded-card bg-blue-50 dark:bg-blue-900/20 text-sm text-primary">
              Importing...
            </div>
          )}

          {importResult && (
            <div className={`mt-4 p-3 rounded-card text-sm ${
              importResult.imported > 0
                ? 'bg-green-50 dark:bg-green-900/20 text-success'
                : 'bg-red-50 dark:bg-red-900/20 text-error'
            }`}>
              {importResult.imported > 0 && (
                <p>Successfully imported {importResult.imported} session{importResult.imported !== 1 ? 's' : ''}</p>
              )}
              {importResult.errors.length > 0 && (
                <ul className="mt-1 list-disc list-inside">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>...and {importResult.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
