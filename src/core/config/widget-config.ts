import type { CardType, SpanValue } from '@core/types/newtab.types';

export interface WidgetSizeConfig {
  minW: SpanValue;
  minH: SpanValue;
  maxW: SpanValue;
  maxH: SpanValue;
  defaultW: SpanValue;
  defaultH: SpanValue;
}

export const WIDGET_CONFIG: Record<CardType, WidgetSizeConfig> = {
  bookmark:           { minW: 2, minH: 2, maxW: 9, maxH: 9, defaultW: 3, defaultH: 3 },
  clock:              { minW: 2, minH: 2, maxW: 5, maxH: 5, defaultW: 3, defaultH: 3 },
  note:               { minW: 2, minH: 2, maxW: 9, maxH: 9, defaultW: 3, defaultH: 4 },
  todo:               { minW: 2, minH: 2, maxW: 9, maxH: 9, defaultW: 3, defaultH: 4 },
  subscription:       { minW: 3, minH: 2, maxW: 9, maxH: 6, defaultW: 4, defaultH: 3 },
  'tab-groups':       { minW: 2, minH: 2, maxW: 9, maxH: 6, defaultW: 3, defaultH: 3 },
  'native-bookmarks': { minW: 2, minH: 3, maxW: 9, maxH: 9, defaultW: 2, defaultH: 4 },
  weather:            { minW: 3, minH: 3, maxW: 6, maxH: 6, defaultW: 3, defaultH: 3 },
  downloads:          { minW: 2, minH: 3, maxW: 6, maxH: 6, defaultW: 2, defaultH: 3 },
};

export function getDefaultSize(cardType: CardType): { colSpan: SpanValue; rowSpan: SpanValue } {
  const cfg = WIDGET_CONFIG[cardType];
  return { colSpan: cfg.defaultW, rowSpan: cfg.defaultH };
}

export function clampSize(
  cardType: CardType,
  colSpan: number,
  rowSpan: number,
): { colSpan: SpanValue; rowSpan: SpanValue } {
  const cfg = WIDGET_CONFIG[cardType];
  return {
    colSpan: Math.max(cfg.minW, Math.min(cfg.maxW, colSpan)) as SpanValue,
    rowSpan: Math.max(cfg.minH, Math.min(cfg.maxH, rowSpan)) as SpanValue,
  };
}
