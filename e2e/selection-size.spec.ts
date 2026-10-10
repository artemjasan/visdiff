import { expect, test } from '@playwright/test'

test('skips viewport-sized targets unless Alt is held', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const target = document.createElement('div')
    target.id = 'vd-large-probe'
    Object.assign(target.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '1000',
      background: 'transparent',
    })
    document.body.append(target)
  })
  await page.getByRole('button', { name: 'visdiff' }).click()

  const target = page.locator('#vd-large-probe')
  await target.click({ position: { x: 240, y: 180 } })
  await expect(page.locator('[data-vd-toast]')).toContainText('hold Alt')
  await expect(page.locator('[data-vd-bar]')).toBeHidden()

  await target.click({ position: { x: 240, y: 180 }, modifiers: ['Alt'] })
  await expect(page.locator('[data-vd-bar]')).toBeVisible()
  await expect(page.locator('[data-vd-label]')).toContainText('vd-large-probe')
})
