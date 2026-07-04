import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

type GroceryItem = { name: string; checked: boolean };

export default function GroceryListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [listName, setListName] = useState('Grocery List');
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, 'groceryLists', id));
      if (snap.exists()) {
        const data = snap.data();
        setListName(data.name ?? 'Grocery List');
        setItems(Array.isArray(data.items) ? data.items : []);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const persist = async (nextItems: GroceryItem[]) => {
    if (!id) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'groceryLists', id), { items: nextItems }, { merge: true });
      setItems(nextItems);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (index: number) => {
    const next = items.map((item, i) => i === index ? { ...item, checked: !item.checked } : item);
    persist(next);
  };

  const handleAddItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    persist([...items, { name: trimmed, checked: false }]);
    setNewItem('');
  };

  const handleDelete = (index: number) => {
    if (items.length <= 1) { Alert.alert('Cannot delete', 'A list must have at least one item.'); return; }
    persist(items.filter((_, i) => i !== index));
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>{listName}</Text>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add item..."
          onSubmitEditing={handleAddItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => handleToggle(index)} style={styles.checkbox}>
              <Text style={styles.checkboxText}>{item.checked ? '☑' : '☐'}</Text>
            </TouchableOpacity>
            <Text style={[styles.itemName, item.checked && styles.itemChecked]}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(index)} disabled={saving}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  loader: { flex: 1 },
  header: { padding: 16, paddingTop: 56 },
  backBtn: { color: '#0f766e', fontWeight: '700', marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: '800', color: '#115e59' },
  addRow: { flexDirection: 'row', padding: 16, gap: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  addBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  checkbox: { marginRight: 12 },
  checkboxText: { fontSize: 20, color: '#0f766e' },
  itemName: { flex: 1, fontSize: 16, color: '#1f2421' },
  itemChecked: { textDecorationLine: 'line-through', color: '#5e6a63' },
  deleteBtn: { color: '#9f1239', fontWeight: '700', paddingHorizontal: 8 },
});
