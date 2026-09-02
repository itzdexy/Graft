import { describe, expect, test } from 'bun:test'
import {
  createGoal,
  createSession,
  inferAcceptanceCriteria,
} from './GoalTracker.js'
import { planTask } from './TaskPlanner.js'

describe('GoalTracker', () => {
  test('createGoal infers criteria for dashboard tasks', () => {
    const goal = createGoal('Build a dashboard for metrics')
    expect(goal.text).toBe('Build a dashboard for metrics')
    expect(goal.acceptanceCriteria.some(c => c.toLowerCase().includes('ui'))).toBe(true)
  })

  test('inferAcceptanceCriteria includes tests for fix tasks', () => {
    const criteria = inferAcceptanceCriteria('fix the login test failure')
    expect(criteria.some(c => c.toLowerCase().includes('test'))).toBe(true)
  })

  test('createSession has observe phase and steps', () => {
    const steps = planTask('add logging')
    const session = createSession('/tmp/proj', 'add logging', steps)
    expect(session.phase).toBe('observe')
    expect(session.steps.length).toBeGreaterThan(3)
    expect(session.goal.text).toBe('add logging')
  })
})

describe('TaskPlanner', () => {
  test('planTask adds research step for API integration', () => {
    const steps = planTask('integrate Stripe API for billing')
    expect(steps.some(s => s.specialist === 'research')).toBe(true)
  })

  test('planTask adds browser step when URL in goal', () => {
    const steps = planTask('read https://docs.example.com/api')
    expect(steps.some(s => s.specialist === 'browser')).toBe(true)
  })

  test('planTask adds devops step for deploy goals', () => {
    const steps = planTask('deploy staging with kubernetes')
    expect(steps.some(s => s.specialist === 'devops')).toBe(true)
  })

  test('planTask adds benchmark step for performance goals', () => {
    const steps = planTask('benchmark API latency')
    expect(steps.some(s => s.specialist === 'benchmark')).toBe(true)
  })
})
