import { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useIngredientLinesEditor } from '../../../hooks/useIngredientLinesEditor';
import { useStepsEditor } from '../../../hooks/useStepsEditor';
import { usePickImageBase64 } from '../../../hooks/usePickImageBase64';
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
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickImage = async () => {
    const image = await pickImage();
    if (image) setImageUrl(image);
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
  imagePicker: { width: '100%', height: 160, borderRadius: 14, backgroundColor: '#ffeecf', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  imagePickerText: { color: '#b45309', fontWeight: '700' },
  image: { width: '100%', height: '100%' },
  saveBtn: { backgroundColor: '#f97316', borderRadius: 999, padding: 14, alignItems: 'center', marginTop: 30 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
