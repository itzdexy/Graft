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

$TovyrCliSubcommands = @(
  'setup', 'doctor', 'bench', 'auth', 'provider', 'chrome', 'config', 'models', 'sessions',
  'serve', 'mcp', 'providers', 'launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'
)
$TovyrAppCommands = @(
  'launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'
)

if ($cliArgs -contains '--allow-home') { $env:TOVYR_ALLOW_HOME = '1' }
$cliArgs = @($cliArgs | Where-Object { $_ -ne '--allow-home' })

# ask/review/fix/plan turn a scope into a print-mode prompt. bin/tovyr.js owns
# that construction (buildWorkflowPrintArgs); this launcher must not re-derive
# it, or the two entry points drift.
$TovyrWorkflowCommands = @('ask', 'review', 'fix', 'plan')

function Test-IsInteractiveTovyrLaunch {
  param([string[]]$PassArgs)
  if ($PassArgs -contains '-p' -or $PassArgs -contains '--print') { return $false }
  if ($PassArgs -contains '--help' -or $PassArgs -contains '-h') { return $false }
  if ($PassArgs -contains '--version' -or $PassArgs -contains '-v' -or $PassArgs -contains '-V') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrWorkflowCommands) { return $false }
  return $true
}

function Invoke-TovyrWarmCompile {
  param([string]$Root)
  $warm = Join-Path $Root 'scripts\tovyr-warm.js'
  if (-not (Test-Path $warm)) { return $true }

  # Staleness is decided only by tovyrWarmNeeded(). This used to be shortcut by
  # an inline check of six entry files, which missed every edit under
  # components/** and services/** — i.e. most of the product — so the launcher
  # silently served a stale compiled bundle and source changes never appeared.
  # The real fingerprint walks those trees; it memoizes per process and costs
  # ~20ms, which is not worth risking a stale UI to save.
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
  if ($PassArgs -contains '-p' -or $PassArgs -contains '--print') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $TovyrWorkflowCommands) { return $false }
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
$PkgRoot = if (Test-Path (Join-Path $sourceRoot 'src\entrypoints\cli.tsx')) {
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
  exit 1
}

# Child Node helpers resolve Bun independently. Replace stale user-level
# overrides only after this executable has passed the native version probe.
$env:TOVYR_BUN_CMD = $Bun

$cliEntry = Join-Path $PkgRoot 'src\entrypoints\cli.tsx'

# This launcher exists for exactly one reason: npm's node->bun hop breaks Ink
# raw mode on Windows, so the interactive UI has to start Bun in-process. Every
# other path -- subcommands, workflow prompts, --help/--version, print mode --
# is dispatched by bin/tovyr.js, which owns the subcommand table, the workflow
# prompt builder, the exit codes, and the source-missing fallbacks. Keeping a
# second copy of that table here is what silently dropped `sessions` and
# `review|fix|plan`: both were declared non-interactive but never routed, so
# they fell through and were handed to the agent as raw positional arguments.
# TOVYR_WIN_PS_LAUNCH stops tovyr.js from delegating straight back here.
if (-not (Test-IsInteractiveTovyrLaunch -PassArgs $cliArgs)) {
  $nodeCli = Join-Path $PkgRoot 'bin\tovyr.js'
  if (-not (Test-Path $nodeCli)) {
    Write-Host "Tovyr launcher not found at $nodeCli." -ForegroundColor Red
    Write-Host 'Reinstall the tovyr package.' -ForegroundColor DarkGray
    Exit-Tovyr 1
  }
  $env:TOVYR_WIN_PS_LAUNCH = '1'
  & $Node $nodeCli @cliArgs
  Exit-Tovyr $LASTEXITCODE
}

# Interactive launch only: without the source entry there is nothing to run.
if (-not (Test-Path $cliEntry)) {
  Write-Host "Tovyr source not found at $PkgRoot (missing src\entrypoints\cli.tsx)." -ForegroundColor Red
  Write-Host 'Tovyr will not fall back to, patch, or launch another AI CLI.' -ForegroundColor DarkGray
  Write-Host 'Install the complete tovyr package or run from its source checkout.' -ForegroundColor DarkGray
  Exit-Tovyr 1
}

$exitCode = 0
try {
$env:TOVYR_PACKAGE_ROOT = $PkgRoot
$env:TOVYR_SRC = $PkgRoot
$env:TOVYR_FORCE_INTERACTIVE = '1'
if (-not $env:TOVYR_CODE_NO_FLICKER) { $env:TOVYR_CODE_NO_FLICKER = '1' }
$env:TOVYR_SKIP_TERMINAL_QUERIES = '1'

# Interactive init reads the active provider straight from Tovyr's config, so
# no throwaway Node process runs before Bun can start accepting input. The
# non-interactive auth prep that used to sit here is gone: those invocations
# now delegate to bin/tovyr.js above, which runs buildTovyrChildAuthEnv itself.
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

$null = Invoke-TovyrWarmCompile -Root $PkgRoot

$runtimeEntry = Join-Path $PkgRoot '.cache\runtime\tovyr-cli.js'
# Existence alone is not enough: a bundle left over from an earlier build is
# exactly how stale code gets served. Only run it when the warm step confirmed
# the cache matches current source, otherwise fall back to compiling from
# source — slower to start, but never wrong.
if (
  $cliArgs -contains '--bare' -and
  (Test-Path $runtimeEntry) -and
  $env:TOVYR_CACHE_WARMED -eq '1'
) {
  $cliEntry = $runtimeEntry
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
  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -in $TovyrAppCommands) {
    [Console]::Error.WriteLine("Tovyr app command '$($cliArgs[0])' exited with code $exitCode.")
    [Console]::Error.WriteLine('Run: tovyr apps list   (verify providers/models)')
  } else {
    [Console]::Error.WriteLine("Tovyr exited with code $exitCode. Run: tovyr setup")
  }
  [Console]::Error.WriteLine('For details: tovyr --debug-to-stderr')
}
exit $exitCode
