import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function DeleteAccount() {
  const { user, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState('');

  if (!user) return null;

  const isPassword = user.providerData[0]?.providerId === 'password';

  const run = async (pw?: string) => {
    setBusy(true);
    try {
      await deleteAccount(pw);
      // onAuthStateChanged clears the cache and returns to the logged-out UI.
      setPwOpen(false);
      setPassword('');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const msg =
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Incorrect password. Please try again.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : err.message || 'Could not delete your account. Please try again.';
      Alert.alert('Account not deleted', msg);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all your recipes, meal plans and grocery lists. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => (isPassword ? setPwOpen(true) : run()) },
      ]
    );
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={confirm} disabled={busy}>
        {busy && !pwOpen ? <ActivityIndicator color="#9f1239" /> : <Text style={styles.text}>Delete Account</Text>}
      </TouchableOpacity>

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => !busy && setPwOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Confirm your password</Text>
            <Text style={styles.subtitle}>Enter your password to permanently delete your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              editable={!busy}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancel} onPress={() => !busy && setPwOpen(false)} disabled={busy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.delete, (!password || busy) && { opacity: 0.5 }]}
                onPress={() => run(password)}
                disabled={!password || busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 12, borderWidth: 1, borderColor: '#9f1239', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  text: { color: '#9f1239', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 400 },
  title: { fontSize: 18, fontWeight: '800', color: '#115e59', marginBottom: 6 },
  subtitle: { color: '#5e6a63', fontSize: 13, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancel: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { color: '#5e6a63', fontWeight: '700' },
  delete: { backgroundColor: '#9f1239', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minWidth: 90 },
  deleteText: { color: '#fff', fontWeight: '700' },
});
