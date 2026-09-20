/**
 * DevOps specialist catalog (Phase 14).
 */

export type DevOpsWorkflow = {
  id: string
  label: string
  tools: string[]
  prompt: string
}

export const DEVOPS_WORKFLOWS: DevOpsWorkflow[] = [
  {
    id: 'docker-build',
    label: 'Docker build & run',
    tools: ['Bash', 'Read'],
    prompt: 'Read Dockerfile, build image, run container, verify health endpoint.',
  },
  {
    id: 'k8s-deploy',
    label: 'Kubernetes deploy',
    tools: ['Bash', 'Read', 'Grep'],
    prompt: 'Validate manifests, kubectl apply --dry-run, deploy, check pod status.',
  },
  {
    id: 'terraform-plan',
    label: 'Terraform plan',
    tools: ['Bash', 'Read'],
    prompt: 'terraform fmt -check, init, plan; summarize infra changes for user.',
  },
  {
    id: 'ci-fix',
    label: 'CI pipeline fix',
    tools: ['Bash', 'Read', 'Grep'],
    prompt: 'Read CI config, reproduce failing job locally, fix and re-run.',
  },
]

export type GamingHint = {
  id: string
  label: string
  command: string
}

export const GAMING_HINTS: GamingHint[] = [
  {
    id: 'fps',
    label: 'FPS / GPU monitor',
    command: 'Use /cookbook for hardware tier; Task Manager / nvidia-smi for live stats.',
  },
  {
    id: 'gaming-mode',
    label: 'Gaming mode',
    command: 'Set GRAFT_CRUSH=1 or /crush on for compact agent output during sessions.',
  },
]

export function formatDevOpsCatalog(): string {
  const lines = ['# DevOps workflows (Phase 14)', '']
  for (const w of DEVOPS_WORKFLOWS) {
    lines.push(`## ${w.label} (\`${w.id}\`)`)
    lines.push(`Tools: ${w.tools.join(', ')}`)
    lines.push(w.prompt)
    lines.push('')
  }
  lines.push('## Gaming hints')
  for (const g of GAMING_HINTS) {
    lines.push(`- **${g.label}**: ${g.command}`)
  }
  return lines.join('\n')
}
