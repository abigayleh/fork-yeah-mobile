import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

const STORAGE_KEY = 'queryCache';
// Bump when a persisted query's data shape changes; older caches are discarded.
const VERSION = 1;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const WRITE_DELAY = 1000;

type Entry = { queryKey: QueryKey; data: unknown; updatedAt: number };
// keepUnused holds a restored query in memory until its screen mounts to claim it.
type Rule = { project?: (data: any) => unknown; keepUnused?: boolean };

export const firstPage = <T, P>(data: InfiniteData<T, P>): InfiniteData<T, P> => ({
  pages: data.pages.slice(0, 1),
  pageParams: data.pageParams.slice(0, 1),
});

// Everything that reaches disk, by queryKey[0]. Spoonacular's terms allow storing
// only a recipe's id, title and image, so its queries hold nothing else.
const PERSISTED = new Map<string, Rule>([
  ['userContext', { keepUnused: true }],
  ['userRecipes', { keepUnused: true }],
  ['browse', { project: firstPage }],
]);

const ruleFor = (queryKey: QueryKey) => PERSISTED.get(String(queryKey[0]));

// Serialized so a clear can never be overtaken by a write that started before it.
let writes: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<unknown>) => {
  writes = writes.then(task).catch(() => { /* the cache is best-effort */ });
  return writes;
};

export const clearPersistedCache = () => enqueue(() => AsyncStorage.removeItem(STORAGE_KEY));

export const persistQueryCache = (client: QueryClient, uid: string | null) => {
  const entries: Entry[] = client.getQueryCache().getAll().flatMap(({ queryKey, state }) => {
    const rule = ruleFor(queryKey);
    if (!rule || state.data === undefined) return [];
    const data = rule.project ? rule.project(state.data) : state.data;
    return [{ queryKey, data, updatedAt: state.dataUpdatedAt }];
  });
  const payload = JSON.stringify({ version: VERSION, uid, entries });
  return enqueue(() => AsyncStorage.setItem(STORAGE_KEY, payload));
};

// The cache is tagged with its owner: a different account (or a guest) never sees it.
export async function restoreQueryCache(client: QueryClient, uid: string | null): Promise<void> {
  PERSISTED.forEach((rule, prefix) => {
    if (rule.keepUnused) client.setQueryDefaults([prefix], { gcTime: Infinity });
  });
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.version !== VERSION || saved.uid !== uid) throw new Error('stale cache');
    const cutoff = Date.now() - MAX_AGE;
    (saved.entries as Entry[]).forEach(({ queryKey, data, updatedAt }) => {
      if (ruleFor(queryKey) && updatedAt > cutoff) client.setQueryData(queryKey, data, { updatedAt });
    });
  } catch {
    await clearPersistedCache();
  }
}

// Writes shortly after any persisted query changes. Returns the unsubscribe.
export function persistOnChange(client: QueryClient, getUid: () => string | null): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return client.getQueryCache().subscribe((event) => {
    const changed = event.type === 'removed' || (event.type === 'updated' && event.action.type === 'success');
    if (!changed || timer || !ruleFor(event.query.queryKey)) return;
    timer = setTimeout(() => {
      timer = undefined;
      persistQueryCache(client, getUid());
    }, WRITE_DELAY);
  });
}
