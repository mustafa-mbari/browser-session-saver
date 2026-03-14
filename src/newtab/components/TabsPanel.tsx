import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

interface ChromeTab {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  active: boolean;
}

export default function TabsPanel() {
  const [tabs, setTabs] = useState<ChromeTab[]>([]);

  useEffect(() => {
    chrome.tabs.query({ currentWindow: true }, (results) => {
      setTabs(results);
    });
  }, []);

  const switchTab = (tabId: number | undefined) => {
    if (tabId !== undefined) {
      chrome.tabs.update(tabId, { active: true });
    }
  };

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
      <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--newtab-text)' }}>
        Open Tabs ({tabs.length})
      </h3>
      {tabs.map((tab, idx) => (
        <button
          key={tab.id ?? idx}
          onClick={() => switchTab(tab.id)}
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-left ${
            tab.active ? 'bg-white/15' : ''
          }`}
        >
          {tab.favIconUrl ? (
            <img src={tab.favIconUrl} alt="" className="w-4 h-4 rounded shrink-0" />
          ) : (
            <Globe size={16} className="shrink-0 opacity-50" style={{ color: 'var(--newtab-text)' }} />
          )}
          <div className="flex-1 min-w-0">
            <div
              className="text-sm truncate"
              style={{ color: 'var(--newtab-text)' }}
            >
              {tab.title ?? tab.url ?? 'Untitled'}
            </div>
            {tab.url && (
              <div className="text-xs truncate opacity-50" style={{ color: 'var(--newtab-text)' }}>
                {tab.url}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
