import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { annotateTasks, type TailwindTheme } from '../src/tailwind.ts'
import { VisdiffTaskQueueSchema } from '../src/types.ts'

const fixture = (name: string): URL => new URL(`./fixtures/${name}`, import.meta.url)
const cliPath = new URL('../src/cli.ts', import.meta.url).pathname
const tsxLoader = import.meta.resolve('tsx')
const inputFixture = 'golden-task-input.json'
const baseFixture = 'golden-task.json'
const tailwindFixture = 'golden-task-tailwind.json'

async function readFixture(name: string): Promise<string> {
  return readFile(fixture(name), 'utf8')
}

async function readGolden(name: string): Promise<unknown> {
  return JSON.parse(await readFixture(name)) as unknown
}

function getMcpText(result: unknown): string {
  if (typeof result !== 'object' || result === null || !('content' in result)) {
    throw new Error('MCP response has no content')
  }
  const content = result.content
  if (!Array.isArray(content)) throw new Error('MCP response content is not an array')
  const text = content.find((item: unknown): item is { type: 'text'; text: string } => (
    typeof item === 'object'
    && item !== null
    && 'type' in item
    && item.type === 'text'
    && 'text' in item
    && typeof item.text === 'string'
  ))
  if (text === undefined) throw new Error('MCP response has no text content')
  return text.text
}

async function makeProject(tailwind: boolean): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'visdiff-golden-test-'))
  await mkdir(path.join(root, '.visdiff'))
  const tasks = await readFixture(inputFixture)
  await writeFile(path.join(root, '.visdiff', 'tasks.json'), tasks)
  if (tailwind) {
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { tailwindcss: '^4.0.0' } }))
    await writeFile(path.join(root, 'app.css'), '@theme { --spacing-gutter: 16px; }')
  }
  return root
}

function runCli(root: string, command: string): string {
  const result = spawnSync(process.execPath, ['--import', tsxLoader, cliPath, command], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

void test('task queue JSON stays compatible with the golden contract', async () => {
  const input: unknown = JSON.parse(await readFixture('golden-task-input.json'))
  const tasks = VisdiffTaskQueueSchema.parse(input)
  const actual = JSON.parse(JSON.stringify(tasks)) as unknown
  assert.deepEqual(actual, await readGolden(baseFixture))
})

void test('Tailwind task JSON stays compatible with the golden contract', async () => {
  const input: unknown = JSON.parse(await readFixture('golden-task-input.json'))
  const tasks = VisdiffTaskQueueSchema.parse(input)
  const theme: TailwindTheme = {
    spacing: [['gutter', 16]],
    width: [],
    height: [],
    replaceDefaults: false,
    screens: [],
    replaceScreens: false,
    unit: 4,
  }
  const actual = JSON.parse(JSON.stringify(annotateTasks(tasks, { theme }))) as unknown
  assert.deepEqual(actual, await readGolden(tailwindFixture))
})

void test('CLI tasks output matches the golden task formats', async (t) => {
  const plainRoot = await makeProject(false)
  const tailwindRoot = await makeProject(true)
  t.after(async () => {
    await rm(plainRoot, { recursive: true, force: true })
    await rm(tailwindRoot, { recursive: true, force: true })
  })

  assert.deepEqual(JSON.parse(runCli(plainRoot, 'tasks')), await readGolden(baseFixture))
  assert.deepEqual(JSON.parse(runCli(tailwindRoot, 'tasks')), await readGolden(tailwindFixture))
})

void test('MCP pending-task output matches the golden task formats', async (t) => {
  const root = await makeProject(true)
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', tsxLoader, cliPath, 'mcp'],
    cwd: root,
  })
  const client = new Client({ name: 'visdiff-golden-test', version: '1.0.0' })
  t.after(async () => {
    await client.close()
    await rm(root, { recursive: true, force: true })
  })
  await client.connect(transport)

  const result: unknown = await client.callTool(
    { name: 'visdiff_pending_tasks', arguments: {} },
    CallToolResultSchema,
  )
  const response: unknown = JSON.parse(getMcpText(result))
  assert.equal(typeof response, 'object')
  assert.notEqual(response, null)
  assert.deepEqual((response as { tasks: unknown }).tasks, await readGolden(tailwindFixture))
})
