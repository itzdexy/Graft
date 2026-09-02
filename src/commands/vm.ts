import type { Command } from '../types/command.js'
import {
  DEFAULT_LIMITS,
  SANDBOX_ROOT,
  describeProfile,
} from '../services/tovyr/vm/sandboxProfile.js'
import {
  checkVmAvailability,
  runInVm,
  vmDestroy,
} from '../services/tovyr/vm/wslVm.js'
import { isTovyrRuntime } from '../utils/tovyrRuntime.js'

function isVmSupported(): boolean {
  return isTovyrRuntime() && process.platform === 'win32'
}

async function listSandboxes(): Promise<string[]> {
  // Runs in the workspace profile: reading the sandbox root from *inside* an
  // isolated namespace would only show that namespace's own view.
  const result = await runInVm(
    `ls -1 ${SANDBOX_ROOT} 2>/dev/null || true`,
    { profile: 'workspace', timeoutMs: 15_000 },
  )
  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

async function call(args: string): Promise<{ type: 'text'; value: string }> {
  const arg = args.trim()

  if (!isVmSupported()) {
    return {
      type: 'text',
      value:
        'The VM is backed by WSL and is only available on Windows.\n' +
        'On other platforms, run commands with Bash directly.',
    }
  }

  const availability = await checkVmAvailability()
  if (!availability.available) {
    return { type: 'text', value: `VM unavailable: ${availability.reason}` }
  }

  if (arg.startsWith('rm ') || arg.startsWith('destroy ')) {
    const id = arg.split(/\s+/)[1]
    if (!id) {
      return { type: 'text', value: 'Usage: /vm rm <sandbox-id>' }
    }
    const result = await vmDestroy(id)
    return {
      type: 'text',
      value: result.ok
        ? `Removed sandbox ${id}.`
        : `Could not remove ${id}: ${result.stderr || `exit ${result.exitCode}`}`,
    }
  }

  const sandboxes = await listSandboxes()
  const lines = [
    `VM: ${availability.distro.name} (WSL${availability.distro.version})`,
    '',
    `isolated   ${describeProfile('isolated', false)}`,
    `workspace  ${describeProfile('workspace', true)}`,
    '',
    `Caps in isolated: ${DEFAULT_LIMITS.memoryMb}MB memory, ` +
      `${DEFAULT_LIMITS.maxProcesses} processes, ${DEFAULT_LIMITS.cpuSeconds}s CPU.`,
    '',
    sandboxes.length
      ? `Sandboxes (${SANDBOX_ROOT}):\n${sandboxes.map(s => `  ${s}`).join('\n')}`
      : 'No sandboxes yet.',
    '',
    'Remove one with: /vm rm <sandbox-id>',
  ]
  return { type: 'text', value: lines.join('\n') }
}

/**
 * Shows what the VM can and cannot reach, and cleans up sandboxes.
 *
 * Worth surfacing because the difference between the two profiles is a
 * security boundary, not a preference: in `workspace` a command can destroy
 * the Windows disk, and in `isolated` it cannot see it at all. That is not
 * something to leave implicit in a tool description the user never reads.
 */
const vm = {
  type: 'local',
  name: 'vm',
  description: 'Show VM sandbox status, or remove a sandbox',
  argumentHint: '[rm <sandbox-id>]',
  isEnabled: () => isVmSupported(),
  get isHidden() {
    return !isVmSupported()
  },
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default vm
