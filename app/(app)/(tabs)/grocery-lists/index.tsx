import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../../lib/firebase';
import { fetchDocsForFamily, withCurrentUser } from '../../../../lib/familyData';
import { useAuth } from '../../../../contexts/AuthContext';
import GroceryListCard from '../../../../components/GroceryListCard';
import NamePromptModal from '../../../../components/NamePromptModal';
import type { GroceryItem } from '../../../../hooks/useGroceryItemsEditor';

type GroceryList = { id: string; name: string; items: GroceryItem[] };

export default function GroceryListsScreen() {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingList, setRenamingList] = useState<GroceryList | null>(null);
  const { getFamilyUserIdsForCurrentUser } = useAuth();

  const loadLists = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const familyUserIds = withCurrentUser(user.uid, await getFamilyUserIdsForCurrentUser());
      const docs = await fetchDocsForFamily('groceryLists', familyUserIds);
      setLists(docs.map((data) => ({
        id: data.id as string,
        name: (data.name as string) ?? '',
        items: Array.isArray(data.items) ? (data.items as GroceryItem[]) : [],
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLists(); }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (name: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setCreateOpen(false);
    const ref = await addDoc(collection(db, 'groceryLists'), { name, userId: user.uid, items: [] });
    setLists((prev) => [...prev, { id: ref.id, name, items: [] }]);
    setExpandedIds((prev) => new Set(prev).add(ref.id));
  };

  const handleRename = async (name: string) => {
    if (!renamingList) return;
    await setDoc(doc(db, 'groceryLists', renamingList.id), { name }, { merge: true });
    setLists((prev) => prev.map((l) => (l.id === renamingList.id ? { ...l, name } : l)));
    setRenamingList(null);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'groceryLists', id));
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSaveItems = async (id: string, items: GroceryItem[]) => {
    await setDoc(doc(db, 'groceryLists', id), { items }, { merge: true });
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, items } : l)));
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
