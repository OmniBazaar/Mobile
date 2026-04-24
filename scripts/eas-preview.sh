#!/usr/bin/env bash
#
# eas-preview.sh — one-command driver for the first real EAS preview
# build. Runs prerequisites (typecheck, tests, prebuild sanity) before
# kicking off `eas build --profile preview --platform all`.
#
# USAGE
#   ./scripts/eas-preview.sh            # iOS + Android preview builds
#   ./scripts/eas-preview.sh ios        # iOS only
#   ./scripts/eas-preview.sh android    # Android only
#   ./scripts/eas-preview.sh apk        # shortcut → production-apk profile
#
# PREREQS
#   1. `npm i -g eas-cli@latest`
#   2. `eas login` with an Expo account that has access to the org.
#   3. First-run only: `eas project:init` + replace the placeholder
#      `omnibazaar-mobile-project-id` in app.json + eas.json.
#   4. iOS: Apple Team membership + `eas credentials` → iOS dist cert.
#   5. Android: `eas credentials` → Android keystore generated + saved.

set -euo pipefail

PLATFORM="${1:-all}"
PROFILE="preview"

case "$PLATFORM" in
  apk)
    PLATFORM="android"
    PROFILE="production-apk"
    ;;
  ios|android|all)
    ;;
  *)
    echo "Usage: $0 [ios|android|all|apk]" >&2
    exit 2
    ;;
esac

echo "==> Running typecheck"
npm run typecheck

echo "==> Running unit tests"
npm test -- --silent

echo "==> Verifying eas-cli is installed"
if ! command -v eas >/dev/null 2>&1; then
  echo "eas-cli is not installed. Run: npm i -g eas-cli" >&2
  exit 1
fi

echo "==> Verifying Expo login"
eas whoami >/dev/null 2>&1 || {
  echo "Run \`eas login\` first." >&2
  exit 1
}

echo "==> Kicking off \"eas build --profile $PROFILE --platform $PLATFORM\""
echo "    (This runs on EAS cloud infrastructure and typically takes 15–30 min.)"
exec eas build --profile "$PROFILE" --platform "$PLATFORM"
