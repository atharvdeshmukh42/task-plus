import { CalendarClock, ChevronLeft, ChevronRight, Tag, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskRow } from '../../components/TaskRow';
import { Button, EmptyState, ErrorState, Panel, Skeleton, StatusBadge, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { addDays, formatClock, formatLongDate, formatShortDate, occurrenceContext, windowLabel } from '../../lib/format';
import { useComplete, useDay, useUndo } from '../../lib/queries';
import { color, font, height, radius, space, type } from '../../lib/theme';
import type { Occurrence } from '../../lib/types';

const OPEN = new Set(['pending', 'overdue', 'upcoming']);

type Snack = { message: string; undo?: { id: number; title: string } } | null;

export default function Today() {
  const { me } = useAuth();
  const [day, setDay] = useState<string | null>(null);
  const query = useDay(day);
  const complete = useComplete();
  const undo = useUndo();
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [snack, setSnack] = useState<Snack>(null);
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = query.data;
  const current = data?.date ?? day;
  const isToday = Boolean(data && data.date === data.today);
  const occurrences = data?.occurrences ?? [];
  const open = occurrences.filter((o) => OPEN.has(o.status));
  const missed = occurrences.filter((o) => o.status === 'missed');
  const finished = occurrences.filter((o) => o.status === 'done' || o.status === 'late');
  const total = occurrences.length;
  const progress = total ? finished.length / total : 0;

  useEffect(() => () => {
    if (snackTimer.current) clearTimeout(snackTimer.current);
  }, []);

  function showSnack(next: Snack) {
    if (snackTimer.current) clearTimeout(snackTimer.current);
    setSnack(next);
    if (next) snackTimer.current = setTimeout(() => setSnack(null), 8000);
  }

  async function markDone(o: Occurrence, note?: string) {
    try {
      const result = await complete.mutateAsync({ task_id: o.task.id, period_date: o.period_date, note: note?.trim() || null });
      showSnack({
        message: `${o.task.title} — ${result.status === 'late' ? 'done late' : 'done'}`,
        undo: result.completion ? { id: result.completion.id, title: o.task.title } : undefined,
      });
      setSelected(null);
    } catch (e) {
      showSnack({ message: e instanceof Error ? e.message : 'Could not mark it done.' });
    }
  }

  async function reopen(completionId: number, title: string) {
    try {
      await undo.mutateAsync(completionId);
      showSnack({ message: `${title} reopened` });
      setSelected(null);
    } catch (e) {
      showSnack({ message: e instanceof Error ? e.message : 'Could not reopen it.' });
    }
  }

  const busy = complete.isPending || undo.isPending;
  const section = (title: string, items: Occurrence[]) =>
    items.length > 0 && (
      <View style={styles.section}>
        <T variant="meta" style={styles.sectionTitle} accessibilityRole="header">
          {title} · {items.length}
        </T>
        <Panel style={styles.list}>
          {items.map((o) => (
            <TaskRow
              key={`${o.task.id}-${o.period_date}`}
              occurrence={o}
              busy={busy}
              onOpen={() => setSelected(o)}
              onComplete={() => markDone(o)}
            />
          ))}
        </Panel>
      </View>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={color.accent} />}
      >
        <T variant="meta">{me?.organization.name}</T>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <T variant="page" accessibilityRole="header">
              {isToday || !current ? 'Today' : formatShortDate(current)}
            </T>
            <T style={{ color: color.muted }}>{current ? formatLongDate(current) : ' '}</T>
          </View>
          <View style={styles.dayNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              style={styles.navBtn}
              disabled={!current}
              onPress={() => current && setDay(addDays(current, -1))}
            >
              <ChevronLeft size={20} color={color.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              style={styles.navBtn}
              disabled={!current}
              onPress={() => current && setDay(addDays(current, 1))}
            >
              <ChevronRight size={20} color={color.ink} />
            </Pressable>
          </View>
        </View>
        {!isToday && data && (
          <Button label="Back to today" variant="quiet" onPress={() => setDay(null)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        )}

        {query.isError && <ErrorState title="Couldn't load your tasks" error={query.error} onRetry={() => query.refetch()} />}

        {query.isPending && (
          <View accessibilityLabel="Loading your tasks" accessible>
            <Skeleton height={72} />
            <Skeleton height={220} />
          </View>
        )}

        {data && total > 0 && (
          <Panel style={styles.progress}>
            <View style={styles.progressText}>
              <Text style={[type.subheading]}>
                {finished.length} of {total} done
              </Text>
              {missed.length > 0 && <StatusBadge status="missed" />}
            </View>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: total, now: finished.length }}
            >
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            {!isToday && <T variant="meta">Only today’s tasks can be marked done.</T>}
          </Panel>
        )}

        {data && total === 0 && (
          <EmptyState
            title={isToday ? 'Nothing to do today' : 'No tasks on this day'}
            body={isToday ? 'New tasks from your supervisor appear here. Pull down to refresh.' : undefined}
          />
        )}

        {section(isToday ? 'To do' : 'Open', open)}
        {section('Missed', missed)}
        {section('Done', finished)}
      </ScrollView>

      {snack && (
        <View style={styles.snack} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Text style={[type.label, { color: color.surface, flex: 1 }]} numberOfLines={2}>
            {snack.message}
          </Text>
          {snack.undo && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const { id, title } = snack.undo!;
                showSnack(null);
                reopen(id, title);
              }}
              style={styles.snackAction}
              hitSlop={8}
            >
              <Text style={[type.label, { color: '#B9CCFF' }]}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}

      <TaskSheet
        key={selected ? `${selected.task.id}-${selected.period_date}` : 'none'}
        occurrence={selected}
        canReopen={isToday}
        timezone={data?.timezone ?? 'UTC'}
        busy={busy}
        onClose={() => setSelected(null)}
        onDone={(o, note) => markDone(o, note)}
        onReopen={(o) => o.completion && reopen(o.completion.id, o.task.title)}
      />
    </SafeAreaView>
  );
}

function TaskSheet({
  occurrence: o,
  canReopen,
  timezone,
  busy,
  onClose,
  onDone,
  onReopen,
}: {
  occurrence: Occurrence | null;
  canReopen: boolean;
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onDone: (o: Occurrence, note: string) => void;
  onReopen: (o: Occurrence) => void;
}) {
  const [note, setNote] = useState('');
  const done = o && (o.status === 'done' || o.status === 'late');
  // Only today's completions can be reopened; the server enforces the same rule.
  const reopenable = Boolean(o?.completion) && canReopen;

  return (
    <Modal visible={o !== null} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close task details" />
      {o && (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <T variant="section" style={{ flex: 1 }} accessibilityRole="header">
              {o.task.title}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.navBtn}>
              <X size={20} color={color.ink} />
            </Pressable>
          </View>
          <StatusBadge status={o.status} />
          {o.task.description && <T variant="reading" style={{ marginTop: space[12] }}>{o.task.description}</T>}
          <View style={styles.facts}>
            <View style={styles.fact}>
              <CalendarClock size={16} color={color.muted} />
              <T>{[windowLabel(o.task) ?? 'Any time', occurrenceContext(o)].join(' · ')}</T>
            </View>
            {o.task.role && (
              <View style={styles.fact}>
                <Tag size={16} color={color.muted} />
                <T>{o.task.role.name}</T>
              </View>
            )}
            {o.completion && (
              <T variant="meta">
                Completed at {formatClock(o.completion.completed_at, timezone)}
                {o.completion.is_late ? ' · after the time window' : ''}
                {o.completion.note ? ` · “${o.completion.note}”` : ''}
              </T>
            )}
            {o.status === 'overdue' && <T variant="meta">The time window has passed. You can still do it — it will be recorded as late.</T>}
            {o.status === 'missed' && !o.can_complete && <T variant="meta">This day has closed, so it can’t be marked done any more.</T>}
          </View>

          {o.can_complete && (
            <>
              <Text style={[type.label, { marginTop: space[16] }]}>Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Optional — anything your supervisor should know"
                placeholderTextColor={color.muted}
                multiline
                maxLength={1000}
                accessibilityLabel="Note"
                style={styles.noteInput}
              />
              <Button label="Mark done" pendingLabel="Saving…" variant="primary" pending={busy} onPress={() => onDone(o, note)} style={{ marginTop: space[16] }} />
            </>
          )}
          {done && reopenable && (
            <Button label="Reopen task" variant="secondary" disabled={busy} onPress={() => onReopen(o)} style={{ marginTop: space[16] }} />
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  scroll: { padding: space[16], paddingBottom: 96, gap: space[4] },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[8] },
  dayNav: { flexDirection: 'row', gap: space[4] },
  navBtn: {
    width: height.touch,
    height: height.touch,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  progress: { padding: space[16], gap: space[8], marginTop: space[16] },
  progressText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: color.subtle, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.success },
  section: { marginTop: space[24] },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space[8], marginLeft: space[4] },
  list: { overflow: 'hidden', paddingTop: 0, marginTop: 0 },
  snack: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    bottom: space[16],
    backgroundColor: color.ink,
    borderRadius: radius.control,
    paddingVertical: space[12],
    paddingHorizontal: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    shadowColor: '#18251D',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  snackAction: { minHeight: height.touch, justifyContent: 'center', paddingHorizontal: space[8] },
  backdrop: { flex: 1, backgroundColor: 'rgba(24, 37, 29, 0.3)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    padding: space[24],
    paddingBottom: space[32],
    gap: space[4],
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space[8], marginBottom: space[8] },
  facts: { marginTop: space[16], gap: space[8] },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  noteInput: {
    marginTop: space[4],
    minHeight: 80,
    borderWidth: 1,
    borderColor: color.control,
    borderRadius: radius.control,
    padding: space[12],
    fontFamily: font.regular,
    fontSize: 16,
    color: color.ink,
    textAlignVertical: 'top',
  },
});
