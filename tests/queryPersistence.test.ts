import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPersistedCache, persistOnChange, persistQueryCache, restoreQueryCache,
} from '../lib/queryPersistence';

const STORAGE_KEY = 'queryCache';
const CONTEXT_KEY = ['userContext', 'alice'];
const context = { profile: { id: 'alice', familyId: 'fam' }, familyUserIds: ['alice', 'bob'] };

const stored = async () => JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null');

// A fresh client stands in for the next launch of the app.
const relaunch = async (uid: string | null) => {
  const client = new QueryClient();
  await restoreQueryCache(client, uid);
  return client;
};

beforeEach(() => clearPersistedCache());
afterEach(() => vi.useRealTimers());

describe('persistQueryCache + restoreQueryCache', () => {
  it('brings persisted queries back with their original age', async () => {
    const client = new QueryClient();
    client.setQueryData(CONTEXT_KEY, context, { updatedAt: Date.now() - 60_000 });
    const { dataUpdatedAt } = client.getQueryState(CONTEXT_KEY)!;
    await persistQueryCache(client, 'alice');

    const next = await relaunch('alice');
    expect(next.getQueryData(CONTEXT_KEY)).toEqual(context);
    expect(next.getQueryState(CONTEXT_KEY)!.dataUpdatedAt).toBe(dataUpdatedAt);
  });

  it('never writes a query that is not on the persisted list', async () => {
    const client = new QueryClient();
    client.setQueryData(CONTEXT_KEY, context);
    client.setQueryData(['spoonacularRecipe', '42'], { instructions: 'not storable' });
    await persistQueryCache(client, 'alice');

    expect((await stored()).entries.map((e: { queryKey: unknown[] }) => e.queryKey[0])).toEqual(['userContext']);
  });

  it('keeps only the first page of the browse feed', async () => {
    const client = new QueryClient();
    const key = ['browse', { query: '' }];
    client.setQueryData(key, { pages: [{ recipes: ['a'] }, { recipes: ['b'] }], pageParams: [0, 20] });
    await persistQueryCache(client, null);

    const next = await relaunch(null);
    expect(next.getQueryData(key)).toEqual({ pages: [{ recipes: ['a'] }], pageParams: [0] });
  });

  it('discards a cache that belongs to a different account', async () => {
    const client = new QueryClient();
    client.setQueryData(CONTEXT_KEY, context);
    await persistQueryCache(client, 'alice');

    expect((await relaunch('mallory')).getQueryData(CONTEXT_KEY)).toBeUndefined();
    expect(await stored()).toBeNull();
  });

  it('discards a signed-in cache when the app opens signed out', async () => {
    const client = new QueryClient();
    client.setQueryData(CONTEXT_KEY, context);
    await persistQueryCache(client, 'alice');

    expect((await relaunch(null)).getQueryData(CONTEXT_KEY)).toBeUndefined();
    expect(await stored()).toBeNull();
  });

  it('discards a cache written by another version of the shape', async () => {
    const entries = [{ queryKey: CONTEXT_KEY, data: context, updatedAt: Date.now() }];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 0, uid: 'alice', entries }));

    expect((await relaunch('alice')).getQueryData(CONTEXT_KEY)).toBeUndefined();
    expect(await stored()).toBeNull();
  });

  it('skips entries older than a week', async () => {
    const client = new QueryClient();
    client.setQueryData(CONTEXT_KEY, context, { updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    await persistQueryCache(client, 'alice');

    expect((await relaunch('alice')).getQueryData(CONTEXT_KEY)).toBeUndefined();
  });

  it('survives a corrupt cache and removes it', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');

    expect((await relaunch('alice')).getQueryData(CONTEXT_KEY)).toBeUndefined();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('persistOnChange', () => {
  it('writes shortly after a persisted query changes, tagged with the current user', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = persistOnChange(client, () => 'alice');
    client.setQueryData(['spoonacularRecipe', '42'], {});
    await vi.runAllTimersAsync();
    expect(await stored()).toBeNull();

    client.setQueryData(CONTEXT_KEY, context);
    await vi.runAllTimersAsync();
    expect(await stored()).toMatchObject({ uid: 'alice', entries: [{ queryKey: CONTEXT_KEY, data: context }] });
    stop();
  });

  it('leaves nothing of the user on disk after a sign-out clear', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const stop = persistOnChange(client, () => null);
    client.setQueryData(CONTEXT_KEY, context);
    client.clear();
    clearPersistedCache();
    await vi.runAllTimersAsync();

    expect((await stored())?.entries ?? []).toEqual([]);
    stop();
  });
});
