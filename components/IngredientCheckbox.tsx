import { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function IngredientCheckbox({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);

  return (
    <TouchableOpacity style={styles.row} onPress={() => setChecked((c) => !c)}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? '#0f766e' : '#9ca3af'} />
      <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  label: { flex: 1, color: '#1f2421', lineHeight: 22 },
  labelChecked: { color: '#9ca3af', textDecorationLine: 'line-through' },
});
