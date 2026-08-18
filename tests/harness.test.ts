import { beforeAll, describe, expect, it } from 'vitest';
import { doc, getDoc, getDocs, collection, query, setDoc, where } from 'firebase/firestore';
import { clearEmulatorData, db, expectDenied, signIn, signUp } from './helpers/emulator';

// Proves the harness is actually enforcing the production rules. If these ever
// pass trivially, the suite has been pointed at allow-all rules and every other
// test in the repo is worthless.
describe('harness runs against production rules', () => {
  let uid: string;
  const familyId = 'fam-harness';

  beforeAll(async () => {
    await clearEmulatorData();
    uid = await signUp('harness@t.com');
    await signIn('harness@t.com');
    await setDoc(doc(db, 'users', uid), { userId: uid, familyId });
    await setDoc(doc(db, 'families', familyId), { familyId, users: [uid] });
  });

  it('allows reading your own family doc by id', async () => {
    expect((await getDoc(doc(db, 'families', familyId))).exists()).toBe(true);
  });

  it('denies a collection query on families — the bug that broke login', async () => {
    await expectDenied(
      getDocs(query(collection(db, 'families'), where('familyId', '==', familyId)))
    );
  });

  it("denies reading another user's doc outside your family", async () => {
    await expectDenied(getDoc(doc(db, 'users', 'someone-else')));
  });
});
