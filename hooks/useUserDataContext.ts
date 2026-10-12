import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createInvitation, deleteAllUserData, markInvitationAccepted, readFamilyById,
  readFamilyInvitations, readUserContext, readUsersByIds, removeFamilyMember,
  sendInvitationEmail, writeUserProfile,
} from '../lib/userContext';

const userContextQuery = (uid: string) =>
  queryOptions({ queryKey: ['userContext', uid], queryFn: () => readUserContext(uid) });

// Query state around lib/userContext — the Firestore reads and writes live there
// so the integration suite can drive them without rendering a component.
export function useUserDataContext(user: User | null) {
  const queryClient = useQueryClient();
  const uid = user?.uid ?? '';
  const { data, isFetching } = useQuery({ ...userContextQuery(uid), enabled: Boolean(uid) });

  const refreshGlobalUserContext = async (targetUser = auth.currentUser) => {
    if (!targetUser?.uid) return { profile: null, familyUserIds: [] };
    try {
      return await queryClient.fetchQuery(userContextQuery(targetUser.uid));
    } catch (error) {
      console.error('Error refreshing user context:', error);
      return { profile: null, familyUserIds: [targetUser.uid] };
    }
  };

  // Answers from the cache (the query above keeps it fresh); a missing profile is
  // always re-read, since a new user's may have only just been written.
  const loadContext = async (targetUid: string) => {
    const options = userContextQuery(targetUid);
    const cached = queryClient.getQueryData(options.queryKey);
    return cached?.profile ? cached : queryClient.fetchQuery(options);
  };

  const getCurrentUserProfile = async () => {
    const currentUser = auth.currentUser;
    return currentUser ? (await loadContext(currentUser.uid)).profile : null;
  };

  const getFamilyUserIdsForCurrentUser = async () => {
    const currentUser = auth.currentUser;
    return currentUser ? (await loadContext(currentUser.uid)).familyUserIds : [];
  };

  const getFamilyForCurrentUser = async () => {
    const profile = await getCurrentUserProfile();
    return profile?.familyId ? readFamilyById(String(profile.familyId)) : null;
  };

  const createUserProfile = async (name: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    const profile = await writeUserProfile(currentUser, name);
    await refreshGlobalUserContext(currentUser);
    return profile;
  };

  const inviteFamilyMember = async (email: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    const profile = await getCurrentUserProfile();
    if (!profile) throw new Error('You need a family before inviting members.');

    const { invitedEmail, familyId, invitationToken, inviterName } = await createInvitation(profile, email);
    await sendInvitationEmail(invitedEmail, inviterName, invitationToken);
    return { invitedEmail, familyId, invitationToken };
  };

  const getFamilyInvitations = async () => {
    const profile = await getCurrentUserProfile();
    return profile?.familyId ? readFamilyInvitations(String(profile.familyId)) : [];
  };

  const removeMember = async (memberUserId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) throw new Error('User not authenticated');
    const profile = await getCurrentUserProfile();
    if (!profile?.familyId) throw new Error('No family found.');
    await removeFamilyMember(currentUser.uid, String(profile.familyId), memberUserId);
    await queryClient.invalidateQueries({ queryKey: ['userContext'] });
  };

  return {
    currentUserProfile: data?.profile ?? null,
    familyUserIds: data?.familyUserIds ?? [],
    userContextLoading: isFetching,
    refreshGlobalUserContext,
    createUserProfile,
    getCurrentUserProfile,
    getFamilyUserIdsForCurrentUser,
    getFamilyForCurrentUser,
    getUsersByIds: readUsersByIds,
    inviteFamilyMember,
    getFamilyInvitations,
    markInvitationAccepted,
    removeFamilyMember: removeMember,
    deleteAllUserData,
  };
}
