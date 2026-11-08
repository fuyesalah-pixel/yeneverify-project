#!/usr/bin/env bash
# Run the mobile app on a USB-connected Android phone with the correct
# API_BASE_URL for a physical device (the default is emulator-only).
#
# Usage (from the repo root):
#   ./mobile/dev-util/run-on-phone.sh [device-id]
#
# If no device-id is given, it picks the first non-emulator device adb sees.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/mobile"

# Auto-detect the PC LAN IP (skip loopback and link-local 169.254.x.x).
PC_IP="$(ipconfig | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -vE '^127\\.|^169\\.254\\.' | head -n 1 || true)"

if [[ -z "$PC_IP" ]]; then
  echo "ERROR: could not detect PC LAN IP from ipconfig" >&2
  echo "Set API_BASE_URL manually, e.g.:" >&2
  echo "  flutter run -d <phone> --dart-define=API_BASE_URL=http://<pc-ip>:3000/api/v1" >&2
  exit 1
fi

API_BASE_URL="http://${PC_IP}:3000/api/v1"
echo "Using backend at ${API_BASE_URL}"

cd "$MOBILE_DIR"

if [[ $# -ge 1 ]]; then
  DEVICE_ID="$1"
  echo "Target device: $DEVICE_ID"
  flutter run -d "$DEVICE_ID" --dart-define=API_BASE_URL="$API_BASE_URL"
else
  echo "No device id given; picking the first USB-connected device adb sees."
  DEVICE_ID="$(adb devices | awk 'NR>1 && $2==\"device\" {print $1; exit}')"
  if [[ -z "$DEVICE_ID" ]]; then
    echo "ERROR: no connected USB device found (adb devices)" >&2
    exit 1
  fi
  echo "Target device: $DEVICE_ID"
  flutter run -d "$DEVICE_ID" --dart-define=API_BASE_URL="$API_BASE_URL"
fi
