<#
  lock-vite-local.ps1

  Objetivo: Domar el entorno de desarrollo.
  - Mata procesos de dev (node/vite/npm/etc.)
  - Refuerza ajustes de workspace VS Code para evitar auto-open
  - (Opcional) Crea reglas de firewall que permiten SOLO 127.0.0.1:8081

  Uso:
    # Bloqueo estándar (IN allow 127.0.0.1:8081, IN block resto). Sin bloquear OUT.
    powershell -ExecutionPolicy Bypass -File .\lock-vite-local.ps1 -Lock

    # Bloqueo agresivo (también OUT: permite solo 127.0.0.1:8081 y bloquea resto)
    powershell -ExecutionPolicy Bypass -File .\lock-vite-local.ps1 -Lock -AggressiveOutBlock

    # Revertir reglas de firewall
    powershell -ExecutionPolicy Bypass -File .\lock-vite-local.ps1 -Unlock
#>

param(
  [switch] $Lock,
  [switch] $Unlock,
  [switch] $AggressiveOutBlock
)

function Write-Info($msg) { Write-Host "[info] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[err]  $msg" -ForegroundColor Red }

function Ensure-Admin {
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { Write-Warn "Ejecuta PowerShell como Administrador para aplicar reglas de firewall." }
}

function Kill-DevProcesses {
  Write-Info "Matando procesos de desarrollo comunes"
  'node','nodemon','pm2','npm','pnpm','yarn','vite','next','webpack','webpack-dev-server','ts-node','esbuild' |
    ForEach-Object { Stop-Process -Name $_ -ErrorAction SilentlyContinue -Force }
}

function Ensure-WorkspaceSettings {
  $vscodeDir = Join-Path (Get-Location) ".vscode"
  if (-not (Test-Path $vscodeDir)) { New-Item -ItemType Directory -Path $vscodeDir | Out-Null }
  $settingsPath = Join-Path $vscodeDir "settings.json"

  $settings = @{}
  if (Test-Path $settingsPath) {
    try { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json } catch { $settings = @{} }
  }

  $settings.'liveServer.settings.NoBrowser' = $true
  $settings.'liveServer.settings.ignoreFiles' = @('**/*')
  $settings.'liveServer.settings.port' = 0
  $settings.'livePreview.autoOpenPreview' = $false
  $settings.'livePreview.server.autoStart' = $false
  $settings.'previewWebPage.autoOpen' = $false
  $settings.'previewWebPage.defaultUrl' = 'http://127.0.0.1:8081/'

  ($settings | ConvertTo-Json -Depth 6) | Set-Content -Path $settingsPath -Encoding UTF8
  Write-Info "Ajustes de .vscode/settings.json aplicados"
}

function Ensure-TasksJson {
  $vscodeDir = Join-Path (Get-Location) ".vscode"
  $tasksPath = Join-Path $vscodeDir "tasks.json"
  if (Test-Path $tasksPath) {
    $backupPath = Join-Path $vscodeDir ("tasks.backup." + (Get-Date -Format "yyyyMMddHHmmss") + ".json")
    Copy-Item $tasksPath $backupPath -Force
    Write-Warn "tasks.json respaldado en $backupPath"
  }
  $content = @{ version = "2.0.0"; tasks = @() } | ConvertTo-Json
  $content | Set-Content -Path $tasksPath -Encoding UTF8
  Write-Info "tasks.json minimal aplicado (sin auto-lanzamiento)"
}

function Get-NodePath {
  try {
    $nodeCmd = Get-Command node -ErrorAction Stop
    return $nodeCmd.Source
  } catch {
    $default = "C:\\Program Files\\nodejs\\node.exe"
    Write-Warn "No se detectó node.exe en PATH; usando $default. Ajusta si es necesario."
    return $default
  }
}

function Firewall-Apply([string] $nodePath, [switch] $blockOutbound) {
  Ensure-Admin
  Write-Info "Aplicando reglas de firewall para $nodePath"

  # Limpieza previa para idempotencia
  netsh advfirewall firewall delete rule name="Node Allow 127.0.0.1:8081 IN" | Out-Null
  netsh advfirewall firewall delete rule name="Node Block All IN" | Out-Null
  netsh advfirewall firewall delete rule name="Node Allow 127.0.0.1:8081 OUT" | Out-Null
  netsh advfirewall firewall delete rule name="Node Block All OUT" | Out-Null

  # INBOUND
  netsh advfirewall firewall add rule name="Node Allow 127.0.0.1:8081 IN" dir=in action=allow program="$nodePath" protocol=TCP localip=127.0.0.1 localport=8081 profile=any | Out-Null
  netsh advfirewall firewall add rule name="Node Block All IN" dir=in action=block program="$nodePath" protocol=TCP profile=any | Out-Null

  if ($blockOutbound) {
    # OUTBOUND agresivo: permite solo loopback:8081 y bloquea todo lo demás
    netsh advfirewall firewall add rule name="Node Allow 127.0.0.1:8081 OUT" dir=out action=allow program="$nodePath" protocol=TCP remoteip=127.0.0.1 remoteport=8081 profile=any | Out-Null
    netsh advfirewall firewall add rule name="Node Block All OUT" dir=out action=block program="$nodePath" protocol=TCP profile=any | Out-Null
    Write-Warn "Bloqueo OUT habilitado: npm/pnpm/yarn pueden fallar hasta que desbloquees."
  }
  Write-Info "Reglas IN aplicadas; OUT $(if ($blockOutbound) { 'aplicadas' } else { 'NO aplicadas' })."
}

function Firewall-Revert {
  Ensure-Admin
  Write-Info "Revirtiendo reglas de firewall"
  netsh advfirewall firewall delete rule name="Node Allow 127.0.0.1:8081 IN" | Out-Null
  netsh advfirewall firewall delete rule name="Node Block All IN" | Out-Null
  netsh advfirewall firewall delete rule name="Node Allow 127.0.0.1:8081 OUT" | Out-Null
  netsh advfirewall firewall delete rule name="Node Block All OUT" | Out-Null
  Write-Info "Reglas eliminadas"
}

if ($Unlock) {
  Firewall-Revert
  Write-Info "Desbloqueo completado"
  exit 0
}

if ($Lock) {
  Kill-DevProcesses
  Ensure-WorkspaceSettings
  Ensure-TasksJson
  $nodePath = Get-NodePath
  Firewall-Apply -nodePath $nodePath -blockOutbound:$AggressiveOutBlock
  Write-Info "Bloqueo aplicado. Reinicia tu dev server: 'pnpm dev' en 127.0.0.1:8081"
  exit 0
}

Write-Warn "Sin parámetros. Usa -Lock o -Unlock. Ver cabecera del script para ejemplos."