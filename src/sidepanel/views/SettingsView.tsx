import { useState, useEffect } from 'react';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { useMessaging } from '@shared/hooks/useMessaging';
import { useSidePanelStore } from '../stores/sidepanel.store';

export default function SettingsView() {
  const { sendMessage } = useMessaging();
  const { navigateTo } = useSidePanelStore();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load current settings
    const loadSettings = async () => {
      const response = await sendMessage<Settings>({
        action: 'UPDATE_SETTINGS',
        payload: {},
      });
      if (response.success && response.data) {
        setSettings(response.data as Settings);
      }
    };
    loadSettings();
  }, [sendMessage]);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await sendMessage({ action: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Auto-Save Section */}
      <Section title="Auto-Save">
        <Toggle
          label="Enable Auto-Save"
          checked={settings.enableAutoSave}
          onChange={(v) => updateSetting('enableAutoSave', v)}
        />
        <Slider
          label="Save Interval"
          value={settings.saveInterval}
          min={5}
          max={60}
          step={5}
          unit="min"
          onChange={(v) => updateSetting('saveInterval', v)}
        />
        <NumberInput
          label="Max Auto-Saves"
          value={settings.maxAutoSaves}
          min={10}
          max={200}
          onChange={(v) => updateSetting('maxAutoSaves', v)}
        />
        <Toggle
          label="Save on Browser Close"
          checked={settings.saveOnBrowserClose}
          onChange={(v) => updateSetting('saveOnBrowserClose', v)}
        />
        <Toggle
          label="Save on Low Battery"
          checked={settings.saveOnLowBattery}
          onChange={(v) => updateSetting('saveOnLowBattery', v)}
        />
        {settings.saveOnLowBattery && (
          <Slider
            label="Battery Threshold"
            value={settings.lowBatteryThreshold}
            min={5}
            max={30}
            step={5}
            unit="%"
            onChange={(v) => updateSetting('lowBatteryThreshold', v)}
          />
        )}
        <Toggle
          label="Save on Sleep / Hibernate"
          checked={settings.saveOnSleep}
          onChange={(v) => updateSetting('saveOnSleep', v)}
        />
        <Toggle
          label="Save on Network Disconnect"
          checked={settings.saveOnNetworkDisconnect}
          onChange={(v) => updateSetting('saveOnNetworkDisconnect', v)}
        />
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Select
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => updateSetting('theme', v as Settings['theme'])}
        />
      </Section>

      {/* Behavior */}
      <Section title="Behavior">
        <Toggle
          label="Close Tabs After Saving"
          checked={settings.closeTabsAfterSave}
          onChange={(v) => updateSetting('closeTabsAfterSave', v)}
        />
      </Section>

      {/* Data */}
      <Section title="Data">
        <button
          onClick={() => navigateTo('import-export')}
          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
        >
          Import / Export Sessions
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--color-border)]">
      <h3 className="px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        {title}
      </h3>
      <div className="px-3 pb-3 space-y-3">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
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
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
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
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 accent-primary"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <select
        value={value}
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
  );
}
