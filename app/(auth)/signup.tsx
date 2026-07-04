import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const handleSignUp = async () => {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    try {
      await signUpWithEmail(email, password);
    } catch {
      setError('Could not create account. Please try again.');
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
    } catch {
      Alert.alert('Google signup failed', 'Please try again.');
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>Create your account and start planning meals.</Text>
        {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleSignUp}>
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleGoogleSignUp}>
          <Text style={styles.secondaryBtnText}>Sign Up with Google</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Link href="/(auth)/login" style={styles.link}>Log in</Link>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fffaf0' },
  card: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 18, padding: 22, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#115e59', marginBottom: 6 },
  subtitle: { color: '#5e6a63', marginBottom: 18 },
  errorText: { color: '#b91c1c', marginBottom: 10 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { width: '100%', borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, marginBottom: 14 },
  primaryBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 11, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 12, padding: 10, alignItems: 'center', marginBottom: 10, backgroundColor: '#fff' },
  secondaryBtnText: { fontWeight: '700' },
  footerText: { textAlign: 'center', marginTop: 8 },
  link: { color: '#115e59', fontWeight: '700' },
});
