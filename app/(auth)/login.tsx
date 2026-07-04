import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import LoginForm from '../../components/LoginForm';

export default function LoginScreen() {
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <LoginForm />
        <Text style={styles.footerText}>
          <Link href="/(app)/browse-recipes" style={styles.link}>Browse recipes without signing in</Link>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fffaf0' },
  card: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 18, padding: 22, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  footerText: { textAlign: 'center', marginTop: 8 },
  link: { color: '#115e59', fontWeight: '700' },
});
