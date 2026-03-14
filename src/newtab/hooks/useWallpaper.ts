import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { buildBackgroundStyle, getUserWallpaperUrl } from '@core/services/wallpaper.service';
import { newtabDB } from '@core/storage/newtab-storage';
import type { NewTabSettings } from '@core/types/newtab.types';

export function useWallpaper(settings: NewTabSettings): { backgroundStyle: CSSProperties } {
  const objectUrlsRef = useRef<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (settings.backgroundType !== 'image' || !settings.backgroundImageId) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    getUserWallpaperUrl(newtabDB, settings.backgroundImageId)
      .then((url) => {
        if (cancelled || !url) return;
        setImageUrl(url);
        objectUrlsRef.current.push(url);
      })
      .catch(() => setImageUrl(null));

    return () => {
      cancelled = true;
    };
  }, [settings.backgroundType, settings.backgroundImageId]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const base = buildBackgroundStyle(settings);

  if (settings.backgroundType === 'image' && imageUrl) {
    const backgroundStyle: CSSProperties = {
      ...base,
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    return { backgroundStyle };
  }

  return { backgroundStyle: base };
}
