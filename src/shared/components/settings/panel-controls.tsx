import type { ReactNode } from 'react';
import type { ToggleControlProps, RangeControlProps, SelectControlProps } from './glass-controls';

/** Settings controls in the side panel style (theme tokens, light and dark). */

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[var(--color-border)]">
      <h3 className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        {title}
      </h3>
      <div className="px-3 pb-3 space-y-3">{children}</div>
    </div>
  );
}

export function PanelToggle({ label, description, checked, onChange }: ToggleControlProps) {
  return (
    <div className="space-y-0.5">
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">{label}</span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 ${
            checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              checked ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </label>
      {description && (
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{description}</p>
      )}
    </div>
  );
}

export function PanelSlider({ label, value, min, max, step, unit, onChange }: RangeControlProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 accent-primary"
      />
    </div>
  );
}

export function PanelSelect({ label, description, value, options, onChange }: SelectControlProps) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {description && (
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{description}</p>
      )}
    </div>
  );
}
