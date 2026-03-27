import { useEffect, useRef } from 'react';
import { X, Palette, Image as ImageIcon, Sliders, Layers, Upload, Paintbrush, Check } from 'lucide-react';
import type { NewTabSettings, GradientPreset } from '@core/types/newtab.types';
import { GRADIENT_PRESETS } from '@core/types/newtab.types';
import { saveUserWallpaper } from '@core/services/wallpaper.service';
import { newtabDB } from '@core/storage/newtab-storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: NewTabSettings;
  onUpdate: (updates: Partial<NewTabSettings>) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon size={11} style={{ color: 'rgba(255,255,255,0.45)' }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {children}
      </span>
    </div>
  );
}

function Sep() {
  return <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />;
}

/** Rem-based toggle — scales correctly with font-size changes */
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 ${
          checked ? 'bg-indigo-500' : 'bg-white/20'
        }`}
      >
        {/* Thumb uses rem-based sizing so it scales with font-size */}
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function GradientSwatch({ preset, active, onSelect }: {
  preset: GradientPreset;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      title={preset.name}
      aria-label={preset.name}
      className={`w-8 h-8 rounded-lg transition-all duration-150 hover:scale-110 ${
        active ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-105' : 'opacity-75 hover:opacity-100'
      }`}
      style={{ background: `linear-gradient(${preset.angle}deg, ${preset.stops.join(', ')})` }}
    />
  );
}

const SLIDER_CONFIG: Array<{ label: string; key: keyof NewTabSettings; min: number; max: number }> = [
  { label: 'Blur',        key: 'backgroundBlur',        min: 0,  max: 20  },
  { label: 'Dimming',     key: 'backgroundDimming',      min: 0,  max: 80  },
  { label: 'Saturation',  key: 'backgroundSaturation',   min: 50, max: 150 },
  { label: 'Brightness',  key: 'backgroundBrightness',   min: 50, max: 120 },
];

const TOGGLE_CONFIG: Array<{ key: keyof NewTabSettings; label: string }> = [
  { key: 'backgroundVignette', label: 'Vignette' },
  { key: 'dailyRotation',      label: 'Daily gradient rotation' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function WallpaperPicker({ isOpen, onClose, settings, onUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return; }
    const id = await saveUserWallpaper(newtabDB, file);
    onUpdate({ backgroundType: 'image', backgroundImageId: id });
  };

  const isActiveBundled =
    settings.backgroundType === 'bundled' &&
    settings.backgroundBundledPath === 'Custom_Image_1.jpg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-panel rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <Paintbrush size={14} style={{ color: 'var(--newtab-text)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
              Wallpaper &amp; Background
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-4">

          {/* Gradient Presets */}
          <section>
            <SectionLabel icon={Layers}>Gradient Presets</SectionLabel>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2rem, 1fr))' }}>
              {GRADIENT_PRESETS.map((preset) => (
                <GradientSwatch
                  key={preset.id}
                  preset={preset}
                  active={
                    settings.backgroundType === 'gradient' &&
                    settings.backgroundGradientStops.join() === preset.stops.join()
                  }
                  onSelect={() =>
                    onUpdate({
                      backgroundType: 'gradient',
                      backgroundGradientStops: preset.stops,
                      backgroundGradientAngle: preset.angle,
                    })
                  }
                />
              ))}
            </div>
          </section>

          <Sep />

          {/* Solid Color */}
          <section>
            <SectionLabel icon={Palette}>Solid Color</SectionLabel>
            <label className="flex items-center gap-3 cursor-pointer group rounded-xl px-2 py-1.5 -mx-2 hover:bg-white/5 transition-colors">
              <div className="relative shrink-0">
                <div
                  className="w-10 h-10 rounded-xl border border-white/20 group-hover:border-white/35 transition-colors shadow"
                  style={{ backgroundColor: settings.backgroundColor }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Palette size={12} style={{ color: 'rgba(255,255,255,0.8)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }} />
                </div>
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundType: 'solid', backgroundColor: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-xl"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--newtab-text)' }}>Pick color</p>
                <p className="text-xs font-mono uppercase opacity-50 mt-0.5" style={{ color: 'var(--newtab-text)' }}>
                  {settings.backgroundColor}
                </p>
              </div>
              {settings.backgroundType === 'solid' && (
                <Check size={14} className="shrink-0 text-blue-400" />
              )}
            </label>
          </section>

          <Sep />

          {/* Images — preset + upload side by side */}
          <section>
            <SectionLabel icon={ImageIcon}>Images</SectionLabel>
            <div className="flex gap-2">
              {/* Preset thumbnail */}
              <button
                onClick={() => onUpdate({ backgroundType: 'bundled', backgroundBundledPath: 'Custom_Image_1.jpg' })}
                className={`relative flex-1 h-14 rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                  isActiveBundled ? 'border-blue-400' : 'border-white/10 hover:border-white/25'
                }`}
                aria-label="Custom Image 1"
              >
                <img
                  src={chrome.runtime.getURL('Custom_Image_1.jpg')}
                  alt="Custom Image 1"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-1.5">
                  <span className="text-[10px] font-medium text-white">Custom Image 1</span>
                </div>
                {isActiveBundled && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center">
                    <Check size={9} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>

              {/* Upload button */}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { void handleFileUpload(e); }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1 w-full h-14 rounded-xl border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
                >
                  <Upload size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Upload image</span>
                </button>
              </div>
            </div>
          </section>

          <Sep />

          {/* Adjustments */}
          <section className="pb-1">
            <SectionLabel icon={Sliders}>Adjustments</SectionLabel>
            <div className="flex flex-col gap-2">
              {SLIDER_CONFIG.map(({ label, key, min, max }) => (
                <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: '5.5rem 1fr 1.75rem' }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={settings[key] as number}
                    onChange={(e) => onUpdate({ [key]: Number(e.target.value) })}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer accent-indigo-400"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  />
                  <span className="text-xs text-right font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {settings[key] as number}
                  </span>
                </div>
              ))}

              <div
                className="flex flex-col gap-0.5 mt-1 pt-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
              >
                {TOGGLE_CONFIG.map(({ key, label }) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    checked={settings[key] as boolean}
                    onChange={(v) => onUpdate({ [key]: v })}
                  />
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
