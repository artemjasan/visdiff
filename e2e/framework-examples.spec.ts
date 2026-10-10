import { expect, test } from '@playwright/test'

const examples = {
  react: { heading: 'Spring launch', navigation: 'Features', sourceFile: 'App.tsx' },
  vue: { heading: 'Summer collection', navigation: 'Projects', sourceFile: 'App.vue' },
  svelte: { heading: 'Summer collection', navigation: 'Projects', sourceFile: 'App.svelte' },
  'react-tailwind': { heading: 'Spring launch', navigation: 'Features', sourceFile: 'App.tsx' },
} as const

test('selects an element, stages a keyboard move, and saves its source-aware task', async ({ page }, testInfo) => {
  const example = examples[testInfo.project.name as keyof typeof examples]
  expect(example, `unknown E2E project "${testInfo.project.name}"`).toBeDefined()
  if (example === undefined) return

  let savedPayload: unknown
  const pageErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/__visdiff/save', async (route) => {
    savedPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'e2e-task', file: '.visdiff/tasks.json' }),
    })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: example.heading })).toBeVisible()

  await page.getByRole('button', { name: 'visdiff' }).click()
  const appUrl = page.url()
  await page.getByRole('link', { name: example.navigation }).click()
  await expect(page).toHaveURL(appUrl)
  await page.getByRole('heading', { name: example.heading }).click()
  await page.getByRole('link', { name: example.navigation }).focus()
  await page.keyboard.press('ArrowRight')

  const stagedChange = page.locator('[data-vd-change]')
  await expect(stagedChange).toContainText('transform')
  await expect(stagedChange).toContainText('translate(1px, 0px)')

  await page.getByRole('button', { name: 'Finish selection' }).click()
  await expect(stagedChange).toBeVisible()
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('[data-vd-toast]')).toContainText('Batch queued with 1 element')

  expect(savedPayload).toMatchObject({
    changes: [{
      element: {
        tag: 'h2',
        text: example.heading,
        source: { file: expect.stringContaining(example.sourceFile) },
      },
      edits: [{
        property: 'transform',
        from: 'none',
        to: 'translate(1px, 0px)',
        kind: 'move',
        delta: { x: 1, y: 0 },
      }],
      geometry: {
        before: {
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        },
        after: {
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        },
      },
    }],
  })
  expect(savedPayload).toMatchObject({ url: new URL(page.url()).origin + '/' })
  const capturedChange = (savedPayload as {
    changes: Array<{
      geometry: {
        before: { x: number; y: number; width: number; height: number }
        after: { x: number; y: number; width: number; height: number }
      }
    }>
  }).changes[0]
  expect(capturedChange).toBeDefined()
  if (capturedChange === undefined) throw new Error('task payload did not contain a captured change')
  expect(capturedChange.geometry.after.x - capturedChange.geometry.before.x).toBeCloseTo(1, 1)
  expect(capturedChange.geometry.after.y - capturedChange.geometry.before.y).toBeCloseTo(0, 1)
  expect(pageErrors).toEqual([])
})
