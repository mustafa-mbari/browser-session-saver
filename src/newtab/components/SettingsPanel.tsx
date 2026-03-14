import { X } from 'lucide-react';
import type { LayoutMode, NewTabSettings, SearchEngine } from '@core/types/newtab.types';

interface Props {
  settings: NewTabSettings;
  onUpdate: (updates: Partial<NewTabSettings>) => void;
  onClose: () => void;
}

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; desc: string }[] = [
  { value: 'minimal', label: 'Minimal', desc: 'Search & clock only' },
  { value: 'focus', label: 'Focus', desc: 'Search + quick links + to-do' },
  { value: 'dashboard', label: 'Dashboard', desc: 'Full layout with sidebar' },
];

const SEARCH_ENGINE_OPTIONS: { value: SearchEngine; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'bing', label: 'Bing' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'brave', label: 'Brave' },
  { value: 'custom', label: 'Custom' },
];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-400'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </label>
  );
}

export default function SettingsPanel({ settings, onUpdate, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 glass-panel overflow-auto"
      style={{ color: 'var(--newtab-text)' }}
    >
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-8">

          {/* Enable / Disable */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">New Tab Page</h3>
            <Toggle
              label="Enable New Tab Override"
              checked={settings.enabled}
              onChange={(v) => onUpdate({ enabled: v })}
            />
            {!settings.enabled && (
              <p className="text-xs opacity-60 mt-2">
                When disabled, a blank page is shown. To fully restore Chrome's default new tab,
                disable this extension.
              </p>
            )}
          </section>

          {/* Layout */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">Layout</h3>
            <div className="flex flex-col gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="layout"
                    value={opt.value}
                    checked={settings.layoutMode === opt.value}
                    onChange={() => onUpdate({ layoutMode: opt.value })}
                    className="accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs opacity-60">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Toggle
                label="Compact density"
                checked={settings.cardDensity === 'compact'}
                onChange={(v) => onUpdate({ cardDensity: v ? 'compact' : 'comfortable' })}
              />
            </div>
          </section>

          {/* Search engine */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">Search Engine</h3>
            <div className="flex flex-col gap-2">
              {SEARCH_ENGINE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="search-engine"
                    value={opt.value}
                    checked={settings.searchEngine === opt.value}
                    onChange={() => onUpdate({ searchEngine: opt.value })}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
              {settings.searchEngine === 'custom' && (
                <input
                  type="text"
                  value={settings.customSearchUrl ?? ''}
                  onChange={(e) => onUpdate({ customSearchUrl: e.target.value })}
                  placeholder="https://search.example.com/?q="
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm outline-none mt-1 placeholder-white/30"
                  style={{ color: 'var(--newtab-text)' }}
                />
              )}
            </div>
          </section>

          {/* Clock */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">Clock</h3>
            <div className="flex gap-4">
              {(['12h', '24h'] as const).map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="clock-format"
                    checked={settings.clockFormat === fmt}
                    onChange={() => onUpdate({ clockFormat: fmt })}
                    className="accent-primary"
                  />
                  {fmt}
                </label>
              ))}
            </div>
          </section>

          {/* Widgets */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">Widgets</h3>
            <div className="flex flex-col gap-3">
              <Toggle label="Show Clock" checked={settings.showClock} onChange={(v) => onUpdate({ showClock: v })} />
              <Toggle label="Show Quick Links" checked={settings.showQuickLinks} onChange={(v) => onUpdate({ showQuickLinks: v })} />
              <Toggle label="Show To-Do" checked={settings.showTodo} onChange={(v) => onUpdate({ showTodo: v })} />
              <Toggle label="Show Sessions" checked={settings.showSessions} onChange={(v) => onUpdate({ showSessions: v })} />
              <Toggle label="Show Bookmarks" checked={settings.showBookmarks} onChange={(v) => onUpdate({ showBookmarks: v })} />
            </div>
          </section>

          {/* Theme */}
          <section>
            <h3 className="text-sm font-semibold uppercase opacity-60 mb-3">Theme</h3>
            <div className="flex gap-4">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm capitalize">
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === t}
                    onChange={() => onUpdate({ theme: t })}
                    className="accent-primary"
                  />
                  {t}
                </label>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
