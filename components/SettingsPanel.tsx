import { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  authenticateBiometric,
  isBiometricLockEnabled,
  isBiometricSupported,
  setBiometricLockEnabled,
} from '../lib/biometric';

export default function SettingsPanel() {
  const { user, logOut } = useAuth();
  const [supported, setSupported] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setSupported);
    isBiometricLockEnabled().then(setLockEnabled);
  }, []);

  const handleToggle = async (next: boolean) => {
    if (!next) {
      await setBiometricLockEnabled(false);
      setLockEnabled(false);
      return;
    }
    // Confirm the user can pass the biometric check before enabling.
    const ok = await authenticateBiometric();
    if (!ok) return;
    await setBiometricLockEnabled(true);
    setLockEnabled(true);
  };

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logOut() },
    ]);
  };

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle}>Face ID unlock</Text>
          <Text style={styles.rowSubtitle}>
            {supported ? 'Require Face ID to open the app.' : 'No biometrics set up on this device.'}
          </Text>
        </View>
        <Switch value={lockEnabled} onValueChange={handleToggle} disabled={!supported} />
      </View>

      {user ? (
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  rowInfo: { flex: 1, paddingRight: 12 },
  rowTitle: { fontWeight: '700', color: '#1f2421', fontSize: 15 },
  rowSubtitle: { color: '#5e6a63', fontSize: 13, marginTop: 2 },
  logoutBtn: { marginTop: 16, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  logoutText: { color: '#9f1239', fontWeight: '700' },
});
