import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const stub = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Node-only integration tests: they drive the app's data layer against the
// Firestore/Auth emulators loaded with the REAL production rules, so a query the
// rules forbid fails here instead of at runtime on a device.
export default defineConfig({
  resolve: {
    // lib/firebase.ts imports AsyncStorage, which needs a react-native runtime.
    alias: { '@react-native-async-storage/async-storage': stub('./tests/stubs/asyncStorage.ts') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Read by lib/emulatorConfig.ts; the harness refuses to run without it.
    env: { EXPO_PUBLIC_USE_FIREBASE_EMULATOR: '1' },
    testTimeout: 20000,
    hookTimeout: 20000,
    // One shared emulator project, cleared between files.
    fileParallelism: false,
  },
});
