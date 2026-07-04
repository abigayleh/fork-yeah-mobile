import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { useState } from 'react';

const UNITS = ['cups', 'tablespoons', 'teaspoons', 'grams', 'ml', 'liters', 'oz', 'lbs', 'whole'];

type Props = {
  value: string;
  onChange: (unit: string) => void;
};

export default function UnitSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{value}</Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <FlatList
              data={UNITS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.optionActive]}
                  onPress={() => { onChange(item); setOpen(false); }}
                >
                  <Text style={[styles.optionText, item === value && styles.optionTextActive]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  triggerText: { color: '#1f2421', flex: 1 },
  arrow: { color: '#5e6a63' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#fff', borderRadius: 12, width: 220, maxHeight: 320, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  option: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionActive: { backgroundColor: '#ecfdf5' },
  optionText: { color: '#1f2421' },
  optionTextActive: { color: '#0f766e', fontWeight: '700' },
});
