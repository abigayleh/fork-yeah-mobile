import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  rating: number | null;
  onRate: (value: number | null) => void;
  notes: string;
  onSaveNotes: (value: string) => void;
};

// Star rating (tap again to clear) plus a free-text notes box that autosaves on blur.
export default function RecipeRatingNotes({ rating, onRate, notes, onSaveNotes }: Props) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Your rating</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => onRate(rating === n ? null : n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Ionicons name={(rating ?? 0) >= n ? 'star' : 'star-outline'} size={30} color="#f59e0b" />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.notes}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => draft !== notes && onSaveNotes(draft)}
        placeholder="Tweaks, substitutions, who liked it…"
        placeholderTextColor="#9ca3af"
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#e4d9c5', paddingTop: 20 },
  label: { fontSize: 16, fontWeight: '700', color: '#115e59', marginBottom: 10 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  notes: {
    borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, minHeight: 80,
    backgroundColor: '#fff', color: '#1f2421', textAlignVertical: 'top',
  },
});
