import { beforeAll, describe, expect, it } from 'vitest';
import { clearEmulatorData, auth, signIn, signOutTestUser, signUp } from './helpers/emulator';
import { readFamilyById, readUserProfile, resolveFamilyUserIds, writeUserProfile } from '../lib/userContext';

// Signup -> profile -> login, driven through the app's own data layer.
describe('signup and login', () => {
  let uid: string;

  beforeAll(async () => {
    await clearEmulatorData();
    uid = await signUp('alice@t.com');
  });

  it('creates a profile and a single-member family on signup', async () => {
    const profile = await writeUserProfile(auth.currentUser!, 'Alice');
    expect(profile.name).toBe('Alice');
    expect(profile.familyId).toBeTruthy();

    const family = await readFamilyById(profile.familyId);
    expect(family?.users).toEqual([uid]);
  });

  it('reads the profile back after signing out and in again', async () => {
    await signOutTestUser();
    await signIn('alice@t.com');

    const profile = await readUserProfile(uid);
    expect(profile?.name).toBe('Alice');
    // The regression that broke login: this resolved via a families collection
    // query, which the production rules deny outright.
    expect(await resolveFamilyUserIds(profile, uid)).toEqual([uid]);
  });

  it('falls back to the user alone when no family exists', async () => {
    expect(await resolveFamilyUserIds({ familyId: 'nope' }, uid)).toEqual([uid]);
    expect(await resolveFamilyUserIds(null, uid)).toEqual([uid]);
  });

  it('keeps familyId stable when the profile is rewritten', async () => {
    const first = await readUserProfile(uid);
    const rewritten = await writeUserProfile(auth.currentUser!, 'Alice Renamed');
    expect(rewritten.familyId).toBe(first?.familyId);
    expect(rewritten.name).toBe('Alice Renamed');
  });

  it('rejects a blank name', async () => {
    await expect(writeUserProfile(auth.currentUser!, '  ')).rejects.toThrow('Name is required');
  });
});
