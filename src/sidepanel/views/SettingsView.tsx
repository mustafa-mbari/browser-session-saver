import { useState, useEffect } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { Settings } from '@core/types/settings.types';
import { getNewTabSettings, updateNewTabSettings } from '@core/services/newtab-settings.service';
import { useAppSettings } from '@shared/hooks/useAppSettings';
import { useOnboardingFlag } from '@shared/components/OnboardingModal';
import AutoSaveSettingsSection from '@shared/components/settings/AutoSaveSettingsSection';
import { PanelSection, PanelToggle, PanelSelect } from '@shared/components/settings/panel-controls';
import { useSidePanelStore } from '../stores/sidepanel.store';

export default function SettingsView() {
  const { navigateTo } = useSidePanelStore();
  const { reset: resetOnboarding } = useOnboardingFlag();
  const { settings, updateSetting } = useAppSettings();
  const [newtabEnabled, setNewtabEnabled] = useState(true);

  useEffect(() => {
    void getNewTabSettings().then((s) => setNewtabEnabled(s.enabled));
  }, []);

  const toggleNewtab = async (v: boolean) => {
    setNewtabEnabled(v);
    await updateNewTabSettings({ enabled: v });
  };

  return (
    <div className="flex-1 overflow-auto">
      <AutoSaveSettingsSection variant="sidepanel" />

      {/* Appearance */}
      <PanelSection title="Appearance">
        <PanelSelect
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(v) => void updateSetting('theme', v as Settings['theme'])}
        />
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <MoveHorizontal size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-[var(--color-text)]">Resize Side Panel</p>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
              Drag the left edge of this panel to adjust its width. Chrome remembers your preferred size.
            </p>
          </div>
        </div>
      </PanelSection>

      {/* New Tab Page */}
      <PanelSection title="New Tab Page">
        <PanelToggle
          label="Enable New Tab Override"
          checked={newtabEnabled}
          onChange={(v) => void toggleNewtab(v)}
          description="When disabled, a blank page is shown instead of Browser Hub."
        />
      </PanelSection>

      {/* Data */}
      <PanelSection title="Data">
        <button
          onClick={() => navigateTo('import-export')}
          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
        >
          Import / Export Sessions
        </button>
      </PanelSection>

      {/* Help */}
      <PanelSection title="Help">
        <button
          onClick={() => void resetOnboarding()}
          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
        >
          Show welcome tour
        </button>
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug px-3">
          Replays the 7-step first-launch tutorial in every open Browser Hub surface.
        </p>
      </PanelSection>
    </div>
  );
}
