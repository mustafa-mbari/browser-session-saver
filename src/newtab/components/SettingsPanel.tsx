import { useState, useEffect } from 'react';
import { X, AlertTriangle, Monitor, ALargeSmall } from 'lucide-react';
import type { TextSizeMode, NewTabSettings, SearchEngine } from '@core/types/newtab.types';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { useMessaging } from '@shared/hooks/useMessaging';

interface Props {
  settings: NewTabSettings;
  onUpdate: (updates: Partial<NewTabSettings>) => void;
  onClose: () => void;
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

export default function SettingsPanel({ settings, onUpdate, onClose, onClearData }: Props) {
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-[380px] flex flex-col overflow-hidden"
        style={{
          background: 'rgba(12, 12, 28, 0.96)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          color: 'var(--newtab-text)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--newtab-text)' }}>Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close settings"
          >
            <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">

          {/* New Tab Override toggle */}
          <section>
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
          </section>

          <Divider />

          {/* Text Size */}
          <section>
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
            <Toggle
              label="Compact density"
              desc="Reduces card padding and spacing"
              checked={settings.cardDensity === 'compact'}
              onChange={(v) => onUpdate({ cardDensity: v ? 'compact' : 'comfortable' })}
            />
          </section>

          <Divider />

          {/* Search engine */}
          <section>
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
          </section>

          <Divider />

          {/* Clock */}
          <section>
            <SectionTitle>Clock</SectionTitle>
            <div className="flex gap-2 mb-3">
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
          </section>

          <Divider />

          {/* Widgets */}
          <section>
            <SectionTitle>Widgets</SectionTitle>
            <div className="flex flex-col">
              <Toggle label="Show Clock"       checked={settings.showClock}      onChange={(v) => onUpdate({ showClock: v })} />
              <Toggle label="Show Quick Links" checked={settings.showQuickLinks} onChange={(v) => onUpdate({ showQuickLinks: v })} />
              <Toggle label="Show To-Do"       checked={settings.showTodo}       onChange={(v) => onUpdate({ showTodo: v })} />
              <Toggle label="Show Sessions"    checked={settings.showSessions}   onChange={(v) => onUpdate({ showSessions: v })} />
            </div>
          </section>

          <Divider />

          {/* Theme */}
          <section>
            <SectionTitle>Theme</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => {
                const active = settings.theme === t;
                return (
                  <button
                    key={t}
                    onClick={() => onUpdate({ theme: t })}
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
          </section>

          <Divider />

          {/* Auto-Save */}
          <section>
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
          </section>

          <Divider />

          {/* Behavior */}
          <section>
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
          </section>

          <Divider />

          {/* Danger Zone */}
          <section className="pb-2">
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
          </section>

        </div>
      </div>
    </>
  );
}
