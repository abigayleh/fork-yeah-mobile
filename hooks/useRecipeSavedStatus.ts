import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Tracks favorite/want-to-try state for a single recipe (used on detail pages).
export function useRecipeSavedStatus(recipeId: string, isMyRecipe = false) {
  const { getUserRecipeById, addRecipeToUser } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isWantToTry, setIsWantToTry] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    getUserRecipeById(recipeId, { isMyRecipe }).then((r) => {
      if (r) {
        setIsFavorited(Boolean(r.favorite));
        setIsWantToTry(Boolean(r.wantToTry));
      }
    }).catch(() => {});
  }, [recipeId, isMyRecipe, getUserRecipeById]);

  const toggleFavorite = async () => {
    setIsFavorited((v) => !v);
    await addRecipeToUser(recipeId, 'favorite', null, { isMyRecipe });
  };

  const toggleWantToTry = async () => {
    setIsWantToTry((v) => !v);
    await addRecipeToUser(recipeId, 'wantToTry', null, { isMyRecipe });
  };

  return { isFavorited, isWantToTry, toggleFavorite, toggleWantToTry };
}
