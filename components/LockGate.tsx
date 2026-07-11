import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { authenticateBiometric, isBiometricLockEnabled } from '../lib/biometric';

// Gates the already-persisted session behind Face ID / Touch ID when enabled.
export default function LockGate({ children }: { children: React.ReactNode }) {
  const { user, loading, logOut } = useAuth();
  const [locked, setLocked] = useState(false);
  const initialized = useRef(false);
  const prompting = useRef(false);

  // Lock once on launch if a persisted session exists and the lock is enabled.
  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    if (!user) return;
    isBiometricLockEnabled().then((enabled) => enabled && setLocked(true));
  }, [loading, user]);

  // Re-lock when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !user || locked || prompting.current) return;
      isBiometricLockEnabled().then((enabled) => enabled && setLocked(true));
    });
    return () => sub.remove();
  }, [user, locked]);

  const unlock = async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const ok = await authenticateBiometric();
      if (ok) setLocked(false);
      else { await logOut(); setLocked(false); } // fall back to password login
    } finally {
      prompting.current = false;
    }
  };

  // Auto-prompt whenever the app becomes locked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (locked) unlock(); }, [locked]);

  return (
    <>
      {children}
      {locked && (
        <View style={styles.overlay}>
          <Ionicons name="lock-closed" size={56} color="#0f766e" />
          <Text style={styles.title}>Locked</Text>
          <TouchableOpacity style={styles.btn} onPress={unlock}>
            <Text style={styles.btnText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fffaf0', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  title: { fontSize: 22, fontWeight: '800', color: '#115e59', marginTop: 16, marginBottom: 24 },
  btn: { backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
