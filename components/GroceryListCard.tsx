import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import EditableLinesList from './EditableLinesList';
import QuickAddModal from './QuickAddModal';
import { useGroceryItemsEditor, hydrateGroceryItems, type GroceryItem, type GroceryItemLine } from '../hooks/useGroceryItemsEditor';
import { sortGroceryByCategory } from '../lib/groceryCategories';

type GroceryList = { id: string; name: string; items: GroceryItem[] };

type Props = {
  list: GroceryList;
  expanded: boolean;
  onToggleExpand: () => void;
  onRenameList: () => void;
  onDeleteList: () => void;
  onSaveItems: (items: GroceryItem[]) => void;
  requestQuickAdd?: boolean;
  onQuickAddOpened?: () => void;
};

export default function GroceryListCard({
  list, expanded, onToggleExpand, onRenameList, onDeleteList, onSaveItems,
  requestQuickAdd, onQuickAddOpened,
}: Props) {
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

  const [quickOpen, setQuickOpen] = useState(false);

  // The widget's "Add an item" deep link lands here.
  useEffect(() => {
    if (!requestQuickAdd) return;
    setQuickOpen(true);
    onQuickAddOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestQuickAdd]);

  const handleAutoSort = () => {
    editor.resetLines(sortGroceryByCategory(editor.items, (line) => line.text));
  };

  const handleQuickAdd = (names: string[]) => {
    const existing = new Set(editor.items.map((l) => l.text.trim().toLowerCase()));
    const additions = names
      .filter((n) => n.trim() && !existing.has(n.trim().toLowerCase()))
      .map((n) => ({ name: n.trim(), checked: false }));
    if (!additions.length) return;
    editor.resetLines([...editor.items.filter((l) => l.text.trim()), ...hydrateGroceryItems(additions)]);
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

      {expanded ? (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setQuickOpen(true)}>
            <Ionicons name="add-circle-outline" size={14} color="#0f766e" />
            <Text style={styles.sortText}>Quick add</Text>
          </TouchableOpacity>
          {itemCount > 1 ? (
            <TouchableOpacity style={styles.sortBtn} onPress={handleAutoSort}>
              <Ionicons name="funnel-outline" size={14} color="#0f766e" />
              <Text style={styles.sortText}>Auto sort</Text>
            </TouchableOpacity>
          ) : null}
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
          showDragHandle={false}
          deleteOnSwipe
          // Checking an item is how you get rid of it — the tap removes the line outright.
          renderPrefix={(line, index, _indented, drag) => (
            <TouchableOpacity onPress={() => editor.removeLine(index)} onLongPress={drag} style={styles.checkbox} hitSlop={8}>
              <Ionicons name={line.checked ? 'checkbox' : 'square-outline'} size={17} color="#0f766e" />
            </TouchableOpacity>
          )}
        />
      )}

      <QuickAddModal visible={quickOpen} onClose={() => setQuickOpen(false)} onAddItems={handleQuickAdd} />
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
  // paddingTop centres the box on the first line of item text; paddingLeft lines it
  // up with the card header's chevron.
  checkbox: { paddingTop: 9, paddingLeft: 16, paddingRight: 2 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 14, paddingTop: 4 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 6 },
  sortText: { color: '#0f766e', fontWeight: '700', fontSize: 13 },
  checkedText: { textDecorationLine: 'line-through', color: '#9ca3af' },
});
