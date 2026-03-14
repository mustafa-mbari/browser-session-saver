import { useRef } from 'react';
import Modal from '@shared/components/Modal';
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
      className={`w-10 h-10 rounded-lg transition-transform hover:scale-105 ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}`}
      style={{ background: bg }}
      aria-label={preset.name}
    />
  );
}

export default function WallpaperPicker({ isOpen, onClose, settings, onUpdate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <Modal isOpen={isOpen} onClose={onClose} title="Wallpaper & Background">
      <div className="flex flex-col gap-5">

        {/* Gradient presets */}
        <section>
          <p className="text-xs font-semibold uppercase opacity-60 mb-2">Gradient Presets</p>
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

        {/* Solid color */}
        <section>
          <p className="text-xs font-semibold uppercase opacity-60 mb-2">Solid Color</p>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={(e) => onUpdate({ backgroundType: 'solid', backgroundColor: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
            title="Pick a color"
          />
        </section>

        {/* Upload image */}
        <section>
          <p className="text-xs font-semibold uppercase opacity-60 mb-2">Upload Image</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { void handleFileUpload(e); }}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Choose Image (max 5MB)
          </button>
        </section>

        {/* Adjustments */}
        <section>
          <p className="text-xs font-semibold uppercase opacity-60 mb-3">Adjustments</p>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Blur', key: 'backgroundBlur' as const, min: 0, max: 20 },
              { label: 'Dimming', key: 'backgroundDimming' as const, min: 0, max: 80 },
              { label: 'Saturation', key: 'backgroundSaturation' as const, min: 50, max: 150 },
              { label: 'Brightness', key: 'backgroundBrightness' as const, min: 50, max: 120 },
            ].map(({ label, key, min, max }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs w-20 shrink-0">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={settings[key] as number}
                  onChange={(e) => onUpdate({ [key]: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs w-8 text-right opacity-60">{settings[key] as number}</span>
              </div>
            ))}

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings.backgroundVignette}
                onChange={(e) => onUpdate({ backgroundVignette: e.target.checked })}
                className="rounded"
              />
              Vignette
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings.dailyRotation}
                onChange={(e) => onUpdate({ dailyRotation: e.target.checked })}
                className="rounded"
              />
              Daily rotation
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
}
