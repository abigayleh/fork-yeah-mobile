import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { auth, db } from '../../../../lib/firebase';

type GroceryList = { id: string; name: string; items: { name: string; checked: boolean }[] };

export default function GroceryListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLists = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'groceryLists'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroceryList)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLists(); }, []);

  const handleCreate = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = await addDoc(collection(db, 'groceryLists'), {
        name: `List ${Date.now()}`,
        userId: user.uid,
        items: [],
      });
      router.push(`/(app)/grocery-lists/${ref.id}`);
    } catch {
      Alert.alert('Error', 'Could not create grocery list.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete List', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'groceryLists', id));
          setLists((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Grocery Lists</Text>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
          <Text style={styles.createBtnText}>+ New List</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.listItem} onPress={() => router.push(`/(app)/grocery-lists/${item.id}`)}>
              <Text style={styles.listName}>{item.name}</Text>
              <Text style={styles.listMeta}>{item.items?.length ?? 0} items</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteBtn}>Delete</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No grocery lists yet. Create one!</Text>}
        />
      )}
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
  listItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e4d9c5' },
  listName: { flex: 1, fontWeight: '700', color: '#1f2421', fontSize: 16 },
  listMeta: { color: '#5e6a63', marginRight: 12 },
  deleteBtn: { color: '#9f1239', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
});
