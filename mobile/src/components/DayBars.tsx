import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayMonth, formatShortDate } from '../lib/format';
import { color, numeric, radius, space, type } from '../lib/theme';
import type { DayTally } from '../lib/types';

const SERIES = [
  { key: 'done', label: 'Done', color: color.chartDone },
  { key: 'late', label: 'Done late', color: color.chartLate },
  { key: 'missed', label: 'Missed', color: color.chartMissed },
  { key: 'open', label: 'Open', color: color.chartOpen },
] as const;

const PLOT = 120;

function niceMax(value: number): number {
  const half = Math.max(1, value / 2);
  const magnitude = 10 ** Math.floor(Math.log10(half));
  const step = [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * magnitude).find((m) => m >= half && Number.isInteger(m));
  return 2 * (step ?? Math.ceil(half));
}

/** Stacked daily bars. Tap a day to read its numbers (the touch version of a hover tooltip). */
export function DayBars({ days }: { days: DayTally[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...days.map((d) => d.total)));
  const active = selected === null ? null : days[selected];
  const labelEvery = days.length > 10 ? Math.ceil(days.length / 6) : 1;

  return (
    <View>
      <View style={styles.legend} accessibilityLabel="Legend: done, done late, missed, open">
        {SERIES.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={type.meta}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.plotRow}>
        <View style={styles.axis}>
          {[max, max / 2, 0].map((t) => (
            <Text key={t} style={[type.meta, numeric]}>
              {t}
            </Text>
          ))}
        </View>
        <View style={styles.plot}>
          <View style={[styles.grid, { bottom: PLOT / 2 }]} />
          <View style={[styles.grid, { bottom: PLOT }]} />
          {days.map((day, index) => {
            const label = `${formatShortDate(day.date)}: ${day.done} done, ${day.late} late, ${day.missed} missed, ${day.open} open`;
            const parts = SERIES.filter((s) => day[s.key] > 0);
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => setSelected(selected === index ? null : index)}
                style={[styles.slot, selected === index && styles.slotActive]}
              >
                <View style={styles.stack}>
                  {[...parts].reverse().map((s, i) => (
                    <View
                      key={s.key}
                      style={{
                        height: Math.max(2, (day[s.key] / max) * PLOT - 2),
                        backgroundColor: s.color,
                        marginBottom: i === parts.length - 1 ? 0 : 2,
                        borderTopLeftRadius: i === 0 ? 4 : 0,
                        borderTopRightRadius: i === 0 ? 4 : 0,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {days.map((day, index) => (
          <Text key={day.date} style={[type.meta, styles.label]} numberOfLines={1}>
            {index % labelEvery === 0 ? formatDayMonth(day.date) : ''}
          </Text>
        ))}
      </View>
      <View style={styles.detail} accessibilityLiveRegion="polite">
        {active ? (
          <>
            <Text style={type.label}>{formatShortDate(active.date)}</Text>
            <View style={styles.detailRow}>
              {SERIES.map((s) => (
                <View key={s.key} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: s.color }]} />
                  <Text style={type.meta}>
                    {s.label} <Text style={[type.label, numeric]}>{active[s.key]}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={type.meta}>Tap a day to see its numbers.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space[12], marginBottom: space[12] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  plotRow: { flexDirection: 'row', gap: space[8] },
  axis: { height: PLOT + 8, justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -8, width: 20 },
  plot: { flex: 1, height: PLOT, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: color.line },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderTopColor: color.subtle },
  slot: { flex: 1, height: PLOT, justifyContent: 'flex-end', alignItems: 'center', borderRadius: radius.tag },
  slotActive: { backgroundColor: color.canvas },
  stack: { width: '64%', maxWidth: 24 },
  labels: { flexDirection: 'row', marginLeft: 28, marginTop: space[4] },
  label: { flex: 1, textAlign: 'center', fontSize: 10 },
  detail: { marginTop: space[12], minHeight: 40, gap: space[4] },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[12] },
});
