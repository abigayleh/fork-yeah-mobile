import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Tracks favorite/want-to-try state, star rating and notes for a single recipe
// (used on detail pages).
export function useRecipeSavedStatus(recipeId: string, isMyRecipe = false) {
  const { getUserRecipeById, addRecipeToUser, setRecipeNotes } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isWantToTry, setIsWantToTry] = useState(false);
  const [rating, setRatingState] = useState<number | null>(null);
  const [notes, setNotesState] = useState('');

  useEffect(() => {
    if (!recipeId) return;
    getUserRecipeById(recipeId, { isMyRecipe }).then((r) => {
      if (r) {
        setIsFavorited(Boolean(r.favorite));
        setIsWantToTry(Boolean(r.wantToTry));
        setRatingState(typeof r.rating === 'number' ? r.rating : null);
        setNotesState(typeof r.notes === 'string' ? r.notes : '');
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

  const setRating = async (value: number | null) => {
    setRatingState(value);
    await addRecipeToUser(recipeId, 'rating', value, { isMyRecipe });
  };

  const saveNotes = async (value: string) => {
    setNotesState(value);
    await setRecipeNotes(recipeId, value, { isMyRecipe });
  };

  return { isFavorited, isWantToTry, rating, notes, toggleFavorite, toggleWantToTry, setRating, saveNotes };
}
