import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'browseFilters';

export type BrowseFilters = {
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
  sugar: [number, number];
  cookingTime: [number, number];
  price: [number, number];
  ingredients: string[];
  cuisines: string[];
  diets: string[];
  blacklists: string[];
  mealTypes: string[];
  query: string;
};

export async function loadBrowseFilters(): Promise<Partial<BrowseFilters> | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<BrowseFilters>) : null;
  } catch {
    return null;
  }
}

export async function saveBrowseFilters(filters: BrowseFilters): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Persisting filters is best-effort; ignore write failures.
  }
}
