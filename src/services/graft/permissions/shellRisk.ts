/**
 * Which shell commands are powerful enough to be worth interrupting for.
 *
 * Graft used to gate on a 47-entry allowlist: anything not named in it
 * prompted. That inverted the cost — `mkdir`, `cp`, `sed`, `docker build`,
 * `cargo run`, `tsc`, `curl`, every Windows cmdlet and every project-local
 * script stopped the agent dead, so a coding session became a sequence of
 * approvals for commands nobody was worried about. An allowlist can never
 * cover the long tail of a build system, and each miss reads to the user as
 * the tool being broken.
 *
 * This module names the short tail instead: the things that leave the
 * workspace, need elevation, change the machine, or cannot be undone.
 * Everything else runs.
 *
 * `destructiveShell.ts` remains the separate, harder gate for genuinely
 * irreversible local damage (rm -rf, mkfs, DROP DATABASE).
 */

export type ShellRiskKind =
  /** Runs as another user or with elevated privileges. */
  | 'privileged'
  /** Publishes, deploys, or otherwise reaches outside this machine. */
  | 'outward'
  /** Changes the machine outside the workspace. */
  | 'system'

export type ShellRisk = {
  kind: ShellRiskKind
  /** Human label for the confirmation prompt. */
  label: string
}

type Rule = { re: RegExp; kind: ShellRiskKind; label: string }

const RULES: Rule[] = [
  // ── privilege escalation ────────────────────────────────────────────
  { re: /^\s*sudo\b/, kind: 'privileged', label: 'sudo' },
  { re: /^\s*doas\b/, kind: 'privileged', label: 'doas' },
  { re: /^\s*su\b/, kind: 'privileged', label: 'su' },
  { re: /^\s*runas\b/i, kind: 'privileged', label: 'runas' },
  { re: /-Verb\s+RunAs\b/i, kind: 'privileged', label: 'elevated PowerShell' },

  // ── leaves this machine ─────────────────────────────────────────────
  { re: /\bgit\s+push\b/, kind: 'outward', label: 'git push' },
  { re: /\bnpm\s+publish\b/, kind: 'outward', label: 'npm publish' },
  { re: /\b(yarn|pnpm|bun)\s+publish\b/, kind: 'outward', label: 'package publish' },
  { re: /\bcargo\s+publish\b/, kind: 'outward', label: 'cargo publish' },
  { re: /\btwine\s+upload\b/, kind: 'outward', label: 'twine upload' },
  { re: /\bgh\s+(pr\s+create|release\s+create|repo\s+create)\b/, kind: 'outward', label: 'GitHub publish' },
  { re: /\bdocker\s+push\b/, kind: 'outward', label: 'docker push' },
  { re: /\b(vercel|netlify|fly|railway|render|heroku)\b[^\n]*\b(deploy|up|publish)\b/, kind: 'outward', label: 'deploy' },
  { re: /\bkubectl\s+(apply|delete|rollout|scale)\b/, kind: 'outward', label: 'kubectl change' },
  { re: /\bterraform\s+(apply|destroy)\b/, kind: 'outward', label: 'terraform change' },
  { re: /\bhelm\s+(install|upgrade|uninstall)\b/, kind: 'outward', label: 'helm release' },
  { re: /\baws\s+s3\s+(rm|sync|cp)\b/, kind: 'outward', label: 'aws s3 write' },

  // ── changes the machine ─────────────────────────────────────────────
  { re: /\b(apt|apt-get|yum|dnf|pacman|zypper|snap)\s+(install|remove|purge|upgrade)\b/, kind: 'system', label: 'system package change' },
  { re: /\bbrew\s+(install|uninstall|upgrade)\b/, kind: 'system', label: 'homebrew change' },
  { re: /\b(choco|winget|scoop)\s+(install|uninstall|upgrade)\b/i, kind: 'system', label: 'system package change' },
  { re: /\bnpm\s+(install|i|uninstall)\b[^\n]*\s(-g|--global)\b/, kind: 'system', label: 'global npm install' },
  { re: /\bnpm\s+link\b/, kind: 'system', label: 'npm link' },
  { re: /\b(systemctl|service)\s+(start|stop|restart|enable|disable)\b/, kind: 'system', label: 'service change' },
  { re: /\b(shutdown|reboot|halt|poweroff)\b/, kind: 'system', label: 'shutdown/reboot' },
  { re: /\b(reg|reg\.exe)\s+(add|delete|import)\b/i, kind: 'system', label: 'registry change' },
  { re: /\bsetx\b/i, kind: 'system', label: 'persistent environment change' },
  { re: /\b(netsh|iptables|ufw)\b/, kind: 'system', label: 'network/firewall change' },
  { re: /\b(killall|pkill)\b/, kind: 'system', label: 'bulk process kill' },
  { re: /\btaskkill\b[^\n]*\/f\b/i, kind: 'system', label: 'forced process kill' },
  { re: /\bchown\s+-R\b/, kind: 'system', label: 'recursive chown' },
  { re: /\bgh\s+auth\b/, kind: 'system', label: 'credential change' },
  { re: /\b(aws\s+configure|gcloud\s+auth|az\s+login)\b/, kind: 'system', label: 'credential change' },
  { re: /\bssh\b\s+[^\n]*@/, kind: 'outward', label: 'remote shell' },
]

/**
 * Split a command line into the segments a shell would run separately, so a
 * risky command hidden after `&&`, `;` or a pipe is still classified.
 */
function segments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||[;&|\n])/)
    .map(part => part.trim())
    .filter(Boolean)
}

/**
 * Classify a shell command. Returns null when nothing about it warrants
 * stopping the user — which is the common case, and the point.
 */
export function classifyShellRisk(command: string): ShellRisk | null {
  for (const segment of segments(command)) {
    for (const rule of RULES) {
      if (rule.re.test(segment)) {
        return { kind: rule.kind, label: rule.label }
      }
    }
  }
  return null
}

/** Confirmation copy for a risky command. */
export function formatShellRiskPrompt(risk: ShellRisk): string {
  switch (risk.kind) {
    case 'privileged':
      return `This runs with elevated privileges (${risk.label}). Confirm to proceed.`
    case 'outward':
      return `This reaches outside your machine (${risk.label}) and may be hard to undo. Confirm to proceed.`
    case 'system':
      return `This changes your machine outside the project (${risk.label}). Confirm to proceed.`
  }
}
