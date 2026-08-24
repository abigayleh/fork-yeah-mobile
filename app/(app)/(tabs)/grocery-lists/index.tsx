import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { auth } from '../../../../lib/firebase';
import {
  createGroceryList, deleteGroceryList, fetchGroceryLists,
  renameGroceryList, saveGroceryItems, type GroceryList,
} from '../../../../lib/groceryApi';
import GroceryListCard from '../../../../components/GroceryListCard';
import NamePromptModal from '../../../../components/NamePromptModal';
import type { GroceryItem } from '../../../../hooks/useGroceryItemsEditor';
import { writeGrocerySnapshot } from '../../../../lib/widgetSnapshot';

export default function GroceryListsScreen() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingList, setRenamingList] = useState<GroceryList | null>(null);
  const [pendingAddId, setPendingAddId] = useState<string | null>(null);
  const { list: listParam, add } = useLocalSearchParams<{ list?: string; add?: string }>();

  const loadLists = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      setLists(await fetchGroceryLists());
    } catch {
      Alert.alert('Error', 'Could not load your grocery lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLists(); }, []);

  useEffect(() => { if (!loading) writeGrocerySnapshot(lists); }, [lists, loading]);

  // Arriving from a widget: open the list it was showing, and its quick-add sheet.
  useEffect(() => {
    if (loading || !listParam || !lists.some((l) => l.id === listParam)) return;
    setExpandedIds((prev) => new Set(prev).add(listParam));
    if (add === '1') setPendingAddId(listParam);
    router.setParams({ list: undefined, add: undefined });
  }, [loading, listParam, add, lists]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (name: string) => {
    if (!auth.currentUser) return;
    setCreateOpen(false);
    try {
      const created = await createGroceryList(name);
      setLists((prev) => [...prev, created]);
      setExpandedIds((prev) => new Set(prev).add(created.id));
    } catch {
      Alert.alert('Error', 'Could not create the list.');
    }
  };

  const handleRename = async (name: string) => {
    if (!renamingList) return;
    const { id } = renamingList;
    setRenamingList(null);
    try {
      await renameGroceryList(id, name);
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    } catch {
      Alert.alert('Error', 'Could not rename the list.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGroceryList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete the list.');
    }
  };

  const handleSaveItems = async (id: string, items: GroceryItem[]) => {
    try {
      const saved = await saveGroceryItems(id, items);
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, items: saved } : l)));
    } catch {
      Alert.alert('Error', 'Could not save the list.');
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Grocery Lists</Text>
        <TouchableOpacity testID="grocery-new-list" style={styles.createBtn} onPress={() => setCreateOpen(true)}>
          <Text style={styles.createBtnText}>+ New List</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {lists.length === 0 ? (
            <Text style={styles.emptyText}>No grocery lists yet. Create one!</Text>
          ) : (
            lists.map((item) => (
              <GroceryListCard
                key={item.id}
                list={item}
                expanded={expandedIds.has(item.id)}
                onToggleExpand={() => toggleExpanded(item.id)}
                onRenameList={() => setRenamingList(item)}
                onDeleteList={() => handleDelete(item.id)}
                onSaveItems={(items) => handleSaveItems(item.id, items)}
                requestQuickAdd={pendingAddId === item.id}
                onQuickAddOpened={() => setPendingAddId(null)}
              />
            ))
          )}
        </ScrollView>
      )}

      <NamePromptModal
        visible={createOpen}
        title="New Grocery List"
        placeholder="e.g. Weekly Groceries"
        confirmLabel="Create"
        onCancel={() => setCreateOpen(false)}
        onConfirm={handleCreate}
      />

      <NamePromptModal
        visible={!!renamingList}
        title="Rename Grocery List"
        initialValue={renamingList?.name}
        confirmLabel="Rename"
        onCancel={() => setRenamingList(null)}
        onConfirm={handleRename}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59' },
  createBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontWeight: '700' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
});
