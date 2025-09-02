# setup-piston-fixed.ps1
# Run: .\setup-piston-fixed.ps1

Write-Host "Setting up Piston Code Execution Engine..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Blue

# 0) Optional: make this run even if your ExecutionPolicy is strict
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass | Out-Null

# 1) Verify Docker CLI works
Write-Host "`nStep 1: Verifying Docker Installation" -ForegroundColor Cyan
try {
  docker --version | Out-Null
  Write-Host "Docker found." -ForegroundColor Green
} catch {
  Write-Host "Docker is not installed or not running. Start Docker Desktop and retry." -ForegroundColor Red
  exit 1
}

# 2) Choose host port (2000 by default; auto-fallback to 2001 if busy)
function Test-Port($p) {
  try { return (Test-NetConnection -ComputerName '127.0.0.1' -Port $p -InformationLevel Quiet) } catch { return $false }
}
$HostPort = 2000
if (Test-Port $HostPort) {
  Write-Host "Port $HostPort is already in use; switching to 2001." -ForegroundColor Yellow
  $HostPort = 2001
}

# 3) Clean up any old container/volume
Write-Host "`nStep 2: Cleaning up old resources" -ForegroundColor Cyan
docker rm -f piston_api 2>$null | Out-Null
docker volume rm piston_data 2>$null | Out-Null
docker volume create piston_data | Out-Null
Write-Host "Cleanup done; volume created." -ForegroundColor Green

# 4) Pull image (idempotent)
Write-Host "`nStep 3: Pulling image" -ForegroundColor Cyan
docker pull ghcr.io/engineer-man/piston:latest | Out-Null
Write-Host "Image ready." -ForegroundColor Green

# 5) Run container with correct env + writable workdir
Write-Host "`nStep 4: Starting container" -ForegroundColor Cyan
$dockerArgs = @(
  "run","-d",
  "--name","piston_api",
  "--restart","unless-stopped",
  "-p","$HostPort`:2000",
  "-e","PORT=2000",              # correct bind env
  "-e","PISTON_LOG_LEVEL=debug",
  "-v","piston_data:/piston",    # data persists here
  "-w","/piston",                 # make working dir writable
  "ghcr.io/engineer-man/piston:latest"
)
& docker $dockerArgs
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to start container. Logs:" -ForegroundColor Red
  docker logs piston_api
  exit 1
}
Write-Host "Container started." -ForegroundColor Green

# 6) Wait for "Up"
Write-Host "`nStep 5: Waiting for container to be Up" -ForegroundColor Cyan
$up=$false
1..20 | ForEach-Object {
  Start-Sleep -Seconds 2
  $st = docker ps --filter "name=piston_api" --format "{{.Status}}"
  if ($st -like "Up*") { $up=$true; break }
}
if (-not $up) {
  Write-Host "Container did not reach 'Up' state. Logs:" -ForegroundColor Red
  docker logs piston_api
  exit 1
}
Write-Host "Container is Up. Port: http://localhost:$HostPort" -ForegroundColor Green

# 7) Health check (runtimes list may be empty before install)
Write-Host "`nStep 6: Checking API health" -ForegroundColor Cyan
$ok=$false
1..15 | ForEach-Object {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:$HostPort/api/v2/runtimes" -TimeoutSec 5
    $cnt = if ($r) { $r.Length } else { 0 }
    Write-Host "API reachable. Current runtimes: $cnt" -ForegroundColor Green
    $ok=$true; break
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $ok) {
  Write-Host "API did not respond. Logs:" -ForegroundColor Red
  docker logs piston_api
  exit 1
}

# 8) Install language runtimes (via piston-cli)
Write-Host "`nStep 7: Installing runtimes" -ForegroundColor Cyan
$languages = @{
  "python"     = "3.10.0"
  "javascript" = "18.15.0"
  "java"       = "15.0.2"
  "cpp"        = "10.2.0"
  "c"          = "10.2.0"
}
foreach ($kv in $languages.GetEnumerator()) {
  Write-Host ("Installing {0} {1}..." -f $kv.Key,$kv.Value) -ForegroundColor Yellow
  & docker exec piston_api piston-cli package install $kv.Key $kv.Value
  if ($LASTEXITCODE -ne 0) { Write-Host "Warning: Failed to install $($kv.Key) $($kv.Value)" -ForegroundColor Yellow }
}

Write-Host "`nInstalled packages:" -ForegroundColor Blue
docker exec piston_api piston-cli package list

# 9) Quick execute test (Hello World)
Write-Host "`nStep 8: Test code execution (Python)" -ForegroundColor Cyan
$payload = @{
  language = "python"
  version  = "3.10.0"
  files    = @(@{ name="main.py"; content="print('Hello from Piston!')" })
} | ConvertTo-Json -Depth 5
try {
  $res = Invoke-RestMethod -Uri "http://localhost:$HostPort/api/v2/execute" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 30
  Write-Host "Execution stdout: $($res.run.stdout)" -ForegroundColor Green
} catch {
  Write-Host "Execution test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n================================================" -ForegroundColor Blue
Write-Host "Piston is ready at: http://localhost:$HostPort/api/v2" -ForegroundColor Green
Write-Host "If you want network isolation for user code, set PISTON_DISABLE_NETWORKING=true later and recreate." -ForegroundColor DarkGray
