# Remove stale Tovyr shims that override the real launcher (Bun source CLI).
$ErrorActionPreference = 'SilentlyContinue'

$SrcRoot = if ($env:TOVYR_SRC) { $env:TOVYR_SRC } else { Split-Path $PSScriptRoot -Parent }

$stale = @(
  (Join-Path $env:USERPROFILE '.local\bin\tovyr.ps1'),
  (Join-Path $env:USERPROFILE '.local\bin\tovyr.cmd'),
  (Join-Path $env:USERPROFILE '.local\bin\tovyr'),
  (Join-Path $env:USERPROFILE '.bun\bin\tovyr.ps1'),
  (Join-Path $env:USERPROFILE '.bun\bin\tovyr.cmd'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\tovyr.ps1'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\tovyr.cmd')
)

foreach ($p in $stale) {
  if (Test-Path $p) {
    Remove-Item $p -Force
    Write-Host "Removed stale shim: $p"
  }
}

# Optional: install a shim that delegates to bin/tovyr.js in this repo
$bunBin = Join-Path $env:USERPROFILE '.bun\bin'
if (-not (Test-Path $bunBin)) {
  New-Item -ItemType Directory -Path $bunBin -Force | Out-Null
}

$shimPs1 = Join-Path $bunBin 'tovyr.ps1'
$shimContent = @"
# Tovyr — delegates to source launcher (Bun only)
`$ErrorActionPreference = 'Stop'
`$SrcRoot = '$($SrcRoot.Replace("'", "''"))'
`$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not `$Node) { `$Node = 'node' }
& `$Node (Join-Path `$SrcRoot 'bin\tovyr.js') @args
exit `$LASTEXITCODE
"@
Set-Content -Path $shimPs1 -Value $shimContent -Encoding UTF8
Write-Host "Installed launcher: $shimPs1"

$npmTovyr = Join-Path $env:APPDATA 'npm\tovyr.cmd'
if (Test-Path $npmTovyr) {
  Write-Host "npm global tovyr: $npmTovyr"
} else {
  Write-Host "Optional: cd $SrcRoot && npm link"
}

Write-Host ""
Write-Host "Open a NEW terminal, then:"
Write-Host "  tovyr auth login --key fe_oa_YOUR_KEY"
Write-Host "  tovyr"
