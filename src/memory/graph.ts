/**
 * Memory knowledge graph (MCP memory server pattern).
 * Entities, relations, and observations persisted per project.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface KnowledgeEntity {
  name: string
  entityType: string
  observations: string[]
}

export interface KnowledgeRelation {
  from: string
  to: string
  relationType: string
}

export interface KnowledgeGraph {
  entities: KnowledgeEntity[]
  relations: KnowledgeRelation[]
  updatedAt: string
}

function graphPath(cwd: string): string {
  return join(cwd, '.graft', 'memory-graph.json')
}

export function loadKnowledgeGraph(cwd: string): KnowledgeGraph {
  const path = graphPath(cwd)
  if (!existsSync(path)) {
    return { entities: [], relations: [], updatedAt: new Date().toISOString() }
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as KnowledgeGraph
  } catch {
    return { entities: [], relations: [], updatedAt: new Date().toISOString() }
  }
}

export function saveKnowledgeGraph(cwd: string, graph: KnowledgeGraph): void {
  const path = graphPath(cwd)
  mkdirSync(join(cwd, '.graft'), { recursive: true })
  graph.updatedAt = new Date().toISOString()
  writeFileSync(path, JSON.stringify(graph, null, 2), 'utf8')
}

export function upsertEntity(
  cwd: string,
  name: string,
  entityType: string,
  observations: string[],
): KnowledgeGraph {
  const g = loadKnowledgeGraph(cwd)
  const existing = g.entities.find(e => e.name === name)
  if (existing) {
    existing.entityType = entityType
    for (const o of observations) {
      if (!existing.observations.includes(o)) existing.observations.push(o)
    }
  } else {
    g.entities.push({ name, entityType, observations: [...observations] })
  }
  saveKnowledgeGraph(cwd, g)
  return g
}

export function addRelation(
  cwd: string,
  from: string,
  to: string,
  relationType: string,
): KnowledgeGraph {
  const g = loadKnowledgeGraph(cwd)
  const dup = g.relations.some(
    r => r.from === from && r.to === to && r.relationType === relationType,
  )
  if (!dup) g.relations.push({ from, to, relationType })
  saveKnowledgeGraph(cwd, g)
  return g
}

export function searchKnowledgeGraph(
  cwd: string,
  query: string,
): { entities: KnowledgeEntity[]; relations: KnowledgeRelation[] } {
  const g = loadKnowledgeGraph(cwd)
  const q = query.toLowerCase()
  const entities = g.entities.filter(
    e =>
      e.name.toLowerCase().includes(q) ||
      e.entityType.toLowerCase().includes(q) ||
      e.observations.some(o => o.toLowerCase().includes(q)),
  )
  const names = new Set(entities.map(e => e.name))
  const relations = g.relations.filter(
    r => names.has(r.from) || names.has(r.to),
  )
  return { entities, relations }
}

export function readKnowledgeGraph(cwd: string): KnowledgeGraph {
  return loadKnowledgeGraph(cwd)
}

export function openKnowledgeNodes(
  cwd: string,
  names: string[],
): { entities: KnowledgeEntity[]; relations: KnowledgeRelation[] } {
  const g = loadKnowledgeGraph(cwd)
  const wanted = new Set(names)
  const entities = g.entities.filter(e => wanted.has(e.name))
  const entityNames = new Set(entities.map(e => e.name))
  const relations = g.relations.filter(
    r => entityNames.has(r.from) && entityNames.has(r.to),
  )
  return { entities, relations }
}

export function createEntities(
  cwd: string,
  entities: Array<{
    name: string
    entityType: string
    observations?: string[]
  }>,
): { created: string[]; graph: KnowledgeGraph } {
  const g = loadKnowledgeGraph(cwd)
  const created: string[] = []
  for (const entity of entities) {
    if (g.entities.some(e => e.name === entity.name)) continue
    g.entities.push({
      name: entity.name,
      entityType: entity.entityType,
      observations: [...(entity.observations ?? [])],
    })
    created.push(entity.name)
  }
  saveKnowledgeGraph(cwd, g)
  return { created, graph: g }
}

export function createRelations(
  cwd: string,
  relations: Array<{ from: string; to: string; relationType: string }>,
): { created: number; graph: KnowledgeGraph } {
  const g = loadKnowledgeGraph(cwd)
  let created = 0
  for (const rel of relations) {
    const dup = g.relations.some(
      r =>
        r.from === rel.from &&
        r.to === rel.to &&
        r.relationType === rel.relationType,
    )
    if (!dup) {
      g.relations.push({ ...rel })
      created++
    }
  }
  saveKnowledgeGraph(cwd, g)
  return { created, graph: g }
}

export function addObservations(
  cwd: string,
  observations: Array<{ entityName: string; contents: string[] }>,
): { added: Record<string, string[]>; graph: KnowledgeGraph } {
  const g = loadKnowledgeGraph(cwd)
  const added: Record<string, string[]> = {}
  for (const obs of observations) {
    const entity = g.entities.find(e => e.name === obs.entityName)
    if (!entity) {
      throw new Error(`Entity not found: ${obs.entityName}`)
    }
    const newOnes: string[] = []
    for (const content of obs.contents) {
      if (!entity.observations.includes(content)) {
        entity.observations.push(content)
        newOnes.push(content)
      }
    }
    if (newOnes.length) added[obs.entityName] = newOnes
  }
  saveKnowledgeGraph(cwd, g)
  return { added, graph: g }
}

export function deleteEntities(cwd: string, names: string[]): KnowledgeGraph {
  const g = loadKnowledgeGraph(cwd)
  const drop = new Set(names)
  g.entities = g.entities.filter(e => !drop.has(e.name))
  g.relations = g.relations.filter(
    r => !drop.has(r.from) && !drop.has(r.to),
  )
  saveKnowledgeGraph(cwd, g)
  return g
}

export function deleteObservations(
  cwd: string,
  observations: Array<{ entityName: string; contents: string[] }>,
): KnowledgeGraph {
  const g = loadKnowledgeGraph(cwd)
  for (const obs of observations) {
    const entity = g.entities.find(e => e.name === obs.entityName)
    if (!entity) continue
    const drop = new Set(obs.contents)
    entity.observations = entity.observations.filter(o => !drop.has(o))
  }
  saveKnowledgeGraph(cwd, g)
  return g
}

export function deleteRelations(
  cwd: string,
  relations: Array<{ from: string; to: string; relationType: string }>,
): KnowledgeGraph {
  const g = loadKnowledgeGraph(cwd)
  g.relations = g.relations.filter(
    r =>
      !relations.some(
        rel =>
          rel.from === r.from &&
          rel.to === r.to &&
          rel.relationType === r.relationType,
      ),
  )
  saveKnowledgeGraph(cwd, g)
  return g
}

export function formatKnowledgeGraphSection(cwd: string, query?: string): string {
  const { entities, relations } = query
    ? searchKnowledgeGraph(cwd, query)
    : {
        entities: loadKnowledgeGraph(cwd).entities.slice(0, 20),
        relations: loadKnowledgeGraph(cwd).relations.slice(0, 20),
      }
  if (!entities.length && !relations.length) return ''
  const lines = ['# Project knowledge graph', '']
  for (const e of entities) {
    lines.push(`**${e.name}** (${e.entityType})`)
    for (const o of e.observations.slice(0, 5)) {
      lines.push(`  - ${o}`)
    }
  }
  if (relations.length) {
    lines.push('', 'Relations:')
    for (const r of relations) {
      lines.push(`  - ${r.from} --${r.relationType}--> ${r.to}`)
    }
  }
  return lines.join('\n')
}
