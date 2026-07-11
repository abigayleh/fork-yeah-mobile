import { Platform, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../contexts/AuthContext';

// Apple Sign In is iOS-only; renders nothing elsewhere.
export default function AppleSignInButton() {
  const { signInWithApple } = useAuth();

  if (Platform.OS !== 'ios') return null;

  const handlePress = async () => {
    try {
      await signInWithApple();
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Apple sign-in failed', 'Please try again.');
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={{ height: 44, marginBottom: 10 }}
      onPress={handlePress}
    />
  );
}
