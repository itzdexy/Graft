/**
 * BMAD workflow methodology (OpenCode / BMAD-METHOD pattern).
 * Breakdown → Model → Act → Deliver
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type BmadPhase = 'breakdown' | 'model' | 'act' | 'deliver'

export interface BmadStep {
  id: string
  phase: BmadPhase
  title: string
  prompt: string
  status: 'pending' | 'active' | 'done' | 'skipped'
  output?: string
}

export interface BmadWorkflow {
  id: string
  goal: string
  steps: BmadStep[]
  createdAt: number
  currentPhase: BmadPhase
}

const workflows = new Map<string, BmadWorkflow>()

export function bmadStorageDir(cwd: string): string {
  return join(cwd, '.blink', 'bmad')
}

function persistBmadWorkflow(cwd: string, workflow: BmadWorkflow): void {
  const dir = bmadStorageDir(cwd)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${workflow.id}.json`), JSON.stringify(workflow, null, 2))
}

function loadBmadWorkflowFromDisk(cwd: string, id: string): BmadWorkflow | undefined {
  const path = join(bmadStorageDir(cwd), `${id}.json`)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BmadWorkflow
  } catch {
    return undefined
  }
}

function phasePrompt(phase: BmadPhase, goal: string): string {
  switch (phase) {
    case 'breakdown':
      return `BMAD Breakdown: Decompose this goal into ordered sub-tasks with acceptance criteria.\n\nGoal: ${goal}`
    case 'model':
      return `BMAD Model: Propose architecture, data flow, and file-level plan. No code yet.\n\nGoal: ${goal}`
    case 'act':
      return `BMAD Act: Implement the approved plan with tests. Use tools; minimal chat.\n\nGoal: ${goal}`
    case 'deliver':
      return `BMAD Deliver: Verify (lint/test), document changes, and summarize for the user.\n\nGoal: ${goal}`
  }
}

export function createBmadWorkflow(goal: string, cwd?: string): BmadWorkflow {
  const phases: BmadPhase[] = ['breakdown', 'model', 'act', 'deliver']
  const id = `bmad-${Date.now()}`
  const workflow: BmadWorkflow = {
    id,
    goal,
    createdAt: Date.now(),
    currentPhase: 'breakdown',
    steps: phases.map((phase, i) => ({
      id: `${id}-${phase}`,
      phase,
      title: `BMAD ${phase.charAt(0).toUpperCase()}${phase.slice(1)}`,
      prompt: phasePrompt(phase, goal),
      status: i === 0 ? 'active' : 'pending',
    })),
  }
  workflows.set(id, workflow)
  if (cwd) persistBmadWorkflow(cwd, workflow)
  return workflow
}

export function listBmadWorkflowIds(cwd?: string): string[] {
  const ids = new Set<string>(workflows.keys())
  if (cwd) {
    const dir = bmadStorageDir(cwd)
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        if (name.endsWith('.json')) ids.add(name.replace(/\.json$/, ''))
      }
    }
  }
  return [...ids].sort((a, b) => {
    const wa = getBmadWorkflow(a, cwd)
    const wb = getBmadWorkflow(b, cwd)
    return (wb?.createdAt ?? 0) - (wa?.createdAt ?? 0)
  })
}

export function getBmadWorkflow(id: string, cwd?: string): BmadWorkflow | undefined {
  const cached = workflows.get(id)
  if (cached) return cached
  if (!cwd) return undefined
  const loaded = loadBmadWorkflowFromDisk(cwd, id)
  if (loaded) {
    workflows.set(id, loaded)
    return loaded
  }
  return undefined
}

export function resolveLatestBmadWorkflowId(cwd?: string): string | undefined {
  const ids = listBmadWorkflowIds(cwd)
  return ids[0]
}

export function advanceBmadWorkflow(
  id: string,
  stepOutput?: string,
  cwd?: string,
): BmadWorkflow | undefined {
  const w = getBmadWorkflow(id, cwd)
  if (!w) return undefined
  const activeIdx = w.steps.findIndex(s => s.status === 'active')
  if (activeIdx < 0) return w
  w.steps[activeIdx]!.status = 'done'
  if (stepOutput) w.steps[activeIdx]!.output = stepOutput
  const next = w.steps[activeIdx + 1]
  if (next) {
    next.status = 'active'
    w.currentPhase = next.phase
  }
  workflows.set(id, w)
  if (cwd) persistBmadWorkflow(cwd, w)
  return w
}

export function formatBmadStatus(w: BmadWorkflow): string {
  const lines = [`# BMAD workflow: ${w.goal}`, '', `ID: ${w.id}`, '']
  for (const s of w.steps) {
    const mark =
      s.status === 'done' ? '✓' : s.status === 'active' ? '→' : '○'
    lines.push(`${mark} **${s.title}** (${s.phase})`)
  }
  const active = w.steps.find(s => s.status === 'active')
  if (active) {
    lines.push('', '## Current prompt', active.prompt)
  } else {
    lines.push('', '_All phases complete._')
  }
  return lines.join('\n')
}

export function getActiveBmadPrompt(w: BmadWorkflow): string | null {
  return w.steps.find(s => s.status === 'active')?.prompt ?? null
}

export function isBmadWorkflowComplete(w: BmadWorkflow): boolean {
  return !w.steps.some(s => s.status === 'active' || s.status === 'pending')
}