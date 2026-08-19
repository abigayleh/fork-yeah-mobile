import { authedFetch } from './authedFetch';
import type { GroceryItem } from '../hooks/useGroceryItemsEditor';

export type GroceryList = { id: string; name: string; items: GroceryItem[] };

const parse = async (response: Response, action: string) => {
  if (!response.ok) throw new Error(`Could not ${action} (${response.status})`);
  return response.json();
};

const jsonRequest = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const listPath = (id: string) => `/api/myGroceryLists/${encodeURIComponent(id)}`;

const toList = (raw: Record<string, unknown>): GroceryList => ({
  id: String(raw?.id ?? ''),
  name: String(raw?.name ?? ''),
  items: Array.isArray(raw?.items) ? (raw.items as GroceryItem[]) : [],
});

// The route derives the family from the caller's token, so no ids are sent.
export const fetchGroceryLists = async (): Promise<GroceryList[]> => {
  const data = await parse(await authedFetch('/api/myGroceryLists'), 'load your grocery lists');
  return (Array.isArray(data?.groceryLists) ? data.groceryLists : []).map(toList);
};

// Create takes item names as plain strings, not item objects.
export const createGroceryList = async (name: string, itemNames: string[] = []): Promise<GroceryList> => {
  const data = await parse(
    await authedFetch('/api/myGroceryLists', jsonRequest('POST', { name, items: itemNames })),
    'create the list',
  );
  return toList(data);
};

export const renameGroceryList = async (id: string, name: string): Promise<void> => {
  await parse(await authedFetch(listPath(id), jsonRequest('PATCH', { name })), 'rename the list');
};

// Returns the server's copy, which drops blank-named rows.
export const saveGroceryItems = async (id: string, items: GroceryItem[]): Promise<GroceryItem[]> => {
  const data = await parse(await authedFetch(listPath(id), jsonRequest('PATCH', { items })), 'save the list');
  return Array.isArray(data?.items) ? (data.items as GroceryItem[]) : items;
};

export const deleteGroceryList = async (id: string): Promise<void> => {
  await parse(await authedFetch(listPath(id), { method: 'DELETE' }), 'delete the list');
};
