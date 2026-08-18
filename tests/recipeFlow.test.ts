import { beforeAll, describe, expect, it } from 'vitest';
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { clearEmulatorData, auth, db, signUp } from './helpers/emulator';
import { writeUserProfile } from '../lib/userContext';
import { fetchDocsForFamily, withCurrentUser } from '../lib/familyData';

// Save a recipe -> favorite it -> file it in a folder, asserting every read the
// app performs is one production rules actually permit.
describe('recipe, favorite and folder flow', () => {
  let uid: string;
  let familyIds: string[];
  let recipeId: string;

  beforeAll(async () => {
    await clearEmulatorData();
    uid = await signUp('cook@t.com');
    const profile = await writeUserProfile(auth.currentUser!, 'Cook');
    familyIds = withCurrentUser(uid, [uid]);
    expect(profile.familyId).toBeTruthy();
  });

  it('saves a recipe the owner can read back', async () => {
    const ref = await addDoc(collection(db, 'recipes'), {
      userId: uid, name: 'Roast Chicken', ingredients: ['chicken'], steps: ['roast it'],
    });
    recipeId = ref.id;
    const recipes = await fetchDocsForFamily('recipes', familyIds);
    expect(recipes.map((r) => r.name)).toContain('Roast Chicken');
  });

  it('favorites the recipe', async () => {
    // Mirrors useRecipeApi.addRecipeToUser's composite doc id.
    const docId = `${uid}_my_${recipeId}`;
    await setDoc(doc(db, 'userRecipes', docId), {
      userId: uid, recipeId, favorite: true, wantToTry: false, rating: null, notes: '', isMyRecipe: true,
    });
    expect((await getDoc(doc(db, 'userRecipes', docId))).data()?.favorite).toBe(true);

    const saved = await fetchDocsForFamily('userRecipes', familyIds);
    expect(saved.filter((r) => r.favorite)).toHaveLength(1);
  });

  it('creates a folder and a subfolder', async () => {
    const parent = await addDoc(collection(db, 'folders'), {
      name: 'Dinners', recipes: [], userId: uid, order: 0,
    });
    await addDoc(collection(db, 'folders'), {
      name: 'Weeknight', recipes: [], userId: uid, order: 1, parentId: parent.id,
    });

    const folders = await fetchDocsForFamily('folders', familyIds);
    expect(folders.map((f) => f.name).sort()).toEqual(['Dinners', 'Weeknight']);
    expect(folders.find((f) => f.name === 'Weeknight')?.parentId).toBe(parent.id);
  });

  it('files the recipe into the folder', async () => {
    const folders = await fetchDocsForFamily('folders', familyIds);
    const dinners = folders.find((f) => f.name === 'Dinners')!;
    const recipeRef = { recipeId, isMyRecipe: true };
    await setDoc(doc(db, 'folders', String(dinners.id)), { recipes: [recipeRef], userId: uid }, { merge: true });

    const updated = await getDoc(doc(db, 'folders', String(dinners.id)));
    expect(updated.data()?.recipes).toEqual([recipeRef]);
  });
});
