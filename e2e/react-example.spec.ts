import { expect, test } from '@playwright/test'

test('selects a React element, stages a keyboard move, and saves its source-aware task', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: 'Spring launch' })).toBeVisible()

  await page.getByRole('button', { name: 'visdiff' }).click()
  await page.getByRole('heading', { name: 'Spring launch' }).click()
  await page.getByRole('link', { name: 'Features' }).focus()
  await page.keyboard.press('ArrowRight')

  const stagedChange = page.locator('[data-vd-change]')
  await expect(stagedChange).toContainText('transform')
  await expect(stagedChange).toContainText('translate(1px, 0px)')

  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.locator('[data-vd-toast]')).toContainText('Batch queued with 1 element')

  expect(savedPayload).toMatchObject({
    url: 'http://127.0.0.1:4173/',
    changes: [{
      element: {
        tag: 'h2',
        text: 'Spring launch',
        source: { file: expect.stringContaining('App.tsx') },
      },
      edits: [{
        property: 'transform',
        from: 'none',
        to: 'translate(1px, 0px)',
        kind: 'move',
      }],
    }],
  })
  expect(pageErrors).toEqual([])
})
