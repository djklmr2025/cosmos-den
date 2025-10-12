param(
  [int]$Port = 8081
)

Write-Host "=== ARKAIOS: Firewall unlock para node.exe ===" -ForegroundColor Cyan

$rules = @(
  "Node Allow 127.0.0.1:$Port IN",
  "Node Block All IN",
  "Node Allow 127.0.0.1:$Port OUT",
  "Node Block All OUT"
)

foreach ($r in $rules) {
  netsh advfirewall firewall delete rule name="$r" | Out-Null
}

Write-Host "Reglas eliminadas." -ForegroundColor Green
