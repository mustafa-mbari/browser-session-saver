import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Settings } from '@core/types/settings.types';
import { DEFAULT_SETTINGS } from '@core/types/settings.types';
import { useMessaging } from '@shared/hooks/useMessaging';
import Button from '@shared/components/Button';
import Modal from '@shared/components/Modal';

export default function SettingsPage() {
  const { sendMessage } = useMessaging();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    sendMessage<Settings>({ action: 'UPDATE_SETTINGS', payload: {} }).then((r) => {
      if (r.success && r.data) setSettings(r.data as Settings);
    });
  }, [sendMessage]);

  const update = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await sendMessage({ action: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      {/* Auto-Save */}
      <SettingsSection title="Auto-Save">
        <Toggle label="Enable Auto-Save" checked={settings.enableAutoSave} onChange={(v) => update('enableAutoSave', v)} />
        <Range label="Save Interval" value={settings.saveInterval} min={5} max={60} step={5} unit="minutes" onChange={(v) => update('saveInterval', v)} />
        <NumberField label="Max Auto-Saves to Keep" value={settings.maxAutoSaves} min={10} max={500} onChange={(v) => update('maxAutoSaves', v)} />
        <Toggle label="Save on Browser Close" checked={settings.saveOnBrowserClose} onChange={(v) => update('saveOnBrowserClose', v)} />
        <Toggle label="Save on Low Battery" checked={settings.saveOnLowBattery} onChange={(v) => update('saveOnLowBattery', v)} />
        {settings.saveOnLowBattery && (
          <Range label="Battery Threshold" value={settings.lowBatteryThreshold} min={5} max={30} step={5} unit="%" onChange={(v) => update('lowBatteryThreshold', v)} />
        )}
        <Toggle label="Save on Sleep / Hibernate" checked={settings.saveOnSleep} onChange={(v) => update('saveOnSleep', v)} />
        <Toggle label="Save on Network Disconnect" checked={settings.saveOnNetworkDisconnect} onChange={(v) => update('saveOnNetworkDisconnect', v)} />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance">
        <Select label="Theme" value={settings.theme} options={[
          { value: 'system', label: 'System Default' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]} onChange={(v) => update('theme', v as Settings['theme'])} />
      </SettingsSection>

      {/* Behavior */}
      <SettingsSection title="Behavior">
        <Toggle label="Close Tabs After Saving" checked={settings.closeTabsAfterSave} onChange={(v) => update('closeTabsAfterSave', v)} />
        <Select label="Auto-delete Old Sessions After" value={String(settings.autoDeleteAfterDays ?? 'never')} options={[
          { value: 'never', label: 'Never' },
          { value: '7', label: '7 days' },
          { value: '14', label: '14 days' },
          { value: '30', label: '30 days' },
          { value: '60', label: '60 days' },
          { value: '90', label: '90 days' },
        ]} onChange={(v) => update('autoDeleteAfterDays', v === 'never' ? null : Number(v))} />
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="Data Management">
        <div className="space-y-3">
          <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>
            Clear All Session Data
          </Button>
          <p className="text-xs text-[var(--color-text-secondary)]">
            This will permanently delete all saved sessions. This action cannot be undone.
          </p>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="About">
        <div className="space-y-1 text-sm text-[var(--color-text-secondary)]">
          <p>Session Saver v1.0.0</p>
          <p>Save, restore, and manage browser sessions.</p>
        </div>
      </SettingsSection>

      {/* Clear Data Confirm Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Data?"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setShowClearConfirm(false); }}>
              Delete Everything
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm">
            This will permanently delete all saved sessions, auto-saves, and settings.
            This action cannot be undone. Consider exporting your data first.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4 pb-2 border-b border-[var(--color-border)]">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  );
}

function Range({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm text-[var(--color-text-secondary)]">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-600 accent-primary"
      />
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-center focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
