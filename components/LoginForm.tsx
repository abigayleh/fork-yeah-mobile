import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import AppleSignInButton from './AppleSignInButton';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const handleEmailLogin = async () => {
    try {
      await signInWithEmail(email, password);
    } catch {
      Alert.alert('Login failed', 'Check your email and password and try again.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch {
      Alert.alert('Google login failed', 'Please try again.');
    }
  };

  return (
    <View>
      <Text style={styles.title}>Log In</Text>
      <Text style={styles.subtitle}>Get back to your saved recipes and meal plans.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />

      <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailLogin}>
        <Text style={styles.primaryBtnText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleGoogleLogin}>
        <Text style={styles.secondaryBtnText}>Log In with Google</Text>
      </TouchableOpacity>

      <AppleSignInButton />

      <Text style={styles.footerText}>
        Need an account?{' '}
        <Link href="/(auth)/signup" style={styles.link}>Sign up</Link>
      </Text>
      <Text style={styles.footerText}>
        <Link href="/(auth)/forgot-password" style={styles.link}>Forgot password?</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '800', color: '#115e59', marginBottom: 6 },
  subtitle: { color: '#5e6a63', marginBottom: 18 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { width: '100%', borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, marginBottom: 14 },
  primaryBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 11, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 12, padding: 10, alignItems: 'center', marginBottom: 10, backgroundColor: '#fff' },
  secondaryBtnText: { fontWeight: '700' },
  footerText: { textAlign: 'center', marginTop: 8 },
  link: { color: '#115e59', fontWeight: '700' },
});
