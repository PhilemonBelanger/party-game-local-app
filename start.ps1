# Detects this PC's LAN IP, writes it to .env (so the QR code points at the
# right address), then starts the game with Docker Compose.
#
# Usage:  right-click -> Run with PowerShell,  or:  powershell -ExecutionPolicy Bypass -File start.ps1

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# --- find the real LAN IP (skip loopback, WSL, VPN, virtual adapters) ---
$cands = Get-NetIPConfiguration | Where-Object {
  $_.NetAdapter -and $_.NetAdapter.Status -eq 'Up' -and $_.IPv4Address -and
  $_.InterfaceAlias -notmatch 'Loopback|WSL|vEthernet|Hyper-V|NordLynx|VPN|TAP|Virtual'
}

# prefer an adapter that has a default gateway (the one actually on the network)
$ip = ($cands | Where-Object { $_.IPv4DefaultGateway } |
  Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = ($cands | Select-Object -First 1).IPv4Address.IPAddress }

if (-not $ip) {
  Write-Host "Could not auto-detect a LAN IP. Listing all IPv4 addresses:" -ForegroundColor Yellow
  Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' } |
    Select-Object IPAddress, InterfaceAlias | Format-Table -AutoSize
  $ip = Read-Host "Enter the IP phones should use"
}

Write-Host "Using LAN IP: $ip" -ForegroundColor Green
"HOST_LAN_IP=$ip" | Set-Content -Path ".env" -Encoding ascii

# --- start (renew anon volumes so image node_modules / new deps are picked up) ---
docker compose up -d --build --force-recreate --renew-anon-volumes

Write-Host "`nGame is up." -ForegroundColor Cyan
Write-Host "  Host / TV screen : http://$($ip):5173   (open this, then 'Open Host Screen')" -ForegroundColor White
Write-Host "  Players scan the QR, or go to: http://$($ip):5173" -ForegroundColor White
Write-Host "`nStop later with:  docker compose down" -ForegroundColor DarkGray
