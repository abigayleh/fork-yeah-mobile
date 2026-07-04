import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../../contexts/AuthContext';
import UnitSelect from '../../../components/UnitSelect';

type Ingredient = { name: string; quantity: string; unit: string };
type FormData = {
  title: string;
  servings: string;
  ingredients: Ingredient[];
  steps: { value: string }[];
  ingredientName: string;
  ingredientQuantity: string;
  ingredientUnit: string;
  stepInput: string;
};

export default function AddRecipeScreen() {
  const { addMyRecipe } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      title: '',
      servings: '2',
      ingredients: [],
      steps: [],
      ingredientName: '',
      ingredientQuantity: '',
      ingredientUnit: 'cups',
      stepInput: '',
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({ control, name: 'ingredients' });
  const { fields: stepFields, append: appendStep, remove: removeStep } = useFieldArray({ control, name: 'steps' });

  const ingredientName = watch('ingredientName');
  const ingredientQuantity = watch('ingredientQuantity');
  const ingredientUnit = watch('ingredientUnit');
  const stepInput = watch('stepInput');

  const handleAddIngredient = () => {
    const qty = parseFloat(ingredientQuantity);
    if (!ingredientName.trim() || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid ingredient', 'Enter a name and a valid quantity.');
      return;
    }
    appendIngredient({ name: ingredientName.trim(), quantity: ingredientQuantity, unit: ingredientUnit });
    setValue('ingredientName', '');
    setValue('ingredientQuantity', '');
    setValue('ingredientUnit', 'cups');
  };

  const handleAddStep = () => {
    if (!stepInput.trim()) return;
    appendStep({ value: stepInput.trim() });
    setValue('stepInput', '');
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await addMyRecipe({
        name: data.title,
        servings: parseInt(data.servings, 10) || 2,
        imageUrl: '',
        ingredients: data.ingredients.map((i) => ({
          name: i.name,
          quantity: parseFloat(i.quantity) || 1,
          measurement: i.unit,
        })),
        steps: data.steps.map((s) => s.value),
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

      <Text style={styles.label}>Recipe Title</Text>
      <Controller control={control} name="title" render={({ field: { onChange, value } }) => (
        <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="Recipe title" />
      )} />

      <Text style={styles.label}>Servings</Text>
      <Controller control={control} name="servings" render={({ field: { onChange, value } }) => (
        <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="numeric" placeholder="2" />
      )} />

      <Text style={styles.sectionTitle}>Ingredients</Text>
      <View style={styles.addRow}>
        <Controller control={control} name="ingredientName" render={({ field: { onChange, value } }) => (
          <TextInput style={[styles.input, styles.flex2]} value={value} onChangeText={onChange} placeholder="Name" />
        )} />
        <Controller control={control} name="ingredientQuantity" render={({ field: { onChange, value } }) => (
          <TextInput style={[styles.input, styles.flex1]} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="Qty" />
        )} />
      </View>
      <UnitSelect value={ingredientUnit} onChange={(v) => setValue('ingredientUnit', v)} />
      <TouchableOpacity style={styles.addBtn} onPress={handleAddIngredient}>
        <Text style={styles.addBtnText}>Add Ingredient</Text>
      </TouchableOpacity>

      {ingredientFields.map((item, index) => (
        <View key={item.id} style={styles.listRow}>
          <Text style={styles.listRowText}>{item.quantity} {item.unit} {item.name}</Text>
          <TouchableOpacity onPress={() => removeIngredient(index)}>
            <Text style={styles.removeBtn}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Instructions</Text>
      <Controller control={control} name="stepInput" render={({ field: { onChange, value } }) => (
        <TextInput style={[styles.input, styles.textarea]} value={value} onChangeText={onChange} placeholder="Add a step..." multiline />
      )} />
      <TouchableOpacity style={styles.addBtn} onPress={handleAddStep}>
        <Text style={styles.addBtnText}>Add Step</Text>
      </TouchableOpacity>

      {stepFields.map((item, index) => (
        <View key={item.id} style={styles.listRow}>
          <Text style={styles.listRowText}>{index + 1}. {item.value}</Text>
          <TouchableOpacity onPress={() => removeStep(index)}>
            <Text style={styles.removeBtn}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSubmit(onSubmit)} disabled={saving}>
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
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 10 },
  addBtnText: { color: '#115e59', fontWeight: '700' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  listRowText: { flex: 1, color: '#1f2421' },
  removeBtn: { color: '#9f1239', fontWeight: '700', marginLeft: 8 },
  saveBtn: { backgroundColor: '#f97316', borderRadius: 999, padding: 14, alignItems: 'center', marginTop: 30 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
