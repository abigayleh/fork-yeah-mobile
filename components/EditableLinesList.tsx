import { useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextStyle, TextInputSelectionChangeEvent, TextInputKeyPressEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { EditableLineBase, PendingFocus } from '../hooks/useEditableLines';

interface EditableLinesListProps<TLine extends EditableLineBase> {
  lines: TLine[];
  errors: Record<number, string>;
  pendingFocus: PendingFocus | null;
  clearPendingFocus: () => void;
  onUpdateText: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onSplit: (index: number, selectionStart: number, selectionEnd: number) => void;
  onDeleteAtStart: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  placeholder: (line: TLine, indented: boolean) => string;
  renderPrefix: (line: TLine, index: number, indented: boolean, drag: () => void) => React.ReactNode;
  renderExtra?: (line: TLine, index: number) => React.ReactNode;
  removeLabel: (line: TLine) => string;
  textStyle?: (line: TLine) => TextStyle | undefined;
  // Off means the row has no visible handle and drag starts from the prefix instead.
  showDragHandle?: boolean;
  // On means a full right-swipe removes the line instead of parking on a delete button.
  deleteOnSwipe?: boolean;
}

// Everything following a header is indented until the next one.
function getIndentFlags<TLine extends EditableLineBase>(lines: TLine[]): boolean[] {
  let indented = false;
  return lines.map((line) => {
    if (line.isHeader) {
      indented = true;
      return false;
    }
    return indented;
  });
}

export default function EditableLinesList<TLine extends EditableLineBase>({
  lines,
  errors,
  pendingFocus,
  clearPendingFocus,
  onUpdateText,
  onRemove,
  onSplit,
  onDeleteAtStart,
  onReorder,
  placeholder,
  renderPrefix,
  renderExtra,
  removeLabel,
  textStyle,
  showDragHandle = true,
  deleteOnSwipe = false,
}: EditableLinesListProps<TLine>) {
  const inputRefs = useRef<Map<string, TextInput>>(new Map());
  const selections = useRef<Map<string, { start: number; end: number }>>(new Map());
  const indentFlags = getIndentFlags(lines);

  useEffect(() => {
    if (!pendingFocus) return;
    const line = lines[pendingFocus.index];
    const el = line ? inputRefs.current.get(line.id) : null;
    if (!el) return;
    el.focus();
    el.setSelection(pendingFocus.caret, pendingFocus.caret);
    clearPendingFocus();
  }, [pendingFocus, clearPendingFocus, lines]);

  return (
    <DraggableFlatList
      data={lines}
      keyExtractor={(line) => line.id}
      scrollEnabled={false}
      activationDistance={12}
      onDragEnd={({ from, to }) => onReorder(from, to)}
      renderItem={({ item: line, getIndex, drag, isActive }: RenderItemParams<TLine>) => {
        const index = getIndex();
        if (index == null) return null;
        const indented = indentFlags[index];

        return (
          <Swipeable
            rightThreshold={deleteOnSwipe ? 80 : undefined}
            onSwipeableWillOpen={deleteOnSwipe ? (direction) => direction === 'right' && onRemove(index) : undefined}
            renderRightActions={() => (
              <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => onRemove(index)}
                accessibilityLabel={removeLabel(line)}
              >
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          >
            <View
              style={[
                styles.row,
                indented && styles.rowIndented,
                isActive && styles.rowActive,
              ]}
            >
              {showDragHandle ? (
                <TouchableOpacity onLongPress={drag} style={styles.dragHandle} accessibilityLabel="Drag to reorder">
                  <Ionicons name="reorder-three-outline" size={20} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
              {renderPrefix(line, index, indented, drag)}
              <View style={styles.mainColumn}>
                <TextInput
                  ref={(el) => {
                    if (el) inputRefs.current.set(line.id, el);
                    else inputRefs.current.delete(line.id);
                  }}
                  style={[
                    styles.input,
                    line.isHeader && styles.inputHeader,
                    errors[index] && styles.inputError,
                    textStyle?.(line),
                  ]}
                  value={line.text}
                  placeholder={placeholder(line, indented)}
                  onChangeText={(text) => onUpdateText(index, text)}
                  onSelectionChange={(e: TextInputSelectionChangeEvent) => {
                    selections.current.set(line.id, e.nativeEvent.selection);
                  }}
                  onSubmitEditing={() => {
                    const sel = selections.current.get(line.id) ?? { start: line.text.length, end: line.text.length };
                    onSplit(index, sel.start, sel.end);
                  }}
                  onKeyPress={(e: TextInputKeyPressEvent) => {
                    if (e.nativeEvent.key !== 'Backspace') return;
                    const sel = selections.current.get(line.id) ?? { start: 0, end: 0 };
                    if (sel.start === 0 && sel.end === 0) onDeleteAtStart(index);
                  }}
                  returnKeyType="next"
                  submitBehavior="submit"
                />
                {errors[index] && <Text style={styles.errorText}>{errors[index]}</Text>}
                {renderExtra?.(line, index)}
              </View>
            </View>
          </Swipeable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, backgroundColor: '#fff' },
  rowIndented: { paddingLeft: 24 },
  rowActive: { backgroundColor: '#ecfdf5' },
  dragHandle: { paddingHorizontal: 4, paddingTop: 8 },
  mainColumn: { flex: 1 },
  input: { flex: 1, color: '#1f2421', paddingVertical: 8, paddingHorizontal: 6, fontSize: 15 },
  inputHeader: { fontWeight: '800', color: '#115e59' },
  inputError: { backgroundColor: '#fef2f2', borderRadius: 6 },
  errorText: { color: '#9f1239', fontSize: 12, marginLeft: 6, marginBottom: 4 },
  deleteAction: { backgroundColor: '#9f1239', width: 56, alignItems: 'center', justifyContent: 'center' },
});
