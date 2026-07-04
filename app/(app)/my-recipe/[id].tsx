import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import UnitSelect from '../../../components/UnitSelect';
import IngredientCheckbox from '../../../components/IngredientCheckbox';

type Ingredient = { name: string; quantity: number; measurement: string };
type Recipe = {
  id?: string;
  recipeId?: string;
  name: string;
  imageUrl?: string;
  servings?: number;
  ingredients?: Ingredient[];
  steps?: string[];
};

export default function MyRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getMyRecipeById, updateMyRecipe, deleteMyRecipe } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([]);
  const [editSteps, setEditSteps] = useState<string[]>([]);
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('cups');
  const [stepInput, setStepInput] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyRecipeById(String(id || ''));
        setRecipe(data as Recipe | null);
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
    setEditIngredients(Array.isArray(recipe.ingredients) ? recipe.ingredients : []);
    setEditSteps(Array.isArray(recipe.steps) ? [...recipe.steps] : []);
    setIngName(''); setIngQty(''); setIngUnit('cups'); setStepInput('');
    setEditOpen(true);
  };

  const addIngredient = () => {
    const qty = parseFloat(ingQty);
    if (!ingName.trim() || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid', 'Enter a name and valid quantity.');
      return;
    }
    setEditIngredients((prev) => [...prev, { name: ingName.trim(), quantity: qty, measurement: ingUnit }]);
    setIngName(''); setIngQty(''); setIngUnit('cups');
  };

  const removeIngredient = (i: number) => setEditIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const addStep = () => {
    if (!stepInput.trim()) return;
    setEditSteps((prev) => [...prev, stepInput.trim()]);
    setStepInput('');
  };

  const removeStep = (i: number) => setEditSteps((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const recipeId = recipe?.recipeId ?? recipe?.id ?? String(id);
    if (!recipeId) return;
    setSaving(true);
    try {
      await updateMyRecipe(recipeId, { name: editTitle.trim(), imageUrl: editImageUrl, ingredients: editIngredients, steps: editSteps });
      setRecipe((prev) => prev ? { ...prev, name: editTitle.trim(), imageUrl: editImageUrl, ingredients: editIngredients, steps: editSteps } : prev);
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
  const getAdjustedQty = (ing: Ingredient) => Math.round(ing.quantity * servingsRatio * 100) / 100;

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
        <Image source={{ uri: recipe.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}

      {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
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
          {recipe.ingredients.map((ing, i) => (
            <IngredientCheckbox key={i} label={`${getAdjustedQty(ing)} ${ing.measurement} ${ing.name}`} />
          ))}
        </View>
      )}

      {Array.isArray(recipe.steps) && recipe.steps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
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

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Recipe title" />

          <Text style={styles.fieldLabel}>Image URL</Text>
          <TextInput style={styles.input} value={editImageUrl} onChangeText={setEditImageUrl} placeholder="https://..." autoCapitalize="none" />

          <Text style={styles.fieldLabel}>Ingredients</Text>
          <View style={styles.addIngRow}>
            <TextInput style={[styles.input, { flex: 2 }]} value={ingName} onChangeText={setIngName} placeholder="Name" />
            <TextInput style={[styles.input, { flex: 1 }]} value={ingQty} onChangeText={setIngQty} keyboardType="decimal-pad" placeholder="Qty" />
          </View>
          <UnitSelect value={ingUnit} onChange={setIngUnit} />
          <TouchableOpacity style={styles.addBtn} onPress={addIngredient}>
            <Text style={styles.addBtnText}>Add Ingredient</Text>
          </TouchableOpacity>
          {editIngredients.map((ing, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.listRowText}>{ing.quantity} {ing.measurement} {ing.name}</Text>
              <TouchableOpacity onPress={() => removeIngredient(i)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.fieldLabel}>Steps</Text>
          <TextInput style={[styles.input, styles.textarea]} value={stepInput} onChangeText={setStepInput} placeholder="Add a step..." multiline />
          <TouchableOpacity style={styles.addBtn} onPress={addStep}>
            <Text style={styles.addBtnText}>Add Step</Text>
          </TouchableOpacity>
          {editSteps.map((step, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.listRowText}>{i + 1}. {step}</Text>
              <TouchableOpacity onPress={() => removeStep(i)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
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
  image: { width: '100%', height: 220, borderRadius: 14, marginBottom: 14 },
  meta: { color: '#5e6a63', fontWeight: '600', marginBottom: 16 },
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
  // modal
  modalPage: { flex: 1, backgroundColor: '#fff' },
  modalContent: { padding: 20, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, marginBottom: 20 },
  modalClose: { fontSize: 20, color: '#5e6a63', padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  fieldLabel: { fontWeight: '700', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  addIngRow: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 10 },
  addBtnText: { color: '#115e59', fontWeight: '700' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  listRowText: { flex: 1, color: '#1f2421' },
  removeBtn: { color: '#9f1239', fontWeight: '700', marginLeft: 8 },
  saveBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
