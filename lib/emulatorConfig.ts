// Shared by lib/firebase.ts and the test harness so both agree on where the
// emulators live. Deliberately not the web repo's 8080/9099: on the same ports
// the mobile tests could silently hit that project's allow-all rules and pass
// on queries production forbids.
export const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';
export const EMULATOR_HOST = '127.0.0.1';
export const FIRESTORE_EMULATOR_PORT = 8085;
export const AUTH_EMULATOR_PORT = 9199;
export const EMULATOR_PROJECT_ID = 'demo-forkyeah-mobile';
