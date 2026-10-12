import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { firstPage } from '../lib/queryPersistence';
import { loadBrowseFilters, saveBrowseFilters, type BrowseFilters } from '../utils/browseFiltersStorage';

const API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? '';
const API_URL = 'https://api.spoonacular.com/recipes';
const PAGE_SIZE = 20;
const SEARCH_STALE_TIME = 5 * 60 * 1000;
// The random feed only changes on Refresh or once a day, so a relaunch never reshuffles it.
const RANDOM_STALE_TIME = 24 * 60 * 60 * 1000;
const MIN_API_INTERVAL = 2000;

type BrowseRecipe = { id: number | string; title: string; image: string };
// rawCount is what the API returned, before image-less recipes were dropped.
type BrowsePage = { recipes: BrowseRecipe[]; rawCount: number };

const hasValidImage = (image: unknown): image is string =>
  typeof image === 'string' && image.trim().length > 0;

// Spoonacular reports quota/key problems as a JSON body, not an empty result.
const assertOk = <T extends { status?: string; message?: string }>(data: T): T => {
  if (data?.status === 'failure') throw new Error(data.message ?? 'Recipe service unavailable');
  return data;
};

const searchUrl = (f: BrowseFilters, offset: number) => [
  `${API_URL}/complexSearch?number=${PAGE_SIZE}&apiKey=${API_KEY}`,
  `&offset=${offset}`,
  f.query ? `&query=${encodeURIComponent(f.query)}` : '',
  `&minProtein=${f.protein[0]}&maxProtein=${f.protein[1]}`,
  `&minCarbs=${f.carbs[0]}&maxCarbs=${f.carbs[1]}`,
  `&minFat=${f.fat[0]}&maxFat=${f.fat[1]}`,
  `&minSugar=${f.sugar[0]}&maxSugar=${f.sugar[1]}`,
  `&maxCookingTime=${f.cookingTime[1]}`,
  `&maxPrice=${f.price[1]}`,
  f.ingredients.length ? `&includeIngredients=${f.ingredients.join(',')}` : '',
  f.cuisines.length ? `&cuisine=${f.cuisines.join(',')}` : '',
  f.diets.length ? `&diet=${f.diets.join(',')}` : '',
  f.blacklists.length ? `&excludeIngredients=${f.blacklists.join(',')}` : '',
  f.mealTypes.length ? `&type=${f.mealTypes.join(',')}` : '',
].join('');

export function useBrowseRecipes() {
  const queryClient = useQueryClient();
  const { loading: restoringCache } = useAuth();
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
  const [hydrated, setHydrated] = useState(false);

  const lastApiRequestAtRef = useRef(0);

  useEffect(() => {
    loadBrowseFilters().then((saved) => {
      if (saved) {
        if (saved.protein) setProtein(saved.protein);
        if (saved.carbs) setCarbs(saved.carbs);
        if (saved.fat) setFat(saved.fat);
        if (saved.sugar) setSugar(saved.sugar);
        if (saved.cookingTime) setCookingTime(saved.cookingTime);
        if (saved.price) setPrice(saved.price);
        if (saved.ingredients) setIngredients(saved.ingredients);
        if (saved.cuisines) setCuisines(saved.cuisines);
        if (saved.diets) setDiets(saved.diets);
        if (saved.blacklists) setBlacklists(saved.blacklists);
        if (saved.mealTypes) setMealTypes(saved.mealTypes);
        if (saved.query) {
          setSearchInput(saved.query);
          setAppliedSearchQuery(saved.query);
        }
      }
      setHydrated(true);
    });
  }, []);

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

  const filters: BrowseFilters = useMemo(() => ({
    protein, carbs, fat, sugar, cookingTime, price,
    ingredients, cuisines, diets, blacklists, mealTypes,
    query: appliedSearchQuery,
  }), [protein, carbs, fat, sugar, cookingTime, price, ingredients, cuisines, diets, blacklists, mealTypes, appliedSearchQuery]);

  const queryKey = ['browse', filters];
  const query = useInfiniteQuery({
    queryKey,
    // Only id, title and image are kept: all the list needs, and all that may be stored.
    queryFn: async ({ pageParam }): Promise<BrowsePage> => {
      await throttle();
      const url = filterIsEmpty
        ? `${API_URL}/random?number=${PAGE_SIZE}&apiKey=${API_KEY}`
        : searchUrl(filters, pageParam);
      const data = assertOk(await fetch(url).then((r) => r.json()));
      const found = filterIsEmpty ? data?.recipes : data?.results;
      const raw: BrowseRecipe[] = Array.isArray(found) ? found : [];
      return {
        rawCount: raw.length,
        recipes: raw.filter((r) => hasValidImage(r?.image)).map(({ id, title, image }) => ({ id, title, image })),
      };
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      filterIsEmpty || last.rawCount === PAGE_SIZE ? pages.reduce((n, p) => n + p.rawCount, 0) : undefined,
    // Wait for the saved filters and the disk cache, or launch would fetch what is already stored.
    enabled: hydrated && !restoringCache,
    staleTime: filterIsEmpty ? RANDOM_STALE_TIME : SEARCH_STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const recipeList = useMemo(() => query.data?.pages.flatMap((p) => p.recipes) ?? [], [query.data]);
  const hasRecipes = recipeList.length > 0;

  useEffect(() => {
    if (hydrated) saveBrowseFilters(filters);
  }, [hydrated, filters]);

  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized === appliedSearchQuery) return;
    const timer = setTimeout(() => setAppliedSearchQuery(normalized), 700);
    return () => clearTimeout(timer);
  }, [searchInput, appliedSearchQuery]);

  // Drop back to one page first: refetching an infinite query re-requests every loaded page.
  const handleRefreshRecipes = () => {
    queryClient.setQueryData<InfiniteData<BrowsePage, number>>(queryKey, (data) => data && firstPage(data));
    query.refetch();
  };

  const handleApplySearch = () => {
    const normalized = searchInput.trim();
    if (normalized === appliedSearchQuery) handleRefreshRecipes();
    else setAppliedSearchQuery(normalized);
  };

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetching) query.fetchNextPage();
  };

  return {
    recipeList,
    loading: !hydrated || query.isPending || (query.isFetching && !hasRecipes),
    error: query.error?.message ?? null,
    isFetchingMore: query.isFetching && hasRecipes,
    hasMore: query.hasNextPage,
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
