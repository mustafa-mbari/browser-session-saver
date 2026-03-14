import { useState, useRef, useCallback } from 'react';
import { Download, Upload, FileJson, FileText, type LucideIcon } from 'lucide-react';
import Button from '@shared/components/Button';
import { useSession } from '@shared/hooks/useSession';
import { useMessaging } from '@shared/hooks/useMessaging';
import type { ExportFormat } from '@core/types/messages.types';

export default function ImportExportView() {
  const { sessions } = useSession();
  const { sendMessage } = useMessaging();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      a.download = `session-saver-export.${exportFormat}`;
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

  return (
    <div className="flex-1 overflow-auto p-3 space-y-6">
      {/* Export */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Download size={16} />
          Export Sessions
        </h3>
        <div className="space-y-3">
          <div className="flex gap-2">
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
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Export {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
          <Button icon={Download} size="sm" fullWidth onClick={handleExport}>
            Export All Sessions
          </Button>
        </div>
      </section>

      {/* Import */}
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
