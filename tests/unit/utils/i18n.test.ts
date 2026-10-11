import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatMessage, loadLocale, t } from '@shared/utils/i18n';

const GERMAN = {
  nSaved: { message: '$COUNT$ gespeichert', placeholders: { count: { content: '$1' } } },
  tabs: {
    message: '$COUNT$ Tab$PLURAL$',
    placeholders: { count: { content: '$1' }, plural: { content: '$2' } },
  },
  plain: { message: 'Hallo $1' },
};

afterEach(async () => {
  await loadLocale('auto');
  vi.mocked(fetch).mockReset();
});

describe('formatMessage', () => {
  it('resolves named placeholders to their positional content', () => {
    expect(formatMessage(GERMAN.nSaved, ['3'])).toBe('3 gespeichert');
    expect(formatMessage(GERMAN.tabs, ['2', 's'])).toBe('2 Tabs');
  });

  it('substitutes positional arguments directly', () => {
    expect(formatMessage(GERMAN.plain, ['Welt'])).toBe('Hallo Welt');
  });

  it('inserts substitutions literally, even with $ characters', () => {
    expect(formatMessage(GERMAN.plain, ["$&$'"])).toBe("Hallo $&$'");
  });
});

describe('t with a language override', () => {
  it('uses the loaded locale and resolves named placeholders', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => GERMAN } as Response);
    await loadLocale('de');

    expect(t('nSaved', '5')).toBe('5 gespeichert');
  });

  it('falls back to chrome.i18n for keys missing from the override', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => GERMAN } as Response);
    await loadLocale('de');

    expect(t('someOtherKey')).toBe('someOtherKey');
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith('someOtherKey', []);
  });
});
