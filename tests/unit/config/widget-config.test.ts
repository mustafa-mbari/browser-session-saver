import { describe, it, expect } from 'vitest';
import { WIDGET_CONFIG, getDefaultSize, clampSize } from '@core/config/widget-config';
import type { CardType } from '@core/types/newtab.types';

const ALL_CARD_TYPES: CardType[] = ['bookmark', 'clock', 'note', 'todo', 'subscription', 'tab-groups'];

describe('WIDGET_CONFIG', () => {
  it('has an entry for every CardType', () => {
    for (const ct of ALL_CARD_TYPES) {
      expect(WIDGET_CONFIG[ct]).toBeDefined();
    }
  });

  it('every config has minW <= defaultW <= maxW', () => {
    for (const cfg of Object.values(WIDGET_CONFIG)) {
      expect(cfg.minW).toBeLessThanOrEqual(cfg.defaultW);
      expect(cfg.defaultW).toBeLessThanOrEqual(cfg.maxW);
    }
  });

  it('every config has minH <= defaultH <= maxH', () => {
    for (const cfg of Object.values(WIDGET_CONFIG)) {
      expect(cfg.minH).toBeLessThanOrEqual(cfg.defaultH);
      expect(cfg.defaultH).toBeLessThanOrEqual(cfg.maxH);
    }
  });

  it('all values are within SpanValue range 1-9', () => {
    for (const cfg of Object.values(WIDGET_CONFIG)) {
      for (const val of [cfg.minW, cfg.minH, cfg.maxW, cfg.maxH, cfg.defaultW, cfg.defaultH]) {
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('getDefaultSize', () => {
  it('returns correct defaults for bookmark', () => {
    expect(getDefaultSize('bookmark')).toEqual({ colSpan: 3, rowSpan: 5 });
  });

  it('returns correct defaults for clock', () => {
    expect(getDefaultSize('clock')).toEqual({ colSpan: 3, rowSpan: 3 });
  });

  it('returns correct defaults for note', () => {
    expect(getDefaultSize('note')).toEqual({ colSpan: 3, rowSpan: 4 });
  });

  it('returns correct defaults for todo', () => {
    expect(getDefaultSize('todo')).toEqual({ colSpan: 3, rowSpan: 4 });
  });

  it('returns correct defaults for subscription', () => {
    expect(getDefaultSize('subscription')).toEqual({ colSpan: 4, rowSpan: 3 });
  });

  it('returns correct defaults for tab-groups', () => {
    expect(getDefaultSize('tab-groups')).toEqual({ colSpan: 3, rowSpan: 3 });
  });
});

describe('clampSize', () => {
  it('clamps below minW', () => {
    const result = clampSize('subscription', 1, 3);
    expect(result.colSpan).toBe(3); // subscription minW=3
  });

  it('clamps below minH', () => {
    const result = clampSize('bookmark', 3, 1);
    expect(result.rowSpan).toBe(2); // bookmark minH=2
  });

  it('clamps above maxW', () => {
    const result = clampSize('clock', 9, 3);
    expect(result.colSpan).toBe(5); // clock maxW=5
  });

  it('clamps above maxH', () => {
    const result = clampSize('tab-groups', 3, 9);
    expect(result.rowSpan).toBe(6); // tab-groups maxH=6
  });

  it('passes through valid values unchanged', () => {
    expect(clampSize('bookmark', 5, 5)).toEqual({ colSpan: 5, rowSpan: 5 });
  });

  it('clamps both dimensions simultaneously', () => {
    const result = clampSize('clock', 9, 9);
    expect(result).toEqual({ colSpan: 5, rowSpan: 5 }); // clock max 5x5
  });

  it('handles exact min boundary', () => {
    const result = clampSize('subscription', 3, 2);
    expect(result).toEqual({ colSpan: 3, rowSpan: 2 }); // subscription min 3x2
  });

  it('handles exact max boundary', () => {
    const result = clampSize('clock', 5, 5);
    expect(result).toEqual({ colSpan: 5, rowSpan: 5 }); // clock max 5x5
  });
});
