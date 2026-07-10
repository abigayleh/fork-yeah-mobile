import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import EditableLinesList from './EditableLinesList';
import type { IngredientLine, IngredientLinesEditorState } from '../hooks/useIngredientLinesEditor';

interface Props {
  editor: IngredientLinesEditorState;
}

export default function IngredientLinesEditor({ editor }: Props) {
  const { lines, updateLine, removeLine, splitLine, deleteAtStart, reorderLines, pendingFocus, clearPendingFocus, errors, addSectionHeader } =
    editor;

  return (
    <>
      <EditableLinesList<IngredientLine>
        lines={lines}
        errors={errors}
        pendingFocus={pendingFocus}
        clearPendingFocus={clearPendingFocus}
        onUpdateText={updateLine}
        onRemove={removeLine}
        onSplit={splitLine}
        onDeleteAtStart={deleteAtStart}
        onReorder={reorderLines}
        placeholder={(line) => (line.isHeader ? 'Section title (e.g. Cake)' : 'e.g. 1/2 cup flour')}
        removeLabel={(line) => (line.isHeader ? 'Remove section' : 'Remove ingredient')}
        renderPrefix={(line) => (line.isHeader ? null : <Text style={styles.bullet}>•</Text>)}
      />
      <TouchableOpacity style={styles.addSectionBtn} onPress={addSectionHeader}>
        <Text style={styles.addSectionText}>+ Add Section</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  bullet: { color: '#9ca3af', paddingTop: 10, paddingHorizontal: 4 },
  addSectionBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  addSectionText: { color: '#0f766e', fontWeight: '700' },
});
