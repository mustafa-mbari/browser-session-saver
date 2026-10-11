import { useState } from 'react';
import { AlertTriangle, Monitor, ALargeSmall } from 'lucide-react';
import type { TextSizeMode, NewTabSettings, SearchEngine } from '@core/types/newtab.types';
import { useAppSettings } from '@shared/hooks/useAppSettings';
import AutoSaveSettingsSection from '@shared/components/settings/AutoSaveSettingsSection';
import {
  GlassCard as Card,
  GlassDivider as Divider,
  GlassSectionTitle as SectionTitle,
  GlassSelect as SelectField,
  GlassToggle as Toggle,
} from '@shared/components/settings/glass-controls';

interface BoardOption {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  settings: NewTabSettings;
  boards: BoardOption[];
  onUpdate: (updates: Partial<NewTabSettings>) => void;
  onClearData: () => Promise<void>;
}

const TEXT_SIZE_OPTIONS: { value: TextSizeMode; label: string; desc: string; Icon: React.ElementType }[] = [
  { value: 'default', label: 'Default', desc: 'Standard text size',  Icon: ALargeSmall },
  { value: 'medium',  label: 'Medium',  desc: 'All text 20% larger', Icon: ALargeSmall },
  { value: 'large',   label: 'Large',   desc: 'All text 35% larger', Icon: ALargeSmall },
];

const SEARCH_ENGINE_OPTIONS: { value: SearchEngine; label: string }[] = [
  { value: 'google',    label: 'Google' },
  { value: 'bing',      label: 'Bing' },
  { value: 'duckduckgo',label: 'DuckDuckGo' },
  { value: 'brave',     label: 'Brave' },
  { value: 'custom',    label: 'Custom' },
];

export default function SettingsView({ settings, boards, onUpdate, onClearData }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { settings: appSettings, updateSetting: updateApp } = useAppSettings();

  const handleClear = async () => {
    setClearing(true);
    await onClearData();
  };

  return (
    <div className="pt-4 w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--newtab-text)' }}>Settings</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── New Tab Page ── */}
        <Card>
          <SectionTitle>New Tab Page</SectionTitle>
          <Toggle
            label="Enable New Tab Override"
            checked={settings.enabled}
            onChange={(v) => onUpdate({ enabled: v })}
          />
          {!settings.enabled && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              When disabled, a blank page is shown. Disable the extension to restore Chrome's default.
            </p>
          )}
        </Card>

        {/* ── Theme ── */}
        <Card>
          <SectionTitle>Theme</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => {
              const active = (appSettings.theme ?? 'system') === t;
              return (
                <button
                  key={t}
                  onClick={() => { void updateApp('theme', t); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm capitalize transition-colors border ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15 text-white'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/60'
                  }`}
                >
                  <Monitor size={13} />
                  {t}
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Text Size ── */}
        <Card>
          <SectionTitle>Text Size</SectionTitle>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {TEXT_SIZE_OPTIONS.map(({ value, label, desc, Icon }) => {
              const active = (settings.textSize ?? 'default') === value;
              return (
                <button
                  key={value}
                  onClick={() => onUpdate({ textSize: value })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors border ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.5)' }} />
                  <span className="text-xs font-medium" style={{ color: active ? '#e0e7ff' : 'rgba(255,255,255,0.6)' }}>
                    {label}
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
          {boards.length > 0 && (
            <>
              <Divider />
              <SelectField
                label="Default Board"
                value={settings.activeBoardId ?? boards[0]?.id ?? ''}
                options={boards.map((b) => ({ value: b.id, label: `${b.icon} ${b.name}` }))}
                onChange={(v) => onUpdate({ activeBoardId: v })}
              />
            </>
          )}
        </Card>

        {/* ── Search Engine ── */}
        <Card>
          <SectionTitle>Search Engine</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {SEARCH_ENGINE_OPTIONS.map((opt) => {
              const active = settings.searchEngine === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ searchEngine: opt.value })}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15 text-white'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {settings.searchEngine === 'custom' && (
            <input
              type="text"
              value={settings.customSearchUrl ?? ''}
              onChange={(e) => onUpdate({ customSearchUrl: e.target.value })}
              placeholder="https://search.example.com/?q="
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-hidden placeholder-white/25"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--newtab-text)',
              }}
            />
          )}
        </Card>

        {/* ── Clock & Widgets ── */}
        <Card>
          <SectionTitle>Clock</SectionTitle>
          <div className="flex gap-2 mb-4">
            {(['12h', '24h'] as const).map((fmt) => {
              const active = settings.clockFormat === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => onUpdate({ clockFormat: fmt })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15 text-white'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-white/60'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
          <Divider />
          <SectionTitle>Widgets</SectionTitle>
          <div className="flex flex-col">
            <Toggle label="Show Clock"       checked={settings.showClock}      onChange={(v) => onUpdate({ showClock: v })} />
            <Toggle label="Show Quick Links" checked={settings.showQuickLinks} onChange={(v) => onUpdate({ showQuickLinks: v })} />
          </div>
        </Card>

        <AutoSaveSettingsSection
          variant="newtab"
          renderGroup={(title, rows) => (
            <Card>
              <SectionTitle>{title}</SectionTitle>
              <div className="flex flex-col gap-0.5">{rows}</div>
            </Card>
          )}
        />

        {/* ── Danger Zone ── */}
        <Card>
          <SectionTitle>Danger Zone</SectionTitle>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: '#f87171',
                border: '1px solid rgba(248,113,113,0.25)',
                background: 'rgba(248,113,113,0.07)',
              }}
            >
              <AlertTriangle size={13} />
              Clear All Data
            </button>
          ) : (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
            >
              <p className="text-sm" style={{ color: '#fca5a5' }}>
                Permanently deletes all boards, cards, bookmarks, quick links, and to-do lists.{' '}
                <strong>Cannot be undone.</strong>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(false)}
                  disabled={clearing}
                  className="flex-1 py-1.5 rounded-lg text-sm transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleClear(); }}
                  disabled={clearing}
                  className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: '#dc2626', color: '#fff' }}
                >
                  {clearing ? 'Clearing…' : 'Delete everything'}
                </button>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
