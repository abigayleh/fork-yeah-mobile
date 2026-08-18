import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authedFetch } from '../lib/authedFetch';

type Props = { visible: boolean; onClose: () => void; onAddItems: (names: string[]) => void };

// A family-shared list of regularly-bought items (served by the admin
// /api/quickAddItems route). Tap regulars to drop them into the current list.
export default function QuickAddModal({ visible, onClose, onAddItems }: Props) {
  const [regulars, setRegulars] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setSelected(new Set());
    setNewName('');
    setLoading(true);
    try {
      const res = await authedFetch('/api/quickAddItems');
      const payload = await res.json();
      const names: string[] = Array.isArray(payload?.items)
        ? payload.items.map((i: { name?: string }) => String(i?.name || '').trim()).filter(Boolean)
        : [];
      setRegulars(Array.from(new Set(names)));
    } catch {
      setRegulars([]);
    } finally {
      setLoading(false);
    }
  };

  const persist = async (names: string[]) => {
    setSaving(true);
    try {
      await authedFetch('/api/quickAddItems', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: names.map((name) => ({ name })) }),
      });
    } catch {
      Alert.alert('Error', 'Could not save your quick-add list.');
    } finally {
      setSaving(false);
    }
  };

  const addRegular = async () => {
    const name = newName.trim();
    setNewName('');
    if (!name || regulars.some((r) => r.toLowerCase() === name.toLowerCase())) return;
    const next = [...regulars, name];
    setRegulars(next);
    setSelected((s) => new Set(s).add(name));
    await persist(next);
  };

  const removeRegular = async (name: string) => {
    const next = regulars.filter((r) => r !== name);
    setRegulars(next);
    setSelected((s) => { const n = new Set(s); n.delete(name); return n; });
    await persist(next);
  };

  const toggle = (name: string) => {
    setSelected((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  };

  const confirm = () => {
    const names = regulars.filter((r) => selected.has(r));
    if (names.length) onAddItems(names);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={load}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Quick add</Text>
          <Text style={styles.subtitle}>Tap your regulars to add them to this list.</Text>

          {loading ? (
            <ActivityIndicator color="#0f766e" style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              {regulars.length === 0 ? (
                <Text style={styles.empty}>No regulars yet — add your staples below.</Text>
              ) : (
                <View style={styles.chips}>
                  {regulars.map((name) => {
                    const on = selected.has(name);
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => toggle(name)}
                        onLongPress={() => removeRegular(name)}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
                        {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {regulars.length > 0 ? <Text style={styles.hint}>Long-press a regular to remove it.</Text> : null}
            </ScrollView>
          )}

          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Add a regular…"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={addRegular}
              returnKeyType="done"
            />
            <TouchableOpacity style={[styles.addBtn, !newName.trim() && { opacity: 0.5 }]} onPress={addRegular} disabled={!newName.trim()}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, selected.size === 0 && { opacity: 0.5 }]} onPress={confirm} disabled={selected.size === 0}>
              <Text style={styles.confirmText}>Add{selected.size ? ` ${selected.size}` : ''} to list</Text>
            </TouchableOpacity>
          </View>
          {saving ? <Text style={styles.saving}>Saving…</Text> : null}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { color: '#1f2421', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  empty: { color: '#9ca3af', textAlign: 'center', marginVertical: 16 },
  hint: { color: '#9ca3af', fontSize: 12, marginTop: 10 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10 },
  addBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  cancelText: { color: '#5e6a63', fontWeight: '700', paddingVertical: 8 },
  confirmBtn: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  confirmText: { color: '#fff', fontWeight: '700' },
  saving: { color: '#9ca3af', fontSize: 12, textAlign: 'right', marginTop: 6 },
});
