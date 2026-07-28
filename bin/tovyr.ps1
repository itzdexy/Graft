# Tovyr — Windows launcher. Runs Bun directly (better TTY than node→bun).
# Supports: Windows PowerShell 5.1+, PowerShell Core 7+
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Faster progress bar handling

$TovyrScopedEnvNames = @(
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'TOVYR_CODE_DISABLE_THINKING',
  'DISABLE_INTERLEAVED_THINKING',
  'ENABLE_TOOL_SEARCH',
  'TOVYR_PACKAGE_ROOT',
  'TOVYR_SRC',
  'TOVYR_ACTIVE_PROVIDER',
  'TOVYR_PROVIDER_AUTH_MODE',
  'TOVYR_FORCE_INTERACTIVE',
  'TOVYR_SKIP_TERMINAL_QUERIES',
  'TOVYR_CACHE_WARMED',
  'TOVYR_INVOKE_CWD',
  'TOVYR_INVOKE_CWD_LOCKED',
  'TOVYR_IN_WINDOW',
  'TOVYR_ALLOW_HOME',
  'TOVYR_BUN_CMD',
  'TOVYR_DOCTOR_INVOKED_AS',
  'TOVYR_CODE_NO_FLICKER',
  'TOVYR_CODE_OAUTH_TOKEN',
  'TOVYR_CODE_SIMPLE'
)
$TovyrSavedEnvironment = @{}
foreach ($name in $TovyrScopedEnvNames) {
  $item = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  if ($null -eq $item) {
    $TovyrSavedEnvironment[$name] = @{ Exists = $false; Value = $null }
  } else {
    $TovyrSavedEnvironment[$name] = @{ Exists = $true; Value = [string]$item.Value }
  }
}

function Restore-TovyrEnvironment {
  foreach ($name in $TovyrScopedEnvNames) {
    $saved = $TovyrSavedEnvironment[$name]
    if ($saved.Exists) {
      Set-Item -LiteralPath "Env:$name" -Value ([string]$saved.Value)
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}

function Exit-Tovyr {
  param([int]$Code)
  Restore-TovyrEnvironment
  exit $Code
}

# Capture the user's folder at the outermost launcher boundary. Installer,
# npm, and repo shims lock this before any wrapper changes location.
if ($env:TOVYR_INVOKE_CWD_LOCKED -ne '1' -or -not $env:TOVYR_INVOKE_CWD) {
  $env:TOVYR_INVOKE_CWD = (Get-Location).Path
  $env:TOVYR_INVOKE_CWD_LOCKED = '1'
}

# Fresh console for interactive sessions (parent shell scrollback breaks Ink UI).
$cliArgs = @($args)
if ($cliArgs -contains '--in-window') {
  $env:TOVYR_IN_WINDOW = '1'
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--in-window' })
  if ($Host.Name -eq 'ConsoleHost') { Clear-Host }
  if ($env:TOVYR_INVOKE_CWD -and (Test-Path $env:TOVYR_INVOKE_CWD)) {
    Set-Location $env:TOVYR_INVOKE_CWD
  }
}

function Test-IsBunInstalled {
  $bunPaths = @(
    Join-Path $env:USERPROFILE '.bun\bin\bun.exe',
    Join-Path $env:LOCALAPPDATA 'Programs\bun\bin\bun.exe'
  )
  foreach ($path in $bunPaths) {
    if (Test-Path $path) { return $true }
  }
  $cmd = Get-Command bun -ErrorAction SilentlyContinue
  return ($null -ne $cmd)
}

$TovyrCliSubcommands = @('setup', 'doctor', 'bench', 'auth', 'provider', 'chrome', 'config', 'models')

if ($cliArgs -contains '--allow-home') { $env:TOVYR_ALLOW_HOME = '1' }
$cliArgs = @($cliArgs | Where-Object { $_ -ne '--allow-home' })

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'ask') {
  if ($cliArgs.Count -lt 2) {
    Write-Host 'Usage: tovyr ask <question>' -ForegroundColor Red
    Write-Host 'Example: tovyr ask "summarize this repo"' -ForegroundColor DarkGray
    exit 1
  }
  $rest = @($cliArgs[1..($cliArgs.Count - 1)])
  if ($rest -notcontains '-p' -and $rest -notcontains '--print') {
    $cliArgs = @('-p') + $rest
  } else {
    $cliArgs = $rest
  }
}

function Test-IsInteractiveTovyrLaunch {
  param([string[]]$PassArgs)
  if ($PassArgs -contains '-p' -or $PassArgs -contains '--print') { return $false }
  if ($PassArgs -contains '--help' -or $PassArgs -contains '-h') { return $false }
  if ($PassArgs -contains '--version' -or $PassArgs -contains '-v' -or $PassArgs -contains '-V') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -eq 'ask') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -eq 'sessions') { return $false }
  return $true
}

function Invoke-TovyrWarmCompile {
  param([string]$Root)
  $warm = Join-Path $Root 'scripts\tovyr-warm.js'
  if (-not (Test-Path $warm)) { return $true }

  Push-Location $Root
  try {
    $neededOut = & $Node -e "import('./scripts/tovyr-warm.js').then(m => console.log(m.tovyrWarmNeeded() ? '1' : '0'))"
    if ($neededOut -eq '0') {
      $env:TOVYR_CACHE_WARMED = '1'
      return $true
    }

    # Warm must not inherit interactive mode — that hangs the compile child forever.
    # Leave quiet off so the warm child owns the compiling animation.
    $prevForce = $env:TOVYR_FORCE_INTERACTIVE
    $env:TOVYR_FORCE_INTERACTIVE = '0'
    Remove-Item Env:TOVYR_WARM_QUIET_LOADER -ErrorAction SilentlyContinue
    try {
      & $Node $warm
      if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('Compile prep failed; Tovyr will compile on launch (please wait).')
        return $false
      }
      $env:TOVYR_CACHE_WARMED = '1'
      return $true
    } finally {
      if ($null -ne $prevForce -and $prevForce -ne '') {
        $env:TOVYR_FORCE_INTERACTIVE = $prevForce
      } else {
        Remove-Item Env:TOVYR_FORCE_INTERACTIVE -ErrorAction SilentlyContinue
      }
    }
  } finally {
    Pop-Location
  }
}

function Set-TovyrConsoleUtf8 {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  try {
    $null = chcp 65001
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
  } catch {
    # Best-effort; Ink still runs if UTF-8 setup fails.
  }
}

function Enter-TovyrTuiConsole {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  Set-TovyrConsoleUtf8
  # Switch to the alt buffer before warm compile / Ink so the parent PowerShell
  # prompt stays on the main screen and does not paint over setup UI.
  $esc = [char]27
  [Console]::Out.Write("${esc}[?1049h${esc}[2J${esc}[H")
  [Console]::Out.Flush()
}

function Leave-TovyrTuiConsole {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  $esc = [char]27
  [Console]::Out.Write("${esc}[?1049l")
  [Console]::Out.Flush()
}

function Test-TovyrOpenNewWindow {
  param([string[]]$PassArgs)
  # Opt-in only (a separate window flashes/closes on startup hiccups).
  if ($env:TOVYR_NEW_WINDOW -ne '1') { return $false }
  if ($env:TOVYR_IN_WINDOW -eq '1') { return $false }
  if ($env:TOVYR_NO_NEW_WINDOW -eq '1') { return $false }
  if ($PassArgs -contains '--help' -or $PassArgs -contains '-h') { return $false }
  if ($PassArgs -contains '--version' -or $PassArgs -contains '-v' -or $PassArgs -contains '-V') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -eq 'ask') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -eq 'sessions') { return $false }
  return $true
}

function Start-TovyrNewWindow {
  param([string[]]$PassArgs)
  $ps1 = $PSCommandPath
  $cwd = (Get-Location).Path
  $newArgs = @('--in-window') + $PassArgs
  $wtCmd = Get-Command wt.exe -ErrorAction SilentlyContinue
  $wt = if ($wtCmd) { $wtCmd.Source } else { $null }
  $psLaunch = @(
    'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1
  ) + $newArgs
  if ($wt) {
    $argList = @('new-tab', '-d', $cwd, '--title', 'Tovyr') + $psLaunch
    Start-Process -FilePath $wt -ArgumentList $argList | Out-Null
  } else {
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $cwd -ArgumentList (
      @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1) + $newArgs
    ) | Out-Null
  }
}

if (Test-TovyrOpenNewWindow -PassArgs $cliArgs) {
  Start-TovyrNewWindow -PassArgs $cliArgs
  exit 0
}

if ($Host.Name -eq 'ConsoleHost') {
  $Host.UI.RawUI.WindowTitle = 'Tovyr'
}

$sourceRoot = Split-Path $PSScriptRoot -Parent
$PkgRoot = if (Test-Path (Join-Path $sourceRoot 'entrypoints\cli.tsx')) {
  $sourceRoot
} elseif ($env:TOVYR_PACKAGE_ROOT) {
  $env:TOVYR_PACKAGE_ROOT
} elseif ($env:TOVYR_SRC) {
  $env:TOVYR_SRC
} else {
  Split-Path $PSScriptRoot -Parent
}

$Bun = if ($env:BUN_INSTALL) {
  Join-Path $env:BUN_INSTALL 'bin\bun.exe'
} else {
  Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
}
if (-not (Test-Path $Bun)) {
  $found = Get-Command bun -ErrorAction SilentlyContinue
  if ($found) { $Bun = $found.Source }
}
if (-not (Test-Path $Bun) -and -not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun is required. Install: https://bun.sh" -ForegroundColor Red
  Write-Host '  powershell -c "irm bun.sh/install.ps1 | iex"' -ForegroundColor Yellow
  exit 1
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  # Bun can execute Tovyr's JavaScript launcher helpers.
  $Node = $Bun
}

# Verify Bun is executable
try {
  $null = & $Bun --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Bun exited with code $LASTEXITCODE"
  }
} catch {
  Write-Host "Bun executable found but failed to run. Reinstall Bun: https://bun.sh" -ForegroundColor Red
  Write-Host "Bun executable found but failed to run. Reinstall Bun: https://bun.sh" -ForegroundColor Red
  exit 1
}

# Child Node helpers resolve Bun independently. Replace stale user-level
# overrides only after this executable has passed the native version probe.
$env:TOVYR_BUN_CMD = $Bun

$cliEntry = Join-Path $PkgRoot 'entrypoints\cli.tsx'
if (-not (Test-Path $cliEntry)) {
  if ($cliArgs.Count -ge 1 -and ($cliArgs[0] -eq 'setup' -or $cliArgs[0] -eq 'doctor')) {
    $env:TOVYR_DOCTOR_INVOKED_AS = $cliArgs[0]
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-doctor.js')
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'config') {
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-config-cli.js')
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'bench') {
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-bench-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'models') {
    $modelArgs = if ($cliArgs.Count -ge 2) { @('models', $cliArgs[1]) } else { @('models') }
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-provider-cli.js') @modelArgs
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'provider') {
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-provider-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'chrome') {
    & $Node (Join-Path $PkgRoot 'scripts\tovyr-chrome-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
    exit $LASTEXITCODE
  }

  if ($cliArgs.Count -ge 2 -and $cliArgs[0] -eq 'auth' -and $cliArgs[1] -eq 'login') {
    $env:TOVYR_WIN_PS_LAUNCH = '1'
    & $Node (Join-Path $PkgRoot 'bin\tovyr.js') @cliArgs
    exit $LASTEXITCODE
  }

  Write-Error (
    "Tovyr source not found at $PkgRoot (missing entrypoints\cli.tsx). " +
    "Tovyr will not fall back to, patch, or launch another AI CLI."
  )
}

if ($cliArgs.Count -ge 1 -and ($cliArgs[0] -eq 'setup' -or $cliArgs[0] -eq 'doctor')) {
  $env:TOVYR_DOCTOR_INVOKED_AS = $cliArgs[0]
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-doctor.js')
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'config') {
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-config-cli.js')
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'bench') {
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-bench-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'models') {
  $modelArgs = if ($cliArgs.Count -ge 2) { @('models', $cliArgs[1]) } else { @('models') }
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-provider-cli.js') @modelArgs
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'provider') {
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-provider-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 1 -and $cliArgs[0] -eq 'chrome') {
  & $Node (Join-Path $PkgRoot 'scripts\tovyr-chrome-cli.js') @($cliArgs[1..($cliArgs.Count - 1)])
  exit $LASTEXITCODE
}

if ($cliArgs.Count -ge 2 -and $cliArgs[0] -eq 'auth' -and $cliArgs[1] -eq 'login') {
  $env:TOVYR_WIN_PS_LAUNCH = '1'
  & $Node (Join-Path $PkgRoot 'bin\tovyr.js') @cliArgs
  exit $LASTEXITCODE
}

# Static paths never require provider credentials or a warm interactive cache.
if ($cliArgs.Count -eq 1 -and ($cliArgs[0] -eq '--version' -or $cliArgs[0] -eq '-v' -or $cliArgs[0] -eq '-V' -or $cliArgs[0] -eq '--help' -or $cliArgs[0] -eq '-h')) {
  $env:TOVYR_WIN_PS_LAUNCH = '1'
  & $Node (Join-Path $PkgRoot 'bin\tovyr.js') @cliArgs
  exit $LASTEXITCODE
}

$exitCode = 0
try {
Push-Location $PkgRoot
try {
  $envJson = & $Node -e "import('./scripts/tovyr-prep-auth.js').then(m => console.log(JSON.stringify(m.buildTovyrChildAuthEnv())))"
} finally {
  Pop-Location
}
try {
  $auth = $envJson | ConvertFrom-Json
  $env:TOVYR_PACKAGE_ROOT = $PkgRoot
  $env:TOVYR_SRC = $PkgRoot
  $env:TOVYR_FORCE_INTERACTIVE = '1'
  if (-not $env:TOVYR_CODE_NO_FLICKER) { $env:TOVYR_CODE_NO_FLICKER = '1' }
  $env:TOVYR_SKIP_TERMINAL_QUERIES = '1'
  foreach ($prop in $auth.PSObject.Properties) {
    $name = $prop.Name
    $val = [string]$prop.Value
    if ($val) {
      Set-Item -Path "Env:$name" -Value $val
    } else {
      Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Error "Failed to load auth env: $_"
}
Remove-Item Env:TOVYR_CODE_OAUTH_TOKEN -ErrorAction SilentlyContinue

if ($cliArgs -contains '--fast') {
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--fast' })
  if ($cliArgs -notcontains '--bare') { $cliArgs = @('--bare') + $cliArgs }
  $env:TOVYR_CODE_SIMPLE = '1'
} elseif ($cliArgs -contains '--bare') {
  $env:TOVYR_CODE_SIMPLE = '1'
} elseif ($cliArgs -contains '--full') {
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--full' })
  Remove-Item Env:TOVYR_CODE_SIMPLE -ErrorAction SilentlyContinue
} else {
  if ($cliArgs -notcontains '--bare') { $cliArgs = @('--bare') + $cliArgs }
  $env:TOVYR_CODE_SIMPLE = '1'
}

if (Test-IsInteractiveTovyrLaunch -PassArgs $cliArgs) {
  $null = Invoke-TovyrWarmCompile -Root $PkgRoot
}

Push-Location $PkgRoot
try {
  & $Bun $cliEntry @cliArgs
  if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE }
} catch {
  $exitCode = 1
  [Console]::Error.WriteLine('')
  [Console]::Error.WriteLine("Tovyr failed to start: $_")
} finally {
  Pop-Location
}
} finally {
  foreach ($name in $TovyrScopedEnvNames) {
    $saved = $TovyrSavedEnvironment[$name]
    if ($saved.Exists) {
      Set-Item -LiteralPath "Env:$name" -Value ([string]$saved.Value)
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}
if ($exitCode -ne 0 -and $exitCode -ne 130) {
  [Console]::Error.WriteLine('')
  [Console]::Error.WriteLine("Tovyr exited with code $exitCode. Run: tovyr setup")
  [Console]::Error.WriteLine('For details: tovyr --debug-to-stderr')
}
exit $exitCode
