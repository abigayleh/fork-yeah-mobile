#!/usr/bin/env bash
# Drives the app on a booted iOS simulator against the Firestore emulator, so an
# E2E run never touches production data. Screenshots land in
# .maestro/screenshots/ as artifacts — nothing asserts on them.
#
# Requires: firebase CLI, maestro, an already-built dev client on the simulator
# (npm run ios once). Metro is started here with the emulator flag set, because
# EXPO_PUBLIC_* vars are inlined into the bundle at bundling time.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_ID=com.hammyinc.whatsfordinner
PROJECT=demo-forkyeah-mobile
SIM="${E2E_SIMULATOR:-booted}"
export E2E_EMAIL="${E2E_EMAIL:-e2e@t.com}"
export E2E_PASSWORD="${E2E_PASSWORD:-password123}"

command -v maestro >/dev/null || { echo "maestro not installed: curl -Ls https://get.maestro.mobile.dev | bash" >&2; exit 1; }
command -v firebase >/dev/null || { echo "firebase CLI not installed" >&2; exit 1; }

cleanup() {
  [ -n "${METRO_PID:-}" ] && kill "$METRO_PID" 2>/dev/null || true
  [ -n "${EMU_PID:-}" ] && kill "$EMU_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> starting emulators"
firebase emulators:start --only auth,firestore --project "$PROJECT" >/tmp/e2e-emulators.log 2>&1 &
EMU_PID=$!
until curl -s -o /dev/null http://127.0.0.1:8085; do sleep 1; done

echo "==> clearing emulator data"
curl -s -X DELETE "http://127.0.0.1:8085/emulator/v1/projects/$PROJECT/databases/(default)/documents" >/dev/null
curl -s -X DELETE "http://127.0.0.1:9199/emulator/v1/projects/$PROJECT/accounts" >/dev/null

echo "==> starting Metro with the emulator flag"
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 npx expo start --dev-client >/tmp/e2e-metro.log 2>&1 &
METRO_PID=$!
until curl -s http://localhost:8081/status | grep -q running; do sleep 1; done

echo "==> pointing the app at Metro"
xcrun simctl launch "$SIM" "$APP_ID" >/dev/null
xcrun simctl openurl "$SIM" "forkyeah://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

echo "==> running flows"
mkdir -p .maestro/screenshots
maestro test .maestro/full-flow.yaml \
  -e E2E_EMAIL="$E2E_EMAIL" -e E2E_PASSWORD="$E2E_PASSWORD"

echo "==> screenshots in .maestro/screenshots/"
