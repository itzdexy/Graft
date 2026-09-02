import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'

const FAKER_EXAMPLES = `Examples:
- /faker user 5 — five user objects (name, email, uuid)
- /faker company — company name + catch phrase
- /faker lorem 3 — three paragraphs
- /faker json user 10 — JSON array of 10 users
`

async function loadFaker(): Promise<typeof import('@faker-js/faker').faker> {
  const mod = await import('@faker-js/faker')
  return mod.faker
}

function generateUsers(faker: typeof import('@faker-js/faker').faker, count: number) {
  return Array.from({ length: count }, () => ({
    userId: faker.string.uuid(),
    username: faker.internet.username(),
    email: faker.internet.email(),
    avatar: faker.image.avatar(),
    phone: faker.phone.number(),
    birthdate: faker.date.birthdate().toISOString().slice(0, 10),
  }))
}

const fakerCmd: Command = {
  type: 'prompt',
  name: 'faker',
  description: 'Generate realistic fake data with Faker.js (tests, seeds, demos)',
  argumentHint: '[user|company|lorem|json user <n> | seed <n>]',
  progressMessage: 'generating fake data',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args: string): Promise<ContentBlockParam[]> {
    const parts = args.trim().split(/\s+/).filter(Boolean)
    const sub = (parts[0] || 'help').toLowerCase()

    let faker: typeof import('@faker-js/faker').faker
    try {
      faker = await loadFaker()
    } catch {
      return [
        {
          type: 'text',
          text: 'Faker.js is not installed. Run: npm install @faker-js/faker\n\nThen retry /faker.',
        },
      ]
    }

    if (sub === 'seed' && parts[1]) {
      const n = Number(parts[1])
      if (!Number.isFinite(n)) {
        return [{ type: 'text', text: 'Usage: /faker seed <number>' }]
      }
      faker.seed(n)
      return [{ type: 'text', text: `Faker seed set to ${n}. Subsequent /faker calls are reproducible.` }]
    }

    if (sub === 'user') {
      const count = Math.min(Math.max(parseInt(parts[1] || '1', 10) || 1, 1), 100)
      const data = generateUsers(faker, count)
      return [
        {
          type: 'text',
          text: `Generated ${count} user(s) (@faker-js/faker):\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        },
      ]
    }

    if (sub === 'json' && parts[1] === 'user') {
      const count = Math.min(Math.max(parseInt(parts[2] || '5', 10) || 5, 1), 500)
      const data = generateUsers(faker, count)
      return [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ]
    }

    if (sub === 'company') {
      const data = {
        name: faker.company.name(),
        catchPhrase: faker.company.catchPhrase(),
        bs: faker.company.buzzPhrase(),
      }
      return [
        {
          type: 'text',
          text: `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        },
      ]
    }

    if (sub === 'lorem') {
      const paras = Math.min(Math.max(parseInt(parts[1] || '2', 10) || 2, 1), 20)
      return [{ type: 'text', text: faker.lorem.paragraphs(paras) }]
    }

    return [
      {
        type: 'text',
        text: `Faker.js — https://github.com/faker-js/faker\n\n${FAKER_EXAMPLES}`,
      },
    ]
  },
}

export default fakerCmd
