import { CircleAlert, CircleCheck, CircleX, Clock3, Info, RotateCw, type LucideIcon } from 'lucide-react-native';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { Status } from '../lib/types';
import { color, font, height, radius, space, type } from '../lib/theme';

/* ---------- Text ---------- */

type Role = keyof typeof type;

export function T({
  variant = 'body',
  style,
  children,
  ...rest
}: { variant?: Role; style?: StyleProp<TextStyle>; children: ReactNode } & Omit<ComponentProps<typeof Text>, 'style' | 'children'>) {
  return (
    <Text style={[type[variant], style]} {...rest}>
      {children}
    </Text>
  );
}

/* ---------- Buttons ---------- */

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  icon: Icon,
  pending,
  pendingLabel,
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: PressableProps['onPress'];
  variant?: Variant;
  icon?: LucideIcon;
  pending?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || pending;
  const palette = {
    primary: { bg: color.accent, fg: color.onAccent, border: color.accent, pressed: color.accentHover },
    secondary: { bg: color.surface, fg: color.ink, border: color.control, pressed: color.subtle },
    quiet: { bg: 'transparent', fg: color.accent, border: 'transparent', pressed: color.accentSoft },
    danger: { bg: color.danger, fg: color.surface, border: color.danger, pressed: '#8A2D2D' },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(pending) }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { backgroundColor: palette.pressed },
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={inactive ? color.muted : palette.fg} />
      ) : (
        Icon && <Icon size={16} color={inactive ? color.muted : palette.fg} />
      )}
      <Text style={[type.label, { color: inactive ? color.muted : palette.fg }]}>{pending ? (pendingLabel ?? label) : label}</Text>
    </Pressable>
  );
}

/* ---------- Status ---------- */

const STATUS: Record<Status, { label: string; fg: string; bg: string; Icon: LucideIcon }> = {
  upcoming: { label: 'Upcoming', fg: color.info, bg: color.infoSoft, Icon: Info },
  pending: { label: 'To do', fg: color.muted, bg: color.subtle, Icon: Clock3 },
  overdue: { label: 'Overdue', fg: color.warning, bg: color.warningSoft, Icon: CircleAlert },
  done: { label: 'Done', fg: color.success, bg: color.successSoft, Icon: CircleCheck },
  late: { label: 'Done late', fg: color.warning, bg: color.warningSoft, Icon: CircleCheck },
  missed: { label: 'Missed', fg: color.danger, bg: color.dangerSoft, Icon: CircleX },
};

export function statusLabel(status: Status) {
  return STATUS[status].label;
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, fg, bg, Icon } = STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon size={12} color={fg} />
      <Text style={[type.meta, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* ---------- Surfaces ---------- */

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/* ---------- Fields ---------- */

export function Field({ label, error, help, ...input }: { label: string; error?: string | null; help?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        placeholderTextColor={color.muted}
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        style={[styles.input, error ? styles.inputInvalid : null]}
        {...input}
      />
      {help && !error ? <Text style={[type.meta, styles.fieldNote]}>{help}</Text> : null}
      {error ? (
        <Text style={[type.meta, styles.fieldNote, { color: color.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------- States ---------- */

export function ErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <View style={styles.row}>
        <CircleAlert size={16} color={color.danger} />
        <Text style={[type.label, { color: color.danger, flex: 1 }]}>{title}</Text>
      </View>
      <Text style={[type.body, { marginTop: space[4] }]}>{error instanceof Error ? error.message : 'Something went wrong.'}</Text>
      {onRetry && <Button label="Retry" icon={RotateCw} onPress={onRetry} style={{ alignSelf: 'flex-start', marginTop: space[12] }} />}
    </View>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={[type.subheading, { textAlign: 'center' }]}>{title}</Text>
      {body && <Text style={[type.body, { color: color.muted, textAlign: 'center', marginTop: space[4] }]}>{body}</Text>}
      {children}
    </View>
  );
}

export function Skeleton({ height: h = 64 }: { height?: number }) {
  return <View style={[styles.skeleton, { height: h }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  button: {
    minHeight: height.touch,
    paddingHorizontal: space[16],
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
  },
  buttonDisabled: { backgroundColor: color.subtle, borderColor: color.line },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.tag,
    alignSelf: 'flex-start',
  },
  panel: { backgroundColor: color.surface, borderColor: color.line, borderWidth: 1, borderRadius: radius.panel },
  field: { marginBottom: space[16] },
  input: {
    marginTop: space[4],
    minHeight: height.touch,
    borderWidth: 1,
    borderColor: color.control,
    borderRadius: radius.control,
    paddingHorizontal: space[12],
    backgroundColor: color.surface,
    color: color.ink,
    fontFamily: font.regular,
    fontSize: 16,
  },
  inputInvalid: { borderColor: color.danger },
  fieldNote: { marginTop: space[4] },
  errorBox: {
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: color.dangerSoft,
    borderRadius: radius.panel,
    padding: space[16],
  },
  empty: { alignItems: 'center', paddingVertical: space[32], paddingHorizontal: space[16], gap: space[8] },
  skeleton: { backgroundColor: color.subtle, borderRadius: radius.panel, marginBottom: space[8] },
});
