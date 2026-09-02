import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { getCwd } from '../../utils/cwd.js'
import { checkVmAvailability, runInVm } from '../../services/tovyr/vm/wslVm.js'
import {
  DEFAULT_LIMITS,
  DEFAULT_SANDBOX_PROFILE,
  describeProfile,
  SANDBOX_PROFILES,
} from '../../services/tovyr/vm/sandboxProfile.js'

export const VM_TOOL_NAME = 'Vm'

const inputSchema = lazySchema(() =>
  z.strictObject({
    command: z
      .string()
      .min(1)
      .describe('Shell command to run inside the Linux VM (bash -lc).'),
    profile: z
      .enum(SANDBOX_PROFILES)
      .optional()
      .describe(
        "'isolated' (default): no Windows drives, no network, resource caps. " +
          "'workspace': the Windows disk is mounted under /mnt and the network is up — not a boundary.",
      ),
    network: z
      .boolean()
      .optional()
      .describe(
        'Allow network access in the isolated profile. Off by default. Ignored in workspace, which always has it.',
      ),
    sandboxId: z
      .string()
      .optional()
      .describe(
        'Which sandbox to run in. Reuse the same id across calls to keep files and installed packages.',
      ),
    cwd: z
      .string()
      .optional()
      .describe(
        'Workspace profile only: absolute Windows path to run in, translated to its /mnt mount. Ignored in isolated, which has no /mnt.',
      ),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Kill the command after this long. Default 120000.'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    ok: z.boolean(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    timedOut: z.boolean(),
  }),
)

/**
 * Run commands in a Linux VM instead of on the Windows host.
 *
 * Two things this buys an agent on Windows. First, a real POSIX environment:
 * apt, symlinks, and a filesystem where `make`, `python3` and node toolchains
 * behave the way every project's README assumes. Second — in the isolated
 * profile — somewhere to run work that should not be able to touch the user's
 * machine at all.
 */
export const VmTool = buildTool({
  name: VM_TOOL_NAME,
  searchHint: 'run a command in an isolated Linux VM (WSL)',
  isEnabled() {
    return isTovyrRuntime() && process.platform === 'win32'
  },
  userFacingName() {
    return 'VM'
  },
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    // It installs packages and writes files, and in workspace mode it can
    // write anywhere on the Windows disk. Treat it as mutating so it goes
    // through the same permission flow as Bash.
    return false
  },
  toAutoClassifierInput(input) {
    // The tool used to short-circuit its own permission check with an
    // unconditional `allow` and fed the classifier nothing, so a workspace
    // command reaching the Windows disk was approved before anyone looked at
    // it. Hand over the same text Bash does, plus the profile, since the same
    // command means very different things in each.
    const profile = input.profile ?? DEFAULT_SANDBOX_PROFILE
    return `[vm:${profile}] ${input.command}`
  },
  isDestructive(input) {
    // In workspace the guest reaches the Windows disk through /mnt, so this
    // is as destructive as Bash. Isolated cannot touch anything outside its
    // own sandbox directory.
    return (input.profile ?? DEFAULT_SANDBOX_PROFILE) === 'workspace'
  },
  // Guest output is already capped at MAX_OUTPUT_CHARS by wslVm; this is the
  // second bound, on what reaches the transcript.
  maxResultSizeChars: 100_000,
  renderToolUseMessage(input) {
    // Partial while the call streams in, so every field is optional here.
    const profile = input.profile ?? DEFAULT_SANDBOX_PROFILE
    const scope =
      profile === 'workspace'
        ? 'workspace'
        : input.network
          ? 'isolated, network'
          : 'isolated'
    return `${input.command ?? ''} (${scope})`
  },
  async description(input) {
    const profile = input.profile ?? DEFAULT_SANDBOX_PROFILE
    return `VM (${profile}): ${input.command.slice(0, 70)}`
  },
  getActivityDescription(input) {
    // Partial and possibly undefined: this is called while the model is still
    // streaming the tool call, before `command` has arrived.
    const profile = input?.profile ?? DEFAULT_SANDBOX_PROFILE
    const command = input?.command
    return command
      ? `Running in ${profile} VM: ${command.slice(0, 50)}`
      : `Starting ${profile} VM`
  },
  async prompt() {
    const availability = await checkVmAvailability()
    const status = availability.available
      ? `Available (${availability.distro.name}, WSL${availability.distro.version}).`
      : `Unavailable: ${availability.reason}`

    return `Run a shell command inside a Linux VM (WSL) rather than on the Windows host.

Status: ${status}

Profiles:

- isolated (default) — ${describeProfile('isolated', false)}
  The command runs in a throwaway directory inside the guest. It cannot read
  or write the Windows disk, and by default cannot reach the network. Use it
  for anything destructive, untrusted, or downloaded, and for work that only
  needs a scratch directory. Pass network: true when the task genuinely needs
  to fetch something.

- workspace — ${describeProfile('workspace', true)}
  The Windows workspace is mounted under /mnt (C:\\Users\\x becomes
  /mnt/c/Users/x) and \`cwd\` accepts a Windows path directly. Files written
  here are visible to Windows and to the Read/Edit/Write tools. Use it to
  build and test the user's actual checkout. It is NOT a boundary: a command
  here can destroy the Windows disk.

Prefer this tool over Bash for builds and test suites on Windows, where Git
Bash often diverges from what a project expects.

Resource caps in the isolated profile: ${DEFAULT_LIMITS.memoryMb}MB address
space, ${DEFAULT_LIMITS.maxProcesses} processes, ${DEFAULT_LIMITS.cpuSeconds}s CPU.

Reuse \`sandboxId\` across calls to keep a sandbox's files and installed
packages; a fresh id gets a clean one.`
  },
  async call(input, { abortController }) {
    const profile = input.profile ?? DEFAULT_SANDBOX_PROFILE
    const result = await runInVm(input.command, {
      profile,
      network: input.network,
      sandboxId: input.sandboxId,
      // A Windows cwd only means something where /mnt exists.
      cwd: profile === 'workspace' ? (input.cwd ?? getCwd()) : undefined,
      timeoutMs: input.timeoutMs,
      signal: abortController.signal,
    })
    return { data: result }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const parts: string[] = []
    if (output.stdout.trim()) parts.push(output.stdout.trimEnd())
    if (output.stderr.trim()) {
      parts.push(`[stderr]\n${output.stderr.trimEnd()}`)
    }
    if (output.timedOut) {
      parts.push('[command timed out and was killed]')
    }
    if (!output.ok && !output.timedOut) {
      parts.push(`[exit code ${output.exitCode}]`)
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: parts.join('\n\n') || '(no output)',
      is_error: !output.ok,
    }
  },
} satisfies Parameters<typeof buildTool>[0])
