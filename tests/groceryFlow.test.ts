import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDoc, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { clearEmulatorData, auth, db, expectDenied, signUp } from './helpers/emulator';
import { writeUserProfile } from '../lib/userContext';
import { fetchDocsForFamily, withCurrentUser } from '../lib/familyData';
import {
  createGroceryList, deleteGroceryList, fetchGroceryLists, renameGroceryList, saveGroceryItems,
} from '../lib/groceryApi';
import { createMealPlan, deleteMealPlan, fetchMealPlans } from '../lib/mealPlanApi';

// groceryLists and mealPlans are admin-only in the production rules; the app
// reaches them through the web app's authenticated API routes instead.
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

const stubFetch = (body: unknown = {}) => {
  const spy = vi.fn(async () => okJson(body));
  vi.stubGlobal('fetch', spy);
  return spy;
};

const lastCall = (spy: ReturnType<typeof stubFetch>) => {
  const [url, options] = spy.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, options, body: options?.body ? JSON.parse(String(options.body)) : undefined };
};

describe('grocery list API client', () => {
  let uid: string;

  beforeAll(async () => {
    await clearEmulatorData();
    uid = await signUp('shopper@t.com');
    await writeUserProfile(auth.currentUser!, 'Shopper');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends the signed-in user token and no family ids', async () => {
    const spy = stubFetch({ groceryLists: [{ id: 'a', name: 'Weekly', items: [] }] });
    const lists = await fetchGroceryLists();

    const { url, options } = lastCall(spy);
    expect(url).toContain('/api/myGroceryLists');
    expect(url).not.toContain('userIds');
    expect((options.headers as Record<string, string>).Authorization).toMatch(/^Bearer .+/);
    expect(lists).toEqual([{ id: 'a', name: 'Weekly', items: [] }]);
  });

  it('creates a list sending item names as strings, not objects', async () => {
    const spy = stubFetch({ id: 'new', name: 'Party', items: [{ name: 'Ice', checked: false }] });
    await createGroceryList('Party', ['Ice', 'Limes']);

    const { url, options, body } = lastCall(spy);
    expect(url).toContain('/api/myGroceryLists');
    expect(options.method).toBe('POST');
    // Sending objects here would store "[object Object]" as each item name.
    expect(body).toEqual({ name: 'Party', items: ['Ice', 'Limes'] });
  });

  it('renames without touching items, and saves items without touching the name', async () => {
    const renameSpy = stubFetch({ success: true, name: 'Renamed' });
    await renameGroceryList('list-1', 'Renamed');
    expect(lastCall(renameSpy).options.method).toBe('PATCH');
    expect(lastCall(renameSpy).body).toEqual({ name: 'Renamed' });
    vi.unstubAllGlobals();

    const itemsSpy = stubFetch({ success: true, items: [{ name: 'Milk', checked: false }] });
    const saved = await saveGroceryItems('list-1', [{ name: 'Milk', checked: false }]);
    expect(lastCall(itemsSpy).body).toEqual({ items: [{ name: 'Milk', checked: false }] });
    expect(saved).toEqual([{ name: 'Milk', checked: false }]);
  });

  it('escapes the id in the path and deletes', async () => {
    const spy = stubFetch({ success: true });
    await deleteGroceryList('a/b');
    expect(lastCall(spy).url).toContain('/api/myGroceryLists/a%2Fb');
    expect(lastCall(spy).options.method).toBe('DELETE');
  });

  it('throws when the route rejects the request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as Response));
    await expect(fetchGroceryLists()).rejects.toThrow(/403/);
  });
});

describe('meal plan API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads plans from the route payload', async () => {
    const spy = stubFetch({ plans: [{ id: 'm1', date: '2026-01-01' }] });
    expect(await fetchMealPlans()).toEqual([{ id: 'm1', date: '2026-01-01' }]);
    expect(lastCall(spy).url).toContain('/api/mealPlans');
  });

  it('posts only the fields the route stores', async () => {
    const spy = stubFetch({ id: 'm2' });
    await createMealPlan({ recipeId: 'r1', isMyRecipe: true, servings: 4, date: '2026-01-02', type: 'dinner' });

    expect(lastCall(spy).options.method).toBe('POST');
    expect(lastCall(spy).body).toEqual({
      recipeId: 'r1', isMyRecipe: true, servings: 4, date: '2026-01-02', type: 'dinner',
    });
  });

  it('deletes by query parameter', async () => {
    const spy = stubFetch({ success: true });
    await deleteMealPlan('m3');
    expect(lastCall(spy).url).toContain('/api/mealPlans?id=m3');
    expect(lastCall(spy).options.method).toBe('DELETE');
  });
});

// The API routes are the only way in; this pins that the direct client path
// stays shut, so a future screen can't quietly reintroduce it.
describe('direct client access to these collections stays denied', () => {
  let uid: string;
  let familyIds: string[];

  beforeAll(async () => {
    uid = auth.currentUser?.uid ?? (await signUp('shopper2@t.com'));
    familyIds = withCurrentUser(uid, [uid]);
  });

  it('denies grocery list reads and writes', async () => {
    await expectDenied(addDoc(collection(db, 'groceryLists'), { name: 'Weekly', userId: uid, items: [] }));
    await expectDenied(fetchDocsForFamily('groceryLists', familyIds));
    await expectDenied(setDoc(doc(db, 'groceryLists', 'any'), { name: 'x' }, { merge: true }));
    await expectDenied(deleteDoc(doc(db, 'groceryLists', 'any')));
  });

  it('denies meal plan reads and writes', async () => {
    await expectDenied(addDoc(collection(db, 'mealPlans'), { userId: uid, date: '2026-01-01' }));
    await expectDenied(fetchDocsForFamily('mealPlans', familyIds));
  });
});
