param(
  [int]$Port = 8081,
  [string]$BindHost = "127.0.0.1",
  [string]$ProjectPath = "C:\Users\djklm\Desktop\ARKAIOS\cosmos-den"
)
"node","vite","webpack-dev-server","next","npm","pnpm","yarn" | % { Stop-Process -Name $_ -ErrorAction SilentlyContinue -Force }
Start-Process -FilePath "cmd.exe" -WorkingDirectory $ProjectPath -ArgumentList "/k pnpm dlx vite --host $BindHost --port $Port --strictPort"
