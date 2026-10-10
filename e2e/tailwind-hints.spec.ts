import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const run = promisify(execFile)

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exampleRoot = path.join(repoRoot, 'examples', 'vite-react-tailwind')
const cli = path.join(repoRoot, 'packages', 'visdiff', 'dist', 'cli.js')
const taskFile = path.join(exampleRoot, '.visdiff', 'tasks.json')
let previousTasks: Buffer | undefined

test.beforeEach(async () => {
  try {
    previousTasks = await readFile(taskFile)
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    previousTasks = undefined
  }
})

test.afterEach(async () => {
  if (previousTasks === undefined) {
    await rm(taskFile, { force: true })
    return
  }
  await mkdir(path.dirname(taskFile), { recursive: true })
  await writeFile(taskFile, previousTasks)
})

interface HintedEdit {
  property: string
  from?: string
  to?: string
  kind?: string
  tailwind?: {
    suggestion: string
    exact: boolean
    alternative?: string
    replaces?: string[]
    breakpoint?: string
    responsive?: string
    replacesAtBreakpoint?: string[]
  }
}

interface TaskChange {
  element: { classes?: string[] }
  edits: HintedEdit[]
}

test('Tailwind projects save real tasks and read them back with theme-aware class hints', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await run('node', [cli, 'clear', '--all'], { cwd: exampleRoot })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible()
  // Late font swaps shift layout and would invalidate cached click coordinates below.
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: 'visdiff' }).click()

  // Resize the w-64 preview card by +32px through the east drag handle (real save, no route mock).
  const card = page.locator('#preview-card')
  await card.click({ position: { x: 8, y: 8 } })
  const handle = page.locator('[data-vd-handle][data-mode="w"]')
  await expect(handle).toBeVisible()
  // hover() resolves the handle position at action time, so no cached box can go stale.
  await handle.hover()
  const handleBox = await handle.boundingBox()
  expect(handleBox).not.toBeNull()
  await page.mouse.down()
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 32, handleBox!.y + handleBox!.height / 2, { steps: 8 })
  await page.mouse.up()
  const widthRow = page.locator('[data-vd-change]')
  await expect(widthRow).toContainText('width')
  await expect(widthRow).toContainText('288px')

  // Stage a gap edit on the features grid via the sibling layout panel.
  const articles = page.locator('#features article')
  await articles.nth(0).click({ position: { x: 8, y: 8 } })
  await articles.nth(1).click({ position: { x: 8, y: 8 }, modifiers: ['Shift'] })
  await page.locator('[data-vd-layout-toggle]').click()
  await page.getByLabel('Gap', { exact: true }).selectOption('16px')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-vd-change]').filter({ hasText: 'gap' })).toBeVisible()

  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('[data-vd-toast]')).toContainText('Batch queued with 2 element(s)')

  // Read the queue back through the CLI; Tailwind hints are attached at read time.
  const { stdout } = await run('node', [cli, 'tasks'], { cwd: exampleRoot })
  const tasks = JSON.parse(stdout) as Array<{ changes: TaskChange[] }>
  expect(tasks).toHaveLength(1)
  const changes = tasks[0]?.changes ?? []

  const widthChange = changes.find((change) => change.edits.some((edit) => edit.property === 'width'))
  const widthEdit = widthChange?.edits.find((edit) => edit.property === 'width')
  expect(widthChange?.element.classes).toContain('w-64')
  expect(widthEdit?.to).toBe('288px')
  expect(widthEdit?.kind).toBe('resize')
  expect(widthEdit?.tailwind).toEqual({
    suggestion: 'w-72',
    exact: true,
    replaces: ['w-64'],
    breakpoint: 'xl',
    responsive: 'xl:w-72',
  })

  const gapChange = changes.find((change) => change.edits.some((edit) => edit.property === 'gap'))
  const gapEdit = gapChange?.edits.find((edit) => edit.property === 'gap')
  expect(gapChange?.element.classes).toContain('gap-6')
  expect(gapEdit?.from).toBe('24px')
  expect(gapEdit?.to).toBe('16px')
  // The 16px target maps to the project's own `--spacing-gutter` theme token.
  expect(gapEdit?.tailwind).toEqual({
    suggestion: 'gap-gutter',
    exact: true,
    replaces: ['gap-6'],
    breakpoint: 'xl',
    responsive: 'xl:gap-gutter',
  })

  expect(pageErrors).toEqual([])
})
