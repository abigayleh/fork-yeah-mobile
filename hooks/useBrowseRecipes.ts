import { useCallback, useEffect, useRef, useState } from 'react';

const API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? '';
const CACHE_TTL = 5 * 60 * 1000;
const MIN_API_INTERVAL = 2000;

type BrowseRecipe = { id: number | string; title: string; image: string };
type Cache = { recipes: BrowseRecipe[]; cachedAt: number };

let defaultCache: Cache | null = null;
let inFlightRequest: Promise<{ recipes?: BrowseRecipe[] }> | null = null;

const hasValidImage = (image: unknown): image is string =>
  typeof image === 'string' && image.trim().length > 0;

export function useBrowseRecipes() {
  const [recipeList, setRecipeList] = useState<BrowseRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');

  const [protein, setProtein] = useState<[number, number]>([0, 150]);
  const [carbs, setCarbs] = useState<[number, number]>([0, 200]);
  const [fat, setFat] = useState<[number, number]>([0, 80]);
  const [sugar, setSugar] = useState<[number, number]>([0, 50]);
  const [cookingTime, setCookingTime] = useState<[number, number]>([0, 180]);
  const [price, setPrice] = useState<[number, number]>([0, 100]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [blacklists, setBlacklists] = useState<string[]>([]);
  const [mealTypes, setMealTypes] = useState<string[]>([]);

  const recipeCountRef = useRef(0);
  const lastApiRequestAtRef = useRef(0);

  const throttle = useCallback(async () => {
    const elapsed = Date.now() - lastApiRequestAtRef.current;
    if (elapsed < MIN_API_INTERVAL) {
      await new Promise((res) => setTimeout(res, MIN_API_INTERVAL - elapsed));
    }
    lastApiRequestAtRef.current = Date.now();
  }, []);

  const filterIsEmpty =
    protein[0] === 0 && protein[1] === 150 &&
    carbs[0] === 0 && carbs[1] === 200 &&
    fat[0] === 0 && fat[1] === 80 &&
    sugar[0] === 0 && sugar[1] === 50 &&
    cookingTime[0] === 0 && cookingTime[1] === 180 &&
    price[0] === 0 && price[1] === 100 &&
    ingredients.length === 0 && cuisines.length === 0 &&
    diets.length === 0 && blacklists.length === 0 &&
    mealTypes.length === 0 && appliedSearchQuery.trim().length === 0;

  const fetchRecipes = useCallback(async (forceRefresh = false, append = false) => {
    const hasExisting = recipeCountRef.current > 0;
    const background = append || (forceRefresh && hasExisting);

    try {
      if (background) setIsFetchingMore(true);
      else setLoading(true);

      if (filterIsEmpty) {
        if (!append && !forceRefresh && defaultCache) {
          const fresh = Date.now() - defaultCache.cachedAt < CACHE_TTL;
          if (fresh && defaultCache.recipes.length > 0) {
            setRecipeList(defaultCache.recipes);
            recipeCountRef.current = defaultCache.recipes.length;
            setLoading(false);
            return;
          }
        }

        if (!append && !forceRefresh && !inFlightRequest) {
          inFlightRequest = throttle()
            .then(() => fetch(`https://api.spoonacular.com/recipes/random?number=20&apiKey=${API_KEY}`))
            .then((r) => r.json())
            .finally(() => { inFlightRequest = null; });
        }

        const data = append || forceRefresh
          ? await throttle().then(() =>
              fetch(`https://api.spoonacular.com/recipes/random?number=20&apiKey=${API_KEY}`).then((r) => r.json())
            )
          : await inFlightRequest;

        const next = Array.isArray(data?.recipes)
          ? (data.recipes as BrowseRecipe[]).filter((r) => hasValidImage(r?.image))
          : [];

        setRecipeList((prev) => {
          const updated = append ? [...prev, ...next] : next;
          recipeCountRef.current = updated.length;
          return updated;
        });

        if (!append) defaultCache = { recipes: next, cachedAt: Date.now() };
        setHasMore(true);
      } else {
        const offset = append ? recipeCountRef.current : 0;
        await throttle();
        const url = [
          `https://api.spoonacular.com/recipes/complexSearch?number=20&apiKey=${API_KEY}`,
          `&offset=${offset}`,
          appliedSearchQuery ? `&query=${encodeURIComponent(appliedSearchQuery)}` : '',
          `&minProtein=${protein[0]}&maxProtein=${protein[1]}`,
          `&minCarbs=${carbs[0]}&maxCarbs=${carbs[1]}`,
          `&minFat=${fat[0]}&maxFat=${fat[1]}`,
          `&minSugar=${sugar[0]}&maxSugar=${sugar[1]}`,
          `&maxCookingTime=${cookingTime[1]}`,
          `&maxPrice=${price[1]}`,
          ingredients.length ? `&includeIngredients=${ingredients.join(',')}` : '',
          cuisines.length ? `&cuisine=${cuisines.join(',')}` : '',
          diets.length ? `&diet=${diets.join(',')}` : '',
          blacklists.length ? `&excludeIngredients=${blacklists.join(',')}` : '',
          mealTypes.length ? `&type=${mealTypes.join(',')}` : '',
        ].join('');

        const data = await fetch(url).then((r) => r.json());
        const raw = Array.isArray(data?.results) ? data.results as BrowseRecipe[] : [];
        const next = raw.filter((r) => hasValidImage(r?.image));

        setRecipeList((prev) => {
          const updated = append ? [...prev, ...next] : next;
          recipeCountRef.current = updated.length;
          return updated;
        });
        setHasMore(raw.length === 20);
      }
    } catch (err) {
      console.error('Browse recipes fetch error:', err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [protein, carbs, fat, sugar, cookingTime, price, ingredients, cuisines, diets, blacklists, mealTypes, appliedSearchQuery, throttle, filterIsEmpty]);

  useEffect(() => {
    setHasMore(true);
    fetchRecipes(false, false);
  }, [fetchRecipes]);

  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized === appliedSearchQuery) return;
    const timer = setTimeout(() => {
      setHasMore(true);
      setAppliedSearchQuery(normalized);
    }, 700);
    return () => clearTimeout(timer);
  }, [searchInput, appliedSearchQuery]);

  const handleRefreshRecipes = useCallback(() => {
    fetchRecipes(true, false);
  }, [fetchRecipes]);

  const handleApplySearch = useCallback(() => {
    const normalized = searchInput.trim();
    setHasMore(true);
    if (normalized === appliedSearchQuery) {
      fetchRecipes(true, false);
    } else {
      setAppliedSearchQuery(normalized);
    }
  }, [searchInput, appliedSearchQuery, fetchRecipes]);

  const loadMore = useCallback(() => {
    if (!loading && !isFetchingMore && hasMore) {
      fetchRecipes(false, true);
    }
  }, [loading, isFetchingMore, hasMore, fetchRecipes]);

  return {
    recipeList,
    loading,
    isFetchingMore,
    hasMore,
    filterModalOpen,
    searchInput,
    setFilterModalOpen,
    setSearchInput,
    handleApplySearch,
    handleRefreshRecipes,
    loadMore,
    filterProps: {
      protein, setProtein,
      carbs, setCarbs,
      fat, setFat,
      sugar, setSugar,
      cookingTime, setCookingTime,
      price, setPrice,
      ingredients, setIngredients,
      cuisines, setCuisines,
      diets, setDiets,
      blacklists, setBlacklists,
      mealTypes, setMealTypes,
    },
  };
}
