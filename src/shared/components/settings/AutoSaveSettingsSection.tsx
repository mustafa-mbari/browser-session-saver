import { Fragment, type ReactNode } from 'react';
import { Calendar, Camera, Clock, Filter, Moon, Power, Scissors, WifiOff } from 'lucide-react';
import { useAppSettings } from '@shared/hooks/useAppSettings';
import {
  GlassSectionTitle,
  GlassToggle,
  GlassRange,
  GlassSelect,
} from './glass-controls';
import { PanelSection, PanelToggle, PanelSlider, PanelSelect } from './panel-controls';

const AUTO_DELETE_OPTIONS = [
  { value: 'never', label: 'Never' },
  ...[7, 14, 30, 60, 90, 180, 365].map((days) => ({ value: String(days), label: `${days} days` })),
];

const CONTROLS = {
  sidepanel: {
    group: (title: string, rows: ReactNode) => <PanelSection title={title}>{rows}</PanelSection>,
    Toggle: PanelToggle,
    Range: PanelSlider,
    Select: PanelSelect,
  },
  newtab: {
    group: (title: string, rows: ReactNode) => (
      <div>
        <GlassSectionTitle>{title}</GlassSectionTitle>
        <div className="flex flex-col gap-0.5">{rows}</div>
      </div>
    ),
    Toggle: GlassToggle,
    Range: GlassRange,
    Select: GlassSelect,
  },
} as const;

interface Props {
  variant: keyof typeof CONTROLS;
  /** Wraps each group of rows. Defaults to the variant's standard group container. */
  renderGroup?: (title: string, rows: ReactNode) => ReactNode;
}

/** Auto-save and session settings, shared by every settings screen. */
export default function AutoSaveSettingsSection({ variant, renderGroup }: Props) {
  const { settings, updateSetting } = useAppSettings();
  const { Toggle, Range, Select, group } = CONTROLS[variant];
  const wrap = renderGroup ?? group;

  const autoDeleteValue =
    settings.autoDeleteAfterDays == null ? 'never' : String(settings.autoDeleteAfterDays);
  // Keep a custom value chosen in an older version selectable.
  const autoDeleteOptions = AUTO_DELETE_OPTIONS.some((o) => o.value === autoDeleteValue)
    ? AUTO_DELETE_OPTIONS
    : [...AUTO_DELETE_OPTIONS, { value: autoDeleteValue, label: `${autoDeleteValue} days` }];

  const autoSaveRows = (
    <>
      <Toggle
        icon={Clock}
        label="Enable auto-save"
        description="Regularly save all open tabs"
        checked={settings.enableAutoSave}
        onChange={(v) => void updateSetting('enableAutoSave', v)}
      />
      {settings.enableAutoSave && (
        <>
          <Range
            label="Save interval"
            value={settings.saveInterval}
            min={5}
            max={60}
            step={5}
            unit="min"
            onChange={(v) => void updateSetting('saveInterval', v)}
          />
          <Toggle
            icon={Power}
            label="Save on browser close"
            description="Keep the tabs that were open when the browser closed"
            checked={settings.saveOnBrowserClose}
            onChange={(v) => void updateSetting('saveOnBrowserClose', v)}
          />
          <Toggle
            icon={Moon}
            label="Save on sleep or lock"
            checked={settings.saveOnSleep}
            onChange={(v) => void updateSetting('saveOnSleep', v)}
          />
          <Toggle
            icon={WifiOff}
            label="Save on network disconnect"
            checked={settings.saveOnNetworkDisconnect}
            onChange={(v) => void updateSetting('saveOnNetworkDisconnect', v)}
          />
          <Toggle
            icon={Camera}
            label="Snapshot mode"
            description="On: the auto-save matches exactly what is open. Off: closed tabs stay in it."
            checked={settings.autoSaveOnTabClose}
            onChange={(v) => void updateSetting('autoSaveOnTabClose', v)}
          />
        </>
      )}
    </>
  );

  const sessionRows = (
    <>
      <Toggle
        icon={Scissors}
        label="Close tabs after saving"
        description="Close the window's tabs when you save a session"
        checked={settings.closeTabsAfterSave}
        onChange={(v) => void updateSetting('closeTabsAfterSave', v)}
      />
      <Toggle
        icon={Filter}
        label="Remove closed tabs when updating"
        description="Updating a session also drops tabs that are no longer open"
        checked={settings.removeClosedTabsOnUpdate}
        onChange={(v) => void updateSetting('removeClosedTabsOnUpdate', v)}
      />
      <Select
        icon={Calendar}
        label="Auto-delete old sessions"
        description="Pinned, locked and starred sessions are always kept"
        value={autoDeleteValue}
        options={autoDeleteOptions}
        onChange={(v) => void updateSetting('autoDeleteAfterDays', v === 'never' ? null : Number(v))}
      />
    </>
  );

  return (
    <>
      <Fragment key="auto-save">{wrap('Auto-Save', autoSaveRows)}</Fragment>
      <Fragment key="sessions">{wrap('Sessions', sessionRows)}</Fragment>
    </>
  );
}
