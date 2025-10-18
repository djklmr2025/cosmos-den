# Smoke test de integración ARKAIOS
# cosmos-den ↔ MCP HTTP ↔ Gateway

param(
  [string]$GatewayUrl,
  [string]$McpUrl,
  [int]$CosmosPort
)

function Get-EnvOrDefault([string]$name, [string]$default) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) { return $default }
  return $v
}

$gw = if ($GatewayUrl) { $GatewayUrl } else { Get-EnvOrDefault 'AIDA_GATEWAY_URL' 'https://arkaios-gateway-open.onrender.com/aida/gateway' }
$mcpBase = if ($McpUrl) { $McpUrl } else {
  $mcpPort = Get-EnvOrDefault 'MCP_HTTP_PORT' '8090'
  "http://localhost:$mcpPort"
}
$cosmosPort = if ($CosmosPort) { $CosmosPort } else { [int](Get-EnvOrDefault 'ARK_PORT' '8082') }

$cosmosBase = "http://localhost:$cosmosPort"

# Derivar health del Gateway
$gwHealth = if ($gw -match '/aida/gateway$') { $gw -replace '/aida/gateway$', '/aida/health' } else { $gw.TrimEnd('/') + '/aida/health' }
$mcpHealth = $mcpBase.TrimEnd('/') + '/mcp/health'
$mcpRun = $mcpBase.TrimEnd('/') + '/mcp/run'
$indexUrl = 'https://djklmr2025.github.io/builderOS_Lab/index.json'

# Token opcional
$token = Get-EnvOrDefault 'AIDA_AUTH_TOKEN' ''
if (-not [string]::IsNullOrWhiteSpace($token) -and ($token -notmatch '^Bearer ')) {
  $token = 'Bearer ' + $token
}

function Show-Result($name, $ok, $data) {
  $status = if ($ok) { 'OK' } else { 'ERROR' }
  Write-Host ("[{0}] {1}" -f $status, $name)
  if ($data) {
    try {
      $pretty = ($data | ConvertTo-Json -Depth 8)
      Write-Host $pretty
    } catch {
      Write-Host ($data | Out-String)
    }
  }
  Write-Host ''
}

try {
  # 1) Gateway health
  $h = Invoke-RestMethod -Method Get -Uri $gwHealth -TimeoutSec 18
  Show-Result 'Gateway /aida/health' $true $h
} catch {
  Show-Result 'Gateway /aida/health' $false $_
}

try {
  # 2) Gateway plan
  $bodyPlan = @{ agent_id = 'cosmos' ; action = 'plan' ; params = @{ objective = 'Validación de integración ARKAIOS' } } | ConvertTo-Json
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = $token }
  $p = Invoke-RestMethod -Method Post -Uri $gw -Headers $headers -Body $bodyPlan -TimeoutSec 18
  Show-Result 'Gateway plan' $true $p
} catch {
  Show-Result 'Gateway plan' $false $_
}

try {
  # 3) Gateway read
  $bodyRead = @{ agent_id = 'cosmos' ; action = 'read' ; params = @{ target = $indexUrl } } | ConvertTo-Json
  $headers2 = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers2['Authorization'] = $token }
  $r = Invoke-RestMethod -Method Post -Uri $gw -Headers $headers2 -Body $bodyRead -TimeoutSec 18
  Show-Result 'Gateway read index.json' $true $r
} catch {
  Show-Result 'Gateway read index.json' $false $_
}

try {
  # 4) MCP health
  $mh = Invoke-RestMethod -Method Get -Uri $mcpHealth -TimeoutSec 12
  Show-Result 'MCP /mcp/health' $true $mh
} catch {
  Show-Result 'MCP /mcp/health' $false $_
}

try {
  # 5) cosmos-den health
  $ch = Invoke-RestMethod -Method Get -Uri ($cosmosBase.TrimEnd('/') + '/health') -TimeoutSec 8
  Show-Result 'cosmos-den /health' $true $ch
} catch {
  Show-Result 'cosmos-den /health' $false $_
}

Write-Host 'Smoke test completado.'