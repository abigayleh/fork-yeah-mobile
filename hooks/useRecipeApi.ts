import { useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

type RecipeRef = { recipeId: string; isMyRecipe: boolean };

export function useRecipeApi(getFamilyUserIdsForCurrentUser: () => Promise<string[]>) {
  const queryClient = useQueryClient();

  const invalidateUserRecipeQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['userRecipes'] }),
      queryClient.invalidateQueries({ queryKey: ['userRecipeById'] }),
    ]);

  const invalidateFolderQueries = () =>
    queryClient.invalidateQueries({ queryKey: ['userFolders'] });

  const invalidateMyRecipeQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['myRecipes'] }),
      queryClient.invalidateQueries({ queryKey: ['myRecipeById'] }),
    ]);

  const invalidateMealPlanQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['userMealPlans'] }),
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] }),
    ]);

  const resolveFamilyUserIds = async (currentUserId: string) => {
    const ids = await getFamilyUserIdsForCurrentUser();
    return Array.from(new Set([currentUserId, ...ids].map((id) => String(id || '').trim()).filter(Boolean)));
  };

  const addRecipeToUser = async (
    recipeId: string | number,
    recipeType: 'favorite' | 'wantToTry' | 'rating',
    ratingValue: number | null,
    options: { isMyRecipe?: boolean } = {}
  ) => {
    const user = auth.currentUser;
    if (!user) return;
    const { isMyRecipe = false } = options;
    const normalizedId = String(recipeId);
    const docId = `${user.uid}_${isMyRecipe ? `my_${normalizedId}` : normalizedId}`;
    const recipeRef = doc(db, 'userRecipes', docId);
    const recipeSnap = await getDoc(recipeRef);
    const existing = recipeSnap.exists()
      ? recipeSnap.data()
      : { favorite: false, wantToTry: false, rating: null, isMyRecipe: false };

    await setDoc(recipeRef, {
      userId: user.uid,
      recipeId: normalizedId,
      favorite: recipeType === 'favorite' ? !existing.favorite : existing.favorite,
      wantToTry: recipeType === 'wantToTry' ? !existing.wantToTry : existing.wantToTry,
      rating: recipeType === 'rating' ? ratingValue : existing.rating,
      isMyRecipe: Boolean(isMyRecipe),
    });
    await invalidateUserRecipeQueries();
  };

  const getUserRecipeById = async (recipeId: string | number, options: { isMyRecipe?: boolean } = {}) => {
    const user = auth.currentUser;
    if (!user) return null;
    const { isMyRecipe = false } = options;
    const normalizedId = String(recipeId);
    const docId = `${user.uid}_${isMyRecipe ? `my_${normalizedId}` : normalizedId}`;
    const snap = await getDoc(doc(db, 'userRecipes', docId));
    return snap.exists() ? snap.data() : null;
  };

  const getUserRecipes = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const familyUserIds = await resolveFamilyUserIds(user.uid);
    return queryClient.fetchQuery({
      queryKey: ['userRecipes', { userId: user.uid, familyUserIds }],
      queryFn: async () => {
        const ref = collection(db, 'userRecipes');
        const snaps = await Promise.all(
          familyUserIds.map((uid) => getDocs(query(ref, where('userId', '==', uid))))
        );
        return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      staleTime: 60_000,
    });
  };

  const getUserMealPlans = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    return queryClient.fetchQuery({
      queryKey: ['userMealPlans', { userId: user.uid }],
      queryFn: async () => {
        const ref = collection(db, 'userMealPlans');
        const snap = await getDocs(query(ref, where('userId', '==', user.uid)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      },
      staleTime: 60_000,
    });
  };

  const getUserFolders = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const familyUserIds = await resolveFamilyUserIds(user.uid);
    return queryClient.fetchQuery({
      queryKey: ['userFolders', { userId: user.uid, familyUserIds }],
      queryFn: async () => {
        const ref = collection(db, 'folders');
        const snaps = await Promise.all(
          familyUserIds.map((uid) => getDocs(query(ref, where('userId', '==', uid))))
        );
        return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      staleTime: 60_000,
    });
  };

  const createUserFolder = async (name: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const ref = collection(db, 'folders');
    const newFolder = { name, recipes: [], userId: user.uid, order: Date.now() };
    const folderRef = await addDoc(ref, newFolder);
    await invalidateFolderQueries();
    return { id: folderRef.id, ...newFolder };
  };

  const updateUserFolderName = async (folderId: string, name: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    await setDoc(doc(db, 'folders', folderId), { name, userId: user.uid }, { merge: true });
    await invalidateFolderQueries();
  };

  const deleteUserFolder = async (folderId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    await deleteDoc(doc(db, 'folders', folderId));
    await invalidateFolderQueries();
  };

  const reorderUserFolders = async (orderedFolderIds: string[]) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const batch = writeBatch(db);
    orderedFolderIds.forEach((folderId, index) => {
      if (!folderId) return;
      batch.set(doc(db, 'folders', folderId), { order: index }, { merge: true });
    });
    await batch.commit();
    await invalidateFolderQueries();
  };

  const addRecipeToFolder = async (folderId: string, recipeRef: RecipeRef) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const folderRef = doc(db, 'folders', folderId);
    const snap = await getDoc(folderRef);
    if (!snap.exists()) throw new Error('Folder not found');
    const existing = Array.isArray(snap.data().recipes) ? snap.data().recipes as RecipeRef[] : [];
    if (existing.some((r) => r.recipeId === recipeRef.recipeId && r.isMyRecipe === recipeRef.isMyRecipe)) {
      return { alreadyExists: true };
    }
    await setDoc(folderRef, { recipes: [...existing, recipeRef], userId: user.uid }, { merge: true });
    await invalidateFolderQueries();
    return { alreadyExists: false };
  };

  const removeRecipeFromFolder = async (folderId: string, recipeRef: RecipeRef) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const folderRef = doc(db, 'folders', folderId);
    const snap = await getDoc(folderRef);
    if (!snap.exists()) throw new Error('Folder not found');
    const existing = Array.isArray(snap.data().recipes) ? snap.data().recipes as RecipeRef[] : [];
    const next = existing.filter((r) => !(r.recipeId === recipeRef.recipeId && r.isMyRecipe === recipeRef.isMyRecipe));
    await setDoc(folderRef, { recipes: next, userId: user.uid }, { merge: true });
    await invalidateFolderQueries();
  };

  const getMyRecipes = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const familyUserIds = await resolveFamilyUserIds(user.uid);
    return queryClient.fetchQuery({
      queryKey: ['myRecipes', { userId: user.uid, familyUserIds }],
      queryFn: async () => {
        const ref = collection(db, 'recipes');
        const snaps = await Promise.all(
          familyUserIds.map((uid) => getDocs(query(ref, where('userId', '==', uid))))
        );
        return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      staleTime: 60_000,
    });
  };

  const getMyRecipeById = async (recipeId: string) => {
    const user = auth.currentUser;
    if (!user) return null;
    const normalizedId = String(recipeId || '').trim();
    const familyUserIds = await resolveFamilyUserIds(user.uid);
    return queryClient.fetchQuery({
      queryKey: ['myRecipeById', { userId: user.uid, recipeId: normalizedId, familyUserIds }],
      queryFn: async () => {
        for (const uid of familyUserIds) {
          const snap = await getDoc(doc(db, 'recipes', `${uid}_${normalizedId}`));
          if (snap.exists()) return { id: snap.id, ...snap.data() };
        }
        const q = query(collection(db, 'recipes'), where('recipeId', '==', normalizedId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          if (familyUserIds.includes(d.data().userId)) return { id: d.id, ...d.data() };
        }
        return null;
      },
      staleTime: 60_000,
    });
  };

  const addMyRecipe = async (recipeData: Record<string, unknown>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const recipeId = (recipeData.recipeId as string) || `${Date.now()}`;
    const docId = `${user.uid}_${recipeId}`;
    const servings = Number.isFinite(Number(recipeData.servings))
      ? Math.max(1, Math.floor(Number(recipeData.servings)))
      : 2;
    await setDoc(doc(db, 'recipes', docId), { ...recipeData, servings, recipeId, userId: user.uid }, { merge: true });
    await Promise.all([invalidateMyRecipeQueries(), invalidateUserRecipeQueries(), invalidateFolderQueries()]);
    return { id: docId, recipeId };
  };

  const updateMyRecipe = async (recipeId: string, recipeData: Record<string, unknown>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docId = `${user.uid}_${recipeId}`;
    await setDoc(doc(db, 'recipes', docId), { ...recipeData, recipeId, userId: user.uid }, { merge: true });
    await Promise.all([invalidateMyRecipeQueries(), invalidateUserRecipeQueries(), invalidateFolderQueries()]);
    return { id: docId, recipeId };
  };

  const deleteMyRecipe = async (recipeId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    const docId = `${user.uid}_${recipeId}`;
    await deleteDoc(doc(db, 'recipes', docId));
    await Promise.all([invalidateMyRecipeQueries(), invalidateUserRecipeQueries(), invalidateFolderQueries()]);
  };

  const addMealPlanToUser = async (data: Record<string, unknown>, mealPlanName: string, groceryList: unknown) => {
    const user = auth.currentUser;
    if (!user) return;
    const docId = `${user.uid}_${mealPlanName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await setDoc(doc(db, 'userMealPlans', docId), { title: mealPlanName, userId: user.uid, groceryList, ...data }, { merge: true });
    await invalidateMealPlanQueries();
  };

  return {
    addRecipeToUser,
    getUserRecipeById,
    getUserRecipes,
    getUserMealPlans,
    getUserFolders,
    createUserFolder,
    updateUserFolderName,
    deleteUserFolder,
    reorderUserFolders,
    addRecipeToFolder,
    removeRecipeFromFolder,
    getMyRecipes,
    getMyRecipeById,
    addMyRecipe,
    updateMyRecipe,
    deleteMyRecipe,
    addMealPlanToUser,
  };
}
