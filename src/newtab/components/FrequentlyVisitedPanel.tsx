import { useEffect, useState } from 'react';
import EmptyState from '@shared/components/EmptyState';
import { Globe } from 'lucide-react';
import { getFaviconUrl } from '@core/utils/favicon';

interface Site {
  url: string;
  title: string;
}

export default function FrequentlyVisitedPanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [hasPermission, setHasPermission] = useState(true);

  useEffect(() => {
    if (!chrome.topSites) {
      setHasPermission(false);
      return;
    }
    chrome.topSites.get((results) => {
      if (chrome.runtime.lastError) {
        setHasPermission(false);
        return;
      }
      setSites(results.slice(0, 8));
    });
  }, []);

  if (!hasPermission) {
    return (
      <div className="flex justify-center py-8">
        <EmptyState
          icon={Globe}
          title="Permission Required"
          description="The topSites permission is needed to show frequently visited pages."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 justify-center py-4">
      {sites.map((site) => {
        const faviconUrl = getFaviconUrl(site.url);
        return (
          <a
            key={site.url}
            href={site.url}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="glass w-20 h-20 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shadow-md">
              <img
                src={faviconUrl}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <span
              className="text-xs truncate max-w-[80px] text-center"
              style={{ color: 'var(--newtab-text-secondary)' }}
            >
              {site.title || new URL(site.url).hostname}
            </span>
          </a>
        );
      })}
    </div>
  );
}
