import type { CSSProperties } from 'react';
import type { NewTabDB } from '@core/storage/newtab-storage';
import type { NewTabSettings } from '@core/types/newtab.types';
import { generateId } from '@core/utils/uuid';

export async function saveUserWallpaper(db: NewTabDB, file: File): Promise<string> {
  const id = generateId();
  await db.putBlob(id, file);
  return id;
}

export async function getUserWallpaperUrl(db: NewTabDB, id: string): Promise<string | null> {
  const blob = await db.getBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deleteUserWallpaper(db: NewTabDB, id: string): Promise<void> {
  await db.deleteBlob(id);
}

export function buildBackgroundStyle(settings: NewTabSettings): CSSProperties {
  const {
    backgroundType,
    backgroundColor,
    backgroundGradientStops,
    backgroundGradientAngle,
    backgroundBlur,
    backgroundDimming: _dimming,
    backgroundSaturation,
    backgroundBrightness,
  } = settings;

  const filter = [
    backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : '',
    backgroundSaturation !== 100 ? `saturate(${backgroundSaturation}%)` : '',
    backgroundBrightness !== 100 ? `brightness(${backgroundBrightness}%)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const base: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    filter: filter || undefined,
  };

  if (backgroundType === 'gradient') {
    const stops = backgroundGradientStops.join(', ');
    return {
      ...base,
      background: `linear-gradient(${backgroundGradientAngle}deg, ${stops})`,
    };
  }

  if (backgroundType === 'solid') {
    return { ...base, backgroundColor };
  }

  if (backgroundType === 'none') {
    return { ...base, backgroundColor: '#000000' };
  }

  // 'image' type: caller injects backgroundImage via the hook
  return base;
}
