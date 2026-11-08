#!/usr/bin/env bash
set -e
PROGDIR="$(cd "$(dirname "$0")" && pwd)"
APK="$PROGDIR/../build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
CFG="--user 0 --tn CDS --name 'Yene Verify'"

CANDIDATES=(
  "$PROGDIR/../android/app/../../../AppData/Local/Android/Sdk/platform-tools/adb.exe"
  "$HOME/AppData/Local/Android/Sdk/platform-tools/adb.exe"
  "$HOME/AppData/Local/android-sdk/platform-tools/adb.exe"
)

ADB=""
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then
    ADB="$c"
    break
  fi
done

if [ -z "$ADB" ]; then
  echo "adb.exe not found under any of: ${CANDIDATES[*]}" >&2
  exit 2
fi

ADB="\"$ADB\""

if [ ! -f "$APK" ]; then
  echo "APK not found: $APK" >&2
  exit 2
fi

echo "Uninstalling existing package on phone, if any..."
eval $ADB uninstall com.yeneverify.yene_verify >/dev/null 2>&1 || true

echo "Installing release arm64 APK..."
eval $ADB install -r -g "$APK" || {
  echo "adb install failed. Last lines:" >&2
  eval $ADB install -r -g "$APK" 2>&1 | tail -n 30
  exit 3
}

echo "Setting debuggable activity filter for flutter attach-style launches..."
eval $ADB shell cmd package compile -m speed -f com.yeneverify.yene_verify >/dev/null 2>&1 || true

echo "Launching app..."
eval $ADB shell am start $CFG -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.yeneverify.yene_verify/com.yeneverify.yene_verify.MainActivity 2>/dev/null || {
  echo "am start failed. Try tapping the home screen icon on the phone." >&2
  exit 4
}

echo "Installed and launched."
