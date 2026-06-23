# Removes the Trivia game firewall rules added by open-firewall.ps1.
# Requires admin — self-elevates below.

$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Requesting admin rights..." -ForegroundColor Yellow
  Start-Process powershell.exe -Verb RunAs `
    -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

foreach ($port in @(5173, 3001)) {
  $name = "TriviaGame TCP $port"
  $rule = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  if ($rule) {
    $rule | Remove-NetFirewallRule
    Write-Host "Removed rule for TCP $port" -ForegroundColor Green
  } else {
    Write-Host "No rule found for TCP $port" -ForegroundColor DarkGray
  }
}

Write-Host "`nPress any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
