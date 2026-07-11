import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';

type FamilyMember = { id?: string; userId?: string; name?: string; email?: string };

export default function FamilyScreen() {
  const { user, getCurrentUserProfile, getFamilyForCurrentUser, getUsersByIds, inviteFamilyMember, removeFamilyMember } = useAuth();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [removingId, setRemovingId] = useState('');

  const loadFamily = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.familyId) { setMembers([]); return; }

      const familyData = await getFamilyForCurrentUser();
      const userIds: string[] = Array.isArray(familyData?.users)
        ? (familyData.users as unknown[])
            .map((m) => typeof m === 'string' ? m.trim() : '')
            .filter(Boolean)
        : [];

      const resolved = await getUsersByIds(userIds);
      setMembers((resolved ?? []) as FamilyMember[]);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load family.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFamily(); }, [user]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      const result = await inviteFamilyMember(inviteEmail.trim());
      setSuccessMessage(`Invitation email sent to ${result.invitedEmail}.`);
      setInviteOpen(false);
      setInviteEmail('');
      await loadFamily();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not create invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (member: FamilyMember) => {
    const memberId = member.userId ?? member.id ?? '';
    if (!memberId || memberId === user?.uid) return;

    Alert.alert(
      'Remove Member',
      `Remove ${member.name ?? member.email ?? 'this member'} from your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setRemovingId(memberId);
            try {
              await removeFamilyMember(memberId);
              setMembers((prev) => prev.filter((m) => (m.userId ?? m.id) !== memberId));
            } catch (e) {
              Alert.alert('Error', (e as { message?: string }).message ?? 'Could not remove member.');
            } finally {
              setRemovingId('');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Family</Text>
      </View>

      <Text style={styles.subtitle}>Family members share saved recipes and meal plans.</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item, i) => String(item.userId ?? item.id ?? i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const memberId = item.userId ?? item.id ?? '';
            const isMe = memberId === user?.uid;
            const isRemoving = removingId === memberId;
            return (
              <View style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.name ?? 'Unnamed member'}</Text>
                  {item.email ? <Text style={styles.memberEmail}>{item.email}</Text> : null}
                </View>
                {isMe ? (
                  <Text style={styles.youBadge}>You</Text>
                ) : (
                  <TouchableOpacity onPress={() => handleRemove(item)} disabled={isRemoving}>
                    <Text style={styles.removeBtn}>{isRemoving ? '...' : 'Remove'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No family members yet.</Text>}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => { setError(''); setSuccessMessage(''); setInviteEmail(''); setInviteOpen(true); }}>
          <Text style={styles.inviteBtnText}>+ Add Family Member</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => !inviting && setInviteOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => !inviting && setInviteOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <Text style={styles.modalSubtitle}>Enter their account email address.</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TouchableOpacity style={[styles.inviteBtn, inviting && { opacity: 0.7 }]} onPress={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              <Text style={styles.inviteBtnText}>{inviting ? 'Adding...' : 'Add to Family'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => !inviting && setInviteOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  header: { padding: 16, paddingTop: 56, marginBottom: 4 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59' },
  subtitle: { color: '#5e6a63', paddingHorizontal: 16, marginBottom: 16 },
  errorText: { color: '#9f1239', paddingHorizontal: 16, marginBottom: 8 },
  successText: { color: '#0f766e', paddingHorizontal: 16, marginBottom: 8 },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  memberInfo: { flex: 1 },
  memberName: { fontWeight: '700', color: '#1f2421', fontSize: 15 },
  memberEmail: { color: '#5e6a63', fontSize: 13, marginTop: 2 },
  youBadge: { backgroundColor: '#ecfdf5', color: '#0f766e', fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, fontSize: 12 },
  removeBtn: { color: '#9f1239', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
  footer: { padding: 16 },
  inviteBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center' },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#115e59', marginBottom: 6 },
  modalSubtitle: { color: '#5e6a63', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, marginBottom: 14, backgroundColor: '#fff' },
  cancelBtn: { marginTop: 10, alignItems: 'center' },
  cancelBtnText: { color: '#5e6a63', fontWeight: '600' },
});
