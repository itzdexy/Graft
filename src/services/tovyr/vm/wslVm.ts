/**
 * A real VM for agents, backed by WSL.
 *
 * Tovyr ships `@anthropic-ai/sandbox-runtime`, but on Windows it needs
 * `srt-win.exe` — a Rust binary that is not shipped and must be built with
 * cargo — so `isSandboxingEnabled()` is always false there and agents run
 * directly on the host. WSL is already present, needs no compilation, and
 * gives a genuine kernel boundary.
 *
 * Two profiles, defined in sandboxProfile.ts:
 *
 *   isolated  — no Windows drives, no network, resource caps, own PID
 *               namespace. The default, and the one dangerous work goes to.
 *   workspace — the old behaviour: /mnt mounted, network up, no caps. Useful
 *               for building the user's actual checkout; not a boundary.
 */
import { spawn } from 'node:child_process'
import {
  defaultDistro,
  parseWslDistros,
  quoteForBash,
  toWslPath,
  type WslDistro,
} from './wslPaths.js'
import {
  buildGuestScript,
  DEFAULT_SANDBOX_PROFILE,
  isValidSandboxId,
  sandboxDir,
  type SandboxLimits,
  type SandboxProfile,
} from './sandboxProfile.js'

const PROBE_TIMEOUT_MS = 10_000
const DEFAULT_RUN_TIMEOUT_MS = 120_000
/** Keep a runaway build from filling the context window. */
const MAX_OUTPUT_CHARS = 30_000

/**
 * Noise WSL itself writes to stderr, unrelated to the command that ran.
 *
 * WSL appends the Windows PATH to the guest's, and warns once per entry it
 * cannot map — so a machine with a few unusual PATH entries prepends that
 * warning to *every* command's stderr. Left in, it would land in the model's
 * context on each call and make successful commands look like they errored.
 */
const WSL_NOISE_PATTERNS = [
  /^wsl: Failed to translate .*$/gm,
  /^wsl: 检测到 localhost.*$/gm,
  /^wsl: Detected localhost proxy configuration.*$/gm,
]

function stripWslNoise(stderr: string): string {
  let cleaned = stderr
  for (const pattern of WSL_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim()
}

export type VmRunResult = {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
}

function runProcess(
  file: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
  stdin?: string,
): Promise<VmRunResult> {
  return new Promise(resolve => {
    const child = spawn(file, args, { windowsHide: true })
    if (stdin !== undefined) {
      // The guest script is delivered here rather than as an argv element.
      // Windows rebuilds a command line for wsl.exe, and that round-trip
      // mangles embedded double quotes -- a command containing `bash -c "..."`
      // arrived in the guest as a syntax error, and the shell reported it by
      // printing whatever came before and exiting 0.
      child.stdin?.on('error', () => {})
      child.stdin?.end(stdin)
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const finish = (exitCode: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve({
        ok: exitCode === 0 && !timedOut,
        exitCode,
        // WSL emits UTF-16 for its own management output but UTF-8 from the
        // guest; NULs only appear in the former, and stripping them here keeps
        // both readable.
        stdout: stdout.replace(/\0/g, '').slice(0, MAX_OUTPUT_CHARS),
        stderr: stripWslNoise(stderr.replace(/\0/g, '')).slice(
          0,
          MAX_OUTPUT_CHARS,
        ),
        timedOut,
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
      finish(124)
    }, timeoutMs)
    timer.unref?.()

    const onAbort = () => {
      child.kill()
      finish(130)
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout?.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', error => {
      stderr += error instanceof Error ? error.message : String(error)
      finish(127)
    })
    child.on('close', code => finish(code ?? 0))
  })
}

/** Distros installed on this machine, or [] when WSL is unavailable. */
export async function listVmDistros(): Promise<WslDistro[]> {
  const result = await runProcess('wsl.exe', ['-l', '-v'], PROBE_TIMEOUT_MS)
  if (!result.ok && !result.stdout.trim()) return []
  return parseWslDistros(result.stdout)
}

export type VmAvailability =
  | { available: true; distro: WslDistro }
  | { available: false; reason: string }

/** Whether an agent VM can run here, and which distro it would use. */
export async function checkVmAvailability(): Promise<VmAvailability> {
  if (process.platform !== 'win32') {
    return {
      available: false,
      reason: 'The WSL agent VM is Windows-only.',
    }
  }

  const distros = await listVmDistros()
  const chosen = defaultDistro(
    // docker-desktop is WSL plumbing for Docker, not a general-purpose distro;
    // running agent commands in it would be surprising and mostly broken.
    distros.filter(d => !/^docker-desktop/i.test(d.name)),
  )
  if (!chosen) {
    return {
      available: false,
      reason:
        'No WSL distribution found. Install one with: wsl --install -d Ubuntu',
    }
  }
  if (chosen.version < 2) {
    return {
      available: false,
      reason: `${chosen.name} is WSL version ${chosen.version}; version 2 is required. Convert it with: wsl --set-version ${chosen.name} 2`,
    }
  }
  return { available: true, distro: chosen }
}

export type VmRunOptions = {
  /**
   * Where to run.
   *
   * In `workspace` this is a Windows path, translated to its /mnt mount. In
   * `isolated` there is no /mnt, so a Windows path is meaningless and this is
   * ignored in favour of the sandbox directory.
   */
  cwd?: string
  timeoutMs?: number
  signal?: AbortSignal
  distro?: string
  /** Defaults to `isolated`. */
  profile?: SandboxProfile
  /** `isolated` only. Off by default; `workspace` always has the network. */
  network?: boolean
  /** Which sandbox to run in. Reused across calls so state persists. */
  sandboxId?: string
  limits?: SandboxLimits
}

/**
 * Run a shell command inside the VM.
 *
 * `bash -lc` so the guest's PATH, nvm, pyenv and friends are set up the way an
 * interactive user would find them — an agent installing a toolchain and then
 * failing to find it is the most common way this kind of integration
 * disappoints.
 */
export async function runInVm(
  command: string,
  options: VmRunOptions = {},
): Promise<VmRunResult> {
  const availability = await checkVmAvailability()
  if (!availability.available) {
    return {
      ok: false,
      exitCode: 127,
      stdout: '',
      stderr: availability.reason,
      timedOut: false,
    }
  }

  const distro = options.distro ?? availability.distro.name
  const profile = options.profile ?? DEFAULT_SANDBOX_PROFILE

  let guestCwd: string | undefined
  if (profile === 'workspace' && options.cwd) {
    try {
      guestCwd = toWslPath(options.cwd)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        exitCode: 127,
        stdout: '',
        stderr: `Cannot enter working directory: ${message}`,
        timedOut: false,
      }
    }
  }

  let script: string
  try {
    script = buildGuestScript({
      profile,
      command,
      cwd: guestCwd,
      network: options.network,
      sandboxId: options.sandboxId ?? DEFAULT_SANDBOX_ID,
      limits: options.limits,
    })
  } catch (error) {
    return {
      ok: false,
      exitCode: 127,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      timedOut: false,
    }
  }

  return runProcess(
    'wsl.exe',
    ['-d', distro, '--', 'bash', '-s'],
    options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS,
    options.signal,
    script,
  )
}

/** Sandbox used when a caller does not name one. */
export const DEFAULT_SANDBOX_ID = 'default'

type SandboxFileOptions = {
  distro?: string
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * Copy host paths into a sandbox.
 *
 * Runs in `workspace` mode on purpose: the copy needs /mnt, which is exactly
 * what the isolated profile removes. Nothing reaches the sandbox except what
 * a caller names here, which is the point -- the agent asks for the three
 * files a task needs instead of the whole disk coming along by default.
 */
export async function vmPut(
  hostPaths: string[],
  sandboxId: string,
  options: SandboxFileOptions = {},
): Promise<VmRunResult> {
  if (!isValidSandboxId(sandboxId)) {
    return {
      ok: false,
      exitCode: 2,
      stdout: '',
      stderr: `Invalid sandbox id: ${sandboxId}`,
      timedOut: false,
    }
  }
  const dir = sandboxDir(sandboxId)
  const parts = [`mkdir -p ${dir}`]
  for (const hostPath of hostPaths) {
    let guestPath: string
    try {
      guestPath = toWslPath(hostPath)
    } catch (error) {
      return {
        ok: false,
        exitCode: 2,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        timedOut: false,
      }
    }
    parts.push(`cp -R ${quoteForBash(guestPath)} ${dir}/`)
  }
  return runInVm(parts.join(' && '), {
    ...options,
    profile: 'workspace',
    sandboxId,
  })
}

/** Copy a path back out of a sandbox to the Windows filesystem. */
export async function vmGet(
  sandboxRelativePath: string,
  hostDestination: string,
  sandboxId: string,
  options: SandboxFileOptions = {},
): Promise<VmRunResult> {
  if (!isValidSandboxId(sandboxId)) {
    return {
      ok: false,
      exitCode: 2,
      stdout: '',
      stderr: `Invalid sandbox id: ${sandboxId}`,
      timedOut: false,
    }
  }
  let guestDestination: string
  try {
    guestDestination = toWslPath(hostDestination)
  } catch (error) {
    return {
      ok: false,
      exitCode: 2,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      timedOut: false,
    }
  }
  const source = `${sandboxDir(sandboxId)}/${sandboxRelativePath}`
  return runInVm(
    `cp -R ${quoteForBash(source)} ${quoteForBash(guestDestination)}`,
    { ...options, profile: 'workspace', sandboxId },
  )
}

/** Delete a sandbox and everything in it. */
export async function vmDestroy(
  sandboxId: string,
  options: SandboxFileOptions = {},
): Promise<VmRunResult> {
  if (!isValidSandboxId(sandboxId)) {
    return {
      ok: false,
      exitCode: 2,
      stdout: '',
      stderr: `Invalid sandbox id: ${sandboxId}`,
      timedOut: false,
    }
  }
  return runInVm(`rm -rf ${sandboxDir(sandboxId)}`, {
    ...options,
    profile: 'workspace',
    sandboxId,
  })
}
