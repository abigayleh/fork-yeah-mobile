import { auth } from './firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://whats-for-dinnner.netlify.app';

// Calls a backend API route with the signed-in user's Firebase ID token attached,
// mirroring the web app's authedFetch so server routes can verify the caller.
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}
