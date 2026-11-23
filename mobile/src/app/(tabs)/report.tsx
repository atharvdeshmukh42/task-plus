import { CircleAlert, CircleCheck, CircleX, Gauge, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DayBars } from '../../components/DayBars';
import { EmptyState, ErrorState, Panel, Skeleton, StatusBadge, T } from '../../components/ui';
import { addDays, formatShortDate, percent, repeatLabel } from '../../lib/format';
import { useDay, useMyReport } from '../../lib/queries';
import { color, height, numeric, radius, space, type } from '../../lib/theme';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

function Stat({ label, value, note, Icon, tint }: { label: string; value: string | number; note: string; Icon: LucideIcon; tint: string }) {
  return (
    <Panel style={styles.stat}>
      <View style={styles.statLabel}>
        <Icon size={16} color={tint} />
        <Text style={type.meta}>{label}</Text>
      </View>
      <Text style={[type.page, numeric]}>{value}</Text>
      <Text style={type.meta}>{note}</Text>
    </Panel>
  );
}

export default function Report() {
  const [days, setDays] = useState(7);
  // "Today" in the organization's timezone, from the (usually cached) Today screen query.
  const day = useDay(null);
  const today = day.data?.today ?? null;
  const start = today ? addDays(today, -(days - 1)) : null;
  const query = useMyReport(start, today);
  const data = query.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={color.accent} />}
      >
        <T variant="page" accessibilityRole="header">
          My report
        </T>
        <T style={{ color: color.muted }}>
          {data ? `${formatShortDate(data.start)} – ${formatShortDate(data.end)}` : ' '}
        </T>

        <View style={styles.segmented} accessibilityRole="tablist">
          {RANGES.map((r) => {
            const selected = r.days === days;
            return (
              <Pressable
                key={r.days}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setDays(r.days)}
                style={[styles.segment, selected && styles.segmentOn]}
              >
                <Text style={[type.label, { color: selected ? color.accent : color.muted }]}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {(query.isError || day.isError) && (
          <ErrorState
            title="Couldn't load your report"
            error={query.error ?? day.error}
            onRetry={() => (day.isError ? day.refetch() : query.refetch())}
          />
        )}
        {!data && !query.isError && !day.isError && (
          <View accessible accessibilityLabel="Loading your report">
            <Skeleton height={180} />
            <Skeleton height={220} />
          </View>
        )}

        {data && (
          <>
            <View style={styles.stats}>
              <Stat
                label="Completion"
                value={percent(data.summary.completion_rate)}
                note={`${data.summary.done + data.summary.late} of ${data.summary.done + data.summary.late + data.summary.missed} closed`}
                Icon={Gauge}
                tint={color.info}
              />
              <Stat label="On time" value={data.summary.done} note={`On-time rate ${percent(data.summary.on_time_rate)}`} Icon={CircleCheck} tint={color.success} />
              <Stat label="Late" value={data.summary.late} note="After the time window" Icon={CircleAlert} tint={color.warning} />
              <Stat label="Missed" value={data.summary.missed} note={`${data.summary.open} still open`} Icon={CircleX} tint={color.danger} />
            </View>

            <Panel style={styles.card}>
              <Text style={[type.subheading, { marginBottom: space[12] }]}>Tasks per day</Text>
              <DayBars days={data.days} />
            </Panel>

            {data.tasks.length > 0 && (
              <View style={styles.section}>
                <T variant="section" accessibilityRole="header">
                  By task
                </T>
                <Panel style={styles.list}>
                  {data.tasks.map(({ task, summary }, i) => (
                    <View key={task.id} style={[styles.listRow, i > 0 && styles.divider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={type.label}>{task.title}</Text>
                        <Text style={type.meta}>
                          {repeatLabel(task)} · {summary.done} on time · {summary.late} late · {summary.missed} missed
                        </Text>
                      </View>
                      <Text style={[type.label, numeric]}>{percent(summary.completion_rate)}</Text>
                    </View>
                  ))}
                </Panel>
              </View>
            )}

            <View style={styles.section}>
              <T variant="section" accessibilityRole="header">
                History
              </T>
              {data.history.length === 0 ? (
                <EmptyState title="No tasks in this range" body="Try a longer range." />
              ) : (
                <Panel style={styles.list}>
                  {data.history.slice(0, 40).map((o, i) => (
                    <View key={`${o.task.id}-${o.period_date}`} style={[styles.listRow, i > 0 && styles.divider]}>
                      <Text style={[type.meta, numeric, styles.historyDate]}>
                        {o.report_date ? formatShortDate(o.report_date) : 'Open'}
                      </Text>
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
                        {o.task.title}
                      </Text>
                      <StatusBadge status={o.status} />
                    </View>
                  ))}
                </Panel>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  scroll: { padding: space[16], paddingBottom: space[48], gap: space[4] },
  segmented: { flexDirection: 'row', gap: space[4], marginVertical: space[16] },
  segment: {
    minHeight: height.touch,
    paddingHorizontal: space[12],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  segmentOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[12] },
  stat: { flexBasis: '47%', flexGrow: 1, padding: space[16], gap: space[4] },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  card: { padding: space[16], marginTop: space[12] },
  section: { marginTop: space[24], gap: space[12] },
  list: { overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space[12], paddingHorizontal: space[16], paddingVertical: space[12], minHeight: height.rowTouch },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  historyDate: { width: 76 },
});
