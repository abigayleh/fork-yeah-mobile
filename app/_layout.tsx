import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';
import LockGate from '../components/LockGate';

const queryClient = new QueryClient();

function RootNavigator() {
  const { user, loading, loginModalOpen, dismissLoginModal } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const path = segments as string[];
    const allowedForGuest = path[0] === '(app)' && (path[2] === 'browse-recipes' || path[1] === 'recipe');
    if (!user && !inAuthGroup && !allowedForGuest) {
      router.replace('/(auth)/login');
    } else if (user && !inAppGroup) {
      router.replace('/(app)/browse-recipes');
    }
  }, [user, loading, segments, router, navState?.key]);

  return (
    <>
      <Slot />
      <Modal visible={loginModalOpen} transparent animationType="fade" onRequestClose={dismissLoginModal}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.closeBtn} onPress={dismissLoginModal}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <LoginForm />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 18, padding: 22, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 4 },
  closeBtnText: { fontSize: 20, color: '#5e6a63' },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LockGate>
            <RootNavigator />
          </LockGate>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
