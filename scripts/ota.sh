#!/usr/bin/env bash
#
# ota.sh — push a JS-only OTA update to an EAS Update channel.
#
# USAGE
#   ./scripts/ota.sh <channel> [eas-update-args...]
#
# Wraps `eas update --branch <channel>` with our standard pre-flight:
#   - typecheck
#   - unit tests (silent)
#   - bundle the sibling Wallet/src + WebApp/src into .bundled/ so the
#     shipped JS reflects current source

set -euo pipefail

CHANNEL="${1:-}"
shift || true

case "$CHANNEL" in
  preview|production) ;;
  *)
    echo "Usage: $0 <preview|production> [eas-update-args...]" >&2
    exit 2
    ;;
esac

echo "==> Bundling sibling Wallet/src + WebApp/src into .bundled/"
node scripts/bundle-shared.mjs

echo "==> Running typecheck"
npm run typecheck

echo "==> Running unit tests"
npm test -- --silent

echo "==> Verifying eas-cli + login"
command -v eas >/dev/null 2>&1 || { echo "Install eas-cli: npm i -g eas-cli" >&2; exit 1; }
eas whoami >/dev/null 2>&1 || { echo "Run \`eas login\` first." >&2; exit 1; }

echo "==> Pushing OTA to '$CHANNEL' branch"
exec eas update --branch "$CHANNEL" "$@"
