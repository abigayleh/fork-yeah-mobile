import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useAuth } from '../../../contexts/AuthContext';
import RecipeCard from '../../../components/RecipeCard';
import { useSavedRecipesBrowser, FolderItem } from '../../../hooks/useSavedRecipesBrowser';

export default function SavedRecipesScreen() {
  const { createUserFolder, reorderUserFolders, logOut } = useAuth();
  const {
    section, setSection, search, setSearch,
    favoritedIds, wantToTryIds,
    folders, setFolders, activeFolderId, selectFolder,
    loading, loadingFolder, displayRecipes, selectedFolder,
    toggleFavorite, toggleWantToTry,
  } = useSavedRecipesBrowser();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    try {
      const created = await createUserFolder(name);
      setFolders((prev) => [...prev, created as FolderItem]);
      setNewFolderName('');
      setCreateModalOpen(false);
    } catch {
      Alert.alert('Error', 'Could not create folder.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderReorder = ({ data }: { data: FolderItem[] }) => {
    setFolders(data);
    reorderUserFolders(data.map((f) => f.id ?? '').filter(Boolean)).catch(() => {});
  };

  const sections: { key: typeof section; label: string }[] = [
    { key: 'myRecipes', label: 'My Recipes' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'wantToTry', label: 'Want to Try' },
  ];

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Saved Recipes</Text>
        <TouchableOpacity onPress={logOut}>
          <Text style={styles.logoutBtn}>Log out</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by recipe or ingredient..."
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      <View style={styles.tabs}>
        {sections.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, section === key && !activeFolderId && styles.tabActive]}
            onPress={() => setSection(key)}
          >
            <Text style={[styles.tabText, section === key && !activeFolderId && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.folderRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setNewFolderName(''); setCreateModalOpen(true); }}>
          <Ionicons name="add" size={20} color="#0f766e" />
        </TouchableOpacity>
        <DraggableFlatList
          data={folders}
          keyExtractor={(item, i) => item.id ?? String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.folderScroll}
          onDragEnd={handleFolderReorder}
          renderItem={({ item, drag, isActive }: RenderItemParams<FolderItem>) => {
            const selected = activeFolderId === item.id;
            return (
              <TouchableOpacity
                style={[styles.chip, selected && styles.chipActive, isActive && styles.chipDragging]}
                onPress={() => selectFolder(item)}
                onLongPress={drag}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading || loadingFolder ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
      ) : (
        <FlatList
          data={displayRecipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.cardRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={selectedFolder ? <Text style={styles.folderTitle}>{selectedFolder.name}</Text> : null}
          renderItem={({ item }) => (
            <RecipeCard
              id={item.id}
              title={item.title}
              image={item.image}
              isMyRecipe={item.isMyRecipe}
              isFavorited={favoritedIds.has(item.id)}
              isWantToTry={wantToTryIds.has(item.id)}
              onFavorite={() => toggleFavorite(item)}
              onWantToTry={() => toggleWantToTry(item)}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes here yet.</Text>}
        />
      )}

      <Modal visible={createModalOpen} transparent animationType="fade" onRequestClose={() => !creatingFolder && setCreateModalOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !creatingFolder && setCreateModalOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name..."
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!newFolderName.trim() || creatingFolder) && { opacity: 0.5 }]}
              onPress={handleCreateFolder}
              disabled={!newFolderName.trim() || creatingFolder}
            >
              <Text style={styles.modalBtnText}>{creatingFolder ? 'Creating...' : 'Create Folder'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59' },
  logoutBtn: { color: '#9f1239', fontWeight: '700' },
  searchInput: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e4d9c5', alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  tabText: { fontWeight: '700', color: '#5e6a63', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  folderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 16 },
  folderScroll: { paddingRight: 16, gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e4d9c5', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipDragging: { opacity: 0.7, transform: [{ scale: 1.05 }] },
  chipText: { fontWeight: '700', color: '#5e6a63', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  addBtn: { paddingRight: 12 },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  cardRow: { gap: 12, marginBottom: 12 },
  folderTitle: { fontSize: 15, fontWeight: '700', color: '#115e59', marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#115e59', marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, marginBottom: 14 },
  modalBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
