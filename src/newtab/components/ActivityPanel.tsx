import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import EmptyState from '@shared/components/EmptyState';

interface HistoryItem {
  id: string;
  url: string;
  title?: string;
  visitCount?: number;
  lastVisitTime?: number;
}

export default function ActivityPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.permissions.contains({ permissions: ['history'] }, (granted) => {
      setHasPermission(granted);
      if (!granted) return;
      chrome.history.search(
        { text: '', maxResults: 50, startTime: Date.now() - 86400000 },
        (results) => setItems(results as HistoryItem[]),
      );
    });
  }, []);

  const requestPermission = () => {
    chrome.permissions.request({ permissions: ['history'] }, (granted) => {
      setHasPermission(granted);
    });
  };

  if (hasPermission === null) return null;

  if (!hasPermission) {
    return (
      <div className="flex justify-center py-8">
        <EmptyState
          icon={History}
          title="History Access Required"
          description="Grant the history permission to view your recent activity."
          action={
            <button
              onClick={requestPermission}
              className="glass px-4 py-2 rounded-lg text-sm mt-2 hover:bg-white/20 transition-colors"
              style={{ color: 'var(--newtab-text)' }}
            >
              Grant Permission
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
      <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--newtab-text)' }}>
        Recent Activity
      </h3>
      {items.map((item, idx) => (
        <a
          key={item.id ?? idx}
          href={item.url}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <img
            src={`chrome://favicon/size/16@1x/${encodeURIComponent(item.url)}`}
            alt=""
            className="w-4 h-4 rounded shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate" style={{ color: 'var(--newtab-text)' }}>
              {item.title || item.url}
            </div>
            <div className="text-xs truncate opacity-50" style={{ color: 'var(--newtab-text)' }}>
              {item.url}
            </div>
          </div>
          {item.visitCount && (
            <span className="text-xs opacity-50 shrink-0" style={{ color: 'var(--newtab-text)' }}>
              {item.visitCount}×
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
