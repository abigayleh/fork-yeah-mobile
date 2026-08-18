import { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import IngredientCheckbox from '../../../components/IngredientCheckbox';
import RecipeActions from '../../../components/RecipeActions';
import RecipeRatingNotes from '../../../components/RecipeRatingNotes';
import AddToGroceryListModal from '../../../components/AddToGroceryListModal';
import { useRecipeSavedStatus } from '../../../hooks/useRecipeSavedStatus';
import { useAuth } from '../../../contexts/AuthContext';

const API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? '';

type Ingredient = { id: number; original: string; amount: number; unit: string; name: string };
type Instruction = { number: number; step: string };
type Recipe = {
  id: number;
  title: string;
  image: string;
  servings: number;
  readyInMinutes: number;
  extendedIngredients: Ingredient[];
  analyzedInstructions: { name: string; steps: Instruction[] }[];
  instructions: string;
};

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [servings, setServings] = useState<number | null>(null);
  const [forking, setForking] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const { user, addMyRecipe } = useAuth();
  const { isFavorited, isWantToTry, rating, notes, toggleFavorite, toggleWantToTry, setRating, saveNotes } =
    useRecipeSavedStatus(String(id ?? ''), false);

  const { data: recipe, isLoading, isError } = useQuery<Recipe>({
    queryKey: ['spoonacularRecipe', id],
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`https://api.spoonacular.com/recipes/${id}/information?apiKey=${API_KEY}`);
      if (!res.ok) throw new Error('Failed to fetch recipe');
      return res.json() as Promise<Recipe>;
    },
  });

  const handleFork = async () => {
    if (!recipe) return;
    setForking(true);
    try {
      const ingredients = (recipe.extendedIngredients || []).map((ing) => ({
        name: ing.name || ing.original || '',
        quantity: Number(ing.amount) || 0,
        measurement: ing.unit || 'whole',
      }));
      const forkSteps =
        recipe.analyzedInstructions?.[0]?.steps?.map((s) => ({ text: s.step })) ??
        (recipe.instructions ? [{ text: stripHtml(recipe.instructions) }] : []);
      const { recipeId } = await addMyRecipe({
        name: recipe.title,
        servings: recipe.servings,
        cookTime: recipe.readyInMinutes || null,
        imageUrl: recipe.image,
        ingredients,
        steps: forkSteps,
      });
      router.replace(`/(app)/my-recipe/${recipeId}` as never);
    } catch {
      Alert.alert('Error', 'Could not save a copy. Please try again.');
      setForking(false);
    }
  };

  if (isLoading) return <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />;
  if (isError || !recipe) return (
    <View style={styles.page}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backBtn}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.errorText}>Could not load recipe.</Text>
    </View>
  );

  const currentServings = servings ?? recipe.servings;
  const ratio = currentServings / (recipe.servings || 1);

  const getAdjustedAmount = (ingredient: Ingredient): string => {
    const adjusted = Math.round(ingredient.amount * ratio * 100) / 100;
    const parts = ingredient.original.split(' ').slice(2).join(' ');
    return `${adjusted} ${ingredient.unit || ''} ${parts}`.trim();
  };

  const steps: Instruction[] =
    recipe.analyzedInstructions?.[0]?.steps ??
    (recipe.instructions ? [{ number: 1, step: stripHtml(recipe.instructions) }] : []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backBtn}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{recipe.title}</Text>

      {recipe.image ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: recipe.image }} style={styles.image} resizeMode="cover" />
          <RecipeActions
            id={String(id ?? '')}
            isMyRecipe={false}
            isFavorited={isFavorited}
            isWantToTry={isWantToTry}
            onFavorite={toggleFavorite}
            onWantToTry={toggleWantToTry}
            containerStyle={styles.detailActions}
          />
        </View>
      ) : null}

      {recipe.readyInMinutes ? <Text style={styles.metaText}>⏱ {recipe.readyInMinutes} min</Text> : null}

      {user ? (
        <>
          <TouchableOpacity style={styles.forkBtn} onPress={handleFork} disabled={forking}>
            <Text style={styles.forkBtnText}>{forking ? 'Saving…' : '🍴 Save a copy to edit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.groceryBtn} onPress={() => setGroceryOpen(true)}>
            <Text style={styles.groceryBtnText}>🛒 Add to grocery list</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {recipe.extendedIngredients?.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <View style={styles.servingsRow}>
              <TouchableOpacity style={styles.servingsBtn} onPress={() => setServings(Math.max(1, currentServings - 1))}>
                <Text style={styles.servingsBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.servingsText}>{currentServings} serving{currentServings !== 1 ? 's' : ''}</Text>
              <TouchableOpacity style={styles.servingsBtn} onPress={() => setServings(currentServings + 1)}>
                <Text style={styles.servingsBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {recipe.extendedIngredients.map((ing) => (
            <IngredientCheckbox key={ing.id} label={getAdjustedAmount(ing)} />
          ))}
        </View>
      )}

      {steps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {steps.map((step) => (
            <View key={step.number} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{step.number}</Text>
              <Text style={styles.stepText}>{step.step}</Text>
            </View>
          ))}
        </View>
      )}

      {user ? (
        <RecipeRatingNotes rating={rating} onRate={setRating} notes={notes} onSaveNotes={saveNotes} />
      ) : null}

      <AddToGroceryListModal
        visible={groceryOpen}
        onClose={() => setGroceryOpen(false)}
        lines={(recipe.extendedIngredients || []).map((i) => i.original || i.name)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  loader: { flex: 1, marginTop: 60 },
  content: { padding: 20, paddingBottom: 60 },
  backRow: { marginTop: 36, marginBottom: 12 },
  backBtn: { color: '#0f766e', fontWeight: '700', fontSize: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#115e59', marginBottom: 14 },
  imageWrap: { marginBottom: 14 },
  image: { width: '100%', height: 220, borderRadius: 14 },
  detailActions: { top: 10, right: 10 },
  metaText: { color: '#5e6a63', fontWeight: '600', marginBottom: 20 },
  forkBtn: { backgroundColor: '#0f766e', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  forkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  groceryBtn: { borderWidth: 1, borderColor: '#0f766e', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
  groceryBtnText: { color: '#0f766e', fontWeight: '700', fontSize: 15 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  servingsBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#e4d9c5', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  servingsBtnText: { fontSize: 18, color: '#115e59', lineHeight: 22 },
  servingsText: { fontWeight: '700', color: '#1f2421' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  stepRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f766e', color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 24, fontSize: 13 },
  stepText: { flex: 1, color: '#1f2421', lineHeight: 22 },
  errorText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
});
