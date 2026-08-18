import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import {
  AUTH_EMULATOR_PORT, EMULATOR_HOST, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT, USE_EMULATOR,
} from '../../lib/emulatorConfig';

// Tests drive the app's own firebase singletons, not a parallel instance, so a
// misconfigured lib/firebase.ts fails the suite instead of hiding behind it.
if (!USE_EMULATOR) {
  throw new Error(
    'EXPO_PUBLIC_USE_FIREBASE_EMULATOR is not set — refusing to run tests against production.'
  );
}

export { auth, db };
export const PASSWORD = 'password123';

export const signUp = async (email: string) =>
  (await createUserWithEmailAndPassword(auth, email, PASSWORD)).user.uid;

export const signIn = async (email: string) =>
  (await signInWithEmailAndPassword(auth, email, PASSWORD)).user.uid;

export const signOutTestUser = () => signOut(auth);

// Lets a test state "production forbids this" rather than merely "it threw".
export const expectDenied = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    const message = (error as { message?: string })?.message ?? '';
    if (code.includes('permission-denied') || message.includes('PERMISSION_DENIED')) return;
    throw new Error(`expected permission-denied, got: ${code || message}`);
  }
  throw new Error('expected permission-denied, but the call succeeded');
};

const emulatorUrl = (port: number, path: string) =>
  `http://${EMULATOR_HOST}:${port}/emulator/v1/projects/${EMULATOR_PROJECT_ID}${path}`;

export async function clearEmulatorData() {
  await signOut(auth).catch(() => {});
  await Promise.all([
    fetch(emulatorUrl(FIRESTORE_EMULATOR_PORT, '/databases/(default)/documents'), { method: 'DELETE' }),
    fetch(emulatorUrl(AUTH_EMULATOR_PORT, '/accounts'), { method: 'DELETE' }),
  ]);
}
