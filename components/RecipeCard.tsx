import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, FlatList, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';

type Props = {
  id: string;
  title: string;
  image: string;
  isMyRecipe: boolean;
  isFavorited?: boolean;
  isWantToTry?: boolean;
  onFavorite?: () => void;
  onWantToTry?: () => void;
};

type FolderItem = { id?: string; name: string };

export default function RecipeCard({ id, title, image, isMyRecipe, isFavorited, isWantToTry, onFavorite, onWantToTry }: Props) {
  const router = useRouter();
  const { getUserFolders, addRecipeToFolder, createUserFolder, promptLogin } = useAuth();

  const [folderOpen, setFolderOpen] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const requireAuth = (action: () => void) => {
    if (!auth.currentUser) {
      promptLogin();
      return;
    }
    action();
  };

  const openFolderModal = async () => {
    setFolderOpen(true);
    setLoadingFolders(true);
    try {
      const data = await getUserFolders();
      setFolders((data ?? []) as FolderItem[]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const saveToFolder = async (folder: FolderItem) => {
    if (!folder.id || savingId) return;
    setSavingId(folder.id);
    try {
      const result = await addRecipeToFolder(folder.id, { recipeId: id, isMyRecipe });
      if (result?.alreadyExists) {
        Alert.alert('Already in folder', 'This recipe is already in that folder.');
      } else {
        setFolderOpen(false);
      }
    } catch {
      Alert.alert('Error', 'Could not save to folder.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    const name = newFolderName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await createUserFolder(name);
      setFolders((prev) => [...prev, created as FolderItem]);
      setNewFolderName('');
    } catch {
      Alert.alert('Error', 'Could not create folder.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push((isMyRecipe ? `/(app)/my-recipe/${id}` : `/(app)/recipe/${id}`) as never)}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
      <Text style={styles.title} numberOfLines={2}>{title}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => requireAuth(() => onFavorite?.())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isFavorited ? 'bookmark' : 'bookmark-outline'} size={18} color={isFavorited ? '#0f766e' : '#9ca3af'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => requireAuth(() => onWantToTry?.())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isWantToTry ? 'heart' : 'heart-outline'} size={18} color={isWantToTry ? '#e11d48' : '#9ca3af'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => requireAuth(openFolderModal)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="folder-open-outline" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <Modal visible={folderOpen} transparent animationType="fade" onRequestClose={() => !savingId && setFolderOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !savingId && setFolderOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save to Folder</Text>

            {loadingFolders ? (
              <ActivityIndicator color="#0f766e" style={{ marginVertical: 16 }} />
            ) : (
              <FlatList
                data={folders}
                keyExtractor={(item, i) => item.id ?? String(i)}
                style={{ maxHeight: 220 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.folderRow} onPress={() => saveToFolder(item)} disabled={!!savingId}>
                    <Ionicons name="folder-outline" size={18} color="#0f766e" />
                    <Text style={styles.folderName}>{item.name}</Text>
                    {savingId === item.id && <ActivityIndicator size="small" color="#0f766e" />}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyFolders}>No folders yet — create one below.</Text>}
              />
            )}

            <View style={styles.createRow}>
              <TextInput
                style={styles.createInput}
                placeholder="New folder name..."
                value={newFolderName}
                onChangeText={setNewFolderName}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity
                style={[styles.createBtn, (!newFolderName.trim() || creating) && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!newFolderName.trim() || creating}
              >
                <Text style={styles.createBtnText}>{creating ? '...' : '+ New'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e4d9c5' },
  image: { width: '100%', height: 120 },
  imagePlaceholder: { width: '100%', height: 120, backgroundColor: '#ffeecf' },
  title: { padding: 8, paddingBottom: 4, fontWeight: '700', color: '#1f2421', fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f0ebe0' },
  actionBtn: { padding: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#115e59', marginBottom: 12 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0ebe0' },
  folderName: { flex: 1, fontWeight: '600', color: '#1f2421' },
  emptyFolders: { color: '#9ca3af', textAlign: 'center', marginVertical: 16 },
  createRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  createInput: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 8, padding: 10 },
  createBtn: { backgroundColor: '#0f766e', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700' },
});
