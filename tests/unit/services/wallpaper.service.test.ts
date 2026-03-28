import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { buildBackgroundStyle, saveUserWallpaper, getUserWallpaperUrl, deleteUserWallpaper } from '@core/services/wallpaper.service';
import type { NewTabSettings } from '@core/types/newtab.types';

const defaults: NewTabSettings = {
  enabled: true,
  layoutMode: 'dashboard',
  cardDensity: 'comfortable',
  searchEngine: 'google',
  clockFormat: '12h',
  showClock: false,
  showQuickLinks: true,
  showTodo: true,
  showSessions: true,
  showBookmarks: true,
  backgroundType: 'none',
  backgroundColor: '#1a1a2e',
  backgroundGradientStops: ['#ff0000', '#0000ff'],
  backgroundGradientAngle: 90,
  backgroundBlur: 0,
  backgroundDimming: 0,
  backgroundSaturation: 100,
  backgroundBrightness: 100,
  backgroundVignette: false,
  dailyRotation: false,
  theme: 'system',
  defaultView: 'quick-links',
  activeBoardId: null,
  zenMode: false,
  sidebarCollapsed: false,
  sidebarControl: 'expand-on-hover',
  language: 'auto',
};

describe('buildBackgroundStyle', () => {
  it('returns base style with fixed positioning and zIndex 0', () => {
    const style = buildBackgroundStyle(defaults);
    expect(style.position).toBe('fixed');
    expect(style.inset).toBe(0);
    expect(style.zIndex).toBe(0);
  });

  it('returns black background for none type', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundType: 'none' });
    expect(style.backgroundColor).toBe('#000000');
  });

  it('returns solid color style', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundType: 'solid', backgroundColor: '#ff0000' });
    expect(style.backgroundColor).toBe('#ff0000');
  });

  it('returns linear-gradient for gradient type', () => {
    const style = buildBackgroundStyle({
      ...defaults,
      backgroundType: 'gradient',
      backgroundGradientStops: ['#ff0000', '#0000ff'],
      backgroundGradientAngle: 90,
    });
    expect(style.background).toBe('linear-gradient(90deg, #ff0000, #0000ff)');
  });

  it('returns base style for image type — caller injects the image', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundType: 'image' });
    expect(style.backgroundImage).toBeUndefined();
    expect(style.position).toBe('fixed');
  });

  it('returns base style for bundled type', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundType: 'bundled' });
    expect(style.position).toBe('fixed');
  });

  it('adds blur filter when backgroundBlur > 0', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundBlur: 10 });
    expect(style.filter).toContain('blur(10px)');
  });

  it('adds saturate filter when backgroundSaturation !== 100', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundSaturation: 50 });
    expect(style.filter).toContain('saturate(50%)');
  });

  it('adds brightness filter when backgroundBrightness !== 100', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundBrightness: 80 });
    expect(style.filter).toContain('brightness(80%)');
  });

  it('omits filter entirely when all values are at defaults', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundBlur: 0, backgroundSaturation: 100, backgroundBrightness: 100 });
    expect(style.filter).toBeUndefined();
  });

  it('combines multiple filters', () => {
    const style = buildBackgroundStyle({ ...defaults, backgroundBlur: 5, backgroundSaturation: 70, backgroundBrightness: 90 });
    expect(style.filter).toContain('blur(5px)');
    expect(style.filter).toContain('saturate(70%)');
    expect(style.filter).toContain('brightness(90%)');
  });
});

describe('wallpaper storage functions', () => {
  let db: import('@core/storage/newtab-storage').NewTabDB;

  beforeEach(async () => {
    (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
    const { NewTabDB } = await import('@core/storage/newtab-storage');
    db = new NewTabDB();
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:mock-url');
  });

  it('saveUserWallpaper returns a non-empty id string', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const id = await saveUserWallpaper(db, file);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('getUserWallpaperUrl returns a URL after saving', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const id = await saveUserWallpaper(db, file);
    const url = await getUserWallpaperUrl(db, id);
    // fake-indexeddb blobs are structured-cloned as {} in jsdom
    // URL.createObjectURL is mocked; result is non-null as long as blob exists
    expect(url).not.toBeNull();
  });

  it('getUserWallpaperUrl returns null for unknown id', async () => {
    const url = await getUserWallpaperUrl(db, 'nonexistent-id');
    expect(url).toBeNull();
  });

  it('deleteUserWallpaper removes the blob', async () => {
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const id = await saveUserWallpaper(db, file);
    await deleteUserWallpaper(db, id);
    const url = await getUserWallpaperUrl(db, id);
    expect(url).toBeNull();
  });
});
