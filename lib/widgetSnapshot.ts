import { addDays, startOfDay, toDateKey } from '../utils/dateKey';
import type { GroceryList } from './groceryApi';

// The widget renders from a file and can never re-fetch, so every list it can expand
// ships its own items. Caps match what the Large widget can physically show.
const MAX_LISTS = 3;
const MAX_ITEMS = 8;
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
const DAYS_AHEAD = 2;

export type GrocerySnapshotList = { id: string; name: string; count: number; items: string[] };
export type GrocerySnapshot = { lists: GrocerySnapshotList[] };

export type PlannedMeal = {
  recipeId: string;
  title: string;
  image: string;
  servings: number;
  isMyRecipe: boolean;
};
// imageFile, not a URL: WidgetKit can't fetch, so the widget only ever names a file
// the app has already cached into the shared container.
export type MealSnapshotMeal = {
  type: string;
  recipeId: string;
  title: string;
  servings: number;
  isMyRecipe: boolean;
  imageFile: string;
};
export type MealSnapshotDay = { date: string; meals: MealSnapshotMeal[] };
export type MealSnapshot = { days: MealSnapshotDay[] };
export type CachedImage = { file: string; url: string };

export function buildGrocerySnapshot(lists: GroceryList[]): GrocerySnapshot {
  return {
    lists: lists.slice(0, MAX_LISTS).map((list) => {
      const names = list.items.map((item) => item.name.trim()).filter(Boolean);
      return { id: list.id, name: list.name, count: names.length, items: names.slice(0, MAX_ITEMS) };
    }),
  };
}

// FNV-1a. The hash busts the cache when a recipe's image changes; the recipe id keeps
// two recipes apart even if their hashes ever collided.
const hash = (value: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

export const imageCacheName = (recipeId: string, url: string): string =>
  url ? `${recipeId.replace(/[^A-Za-z0-9_-]/g, '')}-${hash(url)}.img` : '';

// Keyed `${dateKey}:${type}` to match the planner's own lookup. Unplanned slots are
// omitted; the widget knows the three meal types and draws its own empty rows.
function inWindow(planned: Record<string, PlannedMeal>, from: Date) {
  const base = startOfDay(from);
  return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const date = toDateKey(addDays(base, offset));
    const meals = MEAL_TYPES.flatMap((type) => {
      const meal = planned[`${date}:${type}`];
      return meal ? [{ type, meal }] : [];
    });
    return { date, meals };
  });
}

export function buildMealSnapshot(planned: Record<string, PlannedMeal>, from: Date): MealSnapshot {
  return {
    days: inWindow(planned, from).map(({ date, meals }) => ({
      date,
      // Listed field by field: callers pass richer objects than the widget should see.
      meals: meals.map(({ type, meal }) => ({
        type,
        recipeId: meal.recipeId,
        title: meal.title,
        servings: meal.servings,
        isMyRecipe: Boolean(meal.isMyRecipe),
        imageFile: imageCacheName(meal.recipeId, meal.image),
      })),
    })),
  };
}

// What the app must have on disk for the snapshot above to render its thumbnails.
export function buildImageManifest(planned: Record<string, PlannedMeal>, from: Date): CachedImage[] {
  const seen = new Set<string>();
  return inWindow(planned, from)
    .flatMap(({ meals }) => meals.map(({ meal }) => meal))
    .flatMap((meal) => {
      const file = imageCacheName(meal.recipeId, meal.image);
      if (!file || seen.has(file)) return [];
      seen.add(file);
      return [{ file, url: meal.image }];
    });
}

// Never let a widget write break the screen that triggered it; the bridge is absent
// off iOS and in the node test runner.
async function publish(entries: Record<string, unknown>, images?: CachedImage[]): Promise<void> {
  try {
    const { default: bridge } = await import('../modules/widget-bridge');
    if (!bridge) return;
    for (const [name, payload] of Object.entries(entries)) {
      await bridge.write(name, JSON.stringify(payload));
    }
    if (images) await bridge.cacheImages(images);
    await bridge.reload();
  } catch {
    /* widget stays on its last good snapshot */
  }
}

export const writeGrocerySnapshot = (lists: GroceryList[]) =>
  publish({ groceries: buildGrocerySnapshot(lists) });

export const writeMealSnapshot = (planned: Record<string, PlannedMeal>, from: Date) =>
  publish({ meals: buildMealSnapshot(planned, from) }, buildImageManifest(planned, from));

// Signing out wipes the cached lists as well as flipping the flag — the home screen
// is visible to anyone holding the phone.
export const buildSessionEntries = (signedIn: boolean): Record<string, unknown> =>
  signedIn
    ? { session: { signedIn: true } }
    : { session: { signedIn: false }, groceries: { lists: [] }, meals: { days: [] } };

export const writeSessionSnapshot = (signedIn: boolean) => publish(buildSessionEntries(signedIn));
