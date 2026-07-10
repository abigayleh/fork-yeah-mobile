import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EditableLinesList from './EditableLinesList';
import { usePickImageBase64 } from '../hooks/usePickImageBase64';
import type { EditableStep, StepsEditorState } from '../hooks/useStepsEditor';

interface Props {
  editor: StepsEditorState;
}

// Step numbers restart after every header — mirrors how multi-part recipes
// (Cake, Icing) read.
function getStepNumbers(steps: EditableStep[]): Array<number | null> {
  let counter = 0;
  return steps.map((step) => {
    if (step.isHeader) {
      counter = 0;
      return null;
    }
    counter += 1;
    return counter;
  });
}

export default function StepsEditor({ editor }: Props) {
  const { steps, updateStepText, updateStepImage, removeLine, splitLine, deleteAtStart, reorderLines, pendingFocus, clearPendingFocus, errors, addSectionHeader } =
    editor;
  const { pickImage } = usePickImageBase64();
  const numbers = getStepNumbers(steps);

  const handleAttachImage = async (index: number) => {
    const image = await pickImage();
    if (image) updateStepImage(index, image);
  };

  return (
    <>
      <EditableLinesList<EditableStep>
        lines={steps}
        errors={errors}
        pendingFocus={pendingFocus}
        clearPendingFocus={clearPendingFocus}
        onUpdateText={updateStepText}
        onRemove={removeLine}
        onSplit={splitLine}
        onDeleteAtStart={deleteAtStart}
        onReorder={reorderLines}
        placeholder={(line) => (line.isHeader ? 'Section title (e.g. Cake)' : 'Write this step...')}
        removeLabel={(line) => (line.isHeader ? 'Remove section' : 'Remove step')}
        renderPrefix={(line, index) =>
          line.isHeader ? null : <Text style={styles.stepNumber}>{numbers[index]})</Text>
        }
        renderExtra={(line, index) => {
          if (line.isHeader) return null;
          return (
            <View style={styles.imageRow}>
              {line.imageUrl ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: line.imageUrl }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => updateStepImage(index, undefined)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachImageBtn} onPress={() => handleAttachImage(index)}>
                  <Ionicons name="image-outline" size={16} color="#0f766e" />
                  <Text style={styles.attachImageText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
      <TouchableOpacity style={styles.addSectionBtn} onPress={addSectionHeader}>
        <Text style={styles.addSectionText}>+ Add Section</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  stepNumber: { color: '#9ca3af', fontWeight: '700', paddingTop: 10, paddingHorizontal: 4 },
  imageRow: { marginTop: 4, marginBottom: 6 },
  attachImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  attachImageText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
  imagePreviewWrap: { position: 'relative', width: 100, height: 75 },
  imagePreview: { width: 100, height: 75, borderRadius: 8 },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addSectionBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  addSectionText: { color: '#0f766e', fontWeight: '700' },
});
