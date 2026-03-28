import '@testing-library/jest-dom';

// Mock chrome API
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onSuspend: {
      addListener: vi.fn(),
    },
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      getBytesInUse: vi.fn().mockResolvedValue(0),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    remove: vi.fn().mockResolvedValue(undefined),
    group: vi.fn().mockResolvedValue(1),
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  tabGroups: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
  windows: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    getAll: vi.fn().mockResolvedValue([{ id: 1 }]),
    onRemoved: { addListener: vi.fn() },
  },
  sidePanel: {
    setPanelBehavior: vi.fn(),
    setOptions: vi.fn(),
    open: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  idle: {
    setDetectionInterval: vi.fn(),
    onStateChanged: { addListener: vi.fn() },
  },
  i18n: {
    getMessage: vi.fn((key: string) => key),
  },
  bookmarks: {
    getTree: vi.fn().mockResolvedValue([]),
  },
  topSites: {
    get: vi.fn().mockResolvedValue([]),
  },
};

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true });

// fetch stub — override per test with vi.mocked(fetch).mockResolvedValueOnce(...)
globalThis.fetch = vi.fn();

// URL blob helpers
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

// navigator.geolocation stub — override per test
Object.defineProperty(navigator, 'geolocation', {
  value: { getCurrentPosition: vi.fn() },
  configurable: true,
  writable: true,
});

// navigator.storage.estimate stub (used by IndexedDBAdapter.getUsedBytes)
Object.defineProperty(navigator, 'storage', {
  value: { estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 1_000_000 }) },
  configurable: true,
  writable: true,
});

// window.matchMedia stub (used by useTheme)
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
  configurable: true,
  writable: true,
});
