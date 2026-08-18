import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// firestore.rules here is a copy; the web repo owns the deploy target. If the two
// drift, these tests would be validating rules production no longer uses.
const WEB_REPO_RULES = new URL('../../fork-yeah/firestore.rules', import.meta.url);
const LOCAL_RULES = new URL('../firestore.rules', import.meta.url);

describe('firestore.rules stays in sync with the web repo', () => {
  it('matches fork-yeah/firestore.rules', () => {
    if (!existsSync(WEB_REPO_RULES)) {
      // Checkouts without the sibling repo (CI, a fresh clone) can't compare.
      console.warn('fork-yeah not checked out alongside — skipping drift check');
      return;
    }
    expect(readFileSync(LOCAL_RULES, 'utf8')).toBe(readFileSync(WEB_REPO_RULES, 'utf8'));
  });
});
