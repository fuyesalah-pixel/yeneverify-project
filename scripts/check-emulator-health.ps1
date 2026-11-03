param([string]$DeviceId = "emulator-5554")

$ErrorActionPreference = "Stop"

Write-Host "Checking emulator health for $DeviceId..."

# Check if connected
$devices = adb devices | Select-String "$DeviceId"
if (-not $devices) {
    Write-Host "ERROR: $DeviceId not connected." -ForegroundColor Red
    exit 1
}

# Launcher frame times: p50/p90 over the launcher's rendered frame history.
$gfxinfo = adb -s $DeviceId shell dumpsys gfxinfo com.google.android.apps.launcher
$p50Match = $gfxinfo | Select-String "50th percentile: (\d+)ms"
$p90Match = $gfxinfo | Select-String "90th percentile: (\d+)ms"

if (-not $p50Match) {
    Write-Host "ERROR: could not read frame stats from dumpsys gfxinfo." -ForegroundColor Red
    Write-Host "Interact with the launcher once, then re-run."
    exit 1
}

$p50 = [int]$p50Match.Matches[0].Groups[1].Value
$p90 = if ($p90Match) { [int]$p90Match.Matches[0].Groups[1].Value } else { 0 }

Write-Host "Launcher p50: $p50 ms, p90: $p90 ms"

if ($p50 -gt 100) {
    Write-Host "WARNING: p50 > 100ms. Emulator is NOT hardware-accelerated." -ForegroundColor Yellow
    Write-Host "See docs/ops/emulator-setup.md for the correct AVD config."
    exit 1
}

Write-Host "Emulator is healthy for manual QA." -ForegroundColor Green
exit 0
