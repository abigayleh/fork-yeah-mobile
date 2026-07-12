import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

// Fan out over every family member's UID and flatten the matching docs, so a
// member always sees all family data — not just their own. Mirrors the web app.
export const fetchDocsForFamily = async (
  collectionName: string,
  familyUserIds: string[]
): Promise<Record<string, unknown>[]> => {
  const ids = Array.isArray(familyUserIds) ? familyUserIds : [];
  const ref = collection(db, collectionName);
  const snaps = await Promise.all(
    ids.map((uid) => getDocs(query(ref, where('userId', '==', uid))))
  );
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
};

// Dedupe the current user's UID together with resolved family UIDs.
export const withCurrentUser = (currentUserId: string, familyUserIds: string[]): string[] =>
  Array.from(new Set([currentUserId, ...familyUserIds].map((id) => String(id || '').trim()).filter(Boolean)));
