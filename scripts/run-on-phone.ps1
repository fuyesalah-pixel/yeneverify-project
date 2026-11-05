# Run the mobile app on a USB-connected Android phone with the correct
# API_BASE_URL for a physical device. The default is emulator-only
# (10.0.2.2), which a phone cannot reach.
#
# Usage (from any directory):
#   powershell -File scripts/run-on-phone.ps1 [-DeviceId <phone-id>]
#
# If no device id is given, `flutter run` picks the default device —
# always pass -DeviceId when both an emulator and a phone are connected.

param([string]$DeviceId)

# Auto-detect the PC LAN IP (skip loopback and link-local 169.254.x.x).
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.InterfaceAlias -notmatch "Loopback" -and
    $_.IPAddress -notmatch "^169\.254"
  } |
  Select-Object -First 1).IPAddress

if (-not $ip) {
  Write-Error "Could not detect PC LAN IP. Set it manually, e.g.:
  flutter run -d <phone> --dart-define=API_BASE_URL=http://<pc-ip>:3000/api/v1"
  exit 1
}

Write-Host "Using backend at http://${ip}:3000/api/v1"

# Fire-and-forget firewall hint: the first run usually fails silently if
# port 3000 is not allowed inbound.
Write-Host "If the phone cannot reach the backend, allow port 3000 inbound (Admin PowerShell):"
Write-Host '  New-NetFirewallRule -DisplayName "Yene Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow'
$answer = Read-Host "Add the firewall rule now? (y/N)"
if ($answer -eq "y") {
  try {
    New-NetFirewallRule -DisplayName "Yene Backend" `
      -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow | Out-Null
    Write-Host "Firewall rule added."
  } catch {
    Write-Warning "Could not add the rule (needs an Admin PowerShell). Run it manually."
  }
}

Push-Location "$PSScriptRoot\..\mobile"
try {
  if ($DeviceId) {
    Write-Host "Target device: $DeviceId"
    flutter run -d $DeviceId --dart-define=API_BASE_URL=http://${ip}:3000/api/v1
  } else {
    Write-Host "No device id given; flutter run will use the default device."
    flutter run --dart-define=API_BASE_URL=http://${ip}:3000/api/v1
  }
} finally {
  Pop-Location
}
