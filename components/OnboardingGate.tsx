import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  authenticateBiometric,
  isBiometricOnboardingSeen,
  isBiometricSupported,
  setBiometricLockEnabled,
  setBiometricOnboardingSeen,
} from '../lib/biometric';

// One-time prompt to enable Face ID, shown on a user's first-ever login on this device.
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (loading || !user || checked.current) return;
    checked.current = true;
    (async () => {
      if (await isBiometricOnboardingSeen()) return;
      if (await isBiometricSupported()) setShow(true);
      else await setBiometricOnboardingSeen(); // unsupported: ask once, never again
    })();
  }, [loading, user]);

  const dismiss = async () => {
    await setBiometricOnboardingSeen();
    setShow(false);
  };

  const enable = async () => {
    const { success } = await authenticateBiometric();
    if (success) await setBiometricLockEnabled(true);
    await dismiss();
  };

  return (
    <>
      {children}
      {show && (
        <View style={styles.overlay}>
          <Ionicons name="lock-closed" size={56} color="#0f766e" />
          <Text style={styles.title}>Enable Face ID?</Text>
          <Text style={styles.subtitle}>Require Face ID to open Whats for Dinner. You can change this later in Settings.</Text>
          <TouchableOpacity style={styles.btn} onPress={enable}>
            <Text style={styles.btnText}>Enable Face ID</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={dismiss}>
            <Text style={styles.skipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fffaf0', justifyContent: 'center', alignItems: 'center', padding: 32, zIndex: 1000 },
  title: { fontSize: 22, fontWeight: '800', color: '#115e59', marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#5e6a63', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#0f766e', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 20 },
  skipText: { color: '#5e6a63', fontWeight: '600', fontSize: 14 },
});
