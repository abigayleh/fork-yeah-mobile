import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
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
    // Replace with your iOS/Android client IDs from Google Cloud Console
    iosClientId: '',
    androidClientId: '',
    webClientId: '888702110970-web.apps.googleusercontent.com',
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
