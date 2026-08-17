import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  signInWithCredential,
  reauthenticateWithCredential,
  deleteUser,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../lib/firebase';
import { useUserDataContext } from '../hooks/useUserDataContext';
import { useQueryClient } from '@tanstack/react-query';
import { useRecipeApi } from '../hooks/useRecipeApi';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = ReturnType<typeof useUserDataContext> &
  ReturnType<typeof useRecipeApi> & {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    logOut: () => Promise<void>;
    deleteAccount: (password?: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    loginModalOpen: boolean;
    promptLogin: () => void;
    dismissLoginModal: () => void;
  };

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const queryClient = useQueryClient();
  // Set while deleting an account so the Google response effect doesn't re-sign-in
  // (which would recreate the account) after the reauth prompt resolves.
  const deletingRef = useRef(false);

  const promptLogin = () => setLoginModalOpen(true);
  const dismissLoginModal = () => setLoginModalOpen(false);

  useEffect(() => {
    if (user) setLoginModalOpen(false);
  }, [user]);

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:
      '888702110970-ua103f1surn435l2tpsdk6v20ic90gf1.apps.googleusercontent.com',
    // TODO: add androidClientId when the Android OAuth client is created
    androidClientId: '',
    webClientId:
      '888702110970-lv47hhnud0nmvlh34al6ig9l7k3cerq3.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (googleResponse?.type === 'success' && !deletingRef.current) {
      const { id_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential);
    }
  }, [googleResponse]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        queryClient.clear();
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const userDataApi = useUserDataContext(user);
  const recipeApi = useRecipeApi(userDataApi.getFamilyUserIdsForCurrentUser);

  const signInWithGoogle = async () => {
    // Clear the delete guard so a fresh login after an account deletion still signs in.
    deletingRef.current = false;
    await promptGoogleAsync();
  };

  const getAppleCredential = async (): Promise<AuthCredential> => {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!appleCredential.identityToken) throw new Error('Apple sign-in failed');
    return new OAuthProvider('apple.com').credential({
      idToken: appleCredential.identityToken,
      rawNonce,
    });
  };

  const signInWithApple = async () => {
    await signInWithCredential(auth, await getAppleCredential());
  };

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  // Reauthenticate (required before deletion), purge the user's data, then delete
  // the auth account. `password` is only needed for email/password accounts.
  const deleteAccount = async (password?: string) => {
    const current = auth.currentUser;
    if (!current) throw new Error('You are not signed in.');

    const providerId = current.providerData[0]?.providerId;
    let credential: AuthCredential | null = null;
    if (providerId === 'password') {
      if (!password) throw new Error('Password is required.');
      credential = EmailAuthProvider.credential(current.email ?? '', password);
    } else if (providerId === 'apple.com') {
      credential = await getAppleCredential();
    } else if (providerId === 'google.com') {
      deletingRef.current = true;
      const res = await promptGoogleAsync();
      if (res?.type !== 'success') {
        deletingRef.current = false;
        throw new Error('Google sign-in was cancelled.');
      }
      credential = GoogleAuthProvider.credential(res.params.id_token);
    }

    deletingRef.current = true;
    try {
      if (credential) await reauthenticateWithCredential(current, credential);
      await userDataApi.deleteAllUserData(current.uid);
      await deleteUser(current);
    } catch (e) {
      deletingRef.current = false;
      throw e;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithApple,
        signUpWithEmail,
        signInWithEmail,
        logOut,
        deleteAccount,
        resetPassword,
        loginModalOpen,
        promptLogin,
        dismissLoginModal,
        ...userDataApi,
        ...recipeApi,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
