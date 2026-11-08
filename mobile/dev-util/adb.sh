#!/usr/bin/env bash
# Find adb.exe anywhere under common SDK/Android Studio/Cache paths and run it.
# Usage: source this file and then run adb, or run: bash adb.sh devices -l
set -e

find_adb() {
  for dir in \
    "$ANDROID_HOME$/platform-tools/adb.exe" \
    "$ANDROID_HOME$/emulator/adb.exe" \
    "$HOME$/AppData/Local/Android/Sdk/platform-tools/adb.exe" \
    "$HOME$/AppData/Local/Android/Sdk/platform-tools/adb.exe" \
    "$HOME$/AppData/Local/Android/Sdk/emulator/adb.exe" \
    "$HOME$/Library/Android/sdk/platform-tools/adb.exe" \
  ; do
    if [ -f "$dir" ]; then
      echo "$dir"
      return 0
    fi
  done
  return 1
}

adb_path="$(find_adb)"
if [ -z "$adb_path" ]; then
  echo "adb.exe not found in common SDK paths." >&2
  exit 1
fi

exec "$adb_path" "$@"
