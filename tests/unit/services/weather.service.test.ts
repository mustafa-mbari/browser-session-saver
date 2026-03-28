import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWmoInfo,
  toDisplay,
  getCoordinates,
  fetchForecast,
  getWeatherUnit,
  saveWeatherUnit,
  WEATHER_UNIT_KEY,
} from '@core/services/weather.service';

// ── WMO Map ───────────────────────────────────────────────────────────────────

describe('getWmoInfo', () => {
  it('returns correct info for known code 0 (clear sky)', () => {
    const info = getWmoInfo(0);
    expect(info.description).toBe('Clear sky');
    expect(info.emoji).toBeTruthy();
  });

  it('returns correct info for known code 95 (thunderstorm)', () => {
    const info = getWmoInfo(95);
    expect(info.description).toBe('Thunderstorm');
  });

  it('falls back to nearest lower code for unmapped code', () => {
    // 98 is not in the map; nearest lower is 96
    const info = getWmoInfo(98);
    expect(info).toBeDefined();
    expect(info.description).not.toBe('Unknown');
  });

  it('returns Unknown for very low unknown code', () => {
    const info = getWmoInfo(-999);
    expect(info.description).toBe('Unknown');
    expect(info.emoji).toBe('🌡️');
  });

  it('returns correct info for code 71 (slight snow)', () => {
    const info = getWmoInfo(71);
    expect(info.description).toBe('Slight snow');
  });
});

// ── Temperature conversion ────────────────────────────────────────────────────

describe('toDisplay', () => {
  it('returns Celsius rounded when unit is C', () => {
    expect(toDisplay(20.6, 'C')).toBe(21);
    expect(toDisplay(0, 'C')).toBe(0);
  });

  it('converts to Fahrenheit correctly', () => {
    expect(toDisplay(0, 'F')).toBe(32);
    expect(toDisplay(100, 'F')).toBe(212);
    expect(toDisplay(20, 'F')).toBe(68);
  });

  it('rounds to nearest integer', () => {
    expect(toDisplay(36.6, 'C')).toBe(37);
    expect(toDisplay(36.6, 'F')).toBe(98); // (36.6 * 9/5 + 32) = 97.88 → 98
  });
});

// ── getCoordinates ────────────────────────────────────────────────────────────

describe('getCoordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns GPS coordinates when geolocation succeeds', async () => {
    const mockCoords = { latitude: 37.77, longitude: -122.42 } as GeolocationCoordinates;
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((success) => {
      success({ coords: mockCoords } as GeolocationPosition);
    });

    const result = await getCoordinates();
    expect(result.latitude).toBe(37.77);
    expect(result.longitude).toBe(-122.42);
    expect(result.cityName).toBeUndefined(); // GPS path doesn't return city name
  });

  it('falls back to IP geolocation when GPS times out', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((_, error) => {
      const err = { code: 3, message: 'Timeout' } as GeolocationPositionError; // TIMEOUT
      error!(err);
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ loc: '51.5074,-0.1278', city: 'London' }), { status: 200 }),
    );

    const result = await getCoordinates();
    expect(result.latitude).toBeCloseTo(51.5074);
    expect(result.longitude).toBeCloseTo(-0.1278);
    expect(result.cityName).toBe('London');
  });

  it('falls back to IP when GPS is unavailable', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((_, error) => {
      const err = { code: 2, message: 'Unavailable' } as GeolocationPositionError; // POSITION_UNAVAILABLE
      error!(err);
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ loc: '48.8566,2.3522', city: 'Paris' }), { status: 200 }),
    );

    const result = await getCoordinates();
    expect(result.cityName).toBe('Paris');
  });
});

// ── fetchForecast ─────────────────────────────────────────────────────────────

describe('fetchForecast', () => {
  const mockResponse = {
    timezone: 'Europe/Berlin',
    daily: {
      time: ['2026-03-28', '2026-03-29'],
      weathercode: [0, 61],
      temperature_2m_max: [22, 18],
      temperature_2m_min: [12, 8],
      precipitation_sum: [0, 3.5],
    },
  };

  it('returns today and tomorrow forecasts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchForecast(52.52, 13.4);
    expect(result.today.date).toBe('2026-03-28');
    expect(result.today.tempMax).toBe(22);
    expect(result.tomorrow.date).toBe('2026-03-29');
    expect(result.tomorrow.weatherCode).toBe(61);
  });

  it('uses cityHint when provided instead of timezone', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchForecast(52.52, 13.4, 'Munich');
    expect(result.cityName).toBe('Munich');
  });

  it('falls back to timezone-derived city when no cityHint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchForecast(52.52, 13.4);
    expect(result.cityName).toBe('Berlin');
  });

  it('derives city name by replacing underscores with spaces', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...mockResponse, timezone: 'America/New_York' }),
        { status: 200 },
      ),
    );

    const result = await fetchForecast(40.71, -74.0);
    expect(result.cityName).toBe('New York');
  });

  it('throws on non-OK HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(fetchForecast(0, 0)).rejects.toThrow('Open-Meteo HTTP 500');
  });

  it('includes WMO emoji and description in results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchForecast(52.52, 13.4);
    expect(result.today.emoji).toBeTruthy();
    expect(result.today.description).toBe('Clear sky'); // code 0
  });
});

// ── Weather unit storage ──────────────────────────────────────────────────────

describe('getWeatherUnit / saveWeatherUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getWeatherUnit returns C by default', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => { cb({}); },
    );
    const unit = await getWeatherUnit();
    expect(unit).toBe('C');
  });

  it('getWeatherUnit returns stored value F', async () => {
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => {
        cb({ [WEATHER_UNIT_KEY]: 'F' });
      },
    );
    const unit = await getWeatherUnit();
    expect(unit).toBe('F');
  });

  it('saveWeatherUnit persists via chrome.storage.local', async () => {
    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(
      (_items: unknown, cb: () => void) => { cb(); },
    );
    await saveWeatherUnit('F');
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { [WEATHER_UNIT_KEY]: 'F' },
      expect.any(Function),
    );
  });
});
