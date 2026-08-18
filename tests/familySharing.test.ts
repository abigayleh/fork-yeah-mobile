import { beforeAll, describe, expect, it } from 'vitest';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { clearEmulatorData, auth, db, expectDenied, signIn, signUp } from './helpers/emulator';
import { readUsersByIds, resolveFamilyUserIds, writeUserProfile } from '../lib/userContext';
import { fetchDocsForFamily, withCurrentUser } from '../lib/familyData';

// Two members of one family see each other's recipes; an outsider sees nothing.
describe('family sharing', () => {
  let uidA: string, uidB: string, uidC: string;
  let familyId: string;

  beforeAll(async () => {
    await clearEmulatorData();

    uidA = await signUp('a@t.com');
    const profileA = await writeUserProfile(auth.currentUser!, 'A');
    familyId = String(profileA.familyId);
    await addDoc(collection(db, 'recipes'), { userId: uidA, name: 'A dish' });

    // B joins by writing their own profile against A's family; A, already a
    // member, adds them to the family doc.
    uidB = await signUp('b@t.com');
    await setDoc(doc(db, 'users', uidB), { userId: uidB, name: 'B', familyId });
    await addDoc(collection(db, 'recipes'), { userId: uidB, name: 'B dish' });

    await signIn('a@t.com');
    await setDoc(doc(db, 'families', familyId), { familyId, users: [uidA, uidB] }, { merge: true });

    uidC = await signUp('c@t.com');
    await writeUserProfile(auth.currentUser!, 'C');
  });

  it('resolves both members from either side', async () => {
    await signIn('a@t.com');
    expect((await resolveFamilyUserIds({ familyId }, uidA)).sort()).toEqual([uidA, uidB].sort());
    await signIn('b@t.com');
    expect((await resolveFamilyUserIds({ familyId }, uidB)).sort()).toEqual([uidA, uidB].sort());
  });

  it('shows each member the whole family\'s recipes', async () => {
    await signIn('b@t.com');
    const ids = withCurrentUser(uidB, [uidA, uidB]);
    const names = (await fetchDocsForFamily('recipes', ids)).map((r) => r.name).sort();
    expect(names).toEqual(['A dish', 'B dish']);
  });

  it('lets a member read the other member\'s user doc', async () => {
    await signIn('b@t.com');
    const users = await readUsersByIds([uidA, uidB]);
    expect(users.map((u) => (u as { name?: string }).name).sort()).toEqual(['A', 'B']);
  });

  it('hides the family from an outsider', async () => {
    await signIn('c@t.com');
    await expectDenied(getDoc(doc(db, 'families', familyId)));
    await expectDenied(getDoc(doc(db, 'users', uidA)));
    expect(await readUsersByIds([uidA])).toEqual([]);
  });

  it('gives an outsider none of the family recipes', async () => {
    await signIn('c@t.com');
    await expectDenied(fetchDocsForFamily('recipes', [uidA]));
    expect(await fetchDocsForFamily('recipes', [uidC])).toEqual([]);
  });
});
