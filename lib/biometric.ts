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

// The system sheet flips AppState inactive->active; callers ignore that for a moment after it closes.
const GRACE_MS = 1500;
let authenticating = false;
let endedAt = 0;

export const isBiometricPromptActive = (): boolean =>
  authenticating || Date.now() - endedAt < GRACE_MS;

export const authenticateBiometric = async () => {
  authenticating = true;
  try {
    return await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Whats for Dinner',
      fallbackLabel: 'Use password',
    });
  } finally {
    authenticating = false;
    endedAt = Date.now();
  }
};
