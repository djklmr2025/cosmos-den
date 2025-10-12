param(
  [int]$Port = 8081
)

Write-Host "=== ARKAIOS: Stop dev ===" -ForegroundColor Cyan

# Matar por puerto
$pid = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid) {
  Write-Host "Matando proceso en puerto $Port (PID $pid)..." -ForegroundColor Yellow
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

# Matar procesos típicos
$names = @('vite','webpack-dev-server','next','node','nodemon','pm2')
foreach ($n in $names) {
  Stop-Process -Name $n -ErrorAction SilentlyContinue -Force
}

Write-Host "Terminado. Verifica con: Get-Process node" -ForegroundColor Green
