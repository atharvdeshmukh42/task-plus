/**
 * SWAAR UI tokens (SWAAR-UI/tokens.json) mapped to React Native.
 * Type roles are Text styles with font scaling left on; touch targets are 44 pt.
 */
import type { TextStyle } from 'react-native';

export const color = {
  canvas: '#F6F7F4',
  surface: '#FFFFFF',
  ink: '#202622',
  muted: '#58625E',
  line: '#D9DED8',
  control: '#79847D',
  subtle: '#EEF1EC',
  accent: '#2953BC',
  accentHover: '#204498',
  accentSoft: '#EAF0FF',
  onAccent: '#FFFFFF',
  focus: '#2953BC',
  success: '#216343',
  successSoft: '#E9F4EB',
  warning: '#805000',
  warningSoft: '#FFF2D6',
  danger: '#A33737',
  dangerSoft: '#FCEDEC',
  info: '#305482',
  infoSoft: '#EAF1F9',
  // Chart fills (validated for colour-vision deficiency; always paired with a legend).
  chartDone: '#2E8540',
  chartLate: '#C08A1E',
  chartMissed: '#B33F3F',
  chartOpen: '#8C968F',
} as const;

export const space = { 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32, 48: 48 } as const;
export const radius = { control: 6, panel: 12, tag: 4 } as const;
export const height = { control: 36, touch: 44, rowTouch: 56 } as const;
export const icon = { inline: 16, navigation: 20, standalone: 24 } as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export const type = {
  page: { fontFamily: font.semibold, fontSize: 28, lineHeight: 36, letterSpacing: -0.7, color: color.ink },
  section: { fontFamily: font.semibold, fontSize: 20, lineHeight: 28, letterSpacing: -0.3, color: color.ink },
  subheading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24, color: color.ink },
  reading: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: color.ink },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: color.ink },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: color.ink },
  meta: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: color.muted },
} satisfies Record<string, TextStyle>;

export const numeric: TextStyle = { fontVariant: ['tabular-nums'] };
