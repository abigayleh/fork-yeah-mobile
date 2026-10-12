import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { withCurrentUser } from '../lib/familyData';
import { userRecipesQuery } from './useRecipeApi';

type SavedField = 'favorite' | 'wantToTry';
type SavedDoc = Record<string, unknown>;

const toggled = (docs: SavedDoc[], userId: string, recipeId: string, field: SavedField): SavedDoc[] => {
  const isMine = (d: SavedDoc) => d.userId === userId && String(d.recipeId) === recipeId && !d.isMyRecipe;
  return docs.some(isMine)
    ? docs.map((d) => (isMine(d) ? { ...d, [field]: !d[field] } : d))
    : [...docs, { userId, recipeId, favorite: false, wantToTry: false, isMyRecipe: false, [field]: true }];
};

// Favorite / want-to-try state for every recipe the family has saved (list screens).
export function useSavedStatuses() {
  const { user, familyUserIds, addRecipeToUser } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? '';
  const { queryKey, ...options } = userRecipesQuery(uid, withCurrentUser(uid, familyUserIds));
  // Enabled once the family is known, so the first fetch already covers every member.
  const { data } = useQuery({ queryKey, ...options, enabled: familyUserIds.length > 0 });

  const savedStatus = useMemo(() => {
    const status: Record<string, { favorite: boolean; wantToTry: boolean }> = {};
    (data ?? []).forEach((r) => {
      status[String(r.recipeId)] = { favorite: Boolean(r.favorite), wantToTry: Boolean(r.wantToTry) };
    });
    return status;
  }, [data]);

  // addRecipeToUser invalidates on success, so only the failure path needs undoing here.
  const { mutate } = useMutation({
    mutationFn: ({ recipeId, field }: { recipeId: string; field: SavedField }) =>
      addRecipeToUser(recipeId, field, null),
    onMutate: async ({ recipeId, field }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (docs = []) => toggled(docs, uid, recipeId, field));
      return { previous };
    },
    onError: (_error, _variables, context) => queryClient.setQueryData(queryKey, context?.previous),
  });

  return { savedStatus, toggleSaved: (recipeId: string, field: SavedField) => mutate({ recipeId, field }) };
}
