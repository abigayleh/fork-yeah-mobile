import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import IngredientCheckbox from '../../../components/IngredientCheckbox';
import RecipeActions from '../../../components/RecipeActions';
import { useRecipeSavedStatus } from '../../../hooks/useRecipeSavedStatus';
import IngredientLinesEditor from '../../../components/IngredientLinesEditor';
import StepsEditor from '../../../components/StepsEditor';
import ConvertUnitModal from '../../../components/ConvertUnitModal';
import { useIngredientLinesEditor, hydrateIngredientLines } from '../../../hooks/useIngredientLinesEditor';
import { useStepsEditor } from '../../../hooks/useStepsEditor';
import { usePickImageBase64 } from '../../../hooks/usePickImageBase64';
import { groupIngredientsBySections, groupSteps } from '../../../utils/recipeSections';
import { getUnitType, detectDominantSystem, convertQuantity, convertToSystem, type UnitSystem } from '../../../utils/unitConversion';
import { formatQuantityAsFraction } from '../../../utils/parseQuantity';
import { normalizeSteps, type CustomRecipe } from '../../../types/recipe';

export default function MyRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getMyRecipeById, updateMyRecipe, deleteMyRecipe } = useAuth();
  const { pickImage } = usePickImageBase64();

  const [recipe, setRecipe] = useState<CustomRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convertingIndex, setConvertingIndex] = useState<number | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const ingredientsEditor = useIngredientLinesEditor();
  const stepsEditor = useStepsEditor();
  const { isFavorited, isWantToTry, toggleFavorite, toggleWantToTry } = useRecipeSavedStatus(String(id ?? ''), true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyRecipeById(String(id || '')) as CustomRecipe | null;
        setRecipe(data ? {
          ...data,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
          steps: Array.isArray(data.steps) ? data.steps : [],
        } : null);
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
    else setLoading(false);
  }, [getMyRecipeById, id]);

  const openEdit = () => {
    if (!recipe) return;
    setEditTitle(recipe.name ?? '');
    setEditImageUrl(recipe.imageUrl ?? '');
    ingredientsEditor.resetLines(hydrateIngredientLines(recipe.ingredients ?? [], recipe.ingredientSections));
    stepsEditor.resetSteps(recipe.steps ?? []);
    setEditOpen(true);
  };

  const handlePickImage = async () => {
    const image = await pickImage();
    if (image) setEditImageUrl(image);
  };

  const handleSave = async () => {
    const recipeId = recipe?.recipeId ?? recipe?.id ?? String(id);
    if (!recipeId) return;

    const ingredientsResult = ingredientsEditor.validateAndParse();
    if ('errors' in ingredientsResult) {
      Alert.alert('Check your ingredients', 'Some ingredient lines need fixing.');
      return;
    }
    const stepsResult = stepsEditor.validateSteps();
    if ('errors' in stepsResult) {
      Alert.alert('Check your steps', 'Some step lines need fixing.');
      return;
    }

    setSaving(true);
    try {
      const patch = {
        name: editTitle.trim(),
        imageUrl: editImageUrl,
        ingredients: ingredientsResult.ingredients,
        ingredientSections: ingredientsResult.sections,
        steps: stepsResult.steps,
      };
      await updateMyRecipe(recipeId, patch);
      setRecipe((prev) => (prev ? { ...prev, ...patch } : prev));
      setEditOpen(false);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Recipe', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const recipeId = recipe?.recipeId ?? recipe?.id ?? String(id);
          if (!recipeId) return;
          setDeleting(true);
          try {
            await deleteMyRecipe(recipeId);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete recipe.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleConvertIngredient = async (targetUnit: string) => {
    if (!recipe || convertingIndex === null) return;
    const recipeId = recipe.recipeId ?? recipe.id ?? String(id);
    if (!recipeId) return;

    const ingredient = recipe.ingredients[convertingIndex];
    const converted = convertQuantity(ingredient.quantity, ingredient.measurement, targetUnit, ingredient.name);
    if (converted === null) return;

    const nextIngredients = recipe.ingredients.map((ing, i) =>
      i === convertingIndex ? { ...ing, quantity: converted, measurement: targetUnit } : ing
    );

    try {
      await updateMyRecipe(recipeId, { ingredients: nextIngredients });
      setRecipe((prev) => (prev ? { ...prev, ingredients: nextIngredients } : prev));
    } catch {
      Alert.alert('Error', 'Could not convert this ingredient.');
    } finally {
      setConvertingIndex(null);
    }
  };

  const handleConvertAll = async () => {
    if (!recipe) return;
    const recipeId = recipe.recipeId ?? recipe.id ?? String(id);
    if (!recipeId) return;

    const dominant = detectDominantSystem(recipe.ingredients.map((ing) => ing.measurement));
    if (!dominant) return;
    const targetSystem: UnitSystem = dominant === 'us' ? 'metric' : 'us';

    const nextIngredients = recipe.ingredients.map((ing) => {
      const converted = convertToSystem(ing.quantity, ing.measurement, targetSystem);
      return converted ? { ...ing, quantity: converted.quantity, measurement: converted.unit } : ing;
    });

    try {
      await updateMyRecipe(recipeId, { ingredients: nextIngredients });
      setRecipe((prev) => (prev ? { ...prev, ingredients: nextIngredients } : prev));
    } catch {
      Alert.alert('Error', 'Could not convert ingredients.');
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />;
  if (!recipe) return (
    <View style={styles.page}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backBtn}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.errorText}>Recipe not found.</Text>
    </View>
  );

  const baseServings = recipe.servings || 1;
  const currentServings = servings ?? baseServings;
  const servingsRatio = currentServings / baseServings;
  const getAdjustedQty = (quantity: number, measurement: string) => {
    const adjusted = quantity * servingsRatio;
    return measurement.toLowerCase() === 'grams' || measurement.toLowerCase() === 'ml'
      ? Math.round(adjusted)
      : Math.round(adjusted * 100) / 100;
  };

  const dominantSystem = detectDominantSystem(recipe.ingredients.map((ing) => ing.measurement));
  const convertToggleLabel = dominantSystem === 'us' ? 'Convert to Metric' : dominantSystem === 'metric' ? 'Convert to US' : null;
  const convertingIngredient = convertingIndex !== null ? recipe.ingredients[convertingIndex] : null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backBtn}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Text style={styles.title}>{recipe.name}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} disabled={deleting}>
            <Text style={styles.deleteBtn}>{deleting ? '...' : 'Delete'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {recipe.imageUrl ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
          <RecipeActions
            id={String(id ?? '')}
            isMyRecipe
            isFavorited={isFavorited}
            isWantToTry={isWantToTry}
            onFavorite={toggleFavorite}
            onWantToTry={toggleWantToTry}
            containerStyle={styles.detailActions}
          />
        </View>
      ) : null}

      {recipe.ingredients?.length > 0 && (
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

          {convertToggleLabel && (
            <TouchableOpacity style={styles.convertAllBtn} onPress={handleConvertAll}>
              <Text style={styles.convertAllText}>{convertToggleLabel}</Text>
            </TouchableOpacity>
          )}

          {groupIngredientsBySections(recipe.ingredients, recipe.ingredientSections).map((section, sectionIndex) => (
            <View key={`${section.title}-${sectionIndex}`} style={section.title ? styles.sectionedGroup : undefined}>
              {section.title && <Text style={styles.sectionHeaderLabel}>{section.title}</Text>}
              <View style={section.title ? styles.indentedList : undefined}>
                {section.items.map(({ ingredient, index }) => {
                  const adjustedQuantity = getAdjustedQty(ingredient.quantity, ingredient.measurement);
                  const isConvertible = getUnitType(ingredient.measurement) !== 'count';
                  const quantityLabel = formatQuantityAsFraction(adjustedQuantity, ingredient.measurement);
                  const label = `${quantityLabel} ${ingredient.measurement} ${ingredient.name}`;

                  return isConvertible ? (
                    <TouchableOpacity key={`${ingredient.name}-${index}`} onPress={() => setConvertingIndex(index)}>
                      <IngredientCheckbox label={label} />
                    </TouchableOpacity>
                  ) : (
                    <IngredientCheckbox key={`${ingredient.name}-${index}`} label={label} />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {recipe.steps?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.instructionsTitle]}>Instructions</Text>
          {groupSteps(normalizeSteps(recipe.steps)).map((section, sectionIndex) => {
            let stepNumber = 0;
            return (
              <View key={`${section.title}-${sectionIndex}`} style={section.title ? styles.sectionedGroup : undefined}>
                {section.title && <Text style={styles.sectionHeaderLabel}>{section.title}</Text>}
                <View style={section.title ? styles.indentedList : undefined}>
                  {section.steps.map((step, i) => {
                    stepNumber += 1;
                    return (
                      <View key={`${step.text}-${i}`} style={styles.stepRow}>
                        <Text style={styles.stepNumber}>{stepNumber}</Text>
                        <View style={styles.stepMain}>
                          <Text style={styles.stepText}>{step.text}</Text>
                          {step.imageUrl && <Image source={{ uri: step.imageUrl }} style={styles.stepImage} />}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={editOpen} animationType="slide" onRequestClose={() => !saving && setEditOpen(false)}>
        <ScrollView style={styles.modalPage} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => !saving && setEditOpen(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Recipe</Text>
            <View style={{ width: 32 }} />
          </View>

          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
            {editImageUrl ? (
              <Image source={{ uri: editImageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <Text style={styles.imagePickerText}>+ Add Photo</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Recipe title" />

          <Text style={styles.fieldLabel}>Ingredients</Text>
          <IngredientLinesEditor editor={ingredientsEditor} />

          <Text style={styles.fieldLabel}>Steps</Text>
          <StepsEditor editor={stepsEditor} />

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {convertingIngredient && (
        <ConvertUnitModal
          visible={convertingIndex !== null}
          ingredientName={convertingIngredient.name}
          quantity={convertingIngredient.quantity}
          unit={convertingIngredient.measurement}
          onClose={() => setConvertingIndex(null)}
          onConvert={handleConvertIngredient}
        />
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { flex: 1, fontSize: 24, fontWeight: '800', color: '#115e59', marginRight: 12 },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  editBtn: { backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: '#0f766e', fontWeight: '700' },
  deleteBtn: { color: '#9f1239', fontWeight: '700' },
  imageWrap: { marginBottom: 14 },
  image: { width: '100%', height: 220, borderRadius: 14 },
  detailActions: { top: 10, right: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  servingsBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#e4d9c5', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  servingsBtnText: { fontSize: 18, color: '#115e59', lineHeight: 22 },
  servingsText: { fontWeight: '700', color: '#1f2421' },
  convertAllBtn: { alignSelf: 'flex-start', backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  convertAllText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  instructionsTitle: { marginBottom: 12 },
  sectionedGroup: { marginTop: 12 },
  sectionHeaderLabel: { fontWeight: '800', color: '#115e59', marginBottom: 6 },
  indentedList: { paddingLeft: 12 },
  stepRow: { flexDirection: 'row', marginBottom: 12, gap: 12 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f766e', color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 24, fontSize: 13 },
  stepMain: { flex: 1 },
  stepText: { color: '#1f2421', lineHeight: 22 },
  stepImage: { width: 160, height: 120, borderRadius: 10, marginTop: 8 },
  errorText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
  // modal
  modalPage: { flex: 1, backgroundColor: '#fff' },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, marginBottom: 20 },
  modalClose: { fontSize: 20, color: '#5e6a63', padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  fieldLabel: { fontWeight: '700', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  imagePicker: { width: '100%', height: 160, borderRadius: 14, backgroundColor: '#ffeecf', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  imagePickerText: { color: '#b45309', fontWeight: '700' },
  saveBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
