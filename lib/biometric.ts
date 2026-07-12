import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const ENABLED_KEY = 'biometricLockEnabled';
const ONBOARDING_SEEN_KEY = 'biometricOnboardingSeen';

export const isBiometricSupported = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
};

export const isBiometricLockEnabled = async (): Promise<boolean> => {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
};

export const setBiometricLockEnabled = (enabled: boolean): Promise<void> => {
  return AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
};

export const isBiometricOnboardingSeen = async (): Promise<boolean> => {
  return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === 'true';
};

export const setBiometricOnboardingSeen = (): Promise<void> => {
  return AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
};

export const authenticateBiometric = async (): Promise<boolean> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Fork Yeah',
    fallbackLabel: 'Use password',
  });
  return result.success;
};
