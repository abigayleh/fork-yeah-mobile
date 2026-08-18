import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://whats-for-dinnner.netlify.app';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Legacy families docs whose id isn't the familyId. The security rules deny any
// list on `families`, so a denial here means "no legacy doc", not a real error.
const readLegacyFamilyByField = async (familyId: string) => {
  try {
    const snap = await getDocs(query(collection(db, 'families'), where('familyId', '==', familyId)));
    return snap.empty ? null : { id: snap.docs[0].id, data: snap.docs[0].data() };
  } catch {
    return null;
  }
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
    // Families are keyed by familyId as the doc id — read it directly. A
    // collection scan is denied outright by the rules (they can't evaluate
    // membership on a list), so it's only a best-effort legacy fallback.
    const familySnap = await getDoc(doc(db, 'families', familyId));
    let familyData: Record<string, unknown> | null = familySnap.exists() ? familySnap.data() : null;
    if (!familyData) {
      familyData = (await readLegacyFamilyByField(familyId))?.data ?? null;
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

  const getFamilyForCurrentUser = async (): Promise<Record<string, unknown> | null> => {
    const profile = await getCurrentUserProfile();
    const familyId = profile?.familyId;
    if (!familyId) return null;
    const familyRef = doc(db, 'families', familyId);
    const familySnap = await getDoc(familyRef);
    if (familySnap.exists()) return { id: familySnap.id, ...familySnap.data() };
    const legacy = await readLegacyFamilyByField(familyId);
    return legacy ? { id: legacy.id, ...legacy.data } : null;
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
    // Invitations expire 7 days after creation.
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invitationRef = doc(collection(db, 'invitations'));
    await setDoc(invitationRef, {
      email: normalizedEmail,
      familyId,
      invitationToken,
      name: inviterName,
      createdAt,
      expiresAt,
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

  // All invitations for the current user's family (used to show pending invites).
  const getFamilyInvitations = async () => {
    const profile = await getCurrentUserProfile();
    if (!profile?.familyId) return [];
    const invitationsRef = collection(db, 'invitations');
    const snap = await getDocs(query(invitationsRef, where('familyId', '==', profile.familyId)));
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  };

  // Mark an invitation as accepted after the invited user joins the family.
  const markInvitationAccepted = async (invitationId: string) => {
    const id = String(invitationId || '').trim();
    if (!id) return;
    await setDoc(doc(db, 'invitations', id), { status: 'accepted', acceptedAt: new Date() }, { merge: true });
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

  // Permanently delete everything the user owns, for account deletion. Removes the
  // user from their family (deleting an emptied family and its invitations), then
  // deletes every document keyed to their UID and finally their profile doc.
  const deleteAllUserData = async (uid: string) => {
    const id = String(uid || '').trim();
    if (!id) throw new Error('Missing user id.');

    const profileSnap = await getDoc(doc(db, 'users', id));
    const familyId = profileSnap.exists() ? String(profileSnap.data().familyId || '').trim() : '';
    if (familyId) {
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      if (familySnap.exists()) {
        const members: string[] = Array.isArray(familySnap.data().users) ? familySnap.data().users : [];
        if (members.filter((u) => u !== id).length === 0) {
          const invSnap = await getDocs(query(collection(db, 'invitations'), where('familyId', '==', familyId)));
          await Promise.all(invSnap.docs.map((d) => deleteDoc(d.ref)));
          await deleteDoc(familyRef);
        } else {
          await updateDoc(familyRef, { users: arrayRemove(id) });
        }
      }
    }

    const owned = ['userRecipes', 'recipes', 'mealPlans', 'groceryLists', 'folders'];
    for (const name of owned) {
      const snap = await getDocs(query(collection(db, name), where('userId', '==', id)));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }

    await deleteDoc(doc(db, 'users', id));
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
    getFamilyInvitations,
    markInvitationAccepted,
    removeFamilyMember,
    deleteAllUserData,
  };
}
