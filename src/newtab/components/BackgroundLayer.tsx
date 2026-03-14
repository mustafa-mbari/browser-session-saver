import { useWallpaper } from '@newtab/hooks/useWallpaper';
import type { NewTabSettings } from '@core/types/newtab.types';

interface Props {
  settings: NewTabSettings;
}

export default function BackgroundLayer({ settings }: Props) {
  const { backgroundStyle } = useWallpaper(settings);

  return (
    <>
      <div style={backgroundStyle} aria-hidden="true" />
      {settings.backgroundDimming > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            backgroundColor: `rgba(0,0,0,${settings.backgroundDimming / 100})`,
            pointerEvents: 'none',
          }}
        />
      )}
      {settings.backgroundVignette && (
        <div
          aria-hidden="true"
          className="vignette"
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        />
      )}
    </>
  );
}
