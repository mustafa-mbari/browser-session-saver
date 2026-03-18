import { useEffect, useRef } from 'react';
import { X, Palette, Image as ImageIcon, Sliders, Layers, Upload, Paintbrush } from 'lucide-react';
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

function GradientSwatch({ preset, active, onSelect }: {
  preset: GradientPreset;
  active: boolean;
  onSelect: () => void;
}) {
  const bg = `linear-gradient(${preset.angle}deg, ${preset.stops.join(', ')})`;
  return (
    <button
      onClick={onSelect}
      title={preset.name}
      className={`w-9 h-9 rounded-xl transition-all hover:scale-110 ${
        active
          ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110'
          : 'opacity-80 hover:opacity-100'
      }`}
      style={{ background: bg }}
      aria-label={preset.name}
    />
  );
}

const SLIDER_CONFIG: Array<{ label: string; key: keyof NewTabSettings; min: number; max: number }> = [
  { label: 'Blur',       key: 'backgroundBlur',       min: 0,  max: 20  },
  { label: 'Dimming',    key: 'backgroundDimming',     min: 0,  max: 80  },
  { label: 'Saturation', key: 'backgroundSaturation',  min: 50, max: 150 },
  { label: 'Brightness', key: 'backgroundBrightness',  min: 50, max: 120 },
];

const TOGGLE_CONFIG: Array<{ key: keyof NewTabSettings; label: string }> = [
  { key: 'backgroundVignette', label: 'Vignette'                  },
  { key: 'dailyRotation',      label: 'Daily gradient rotation'   },
];

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={12} style={{ color: 'var(--newtab-text-secondary)', opacity: 0.6 }} />
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--newtab-text-secondary)', opacity: 0.6 }}
      >
        {label}
      </span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-blue-500' : 'bg-white/20'
      }`}
    >
      <span
        className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

export default function WallpaperPicker({ isOpen, onClose, settings, onUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
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
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    const id = await saveUserWallpaper(newtabDB, file);
    onUpdate({ backgroundType: 'image', backgroundImageId: id });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <Paintbrush size={15} style={{ color: 'var(--newtab-text)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--newtab-text)' }}>
              Wallpaper & Background
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={15} style={{ color: 'var(--newtab-text-secondary)' }} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Gradient Presets */}
          <section>
            <SectionHeader icon={Layers} label="Gradient Presets" />
            <div className="flex flex-wrap gap-2">
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

          {/* Solid Color */}
          <section>
            <SectionHeader icon={Palette} label="Solid Color" />
            <label className="flex items-center gap-3 cursor-pointer group p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors">
              {/* Swatch with palette icon overlay + hidden native color input */}
              <div className="relative shrink-0">
                <div
                  className="w-11 h-11 rounded-xl border border-white/20 group-hover:border-white/40 transition-colors shadow-md"
                  style={{ backgroundColor: settings.backgroundColor }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Palette
                    size={14}
                    style={{ color: 'rgba(255,255,255,0.75)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                  />
                </div>
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundType: 'solid', backgroundColor: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-xl"
                  title="Pick a color"
                />
              </div>

              {/* Label + hex value */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight" style={{ color: 'var(--newtab-text)' }}>
                  Pick color
                </p>
                <p
                  className="text-xs font-mono uppercase mt-0.5"
                  style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}
                >
                  {settings.backgroundColor}
                </p>
              </div>

              {/* Active indicator */}
              {settings.backgroundType === 'solid' && (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: '#60a5fa', boxShadow: '0 0 8px rgba(96,165,250,0.7)' }}
                />
              )}
            </label>
          </section>

          {/* Custom Image */}
          <section>
            <SectionHeader icon={ImageIcon} label="Custom Image" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { void handleFileUpload(e); }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/12 hover:border-white/25 hover:bg-white/5 transition-colors"
            >
              <Upload size={15} style={{ color: 'var(--newtab-text-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>Choose Image</span>
              <span
                className="ml-auto text-xs"
                style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}
              >
                JPG · PNG · WebP · max 5 MB
              </span>
            </button>
          </section>

          {/* Adjustments */}
          <section>
            <SectionHeader icon={Sliders} label="Adjustments" />
            <div className="flex flex-col gap-3">
              {SLIDER_CONFIG.map(({ label, key, min, max }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs w-20 shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>
                    {label}
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={settings[key] as number}
                    onChange={(e) => onUpdate({ [key]: Number(e.target.value) })}
                    className="flex-1 accent-blue-400"
                  />
                  <span
                    className="text-xs w-7 text-right font-mono tabular-nums"
                    style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}
                  >
                    {settings[key] as number}
                  </span>
                </div>
              ))}

              {/* Toggle switches */}
              <div className="flex flex-col gap-2.5 pt-2 border-t border-white/8">
                {TOGGLE_CONFIG.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <Toggle
                      checked={settings[key] as boolean}
                      onChange={(v) => onUpdate({ [key]: v })}
                    />
                    <span className="text-xs" style={{ color: 'var(--newtab-text)' }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
