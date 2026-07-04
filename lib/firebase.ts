import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, type Auth, type Persistence } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TS types 'firebase/auth' as its web build; getReactNativePersistence only
// exists on the RN build Metro actually resolves at runtime.
const getReactNativePersistence = (firebaseAuth as unknown as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
}).getReactNativePersistence;

const firebaseConfig = {
  apiKey: 'AIzaSyA_0Tq8pYxdri8AhdgpcLXCAtpsYMZDiEg',
  authDomain: 'forkyeah-89109.firebaseapp.com',
  projectId: 'forkyeah-89109',
  storageBucket: 'forkyeah-89109.firebasestorage.app',
  messagingSenderId: '888702110970',
  appId: '1:888702110970:web:33b28857d881145755cd43',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// getAuth() alone defaults to memory-only persistence on React Native and logs
// users out on every restart; initializeAuth + AsyncStorage persists sessions.
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}
const db = getFirestore(app);

export { auth, db };
