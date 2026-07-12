import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://whats-for-dinnner.netlify.app';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function useUserDataContext(user: User | null) {
  type Profile = Record<string, unknown> & { id?: string; familyId?: string; name?: string };
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [familyUserIds, setFamilyUserIds] = useState<string[]>([]);
  const [userContextLoading, setUserContextLoading] = useState(false);

  const resolveFamilyUserIds = async (profile: Profile | null, currentUserId: string) => {
    const normalizedId = currentUserId.trim();
    if (!profile?.familyId) return normalizedId ? [normalizedId] : [];

    const familyId = String(profile.familyId).trim();
    const familiesRef = collection(db, 'families');
    const familyQuery = query(familiesRef, where('familyId', '==', familyId));
    const familyQuerySnap = await getDocs(familyQuery);

    let familyData: Record<string, unknown> | null = null;
    if (!familyQuerySnap.empty) {
      familyData = familyQuerySnap.docs[0].data();
    } else {
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      familyData = familySnap.exists() ? familySnap.data() : null;
    }

    const ids = Array.isArray(familyData?.users) ? (familyData.users as string[]) : [];
    return ids.length === 0 ? (normalizedId ? [normalizedId] : []) : Array.from(new Set(ids));
  };

  const refreshGlobalUserContext = async (targetUser = auth.currentUser) => {
    if (!targetUser?.uid) {
      setCurrentUserProfile(null);
      setFamilyUserIds([]);
      return { profile: null, familyUserIds: [] };
    }

    setUserContextLoading(true);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const userSnap = await getDoc(userRef);
      const profile: Profile | null = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      const nextFamilyUserIds = await resolveFamilyUserIds(profile, targetUser.uid);

      setCurrentUserProfile(profile);
      setFamilyUserIds(nextFamilyUserIds);
      return { profile, familyUserIds: nextFamilyUserIds };
    } catch (error) {
      console.error('Error refreshing user context:', error);
      setCurrentUserProfile(null);
      setFamilyUserIds(targetUser?.uid ? [targetUser.uid] : []);
      return { profile: null, familyUserIds: targetUser?.uid ? [targetUser.uid] : [] };
    } finally {
      setUserContextLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadContext = async () => {
      if (!user?.uid) {
        setCurrentUserProfile(null);
        setFamilyUserIds([]);
        return;
      }
      const result = await refreshGlobalUserContext(user);
      if (!isMounted) return;
      if (!result.profile) setCurrentUserProfile(null);
    };
    loadContext();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const getCurrentUserProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    if (currentUserProfile && (currentUserProfile as { id?: string }).id === currentUser.uid) {
      return currentUserProfile;
    }
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;
    const profile: Profile = { id: userSnap.id, ...userSnap.data() };
    setCurrentUserProfile(profile);
    return profile;
  };

  const getFamilyUserIdsForCurrentUser = async (): Promise<string[]> => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) return [];
    if (familyUserIds.length > 0) return familyUserIds;
    const profile = await getCurrentUserProfile();
    if (!profile?.familyId) {
      setFamilyUserIds([currentUser.uid]);
      return [currentUser.uid];
    }
    const next = await resolveFamilyUserIds(profile, currentUser.uid);
    setFamilyUserIds(next);
    return next;
  };

  const getFamilyForCurrentUser = async () => {
    const profile = await getCurrentUserProfile();
    const familyId = profile?.familyId;
    if (!familyId) return null;
    const familyRef = doc(db, 'families', familyId);
    const familySnap = await getDoc(familyRef);
    if (familySnap.exists()) return { id: familySnap.id, ...familySnap.data() };
    const q = query(collection(db, 'families'), where('familyId', '==', familyId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  };

  const getUsersByIds = async (userIds: string[] = []) => {
    if (userIds.length === 0) return [];
    const users = await Promise.all(
      userIds.map(async (id) => {
        try {
          const userRef = doc(db, 'users', id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) return { ...userSnap.data(), id: userSnap.id };
          const q = query(collection(db, 'users'), where('userId', '==', id));
          const snap = await getDocs(q);
          if (snap.empty) return null;
          return { ...snap.docs[0].data(), id: snap.docs[0].id };
        } catch (error) {
          console.error('Error resolving user by id:', id, error);
          return null;
        }
      })
    );
    return users.filter(Boolean);
  };

  const createUserProfile = async (name: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw new Error('Name is required');

    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};
    const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();
    const familyId = typeof existingData.familyId === 'string' && existingData.familyId.trim()
      ? existingData.familyId
      : generateUUID();

    await setDoc(userRef, {
      userId: currentUser.uid,
      name: trimmedName,
      email: normalizedEmail,
      signupEmail: normalizedEmail,
      permission: 'ADMIN',
      familyId,
    }, { merge: true });

    const familyRef = doc(db, 'families', familyId);
    const familySnap = await getDoc(familyRef);
    const existingFamily = familySnap.exists() ? familySnap.data() : {};
    const existingUsers = Array.isArray(existingFamily.users) ? existingFamily.users as string[] : [];
    await setDoc(familyRef, {
      familyId,
      users: [...existingUsers.filter((uid) => uid !== currentUser.uid), currentUser.uid],
    }, { merge: true });

    await refreshGlobalUserContext(currentUser);
    return { userId: currentUser.uid, name: trimmedName, email: normalizedEmail, signupEmail: normalizedEmail, permission: 'ADMIN', familyId };
  };

  const inviteFamilyMember = async (email: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email is required');

    const profile = await getCurrentUserProfile();
    if (!profile?.familyId) throw new Error('You need a family before inviting members.');

    const familyId = String(profile.familyId);
    const invitationToken = generateUUID();

    const inviterName = profile.name || 'A family member';
    const invitationRef = doc(collection(db, 'invitations'));
    await setDoc(invitationRef, {
      email: normalizedEmail,
      familyId,
      invitationToken,
      name: inviterName,
      createdAt: new Date(),
      status: 'pending',
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/emails/sendFamilyInvitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, inviterName, invitationToken }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send invitation email');
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      throw new Error('Invitation created but email could not be sent. Please share the link manually.');
    }

    return { invitedEmail: normalizedEmail, familyId, invitationToken };
  };

  const removeFamilyMember = async (memberUserId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) throw new Error('User not authenticated');

    const normalizedMemberId = String(memberUserId || '').trim();
    if (!normalizedMemberId) throw new Error('Invalid member.');
    if (normalizedMemberId === currentUser.uid) throw new Error('You cannot remove yourself.');

    const profile = await getCurrentUserProfile();
    if (!profile?.familyId) throw new Error('No family found.');

    const familyId = String(profile.familyId);
    const familyRef = doc(db, 'families', familyId);
    await updateDoc(familyRef, { users: arrayRemove(normalizedMemberId) });

    const memberRef = doc(db, 'users', normalizedMemberId);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists() && memberSnap.data().familyId === familyId) {
      const newFamilyId = generateUUID();
      await updateDoc(memberRef, { familyId: newFamilyId });
      await setDoc(doc(db, 'families', newFamilyId), { familyId: newFamilyId, users: [normalizedMemberId] });
    }

    const updatedFamilySnap = await getDoc(familyRef);
    const updatedUsers: string[] = Array.isArray(updatedFamilySnap.data()?.users)
      ? updatedFamilySnap.data()!.users
      : [];
    if (!updatedUsers.includes(currentUser.uid)) {
      await updateDoc(familyRef, { users: arrayUnion(currentUser.uid) });
    }
  };

  return {
    currentUserProfile,
    familyUserIds,
    userContextLoading,
    refreshGlobalUserContext,
    createUserProfile,
    getCurrentUserProfile,
    getFamilyUserIdsForCurrentUser,
    getFamilyForCurrentUser,
    getUsersByIds,
    inviteFamilyMember,
    removeFamilyMember,
  };
}
