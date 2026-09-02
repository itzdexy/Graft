/**
 * How much of the machine a VM command can reach.
 *
 * The VM tool used to have exactly one mode: `wsl.exe -- bash -lc <command>`
 * with `/mnt` mounted, the network up, no resource caps, and a
 * checkPermissions() that returned `allow` unconditionally. That is a
 * different *environment*, not a boundary -- `rm -rf /mnt/c/Users/...` from
 * inside it destroys the Windows disk just as thoroughly as it does from a
 * host shell.
 *
 * `isolated` is a real boundary, built from primitives an unprivileged WSL
 * user actually has (verified on Ubuntu/WSL2, no sudo, no root):
 *
 *   - `unshare --user --map-root-user` creates a user namespace where we are
 *     uid 0 *inside only*, which is what makes the mount calls below legal.
 *   - `--mount` plus a tmpfs over /mnt hides every Windows drive. Unmounting
 *     /mnt does not work: /mnt itself is not a mountpoint, its children are.
 *   - `--net` gives an empty network namespace: no interfaces, no DNS.
 *   - `--pid --fork --mount-proc` stops the guest seeing or signalling host
 *     processes.
 *   - `ulimit` caps address space, process count and CPU seconds.
 *
 * What it is not: a defence against a kernel exploit, and not a guarantee for
 * a determined attacker. It is a boundary against destructive commands,
 * runaway builds, and untrusted code that was not written to break out.
 */

/** Profile names, in the order the picker should show them. */
export const SANDBOX_PROFILES = ['isolated', 'workspace'] as const

export type SandboxProfile = (typeof SANDBOX_PROFILES)[number]

export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = 'isolated'

export type SandboxLimits = {
  /** Address space per process, in megabytes. */
  memoryMb: number
  /** Max user processes -- the fork-bomb cap. */
  maxProcesses: number
  /** CPU seconds before SIGKILL, independent of the wall-clock timeout. */
  cpuSeconds: number
}

export const DEFAULT_LIMITS: SandboxLimits = {
  memoryMb: 4096,
  maxProcesses: 512,
  cpuSeconds: 600,
}

/** Where sandboxes live inside the guest. Never under /mnt. */
export const SANDBOX_ROOT = '/var/tmp/tovyr-sandbox'

export function sandboxDir(sandboxId: string): string {
  return `${SANDBOX_ROOT}/${sandboxId}`
}

/**
 * Sandbox ids name a directory in the guest and are interpolated into shell
 * script text, so they are restricted rather than escaped.
 */
export function isValidSandboxId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)
}

export type BuildScriptOptions = {
  profile: SandboxProfile
  command: string
  /** Guest-absolute directory to run in. Required for `isolated`. */
  cwd?: string
  /** Only meaningful for `isolated`; `workspace` always has the host network. */
  network?: boolean
  sandboxId?: string
  limits?: SandboxLimits
}

function b64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64')
}

/**
 * Every payload crosses the boundary base64-encoded and the whole script is
 * delivered on stdin.
 *
 * Both details are load-bearing. Passing the script as an argv element means
 * it travels Windows -> wsl.exe -> Linux, and the Windows command-line
 * round-trip mangles embedded double quotes: a command containing `bash -c
 * "echo hi"` arrived as a syntax error, and the failure was silent -- the
 * shell printed what came before it and exited 0. stdin has no such layer,
 * and base64 keeps arbitrary user commands from terminating the wrapper's
 * own quoting.
 */
export function buildGuestScript(options: BuildScriptOptions): string {
  const {
    profile,
    command,
    cwd,
    network = false,
    sandboxId,
    limits = DEFAULT_LIMITS,
  } = options

  if (profile === 'workspace') {
    const lines = [`CMD=$(printf %s '${b64(command)}' | base64 -d)`]
    if (cwd) {
      lines.push(`CWD=$(printf %s '${b64(cwd)}' | base64 -d)`)
      lines.push('cd "$CWD" || exit 1')
    }
    lines.push('exec bash -lc "$CMD"')
    return lines.join('\n')
  }

  if (!sandboxId || !isValidSandboxId(sandboxId)) {
    throw new Error(
      `Invalid sandbox id: ${JSON.stringify(sandboxId)}. Expected 1-64 chars of [A-Za-z0-9_-] starting alphanumeric.`,
    )
  }
  const dir = cwd ?? sandboxDir(sandboxId)

  const inner = [
    // WSL symlinks /etc/resolv.conf to /mnt/wsl/resolv.conf, so the tmpfs
    // below takes DNS down with the drives. Read it out first; it is restored
    // inside the tmpfs only when the caller asked for a network.
    'RESOLV=$(cat /etc/resolv.conf 2>/dev/null || true)',
    // Detach our mount propagation from the host's before touching anything,
    // so the tmpfs below cannot leak back out to the rest of the distro.
    'mount --make-rprivate / 2>/dev/null || true',
    // /mnt is not itself a mountpoint -- /mnt/c, /mnt/e, /mnt/wsl each are --
    // so `umount /mnt` reports "not mounted" and leaves the drives readable.
    // An empty tmpfs over the top hides all of them at once.
    `mount -t tmpfs -o size=1M,mode=${network ? '0755' : '0555'} none /mnt 2>/dev/null || true`,
    // Put DNS back without putting any drive back: /mnt/wsl/resolv.conf is
    // recreated inside our own tmpfs, so it is the only thing under /mnt.
    ...(network
      ? [
          'mkdir -p /mnt/wsl 2>/dev/null || true',
          'printf %s "$RESOLV" > /mnt/wsl/resolv.conf 2>/dev/null || true',
        ]
      : []),
    `mkdir -p ${dir} || exit 1`,
    `cd ${dir} || exit 1`,
    `ulimit -v ${limits.memoryMb * 1024} 2>/dev/null || true`,
    `ulimit -u ${limits.maxProcesses} 2>/dev/null || true`,
    `ulimit -t ${limits.cpuSeconds} 2>/dev/null || true`,
    `CMD=$(printf %s '${b64(command)}' | base64 -d)`,
    'exec bash -lc "$CMD"',
  ].join('\n')

  const flags = [
    '--user',
    '--map-root-user',
    '--mount',
    '--pid',
    '--fork',
    '--mount-proc',
    ...(network ? [] : ['--net']),
  ].join(' ')

  return [
    `INNER=$(printf %s '${b64(inner)}' | base64 -d)`,
    `exec unshare ${flags} -- bash -c "$INNER"`,
  ].join('\n')
}

/** One-line summary of what a profile can reach, for tool prompts and the UI. */
export function describeProfile(
  profile: SandboxProfile,
  network: boolean,
): string {
  if (profile === 'workspace') {
    return 'Windows drives visible under /mnt, network up, no resource caps. Not a boundary.'
  }
  return `No access to Windows drives, ${
    network ? 'network up' : 'no network'
  }, ${DEFAULT_LIMITS.memoryMb}MB memory cap, own PID namespace.`
}
