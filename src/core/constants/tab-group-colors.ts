import type { ChromeGroupColor } from '@core/types/session.types';

export const GROUP_COLORS: Record<ChromeGroupColor, string> = {
  grey:   '#9aa0a6',
  blue:   '#4a90d9',
  red:    '#e06666',
  yellow: '#f6b26b',
  green:  '#6aa84f',
  pink:   '#d16b8e',
  purple: '#8e44ad',
  cyan:   '#45b7d1',
  orange: '#e69138',
};

export const COLOR_OPTIONS: ChromeGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
];
