import { useState, useEffect } from 'react';
import { AlertTriangle, Monitor, ALargeSmall } from 'lucide-react';
import type { TextSizeMode, NewTabSettings, SearchEngine } from '@core/types/newtab.types';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { useMessaging } from '@shared/hooks/useMessaging';

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'rgba(255,255,255,0.4)' }}>
      {children}
    </h3>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <div>
        <div className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors duration-200 ${
          checked ? 'bg-indigo-500' : 'bg-white/25'
        }`}
      >
        <span
          className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

function Divider() {
  return <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />;
}

function Range({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="py-1">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none"
        style={{ accentColor: '#6366f1' }}
      />
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
        className="w-20 px-2 py-1 text-sm rounded-lg text-center outline-none"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--newtab-text)',
        }}
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1.5 text-sm rounded-lg outline-none"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--newtab-text)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#1a1a2e' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      {children}
    </div>
  );
}

export default function SettingsView({ settings, boards, onUpdate, onClearData }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { sendMessage } = useMessaging();
  const [appSettings, setAppSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    sendMessage<Settings>({ action: 'GET_SETTINGS', payload: {} }).then((r) => {
      if (r.success && r.data) setAppSettings(r.data as Settings);
    });
  }, [sendMessage]);

  const updateApp = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...appSettings, [key]: value };
    setAppSettings(updated);
    await sendMessage({ action: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

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
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none placeholder-white/25"
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

        {/* ── Auto-Save ── */}
        <Card>
          <SectionTitle>Auto-Save</SectionTitle>
          <div className="flex flex-col gap-0.5">
            <Toggle
              label="Enable Auto-Save"
              checked={appSettings.enableAutoSave}
              onChange={(v) => { void updateApp('enableAutoSave', v); }}
            />
            <Range
              label="Save Interval"
              value={appSettings.saveInterval}
              min={5} max={60} step={5} unit="min"
              onChange={(v) => { void updateApp('saveInterval', v); }}
            />
            <NumberField
              label="Max Auto-Saves to Keep"
              value={appSettings.maxAutoSaves}
              min={10} max={500}
              onChange={(v) => { void updateApp('maxAutoSaves', v); }}
            />
            <Toggle
              label="Save on Browser Close"
              checked={appSettings.saveOnBrowserClose}
              onChange={(v) => { void updateApp('saveOnBrowserClose', v); }}
            />
            <Toggle
              label="Save on Low Battery"
              checked={appSettings.saveOnLowBattery}
              onChange={(v) => { void updateApp('saveOnLowBattery', v); }}
            />
            {appSettings.saveOnLowBattery && (
              <Range
                label="Battery Threshold"
                value={appSettings.lowBatteryThreshold}
                min={5} max={30} step={5} unit="%"
                onChange={(v) => { void updateApp('lowBatteryThreshold', v); }}
              />
            )}
            <Toggle
              label="Save on Sleep / Hibernate"
              checked={appSettings.saveOnSleep}
              onChange={(v) => { void updateApp('saveOnSleep', v); }}
            />
            <Toggle
              label="Save on Network Disconnect"
              checked={appSettings.saveOnNetworkDisconnect}
              onChange={(v) => { void updateApp('saveOnNetworkDisconnect', v); }}
            />
          </div>
        </Card>

        {/* ── Behavior ── */}
        <Card>
          <SectionTitle>Behavior</SectionTitle>
          <div className="flex flex-col gap-0.5">
            <Toggle
              label="Close Tabs After Saving"
              checked={appSettings.closeTabsAfterSave}
              onChange={(v) => { void updateApp('closeTabsAfterSave', v); }}
            />
            <SelectField
              label="Auto-delete Old Sessions"
              value={String(appSettings.autoDeleteAfterDays ?? 'never')}
              options={[
                { value: 'never', label: 'Never' },
                { value: '7',     label: '7 days' },
                { value: '14',    label: '14 days' },
                { value: '30',    label: '30 days' },
                { value: '60',    label: '60 days' },
                { value: '90',    label: '90 days' },
              ]}
              onChange={(v) => { void updateApp('autoDeleteAfterDays', v === 'never' ? null : Number(v)); }}
            />
          </div>
        </Card>

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
