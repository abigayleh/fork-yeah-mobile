import { beforeAll, describe, it } from 'vitest';
import { addDoc, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { clearEmulatorData, auth, db, expectDenied, signUp } from './helpers/emulator';
import { writeUserProfile } from '../lib/userContext';
import { fetchDocsForFamily, withCurrentUser } from '../lib/familyData';

// The mobile app reads and writes groceryLists and mealPlans straight through the
// client SDK, but production rules serve both admin-side only:
//   match /groceryLists/{id} { allow read, write: if false; }
// The web app goes through /api/myGroceryLists* and /api/mealPlans instead; mobile
// never got that migration. These tests pin the current, broken reality — when
// mobile moves onto the API routes they should be replaced, not just flipped.
describe('grocery lists and meal plans are denied to the client', () => {
  let uid: string;
  let familyIds: string[];

  beforeAll(async () => {
    await clearEmulatorData();
    uid = await signUp('shopper@t.com');
    await writeUserProfile(auth.currentUser!, 'Shopper');
    familyIds = withCurrentUser(uid, [uid]);
  });

  it('denies creating a grocery list', async () => {
    await expectDenied(addDoc(collection(db, 'groceryLists'), { name: 'Weekly', userId: uid, items: [] }));
  });

  it('denies reading grocery lists for the family', async () => {
    await expectDenied(fetchDocsForFamily('groceryLists', familyIds));
  });

  it('denies renaming and deleting a grocery list', async () => {
    await expectDenied(setDoc(doc(db, 'groceryLists', 'any'), { name: 'x' }, { merge: true }));
    await expectDenied(deleteDoc(doc(db, 'groceryLists', 'any')));
  });

  it('denies creating and reading meal plans', async () => {
    await expectDenied(addDoc(collection(db, 'mealPlans'), { userId: uid, date: '2026-01-01' }));
    await expectDenied(fetchDocsForFamily('mealPlans', familyIds));
  });
});
