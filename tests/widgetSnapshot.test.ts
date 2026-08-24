import { describe, expect, it } from 'vitest';
import {
  buildGrocerySnapshot, buildImageManifest, buildMealSnapshot, buildSessionEntries,
  imageCacheName, type PlannedMeal,
} from '../lib/widgetSnapshot';

const list = (id: string, name: string, names: string[]) => ({
  id, name, items: names.map((n) => ({ name: n, checked: false })),
});

const meal = (title: string, image = '', recipeId = 'r1'): PlannedMeal =>
  ({ recipeId, title, image, servings: 2, isMyRecipe: false });

describe('buildGrocerySnapshot', () => {
  it('keeps only the three lists the Large widget can show', () => {
    const snapshot = buildGrocerySnapshot(
      ['a', 'b', 'c', 'd'].map((id) => list(id, id, ['milk'])),
    );
    expect(snapshot.lists.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('caps items at eight but counts the whole list', () => {
    const names = Array.from({ length: 12 }, (_, i) => `item ${i}`);
    const [only] = buildGrocerySnapshot([list('a', 'Weekly', names)]).lists;
    expect(only.items).toHaveLength(8);
    expect(only.count).toBe(12);
  });

  it('drops blank rows the way the list card does', () => {
    const [only] = buildGrocerySnapshot([list('a', 'Weekly', ['  ', 'limes', ''])]).lists;
    expect(only.items).toEqual(['limes']);
    expect(only.count).toBe(1);
  });
});

describe('buildMealSnapshot', () => {
  const from = new Date(2026, 7, 24, 18, 30);
  const todayKey = '2026-08-24';
  const tomorrowKey = '2026-08-25';

  it('covers today and tomorrow only', () => {
    const snapshot = buildMealSnapshot({}, from);
    expect(snapshot.days.map((d) => d.date)).toEqual([todayKey, tomorrowKey]);
  });

  it('resolves planned slots and omits empty ones', () => {
    const snapshot = buildMealSnapshot({
      [`${todayKey}:breakfast`]: meal('Overnight Oats'),
      [`${todayKey}:dinner`]: meal('Roast Chicken'),
      [`${tomorrowKey}:dinner`]: meal('Miso Salmon'),
    }, from);

    expect(snapshot.days[0].meals.map((m) => [m.type, m.title])).toEqual([
      ['breakfast', 'Overnight Oats'],
      ['dinner', 'Roast Chicken'],
    ]);
    expect(snapshot.days[1].meals).toHaveLength(1);
  });

  it('emits only the fields the widget reads, dropping caller extras', () => {
    const planner = { ...meal('Roast Chicken'), id: 'plan-doc-1', extra: 'ignored' };
    const [only] = buildMealSnapshot({ [`${todayKey}:dinner`]: planner }, from).days[0].meals;
    expect(Object.keys(only).sort()).toEqual(
      ['imageFile', 'isMyRecipe', 'recipeId', 'servings', 'title', 'type'],
    );
  });

  it('ignores meals planned for other days', () => {
    const other = '2026-08-29';
    const snapshot = buildMealSnapshot({ [`${other}:lunch`]: meal('Later') }, from);
    expect(snapshot.days.every((d) => d.meals.length === 0)).toBe(true);
  });

  it('is unaffected by the time of day it runs', () => {
    const morning = buildMealSnapshot({}, new Date(2026, 7, 24, 0, 5));
    const night = buildMealSnapshot({}, new Date(2026, 7, 24, 23, 55));
    expect(morning.days.map((d) => d.date)).toEqual(night.days.map((d) => d.date));
  });
});

describe('buildSessionEntries', () => {
  it('only flips the flag when signing in', () => {
    expect(buildSessionEntries(true)).toEqual({ session: { signedIn: true } });
  });

  it('wipes cached lists on sign-out, since the home screen is visible to anyone', () => {
    expect(buildSessionEntries(false)).toEqual({
      session: { signedIn: false },
      groceries: { lists: [] },
      meals: { days: [] },
    });
  });
});

describe('image cache naming', () => {
  const url = 'https://img.spoonacular.com/recipes/12345-312x231.jpg';

  it('is stable for the same recipe and image', () => {
    expect(imageCacheName('r1', url)).toBe(imageCacheName('r1', url));
  });

  it('changes when the image changes, so a stale thumbnail cannot survive', () => {
    expect(imageCacheName('r1', url)).not.toBe(imageCacheName('r1', `${url}?v=2`));
  });

  it('keeps two recipes apart', () => {
    expect(imageCacheName('r1', url)).not.toBe(imageCacheName('r2', url));
  });

  it('is empty when there is no image, and filename-safe otherwise', () => {
    expect(imageCacheName('r1', '')).toBe('');
    expect(imageCacheName('../../etc/passwd', url)).toMatch(/^[A-Za-z0-9_-]+\.img$/);
  });
});

describe('buildImageManifest', () => {
  const from = new Date(2026, 7, 24, 18, 30);
  const url = 'https://img.spoonacular.com/recipes/1-312x231.jpg';

  it('pairs each cache filename with the url to fetch it from', () => {
    const [only] = buildImageManifest({ '2026-08-24:dinner': meal('Roast', url) }, from);
    expect(only).toEqual({ file: imageCacheName('r1', url), url });
  });

  it('skips meals with no image', () => {
    expect(buildImageManifest({ '2026-08-24:lunch': meal('Leftovers') }, from)).toEqual([]);
  });

  it('deduplicates a recipe planned twice', () => {
    const manifest = buildImageManifest({
      '2026-08-24:lunch': meal('Roast', url),
      '2026-08-25:dinner': meal('Roast', url),
    }, from);
    expect(manifest).toHaveLength(1);
  });

  it('covers the same two-day window as the snapshot', () => {
    const manifest = buildImageManifest({ '2026-08-29:dinner': meal('Later', url) }, from);
    expect(manifest).toEqual([]);
  });
});
