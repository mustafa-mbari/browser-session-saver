import { useState, Fragment } from 'react';
import { X, AlertTriangle, Monitor, ALargeSmall } from 'lucide-react';
import type { TextSizeMode, NewTabSettings, SearchEngine } from '@core/types/newtab.types';
import { useAppSettings } from '@shared/hooks/useAppSettings';
import { useOnboardingFlag } from '@shared/components/OnboardingModal';
import AutoSaveSettingsSection from '@shared/components/settings/AutoSaveSettingsSection';
import {
  GlassDivider as Divider,
  GlassSectionTitle as SectionTitle,
  GlassToggle as Toggle,
} from '@shared/components/settings/glass-controls';

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

export default function SettingsPanel({ settings, onUpdate, onClose, onClearData }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { reset: resetOnboarding } = useOnboardingFlag();
  const { settings: appSettings, updateSetting: updateApp } = useAppSettings();

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
            </div>
          </section>

          <Divider />

          {/* Theme */}
          <section>
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
          </section>

          <Divider />

          <AutoSaveSettingsSection
            variant="newtab"
            renderGroup={(title, rows) => (
              <Fragment>
                <section>
                  <SectionTitle>{title}</SectionTitle>
                  <div className="flex flex-col gap-0.5">{rows}</div>
                </section>
                <Divider />
              </Fragment>
            )}
          />

          {/* Help */}
          <section>
            <SectionTitle>Help</SectionTitle>
            <button
              onClick={() => { void resetOnboarding(); onClose(); }}
              className="w-full px-3 py-2 rounded-lg text-sm text-left transition-colors"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#c7d2fe',
              }}
            >
              Show welcome tour
            </button>
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Replays the 7-step first-launch tutorial in every open Browser Hub surface.
            </p>
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
