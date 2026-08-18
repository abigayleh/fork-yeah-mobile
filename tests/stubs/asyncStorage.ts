// lib/firebase.ts imports AsyncStorage, which pulls in react-native and cannot
// load under Node. Auth persistence is irrelevant to these tests — the RN-only
// getReactNativePersistence is undefined here, so firebase falls back to
// getAuth() and this stub is never actually read from.
const memory = new Map<string, string>();

export default {
  getItem: async (k: string) => memory.get(k) ?? null,
  setItem: async (k: string, v: string) => { memory.set(k, v); },
  removeItem: async (k: string) => { memory.delete(k); },
};
