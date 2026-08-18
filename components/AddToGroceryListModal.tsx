import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { fetchDocsForFamily, withCurrentUser } from '../lib/familyData';
import { useAuth } from '../contexts/AuthContext';
import type { GroceryItem } from '../hooks/useGroceryItemsEditor';

type GList = { id: string; name: string; items: GroceryItem[] };

type Props = { visible: boolean; onClose: () => void; lines: string[] };

// Turns a recipe's ingredient lines into grocery items and adds them to a chosen
// list (deduping by name), or into a brand-new list.
export default function AddToGroceryListModal({ visible, onClose, lines }: Props) {
  const { getFamilyUserIdsForCurrentUser } = useAuth();
  const [lists, setLists] = useState<GList[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const cleanLines = Array.from(new Set(lines.map((l) => l.trim()).filter(Boolean)));

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setCreating(false);
    setNewName('');
    setLoading(true);
    try {
      const ids = withCurrentUser(user.uid, await getFamilyUserIdsForCurrentUser());
      const docs = await fetchDocsForFamily('groceryLists', ids);
      setLists(docs.map((d) => ({
        id: d.id as string,
        name: (d.name as string) ?? '',
        items: Array.isArray(d.items) ? (d.items as GroceryItem[]) : [],
      })));
    } finally {
      setLoading(false);
    }
  };

  const finish = (count: number) => {
    onClose();
    Alert.alert('Added to grocery list', `${count} item${count === 1 ? '' : 's'} added.`);
  };

  const addToList = async (list: GList) => {
    setBusyId(list.id);
    try {
      const existing = new Set(list.items.map((i) => String(i.name || '').trim().toLowerCase()));
      const additions = cleanLines
        .filter((l) => !existing.has(l.toLowerCase()))
        .map((name) => ({ name, checked: false }));
      await setDoc(doc(db, 'groceryLists', list.id), { items: [...list.items, ...additions] }, { merge: true });
      finish(additions.length);
    } catch {
      Alert.alert('Error', 'Could not update the list.');
    } finally {
      setBusyId(null);
    }
  };

  const createWithItems = async () => {
    const user = auth.currentUser;
    const name = newName.trim();
    if (!user || !name) return;
    setBusyId('__new__');
    try {
      const items = cleanLines.map((n) => ({ name: n, checked: false }));
      await addDoc(collection(db, 'groceryLists'), { name, userId: user.uid, items });
      finish(items.length);
    } catch {
      Alert.alert('Error', 'Could not create the list.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={load}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Add to grocery list</Text>
          <Text style={styles.subtitle}>{cleanLines.length} ingredient{cleanLines.length === 1 ? '' : 's'}</Text>

          {loading ? (
            <ActivityIndicator color="#0f766e" style={{ marginVertical: 24 }} />
          ) : creating ? (
            <View style={styles.createBox}>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="List name"
                placeholderTextColor="#9ca3af"
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity onPress={() => setCreating(false)} disabled={busyId === '__new__'}>
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtn, (!newName.trim() || busyId === '__new__') && { opacity: 0.5 }]}
                  onPress={createWithItems}
                  disabled={!newName.trim() || busyId === '__new__'}
                >
                  {busyId === '__new__' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 280 }}>
              {lists.map((list) => (
                <TouchableOpacity key={list.id} style={styles.row} onPress={() => addToList(list)} disabled={!!busyId}>
                  <Text style={styles.rowName}>{list.name || 'Untitled list'}</Text>
                  {busyId === list.id
                    ? <ActivityIndicator size="small" color="#0f766e" />
                    : <Text style={styles.rowCount}>{list.items.length}</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.newRow} onPress={() => setCreating(true)} disabled={!!busyId}>
                <Text style={styles.newText}>+ New list</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 420 },
  title: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  subtitle: { color: '#5e6a63', fontSize: 13, marginTop: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  rowName: { flex: 1, fontWeight: '600', color: '#1f2421' },
  rowCount: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  newRow: { paddingVertical: 14 },
  newText: { color: '#0f766e', fontWeight: '700' },
  createBox: { paddingVertical: 8 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, marginBottom: 14 },
  createActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: '#5e6a63', fontWeight: '700', paddingVertical: 10, paddingHorizontal: 6 },
  createBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
  createBtnText: { color: '#fff', fontWeight: '700' },
  cancel: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: '#5e6a63', fontWeight: '700' },
});
