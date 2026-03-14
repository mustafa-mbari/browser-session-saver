import { FolderOpen, Layers2, Clock, HardDrive } from 'lucide-react';
import type { Session } from '@core/types/session.types';

interface StatsWidgetProps {
  sessions: Session[];
}

export default function StatsWidget({ sessions }: StatsWidgetProps) {
  const totalTabs = sessions.reduce((sum, s) => sum + s.tabCount, 0);
  const autoSaves = sessions.filter((s) => s.isAutoSave).length;
  const estimatedSize = (JSON.stringify(sessions).length / 1024).toFixed(1);

  const stats = [
    { icon: FolderOpen, label: 'Sessions', value: sessions.length },
    { icon: Layers2, label: 'Total Tabs', value: totalTabs },
    { icon: Clock, label: 'Auto-Saves', value: autoSaves },
    { icon: HardDrive, label: 'Storage', value: `${estimatedSize} KB` },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="p-3 rounded-card bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <Icon size={18} className="text-primary mb-1.5" />
            <p className="text-lg font-semibold">{stat.value}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
