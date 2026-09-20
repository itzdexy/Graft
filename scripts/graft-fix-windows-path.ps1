# Remove stale Graft shims that override the real launcher (Bun source CLI).
$ErrorActionPreference = 'SilentlyContinue'

$SrcRoot = if ($env:GRAFT_SRC) { $env:GRAFT_SRC } else { Split-Path $PSScriptRoot -Parent }

$stale = @(
  (Join-Path $env:USERPROFILE '.local\bin\graft.ps1'),
  (Join-Path $env:USERPROFILE '.local\bin\graft.cmd'),
  (Join-Path $env:USERPROFILE '.local\bin\graft'),
  (Join-Path $env:USERPROFILE '.bun\bin\graft.ps1'),
  (Join-Path $env:USERPROFILE '.bun\bin\graft.cmd'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\graft.ps1'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\graft.cmd')
)

foreach ($p in $stale) {
  if (Test-Path $p) {
    Remove-Item $p -Force
    Write-Host "Removed stale shim: $p"
  }
}

# Optional: install a shim that delegates to bin/graft.js in this repo
$bunBin = Join-Path $env:USERPROFILE '.bun\bin'
if (-not (Test-Path $bunBin)) {
  New-Item -ItemType Directory -Path $bunBin -Force | Out-Null
}

$shimPs1 = Join-Path $bunBin 'graft.ps1'
$shimContent = @"
# Graft — delegates to source launcher (Bun only)
`$ErrorActionPreference = 'Stop'
`$SrcRoot = '$($SrcRoot.Replace("'", "''"))'
`$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not `$Node) { `$Node = 'node' }
& `$Node (Join-Path `$SrcRoot 'bin\graft.js') @args
exit `$LASTEXITCODE
"@
Set-Content -Path $shimPs1 -Value $shimContent -Encoding UTF8
Write-Host "Installed launcher: $shimPs1"

$npmGraft = Join-Path $env:APPDATA 'npm\graft.cmd'
if (Test-Path $npmGraft) {
  Write-Host "npm global graft: $npmGraft"
} else {
  Write-Host "Optional: cd $SrcRoot && npm link"
}

Write-Host ""
Write-Host "Open a NEW terminal, then:"
Write-Host "  graft auth login --key fe_oa_YOUR_KEY"
Write-Host "  graft"
