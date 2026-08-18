import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? '';

export type SavedRecipe = { id: string; title: string; image: string; isMyRecipe: boolean; ingredientNames: string[] };
export type SavedRecipeSection = 'myRecipes' | 'favorites' | 'wantToTry';
export type FolderItem = {
  id?: string;
  name: string;
  order?: number;
  parentId?: string;
  recipes?: { recipeId: string; isMyRecipe: boolean }[];
};

const matchesQuery = (r: SavedRecipe, q: string) =>
  r.title.toLowerCase().includes(q) || r.ingredientNames.some((n) => n.toLowerCase().includes(q));

async function fetchSpoonInfo(ids: string[]): Promise<Map<string, { title: string; image: string; ingredientNames: string[] }>> {
  const map = new Map<string, { title: string; image: string; ingredientNames: string[] }>();
  if (!ids.length || !API_KEY) return map;
  try {
    const res = await fetch(`https://api.spoonacular.com/recipes/informationBulk?ids=${ids.join(',')}&apiKey=${API_KEY}`);
    const data = await res.json();
    (Array.isArray(data) ? data : []).forEach((r: { id: number; title: string; image: string; extendedIngredients?: { name: string }[] }) => {
      map.set(String(r.id), {
        title: r.title,
        image: r.image,
        ingredientNames: (r.extendedIngredients ?? []).map((ing) => ing.name).filter(Boolean),
      });
    });
  } catch { /* ignore */ }
  return map;
}

export function useSavedRecipesBrowser() {
  const { getMyRecipes, getUserRecipes, getUserFolders, addRecipeToUser } = useAuth();

  const [section, setSectionState] = useState<SavedRecipeSection>('myRecipes');
  const [search, setSearch] = useState('');
  const [myRecipes, setMyRecipes] = useState<SavedRecipe[]>([]);
  const [favorites, setFavorites] = useState<SavedRecipe[]>([]);
  const [wantToTry, setWantToTry] = useState<SavedRecipe[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderRecipes, setFolderRecipes] = useState<SavedRecipe[]>([]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const clearFolder = () => { setActiveFolderId(null); setFolderRecipes([]); };

  const setSection = (next: SavedRecipeSection) => {
    setSectionState(next);
    clearFolder();
  };

  const reload = async () => {
    setLoading(true);
    try {
      const [rawMine, rawUserRecipes, rawFolders] = await Promise.all([
        getMyRecipes(), getUserRecipes(), getUserFolders(),
      ]);

      const myList = (rawMine ?? []) as Record<string, unknown>[];
      const userList = (rawUserRecipes ?? []) as Record<string, unknown>[];

      const mapped: SavedRecipe[] = myList
        .map((r) => ({
          id: String(r.recipeId ?? r.id ?? ''),
          title: String(r.name ?? ''),
          image: String(r.imageUrl ?? ''),
          isMyRecipe: true,
          ingredientNames: (Array.isArray(r.ingredients) ? r.ingredients as { name?: string }[] : [])
            .map((ing) => String(ing.name ?? '')).filter(Boolean),
        }))
        .filter((r) => r.id && r.title);
      setMyRecipes(mapped);

      const myMap = new Map(mapped.map((r) => [r.id, r]));
      const favRefs = userList.filter((r) => r.favorite) as { recipeId: string; isMyRecipe?: boolean }[];
      const wttRefs = userList.filter((r) => r.wantToTry) as { recipeId: string; isMyRecipe?: boolean }[];

      const spoonIds = Array.from(new Set([
        ...favRefs.filter((r) => !r.isMyRecipe).map((r) => r.recipeId),
        ...wttRefs.filter((r) => !r.isMyRecipe).map((r) => r.recipeId),
      ].filter(Boolean)));

      const spoonMap = await fetchSpoonInfo(spoonIds);

      const resolve = (ref: { recipeId: string; isMyRecipe?: boolean }): SavedRecipe | null => {
        if (ref.isMyRecipe) return myMap.get(ref.recipeId) ?? null;
        const s = spoonMap.get(ref.recipeId);
        return s ? { id: ref.recipeId, title: s.title, image: s.image, isMyRecipe: false, ingredientNames: s.ingredientNames } : null;
      };

      setFavorites(favRefs.map(resolve).filter(Boolean) as SavedRecipe[]);
      setWantToTry(wttRefs.map(resolve).filter(Boolean) as SavedRecipe[]);
      setFolders(((rawFolders ?? []) as FolderItem[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const favoritedIds = useMemo(() => new Set(favorites.map((r) => r.id)), [favorites]);
  const wantToTryIds = useMemo(() => new Set(wantToTry.map((r) => r.id)), [wantToTry]);

  const sectionRecipes = section === 'myRecipes' ? myRecipes : section === 'favorites' ? favorites : wantToTry;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch ? sectionRecipes.filter((r) => matchesQuery(r, normalizedSearch)) : sectionRecipes;

  const selectFolder = async (folder: FolderItem) => {
    if (activeFolderId === folder.id) {
      clearFolder();
      return;
    }
    setActiveFolderId(folder.id ?? null);
    setLoadingFolder(true);
    const myMap = new Map(myRecipes.map((r) => [r.id, r]));
    const refs = folder.recipes ?? [];
    const resolved: SavedRecipe[] = [];
    const spoonIds: string[] = [];
    refs.forEach((ref) => {
      if (ref.isMyRecipe) { const r = myMap.get(ref.recipeId); if (r) resolved.push(r); }
      else spoonIds.push(ref.recipeId);
    });
    const spoonMap = await fetchSpoonInfo(spoonIds);
    spoonMap.forEach((info, id) => resolved.push({ id, title: info.title, image: info.image, isMyRecipe: false, ingredientNames: info.ingredientNames }));
    setFolderRecipes(resolved);
    setLoadingFolder(false);
  };

  const displayRecipes = activeFolderId
    ? (normalizedSearch ? folderRecipes.filter((r) => matchesQuery(r, normalizedSearch)) : folderRecipes)
    : filtered;

  const selectedFolder = folders.find((f) => f.id === activeFolderId);

  const toggleFavorite = async (recipe: SavedRecipe) => {
    setFavorites((prev) => favoritedIds.has(recipe.id) ? prev.filter((r) => r.id !== recipe.id) : [...prev, recipe]);
    await addRecipeToUser(recipe.id, 'favorite', null, { isMyRecipe: recipe.isMyRecipe });
  };

  const toggleWantToTry = async (recipe: SavedRecipe) => {
    setWantToTry((prev) => wantToTryIds.has(recipe.id) ? prev.filter((r) => r.id !== recipe.id) : [...prev, recipe]);
    await addRecipeToUser(recipe.id, 'wantToTry', null, { isMyRecipe: recipe.isMyRecipe });
  };

  return {
    section, setSection, search, setSearch,
    myRecipes, favorites, wantToTry, favoritedIds, wantToTryIds,
    folders, setFolders, activeFolderId, selectFolder, clearFolder, folderRecipes, selectedFolder,
    loading, loadingFolder, displayRecipes,
    toggleFavorite, toggleWantToTry, reload,
  };
}
