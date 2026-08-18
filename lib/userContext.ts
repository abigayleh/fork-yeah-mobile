import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://whats-for-dinnner.netlify.app';

export type Profile = Record<string, unknown> & { id?: string; familyId?: string; name?: string };

export const generateUUID = (): string => {
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

export const readUserProfile = async (uid: string): Promise<Profile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Families are keyed by familyId as the doc id — read it directly. A collection
// scan is denied outright by the rules, so it's only a best-effort legacy fallback.
type FamilyDoc = Record<string, unknown> & { id: string };

export const readFamilyById = async (familyId: string): Promise<FamilyDoc | null> => {
  const id = String(familyId || '').trim();
  if (!id) return null;
  const snap = await getDoc(doc(db, 'families', id));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const legacy = await readLegacyFamilyByField(id);
  return legacy ? { id: legacy.id, ...legacy.data } : null;
};

export const resolveFamilyUserIds = async (profile: Profile | null, currentUserId: string) => {
  const normalizedId = String(currentUserId || '').trim();
  const fallback = normalizedId ? [normalizedId] : [];
  if (!profile?.familyId) return fallback;

  const family = await readFamilyById(String(profile.familyId));
  const ids = Array.isArray(family?.users) ? (family.users as string[]) : [];
  return ids.length === 0 ? fallback : Array.from(new Set(ids));
};

export const readUsersByIds = async (userIds: string[] = []) => {
  if (userIds.length === 0) return [];
  const users = await Promise.all(
    userIds.map(async (id) => {
      try {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (userSnap.exists()) return { ...userSnap.data(), id: userSnap.id };
        const snap = await getDocs(query(collection(db, 'users'), where('userId', '==', id)));
        return snap.empty ? null : { ...snap.docs[0].data(), id: snap.docs[0].id };
      } catch (error) {
        console.error('Error resolving user by id:', id, error);
        return null;
      }
    })
  );
  return users.filter(Boolean);
};

// Writes the user's own profile plus the family they belong to. A user without a
// familyId gets a fresh single-member family.
export const writeUserProfile = async (currentUser: User, name: string) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) throw new Error('Name is required');

  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  const existingData = userSnap.exists() ? userSnap.data() : {};
  const normalizedEmail = String(currentUser.email || '').trim().toLowerCase();
  const familyId = typeof existingData.familyId === 'string' && existingData.familyId.trim()
    ? existingData.familyId
    : generateUUID();

  const profile = {
    userId: currentUser.uid,
    name: trimmedName,
    email: normalizedEmail,
    signupEmail: normalizedEmail,
    permission: 'ADMIN',
    familyId,
  };
  await setDoc(userRef, profile, { merge: true });

  const familyRef = doc(db, 'families', familyId);
  const familySnap = await getDoc(familyRef);
  const existingFamily = familySnap.exists() ? familySnap.data() : {};
  const existingUsers = Array.isArray(existingFamily.users) ? existingFamily.users as string[] : [];
  await setDoc(familyRef, {
    familyId,
    users: [...existingUsers.filter((uid) => uid !== currentUser.uid), currentUser.uid],
  }, { merge: true });

  return profile;
};

export const createInvitation = async (profile: Profile, email: string) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');
  if (!profile?.familyId) throw new Error('You need a family before inviting members.');

  const familyId = String(profile.familyId);
  const invitationToken = generateUUID();
  const inviterName = (profile.name as string) || 'A family member';
  // Invitations expire 7 days after creation.
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  await setDoc(doc(collection(db, 'invitations')), {
    email: normalizedEmail,
    familyId,
    invitationToken,
    name: inviterName,
    createdAt,
    expiresAt,
    status: 'pending',
  });

  return { invitedEmail: normalizedEmail, familyId, invitationToken, inviterName };
};

export const sendInvitationEmail = async (
  email: string, inviterName: string, invitationToken: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/emails/sendFamilyInvitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, inviterName, invitationToken }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to send invitation email');
    }
  } catch (emailError) {
    console.error('Error sending invitation email:', emailError);
    throw new Error('Invitation created but email could not be sent. Please share the link manually.');
  }
};

export const readFamilyInvitations = async (familyId: string) => {
  const id = String(familyId || '').trim();
  if (!id) return [];
  const snap = await getDocs(query(collection(db, 'invitations'), where('familyId', '==', id)));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const markInvitationAccepted = async (invitationId: string) => {
  const id = String(invitationId || '').trim();
  if (!id) return;
  await setDoc(doc(db, 'invitations', id), { status: 'accepted', acceptedAt: new Date() }, { merge: true });
};

export const removeFamilyMember = async (
  currentUserId: string, familyId: string, memberUserId: string
) => {
  const normalizedMemberId = String(memberUserId || '').trim();
  if (!normalizedMemberId) throw new Error('Invalid member.');
  if (normalizedMemberId === currentUserId) throw new Error('You cannot remove yourself.');

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
  if (!updatedUsers.includes(currentUserId)) {
    await updateDoc(familyRef, { users: arrayUnion(currentUserId) });
  }
};

// Permanently delete everything the user owns, for account deletion. Removes the
// user from their family (deleting an emptied family and its invitations), then
// deletes every document keyed to their UID and finally their profile doc.
export const deleteAllUserData = async (uid: string) => {
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
