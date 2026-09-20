import { describe, expect, test } from 'bun:test'
import { classifyShellRisk, formatShellRiskPrompt } from './shellRisk.js'

/** Everyday commands that must never interrupt the user. */
const ORDINARY = [
  'ls -la',
  'mkdir -p src/components',
  'cp a.ts b.ts',
  'mv old.ts new.ts',
  'cat package.json',
  'sed -i "s/a/b/" file.ts',
  'awk "{print $1}" data.txt',
  'grep -rn foo src',
  'npm install',
  'npm run build',
  'npm test',
  'pnpm i',
  'bun run dev',
  'yarn build',
  'tsc --noEmit',
  'eslint .',
  'prettier --write .',
  'cargo build',
  'cargo run',
  'go test ./...',
  'make',
  'pytest -q',
  'python script.py',
  'docker build -t app .',
  'docker compose up -d',
  'git status',
  'git add -A',
  'git commit -m "fix"',
  'git checkout -b feature',
  'git diff HEAD~1',
  'gh pr view 42',
  'curl https://api.example.com/data',
  'wget https://example.com/file.zip',
  'tar -xzf archive.tar.gz',
  'unzip bundle.zip',
  'Get-ChildItem -Recurse',
  'Test-Path ./src',
  'Select-String -Pattern foo -Path src',
  'echo hello > out.txt',
  'node scripts/build.js',
  './scripts/deploy-local.sh',
  'kubectl get pods',
  'terraform plan',
]

describe('ordinary commands run without asking', () => {
  for (const command of ORDINARY) {
    test(command, () => {
      expect(classifyShellRisk(command)).toBeNull()
    })
  }
})

describe('privileged commands ask', () => {
  test('sudo', () => {
    expect(classifyShellRisk('sudo apt install nginx')?.kind).toBe('privileged')
  })

  test('runas and elevated PowerShell', () => {
    expect(classifyShellRisk('runas /user:Administrator cmd')?.kind).toBe(
      'privileged',
    )
    expect(
      classifyShellRisk('Start-Process pwsh -Verb RunAs')?.kind,
    ).toBe('privileged')
  })
})

describe('commands that leave the machine ask', () => {
  test('git push', () => {
    expect(classifyShellRisk('git push origin main')?.label).toBe('git push')
  })

  test('publishing a package', () => {
    expect(classifyShellRisk('npm publish')?.kind).toBe('outward')
    expect(classifyShellRisk('cargo publish')?.kind).toBe('outward')
  })

  test('creating a PR or release', () => {
    expect(classifyShellRisk('gh pr create --fill')?.kind).toBe('outward')
    expect(classifyShellRisk('gh release create v1.0')?.kind).toBe('outward')
  })

  test('deploys', () => {
    expect(classifyShellRisk('vercel deploy --prod')?.kind).toBe('outward')
    expect(classifyShellRisk('fly deploy')?.kind).toBe('outward')
  })

  test('cluster and infra changes, but not reads', () => {
    expect(classifyShellRisk('kubectl apply -f k8s/')?.kind).toBe('outward')
    expect(classifyShellRisk('terraform apply')?.kind).toBe('outward')
    // Read-only equivalents stay silent.
    expect(classifyShellRisk('kubectl get pods')).toBeNull()
    expect(classifyShellRisk('terraform plan')).toBeNull()
  })

  test('ssh to a remote host', () => {
    expect(classifyShellRisk('ssh deploy@prod.example.com')?.kind).toBe('outward')
  })
})

describe('machine-level changes ask', () => {
  test('system package managers', () => {
    expect(classifyShellRisk('apt-get install nginx')?.kind).toBe('system')
    expect(classifyShellRisk('brew install node')?.kind).toBe('system')
    expect(classifyShellRisk('winget install Git.Git')?.kind).toBe('system')
  })

  test('global npm installs, but not local ones', () => {
    expect(classifyShellRisk('npm install -g typescript')?.kind).toBe('system')
    expect(classifyShellRisk('npm install typescript')).toBeNull()
  })

  test('services, shutdown and registry', () => {
    expect(classifyShellRisk('systemctl restart nginx')?.kind).toBe('system')
    expect(classifyShellRisk('shutdown /r /t 0')?.kind).toBe('system')
    expect(classifyShellRisk('reg add HKCU\Software\X /v Y')?.kind).toBe('system')
  })

  test('credential changes', () => {
    expect(classifyShellRisk('gh auth login')?.kind).toBe('system')
    expect(classifyShellRisk('aws configure')?.kind).toBe('system')
  })
})

describe('command chaining', () => {
  test('a risky command hidden after && is still caught', () => {
    expect(classifyShellRisk('npm run build && npm publish')?.kind).toBe(
      'outward',
    )
  })

  test('a risky command after a semicolon is caught', () => {
    expect(classifyShellRisk('echo done; sudo rm /etc/hosts')?.kind).toBe(
      'privileged',
    )
  })

  test('a fully ordinary chain stays silent', () => {
    expect(
      classifyShellRisk('cd app && npm install && npm run build && npm test'),
    ).toBeNull()
  })
})

describe('formatShellRiskPrompt', () => {
  test('says why it stopped, in the user\u2019s terms', () => {
    expect(
      formatShellRiskPrompt({ kind: 'outward', label: 'git push' }),
    ).toContain('outside your machine')
    expect(
      formatShellRiskPrompt({ kind: 'privileged', label: 'sudo' }),
    ).toContain('elevated privileges')
    expect(
      formatShellRiskPrompt({ kind: 'system', label: 'brew install' }),
    ).toContain('outside the project')
  })
})
