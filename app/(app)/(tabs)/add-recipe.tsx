import { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useIngredientLinesEditor, hydrateIngredientLines } from '../../../hooks/useIngredientLinesEditor';
import { useStepsEditor } from '../../../hooks/useStepsEditor';
import { usePickImageBase64 } from '../../../hooks/usePickImageBase64';
import { authedFetch } from '../../../lib/authedFetch';
import IngredientLinesEditor from '../../../components/IngredientLinesEditor';
import StepsEditor from '../../../components/StepsEditor';

export default function AddRecipeScreen() {
  const { addMyRecipe } = useAuth();
  const router = useRouter();
  const { pickImage } = usePickImageBase64();
  const ingredientsEditor = useIngredientLinesEditor();
  const stepsEditor = useStepsEditor();

  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('2');
  const [cookTime, setCookTime] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handlePickImage = async () => {
    const image = await pickImage();
    if (image) setImageUrl(image);
  };

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url) { setImportError('Paste a recipe URL first.'); return; }
    setImporting(true);
    setImportError('');
    try {
      const res = await authedFetch('/api/recipeImport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Could not import recipe from that link.');

      if (payload.title?.trim()) setTitle(payload.title.trim());
      if (payload.imageUrl?.trim()) setImageUrl(payload.imageUrl.trim());
      if (Number.isFinite(payload.servings)) setServings(String(Math.max(1, Math.floor(Number(payload.servings)))));
      if (Number.isFinite(payload.cookTime)) setCookTime(String(Math.max(1, Math.round(Number(payload.cookTime)))));

      if (Array.isArray(payload.ingredients) && payload.ingredients.length > 0) {
        const mapped = payload.ingredients.map((i: { name?: string; quantity?: number; unit?: string }) => ({
          name: (i.name || '').trim(),
          quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
          measurement: i.unit?.trim() || 'whole',
        }));
        ingredientsEditor.resetLines(hydrateIngredientLines(mapped, payload.ingredientSections));
      }
      if (Array.isArray(payload.steps) && payload.steps.length > 0) {
        stepsEditor.resetSteps(
          payload.steps.map((s: { text?: string; imageUrl?: string }) => ({
            text: (s.text || '').trim(),
            ...(s.imageUrl ? { imageUrl: s.imageUrl } : {}),
          }))
        );
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not import recipe from that link.');
    } finally {
      setImporting(false);
    }
  };

  const onSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Enter a recipe title.');
      return;
    }

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
      await addMyRecipe({
        name: title.trim(),
        servings: parseInt(servings, 10) || 2,
        cookTime: parseInt(cookTime, 10) || null,
        imageUrl,
        ingredients: ingredientsResult.ingredients,
        ingredientSections: ingredientsResult.sections,
        steps: stepsResult.steps,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save recipe. Please try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Add Recipe</Text>

      <Text style={styles.label}>Import from a link</Text>
      <View style={styles.importRow}>
        <TextInput
          style={[styles.input, styles.importInput]}
          value={importUrl}
          onChangeText={setImportUrl}
          placeholder="Paste a recipe URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!importing}
        />
        <TouchableOpacity style={[styles.importBtn, importing && styles.saveBtnDisabled]} onPress={handleImport} disabled={importing}>
          <Text style={styles.importBtnText}>{importing ? '...' : 'Import'}</Text>
        </TouchableOpacity>
      </View>
      {importError ? <Text style={styles.importError}>{importError}</Text> : null}

      <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.imagePickerText}>+ Add Photo</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Recipe Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Recipe title" />

      <Text style={styles.label}>Servings</Text>
      <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="2" />

      <Text style={styles.label}>Cook time (minutes)</Text>
      <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholder="e.g. 30" />

      <Text style={styles.sectionTitle}>Ingredients</Text>
      <IngredientLinesEditor editor={ingredientsEditor} />

      <Text style={styles.sectionTitle}>Instructions</Text>
      <StepsEditor editor={stepsEditor} />

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSubmit} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Recipe'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59', marginBottom: 20, marginTop: 36 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 10, color: '#115e59' },
  label: { fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  importRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  importInput: { flex: 1, marginBottom: 0 },
  importBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  importBtnText: { color: '#fff', fontWeight: '700' },
  importError: { color: '#9f1239', fontSize: 13, marginBottom: 6 },
  imagePicker: { width: '100%', height: 160, borderRadius: 14, backgroundColor: '#ffeecf', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  imagePickerText: { color: '#b45309', fontWeight: '700' },
  image: { width: '100%', height: '100%' },
  saveBtn: { backgroundColor: '#f97316', borderRadius: 999, padding: 14, alignItems: 'center', marginTop: 30 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
