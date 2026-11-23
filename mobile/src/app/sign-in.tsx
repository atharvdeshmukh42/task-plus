import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button, Field, Panel, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { color, space } from '../lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (pending) return;
    if (!identifier.trim() || !password) {
      setError('Enter your email or phone number and your password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Logo size={40} />
          </View>
          <T variant="page" accessibilityRole="header">
            Sign in
          </T>
          <T style={styles.lead}>See today’s tasks and how you’re keeping up.</T>
          <Panel style={styles.card}>
            {error && (
              <T variant="body" style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </T>
            )}
            <Field
              label="Email or phone number"
              value={identifier}
              onChangeText={(v) => {
                setIdentifier(v);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Button label="Sign in" pendingLabel="Signing in…" variant="primary" onPress={submit} pending={pending} />
          </Panel>
          <T variant="meta" style={styles.footnote}>
            Your supervisor gives you your sign-in details.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space[24], maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { marginBottom: space[32] },
  lead: { color: color.muted, marginTop: space[4], marginBottom: space[24] },
  card: { padding: space[24] },
  error: { color: color.danger, marginBottom: space[16] },
  footnote: { textAlign: 'center', marginTop: space[24] },
});
