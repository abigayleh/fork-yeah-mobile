import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import EditableLinesList from './EditableLinesList';
import { useGroceryItemsEditor, type GroceryItem, type GroceryItemLine } from '../hooks/useGroceryItemsEditor';
import { sortGroceryByCategory } from '../lib/groceryCategories';

type GroceryList = { id: string; name: string; items: GroceryItem[] };

type Props = {
  list: GroceryList;
  expanded: boolean;
  onToggleExpand: () => void;
  onRenameList: () => void;
  onDeleteList: () => void;
  onSaveItems: (items: GroceryItem[]) => void;
};

export default function GroceryListCard({ list, expanded, onToggleExpand, onRenameList, onDeleteList, onSaveItems }: Props) {
  const editor = useGroceryItemsEditor(list.items);
  const isFirstRender = useRef(true);

  // Autosaves on a short debounce rather than every keystroke, since this list
  // persists on every change instead of behind an explicit "save" button.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeout = setTimeout(() => onSaveItems(editor.toGroceryItems()), 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.items]);

  const itemCount = editor.items.filter((item) => item.text.trim()).length;

  const handleAutoSort = () => {
    editor.resetLines(sortGroceryByCategory(editor.items, (line) => line.text));
  };

  return (
    <View style={styles.card}>
      <Swipeable
        renderRightActions={() => (
          <TouchableOpacity style={styles.deleteAction} onPress={onDeleteList} accessibilityLabel={`Delete ${list.name}`}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      >
        <TouchableOpacity style={styles.headerRow} onPress={onToggleExpand} onLongPress={onRenameList}>
          <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color="#0f766e" />
          <View style={styles.headerText}>
            <Text style={styles.listName}>{list.name}</Text>
            <Text style={styles.itemCount}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>

      {expanded && itemCount > 1 ? (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.sortBtn} onPress={handleAutoSort}>
            <Ionicons name="funnel-outline" size={14} color="#0f766e" />
            <Text style={styles.sortText}>Auto sort</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {expanded && (
        <EditableLinesList<GroceryItemLine>
          lines={editor.items}
          errors={{}}
          pendingFocus={editor.pendingFocus}
          clearPendingFocus={editor.clearPendingFocus}
          onUpdateText={editor.updateItemText}
          onRemove={editor.removeLine}
          onSplit={editor.splitLine}
          onDeleteAtStart={editor.deleteAtStart}
          onReorder={editor.reorderLines}
          placeholder={() => 'Add an item...'}
          removeLabel={() => 'Remove item'}
          textStyle={(line) => (line.checked ? styles.checkedText : undefined)}
          renderPrefix={(line, index) => (
            <TouchableOpacity onPress={() => editor.toggleItemChecked(index)} style={styles.checkbox}>
              <Ionicons name={line.checked ? 'checkbox' : 'square-outline'} size={20} color={line.checked ? '#0f766e' : '#9ca3af'} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e4d9c5', overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#fff' },
  headerText: { flex: 1 },
  listName: { fontWeight: '700', color: '#1f2421', fontSize: 16 },
  itemCount: { color: '#5e6a63', fontSize: 13, marginTop: 2 },
  deleteAction: { backgroundColor: '#9f1239', width: 56, alignItems: 'center', justifyContent: 'center' },
  checkbox: { paddingTop: 8, paddingHorizontal: 4 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingTop: 4 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 6 },
  sortText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  checkedText: { textDecorationLine: 'line-through', color: '#9ca3af' },
});
