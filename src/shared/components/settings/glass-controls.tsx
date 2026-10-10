import type { ElementType, ReactNode } from 'react';

/** Settings controls in the start tab's glassmorphism style. */

export interface ToggleControlProps {
  label: string;
  description?: string;
  icon?: ElementType;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

export interface SelectControlProps {
  label: string;
  description?: string;
  icon?: ElementType;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function GlassSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'rgba(255,255,255,0.4)' }}>
      {children}
    </h3>
  );
}

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      {children}
    </div>
  );
}

export function GlassDivider() {
  return <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.07)' }} />;
}

function Label({ label, description, icon: Icon }: { label: string; description?: string; icon?: ElementType }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      {Icon && <Icon size={14} className="shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }} />}
      <div className="min-w-0">
        <div className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{description}</div>
        )}
      </div>
    </div>
  );
}

export function GlassToggle({ label, description, icon, checked, onChange }: ToggleControlProps) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
      <Label label={label} description={description} icon={icon} />
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
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

export function GlassRange({ label, value, min, max, step, unit, onChange }: RangeControlProps) {
  return (
    <div className="py-1">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm" style={{ color: 'var(--newtab-text)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none"
        style={{ accentColor: '#6366f1' }}
      />
    </div>
  );
}

export function GlassSelect({ label, description, icon, value, options, onChange }: SelectControlProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <Label label={label} description={description} icon={icon} />
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 px-2 py-1.5 text-sm rounded-lg outline-none"
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
