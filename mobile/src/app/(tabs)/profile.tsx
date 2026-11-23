import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, Panel, T } from '../../components/ui';
import { API_URL } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import { useChangePassword } from '../../lib/queries';
import { color, radius, space, type } from '../../lib/theme';

const ACCESS = { owner: 'Owner', supervisor: 'Supervisor', employee: 'Employee' } as const;

export default function Profile() {
  const { user, organization } = useMe();
  const { signOut } = useAuth();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (change.isPending) return;
    setSaved(false);
    if (!current) return setError('Enter your current password.');
    if (next.length < 8) return setError('Use at least 8 characters for the new password.');
    try {
      await change.mutateAsync({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setError(null);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change your password.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <T variant="page" accessibilityRole="header">
            Profile
          </T>
          <Panel style={styles.card}>
            <Text style={type.section}>{user.full_name}</Text>
            <Text style={[type.body, { color: color.muted }]}>
              {ACCESS[user.access_level]} at {organization.name}
            </Text>
            <View style={styles.tags}>
              {user.roles.length ? (
                user.roles.map((r) => (
                  <View key={r.id} style={styles.tag}>
                    <Text style={[type.meta, { color: color.ink }]}>{r.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={type.meta}>No role yet</Text>
              )}
            </View>
            <View style={styles.facts}>
              {user.email && <Text style={type.body}>{user.email}</Text>}
              {user.phone && <Text style={type.body}>{user.phone}</Text>}
            </View>
          </Panel>

          <Panel style={styles.card}>
            <Text style={[type.subheading, { marginBottom: space[16] }]} accessibilityRole="header">
              Change password
            </Text>
            {saved && (
              <Text style={[type.label, styles.saved]} accessibilityLiveRegion="polite">
                Password changed
              </Text>
            )}
            <Field
              label="Current password"
              value={current}
              onChangeText={(v) => {
                setCurrent(v);
                setError(null);
              }}
              secureTextEntry
              autoComplete="current-password"
            />
            <Field
              label="New password"
              value={next}
              onChangeText={(v) => {
                setNext(v);
                setError(null);
              }}
              secureTextEntry
              autoComplete="new-password"
              help="At least 8 characters."
              error={error}
            />
            <Button label="Change password" pendingLabel="Changing…" pending={change.isPending} onPress={submit} />
          </Panel>

          <Button label="Sign out" icon={LogOut} onPress={() => void signOut()} style={{ marginTop: space[8] }} />
          <T variant="meta" style={{ textAlign: 'center', marginTop: space[16] }}>
            Connected to {API_URL} · times shown in {organization.timezone.replace(/_/g, ' ')}
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  scroll: { padding: space[16], paddingBottom: space[48], gap: space[16] },
  card: { padding: space[16] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4], marginTop: space[12] },
  tag: { borderWidth: 1, borderColor: color.line, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 1 },
  facts: { marginTop: space[12], gap: space[4] },
  saved: { color: color.success, backgroundColor: color.successSoft, padding: space[8], borderRadius: radius.control, marginBottom: space[12] },
});
