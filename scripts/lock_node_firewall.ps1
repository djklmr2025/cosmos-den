param(
  [int]$Port = 8081,
  [string]$NodePath = "C:\Program Files\nodejs\node.exe"
)

Write-Host "=== ARKAIOS: Firewall lock para node.exe ===" -ForegroundColor Cyan
Write-Host "NodePath: $NodePath" -ForegroundColor Yellow

# INBOUND allow solo 127.0.0.1:Port
netsh advfirewall firewall add rule name="Node Allow 127.0.0.1:$Port IN" dir=in action=allow program="$NodePath" protocol=TCP localip=127.0.0.1 localport=$Port profile=any | Out-Null

# INBOUND block resto
netsh advfirewall firewall add rule name="Node Block All IN" dir=in action=block program="$NodePath" protocol=TCP profile=any | Out-Null

# OUTBOUND allow solo loopback:Port
netsh advfirewall firewall add rule name="Node Allow 127.0.0.1:$Port OUT" dir=out action=allow program="$NodePath" protocol=TCP remoteip=127.0.0.1 remoteport=$Port profile=any | Out-Null

# OUTBOUND block resto
netsh advfirewall firewall add rule name="Node Block All OUT" dir=out action=block program="$NodePath" protocol=TCP profile=any | Out-Null

Write-Host "Reglas creadas. Para revertir, usa unlock_node_firewall.ps1" -ForegroundColor Green
