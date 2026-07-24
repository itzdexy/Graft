import * as React from 'react'
import type { LocalJSXCommandContext } from '../../commands.js'
import { Box, Text } from '../../ink.js'
import { Pane } from '../../components/design-system/Pane.js'
import { Card } from '../../components/design-system/Card.js'
import { Section } from '../../components/design-system/Section.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { randomBlinkTip } from '../../constants/blinkTips.js'

const STEPS = [
  { cmd: '/provider', desc: 'Choose who powers your sessions' },
  { cmd: '/model', desc: 'Pick a model for speed or depth' },
  { cmd: '/dash', desc: 'See your project overview' },
  { cmd: '/plan', desc: 'Plan big changes before coding' },
  { cmd: '/code', desc: 'Jump into build mode' },
  { cmd: '/review', desc: 'Get a focused code review' },
]

export async function call(
  _onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  return (
    <Pane color="permission">
      <Card
        title="Welcome to Blink"
        subtitle="Your AI coding agent, right in the terminal."
        color="permission"
      >
        <Section title="Quick start">
          {STEPS.map((step, i) => (
            <Text key={i}>
              <Text color="permission">{i + 1}.</Text>
              <Text> {step.cmd}</Text>
              <Text dimColor> — {step.desc}</Text>
            </Text>
          ))}
        </Section>

        <Section title="Useful now">
          <Text dimColor>/commands · /help · /buddy tip · /status · /tips</Text>
        </Section>

        <Section title="Tip">
          <Text wrap="wrap">{randomBlinkTip()}</Text>
        </Section>
      </Card>
    </Pane>
  )
}
