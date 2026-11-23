import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { occurrenceContext, windowLabel } from '../lib/format';
import { color, height, space, type } from '../lib/theme';
import type { Occurrence } from '../lib/types';
import { StatusBadge } from './ui';

export function TaskRow({
  occurrence: o,
  onOpen,
  onComplete,
  busy,
}: {
  occurrence: Occurrence;
  onOpen: () => void;
  onComplete: () => void;
  busy: boolean;
}) {
  const done = o.status === 'done' || o.status === 'late';
  const window = windowLabel(o.task);
  const meta = [window, occurrenceContext(o), o.task.role?.name].filter(Boolean).join(' · ');
  const showBadge = o.status !== 'pending' && o.status !== 'done';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={done ? `${o.task.title}, done` : `Mark ${o.task.title} done`}
        accessibilityState={{ checked: done, disabled: !o.can_complete || busy }}
        disabled={!o.can_complete || busy}
        onPress={onComplete}
        hitSlop={6}
        style={styles.checkHit}
      >
        <View
          style={[
            styles.check,
            done && { backgroundColor: o.status === 'late' ? color.chartLate : color.success, borderColor: 'transparent' },
            !done && !o.can_complete && styles.checkDisabled,
          ]}
        >
          {done && <Check size={16} color={color.onAccent} strokeWidth={3} />}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens task details"
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.6 }]}
      >
        <Text style={[type.label, styles.title, done && styles.titleDone]} numberOfLines={2}>
          {o.task.title}
        </Text>
        {meta ? <Text style={type.meta}>{meta}</Text> : null}
        {showBadge && (
          <View style={{ marginTop: space[4] }}>
            <StatusBadge status={o.status} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[4],
    minHeight: height.rowTouch,
    paddingVertical: space[8],
    paddingRight: space[16],
    paddingLeft: space[4],
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  checkHit: { width: height.touch, height: height.touch, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  checkDisabled: { borderColor: color.line, backgroundColor: color.subtle },
  body: { flex: 1, paddingVertical: space[4], gap: 2, minHeight: height.touch, justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 22 },
  titleDone: { color: color.muted },
});

