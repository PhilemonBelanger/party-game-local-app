# Opens inbound TCP ports 5173 (frontend) + 3001 (backend) so phones on the
# same Wi-Fi can reach the Trivia game. Requires admin — self-elevates below.

# --- self-elevate: relaunch as admin if not already ---
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Requesting admin rights..." -ForegroundColor Yellow
  Start-Process powershell.exe -Verb RunAs `
    -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

$ports = @(5173, 3001)
foreach ($port in $ports) {
  $name = "TriviaGame TCP $port"
  Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue   # avoid duplicates
  New-NetFirewallRule `
    -DisplayName $name `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile Private `
    -Description "Local Wi-Fi Trivia game" | Out-Null
  Write-Host "Allowed inbound TCP $port (Private network)" -ForegroundColor Green
}

Write-Host "`nDone. Phones on the same Wi-Fi can now reach the game." -ForegroundColor Cyan
Write-Host "Find your LAN IP:" -ForegroundColor Cyan
(Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' }
).IPAddress | ForEach-Object { Write-Host "  http://$_:5173" -ForegroundColor White }

Write-Host "`nPress any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
