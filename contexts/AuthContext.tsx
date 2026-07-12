import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
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
    if (googleResponse?.type === 'success') {
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
    await promptGoogleAsync();
  };

  const signInWithApple = async () => {
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
    const credential = new OAuthProvider('apple.com').credential({
      idToken: appleCredential.identityToken,
      rawNonce,
    });
    await signInWithCredential(auth, credential);
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
