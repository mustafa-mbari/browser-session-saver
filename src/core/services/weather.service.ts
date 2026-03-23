export type TemperatureUnit = 'C' | 'F';

export const WEATHER_UNIT_KEY = 'weather_units';

export interface DayForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  emoji: string;
  description: string;
}

export interface WeatherData {
  cityName: string;
  latitude: number;
  longitude: number;
  fetchedAt: number;
  today: DayForecast;
  tomorrow: DayForecast;
}

// ── WMO Weather Interpretation Codes ────────────────────────────────────────

interface WmoInfo {
  emoji: string;
  description: string;
}

const WMO_MAP: Record<number, WmoInfo> = {
  0:  { emoji: '☀️',  description: 'Clear sky' },
  1:  { emoji: '🌤️', description: 'Mainly clear' },
  2:  { emoji: '⛅',  description: 'Partly cloudy' },
  3:  { emoji: '☁️',  description: 'Overcast' },
  45: { emoji: '🌫️', description: 'Foggy' },
  48: { emoji: '🌫️', description: 'Icy fog' },
  51: { emoji: '🌦️', description: 'Light drizzle' },
  53: { emoji: '🌦️', description: 'Drizzle' },
  55: { emoji: '🌦️', description: 'Heavy drizzle' },
  56: { emoji: '🌧️', description: 'Freezing drizzle' },
  57: { emoji: '🌧️', description: 'Heavy freezing drizzle' },
  61: { emoji: '🌧️', description: 'Slight rain' },
  63: { emoji: '🌧️', description: 'Rain' },
  65: { emoji: '🌧️', description: 'Heavy rain' },
  66: { emoji: '🌧️', description: 'Freezing rain' },
  67: { emoji: '🌧️', description: 'Heavy freezing rain' },
  71: { emoji: '❄️',  description: 'Slight snow' },
  73: { emoji: '❄️',  description: 'Snow' },
  75: { emoji: '❄️',  description: 'Heavy snow' },
  77: { emoji: '🌨️', description: 'Snow grains' },
  80: { emoji: '🌦️', description: 'Light showers' },
  81: { emoji: '🌦️', description: 'Showers' },
  82: { emoji: '🌦️', description: 'Heavy showers' },
  85: { emoji: '🌨️', description: 'Snow showers' },
  86: { emoji: '🌨️', description: 'Heavy snow showers' },
  95: { emoji: '⛈️',  description: 'Thunderstorm' },
  96: { emoji: '⛈️',  description: 'Thunderstorm with hail' },
  99: { emoji: '⛈️',  description: 'Thunderstorm with heavy hail' },
};

export function getWmoInfo(code: number): WmoInfo {
  if (WMO_MAP[code]) return WMO_MAP[code];
  const keys = Object.keys(WMO_MAP).map(Number).sort((a, b) => b - a);
  const fallback = keys.find((k) => k <= code);
  return fallback !== undefined ? WMO_MAP[fallback] : { emoji: '🌡️', description: 'Unknown' };
}

// ── Temperature conversion ────────────────────────────────────────────────────

export function toDisplay(celsius: number, unit: TemperatureUnit): number {
  if (unit === 'F') return Math.round((celsius * 9) / 5 + 32);
  return Math.round(celsius);
}

// ── Geolocation ──────────────────────────────────────────────────────────────

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

function gpsPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { timeout: 6_000 },
    );
  });
}

interface IpInfoResponse {
  loc?: string; // "lat,lon"
}

async function ipCoords(): Promise<GeoCoords> {
  const res = await fetch('https://ipinfo.io/json');
  if (!res.ok) throw new Error(`IP geolocation HTTP ${res.status}`);
  const data = (await res.json()) as IpInfoResponse;
  if (!data.loc) throw new Error('IP geolocation unavailable');
  const parts = data.loc.split(',');
  const latitude = parseFloat(parts[0] ?? '');
  const longitude = parseFloat(parts[1] ?? '');
  if (isNaN(latitude) || isNaN(longitude)) throw new Error('IP geolocation parse error');
  return { latitude, longitude };
}

/**
 * Returns coordinates using GPS first; falls back to IP geolocation
 * if GPS is unavailable (common in Chrome extension newtab pages).
 * Throws only when the user has explicitly denied location permission.
 */
export async function getCoordinates(): Promise<GeoCoords> {
  try {
    const coords = await gpsPosition();
    return { latitude: coords.latitude, longitude: coords.longitude };
  } catch (err) {
    // Re-throw only for permission denied — let the UI show the denial message.
    // For POSITION_UNAVAILABLE (2) or TIMEOUT (3), silently fall back to IP.
    if (
      typeof GeolocationPositionError !== 'undefined' &&
      err instanceof GeolocationPositionError &&
      err.code === GeolocationPositionError.PERMISSION_DENIED
    ) {
      throw err;
    }
    return ipCoords();
  }
}

// ── Open-Meteo API ────────────────────────────────────────────────────────────

interface OpenMeteoForecastResponse {
  timezone: string;
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

function cityFromTimezone(tz: string): string {
  const parts = tz.split('/');
  const city = parts[parts.length - 1] ?? 'Unknown';
  return city.replace(/_/g, ' ');
}

export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<{ today: DayForecast; tomorrow: DayForecast; cityName: string }> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = (await res.json()) as OpenMeteoForecastResponse;

  const buildDay = (idx: number): DayForecast => {
    const code = data.daily.weathercode[idx] ?? 0;
    const info = getWmoInfo(code);
    return {
      date:        data.daily.time[idx] ?? '',
      weatherCode: code,
      tempMax:     data.daily.temperature_2m_max[idx] ?? 0,
      tempMin:     data.daily.temperature_2m_min[idx] ?? 0,
      precipSum:   data.daily.precipitation_sum[idx] ?? 0,
      emoji:       info.emoji,
      description: info.description,
    };
  };

  return {
    today:    buildDay(0),
    tomorrow: buildDay(1),
    cityName: cityFromTimezone(data.timezone ?? ''),
  };
}

// ── Unit preference via chrome.storage.local ──────────────────────────────────

export function getWeatherUnit(): Promise<TemperatureUnit> {
  return new Promise((resolve) => {
    chrome.storage.local.get(WEATHER_UNIT_KEY, (result) => {
      const val = result[WEATHER_UNIT_KEY] as TemperatureUnit | undefined;
      resolve(val === 'F' ? 'F' : 'C');
    });
  });
}

export function saveWeatherUnit(unit: TemperatureUnit): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [WEATHER_UNIT_KEY]: unit }, resolve);
  });
}
