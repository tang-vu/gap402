$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
& 'D:\Node\node.exe' (Join-Path $repoRoot 'scripts/start-host.cjs')
if ($LASTEXITCODE -ne 0) { throw "Gap402 PM2 startup failed: $LASTEXITCODE" }
