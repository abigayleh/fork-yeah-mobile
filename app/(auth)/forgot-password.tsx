import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    setError('');
    setMessage('');
    if (!email) { setError('Please enter your email address.'); return; }
    try {
      await resetPassword(email.trim().toLowerCase());
      setMessage('If an account exists for that email, a reset link has been sent.');
      setEmail('');
    } catch {
      setError('Could not send reset email. Please try again.');
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>We&apos;ll send you a reset link.</Text>
        {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
        {Boolean(message) && <Text style={styles.successText}>{message}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />

        <TouchableOpacity style={styles.primaryBtn} onPress={handleReset}>
          <Text style={styles.primaryBtnText}>Send Reset Link</Text>
        </TouchableOpacity>
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
  successText: { color: '#166534', marginBottom: 10 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { width: '100%', borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, marginBottom: 14 },
  primaryBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 11, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
