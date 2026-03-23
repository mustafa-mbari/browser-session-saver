import { useEffect, useState, useCallback, useRef } from 'react';
import type { SpanValue } from '@core/types/newtab.types';
import {
  type WeatherData,
  type TemperatureUnit,
  type DayForecast,
  getCoordinates,
  fetchForecast,
  getWeatherUnit,
  saveWeatherUnit,
  toDisplay,
} from '@core/services/weather.service';

interface Props {
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

type FetchState = 'idle' | 'loading' | 'geo-denied' | 'error' | 'success';

export default function WeatherCardBody({ colSpan: _colSpan, rowSpan: _rowSpan }: Props) {
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unit, setUnit] = useState<TemperatureUnit>('C');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const cacheRef = useRef<WeatherData | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cacheRef.current) {
      const age = Date.now() - cacheRef.current.fetchedAt;
      if (age < CACHE_TTL_MS) {
        setWeather(cacheRef.current);
        setFetchState('success');
        return;
      }
    }

    setFetchState('loading');
    setErrorDetail('');
    try {
      const coords = await getCoordinates();
      const [forecast, savedUnit] = await Promise.all([
        fetchForecast(coords.latitude, coords.longitude),
        getWeatherUnit(),
      ]);

      const data: WeatherData = {
        cityName:  forecast.cityName,
        latitude:  coords.latitude,
        longitude: coords.longitude,
        fetchedAt: Date.now(),
        today:     forecast.today,
        tomorrow:  forecast.tomorrow,
      };
      cacheRef.current = data;
      setWeather(data);
      setUnit(savedUnit);
      setFetchState('success');
    } catch (err) {
      console.error('[WeatherWidget]', err);
      const isGeoDenied =
        typeof GeolocationPositionError !== 'undefined' &&
        err instanceof GeolocationPositionError &&
        err.code === GeolocationPositionError.PERMISSION_DENIED;
      if (isGeoDenied) {
        setFetchState('geo-denied');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorDetail(msg);
        setFetchState('error');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggleUnit = useCallback(async () => {
    const next: TemperatureUnit = unit === 'C' ? 'F' : 'C';
    setUnit(next);
    await saveWeatherUnit(next);
  }, [unit]);

  const handleRetry = useCallback(() => {
    void load(true);
  }, [load]);

  if (fetchState === 'idle' || fetchState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full py-6">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }}
          aria-label="Loading weather"
          role="status"
        />
      </div>
    );
  }

  if (fetchState === 'geo-denied') {
    return (
      <ErrorState
        icon="📍"
        message="Location access denied. Enable it in browser settings to see weather."
        onRetry={handleRetry}
      />
    );
  }

  if (fetchState === 'error') {
    return (
      <ErrorState
        icon="⚠️"
        message="Couldn't load weather. If this is new, try reloading the extension."
        detail={errorDetail}
        onRetry={handleRetry}
      />
    );
  }

  if (!weather) return null;

  const { today, tomorrow, cityName } = weather;

  return (
    <div className="flex flex-col h-full px-3 pb-3 gap-2">
      {/* Header: location + unit toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] shrink-0" style={{ color: 'var(--newtab-text-secondary)' }}>📍</span>
          <span
            className="text-xs font-medium truncate"
            style={{ color: 'var(--newtab-text-secondary)' }}
            title={cityName}
          >
            {cityName}
          </span>
        </div>
        <button
          onClick={handleToggleUnit}
          className="text-[11px] px-1.5 py-0.5 rounded-md transition-colors shrink-0 font-mono tabular-nums"
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--newtab-text-secondary)',
          }}
          aria-label={`Switch to °${unit === 'C' ? 'F' : 'C'}`}
        >
          °{unit}
        </button>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

      {/* Two-column forecast */}
      <div className="flex flex-1 gap-0 min-h-0">
        <DayCard label="TODAY" day={today} unit={unit} />
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', flexShrink: 0, alignSelf: 'stretch' }} />
        <DayCard label="TOMORROW" day={tomorrow} unit={unit} />
      </div>

      {/* Footer: cache age + refresh */}
      <div
        className="flex items-center justify-between pt-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px] opacity-40" style={{ color: 'var(--newtab-text-secondary)' }}>
          {formatFetchedAt(weather.fetchedAt)}
        </span>
        <button
          onClick={handleRetry}
          className="text-[10px] opacity-40 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--newtab-text-secondary)' }}
          title="Refresh weather"
          aria-label="Refresh weather"
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ErrorStateProps {
  icon: string;
  message: string;
  detail?: string;
  onRetry: () => void;
}

function ErrorState({ icon, message, detail, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6 gap-3 text-center">
      <span className="text-3xl" role="img">{icon}</span>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--newtab-text-secondary)' }}>
        {message}
      </p>
      {detail && (
        <p className="text-[10px] opacity-50 font-mono break-all px-2 max-w-full" style={{ color: 'var(--newtab-text-secondary)' }}>
          {detail}
        </p>
      )}
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(56,189,248,0.2)', color: 'var(--newtab-text)' }}
      >
        Retry
      </button>
    </div>
  );
}

interface DayCardProps {
  label: string;
  day: DayForecast;
  unit: TemperatureUnit;
}

function DayCard({ label, day, unit }: DayCardProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 min-w-0 px-1">
      <span
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--newtab-text-secondary)', opacity: 0.5 }}
      >
        {label}
      </span>
      <span className="text-4xl leading-none select-none" role="img" aria-label={day.description}>
        {day.emoji}
      </span>
      <span
        className="text-2xl font-light tabular-nums"
        style={{ color: 'var(--newtab-text)' }}
      >
        {toDisplay(day.tempMax, unit)}°
      </span>
      <span
        className="text-[11px] text-center leading-snug px-1"
        style={{ color: 'var(--newtab-text-secondary)', opacity: 0.8 }}
      >
        {day.description}
      </span>
      <div
        className="flex items-center gap-1 text-[10px] tabular-nums"
        style={{ color: 'var(--newtab-text-secondary)', opacity: 0.6 }}
      >
        <span>H:{toDisplay(day.tempMax, unit)}°</span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span>L:{toDisplay(day.tempMin, unit)}°</span>
      </div>
    </div>
  );
}

function formatFetchedAt(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 60_000);
  if (diff < 1) return 'Just updated';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
}
