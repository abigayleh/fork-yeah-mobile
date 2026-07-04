import { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import IngredientCheckbox from '../../../components/IngredientCheckbox';

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
        <Image source={{ uri: recipe.image }} style={styles.image} resizeMode="cover" />
      ) : null}

      {recipe.readyInMinutes ? <Text style={styles.metaText}>⏱ {recipe.readyInMinutes} min</Text> : null}

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
  image: { width: '100%', height: 220, borderRadius: 14, marginBottom: 14 },
  metaText: { color: '#5e6a63', fontWeight: '600', marginBottom: 20 },
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
