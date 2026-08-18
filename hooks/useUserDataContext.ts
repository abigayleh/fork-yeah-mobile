import { useEffect, useState } from 'react';
import { type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createInvitation, deleteAllUserData, markInvitationAccepted, readFamilyById,
  readFamilyInvitations, readUserProfile, readUsersByIds, removeFamilyMember,
  resolveFamilyUserIds, sendInvitationEmail, writeUserProfile, type Profile,
} from '../lib/userContext';

// React state around lib/userContext — the Firestore reads and writes live there
// so the integration suite can drive them without rendering a component.
export function useUserDataContext(user: User | null) {
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [familyUserIds, setFamilyUserIds] = useState<string[]>([]);
  const [userContextLoading, setUserContextLoading] = useState(false);

  const refreshGlobalUserContext = async (targetUser = auth.currentUser) => {
    if (!targetUser?.uid) {
      setCurrentUserProfile(null);
      setFamilyUserIds([]);
      return { profile: null, familyUserIds: [] };
    }

    setUserContextLoading(true);
    try {
      const profile = await readUserProfile(targetUser.uid);
      const nextFamilyUserIds = await resolveFamilyUserIds(profile, targetUser.uid);
      setCurrentUserProfile(profile);
      setFamilyUserIds(nextFamilyUserIds);
      return { profile, familyUserIds: nextFamilyUserIds };
    } catch (error) {
      console.error('Error refreshing user context:', error);
      setCurrentUserProfile(null);
      setFamilyUserIds([targetUser.uid]);
      return { profile: null, familyUserIds: [targetUser.uid] };
    } finally {
      setUserContextLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadContext = async () => {
      if (!user?.uid) {
        setCurrentUserProfile(null);
        setFamilyUserIds([]);
        return;
      }
      const result = await refreshGlobalUserContext(user);
      if (!isMounted) return;
      if (!result.profile) setCurrentUserProfile(null);
    };
    loadContext();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const getCurrentUserProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    if (currentUserProfile?.id === currentUser.uid) return currentUserProfile;
    const profile = await readUserProfile(currentUser.uid);
    if (profile) setCurrentUserProfile(profile);
    return profile;
  };

  const getFamilyUserIdsForCurrentUser = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    const profile = await getCurrentUserProfile();
    const next = await resolveFamilyUserIds(profile, currentUser.uid);
    setFamilyUserIds(next);
    return next;
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
  };

  return {
    currentUserProfile,
    familyUserIds,
    userContextLoading,
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
