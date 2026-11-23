import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { color, font } from '../lib/theme';
import {
  LOGO_CHECK_PATH,
  LOGO_CHECK_WIDTH,
  LOGO_PLUS_PATH,
  LOGO_PLUS_WIDTH,
  LOGO_TILE_PATH,
  LOGO_VIEWBOX,
} from './logo.generated';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={LOGO_VIEWBOX}>
      <Path d={LOGO_TILE_PATH} fill={color.accent} />
      <G fill="none" stroke={color.onAccent} strokeLinecap="round" strokeLinejoin="round">
        <Path d={LOGO_CHECK_PATH} strokeWidth={LOGO_CHECK_WIDTH} />
        <Path d={LOGO_PLUS_PATH} strokeWidth={LOGO_PLUS_WIDTH} />
      </G>
    </Svg>
  );
}

/** Mark plus the "Task Plus" wordmark. */
export function Logo({ size = 36 }: { size?: number }) {
  const fontSize = Math.round(size * 0.56);
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Task Plus">
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize, lineHeight: Math.round(fontSize * 1.2), marginLeft: Math.round(fontSize * 0.48) }]}>
        Task Plus
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: font.semibold, color: color.ink, letterSpacing: -0.4 },
});
