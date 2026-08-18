# Testing

## Running

```
npm run test:run    # once
npm test            # watch
```

Both boot the Firestore + Auth emulators via `firebase emulators:exec`, so the
Firebase CLI must be installed. No simulator, no network, ~3s.

## What these tests are for

They run against **`firestore.rules` — the real production rules**, not a
permissive test copy. That is the whole point: the bug class this suite exists to
catch is code that is logically correct but performs a query the rules forbid
(e.g. a collection query on `families`, which is denied outright). Such a bug
passes any test suite with rules disabled and then fails on a real device.

`tests/harness.test.ts` guards that property — if it starts passing trivially,
the suite has been pointed at allow-all rules and everything else here is void.

## Layout

| File | Covers |
|---|---|
| `harness.test.ts` | Proves production rules are enforced |
| `rulesSync.test.ts` | `firestore.rules` hasn't drifted from the web repo |
| `authFlow.test.ts` | Signup, profile + family creation, login |
| `recipeFlow.test.ts` | Save recipe, favorite, folders and subfolders |
| `groceryFlow.test.ts` | Pins grocery lists / meal plans as client-denied |
| `familySharing.test.ts` | Family members share data; outsiders are locked out |

## Rules are owned by the web repo

`firestore.rules` is a copy; `fork-yeah/firestore.rules` is the deploy target.
Re-sync with `npm run sync-rules`. `rulesSync.test.ts` fails on drift (and skips
when `fork-yeah` isn't checked out alongside).

## Conventions

- Tests drive **the app's own modules** (`lib/userContext.ts`, `lib/familyData.ts`)
  and the real `lib/firebase.ts` singletons — never a parallel Firebase app, or a
  misconfigured client would hide behind the harness.
- `expectDenied(...)` states "production forbids this", rather than "it threw".
- `clearEmulatorData()` in `beforeAll`; files run serially and share one project.
- Denial assertions print Firestore PERMISSION_DENIED noise to stderr. Expected.

## Known gap

`hooks/useRecipeApi.ts` still holds its Firestore writes inline behind React
Query, so `recipeFlow.test.ts` reproduces those write shapes rather than calling
the app's code. Reads go through the real `lib/familyData.ts`. Extracting that
hook's data layer to `lib/` — as was done for `useUserDataContext` — would close it.
