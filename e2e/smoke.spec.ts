import { expect, test } from '@playwright/test'

// One end-to-end smoke path through the demo, protecting the rehearsed
// walkthrough: Load demo → Planning (shops) → Optimize → Simulation (3D canvas)
// → Report (score > 0) → export downloads. If this stays green, the demo works.

test('demo walkthrough: setup → planning → simulation → report → export', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto('/')

  // Setup → Load demo jumps straight to Planning.
  await page.getByRole('button', { name: /Load demo/i }).click()

  // Planning lists the demo's shops.
  const shopList = page.getByRole('list', { name: /Shops in delivery order/i })
  await expect(shopList).toBeVisible()
  await expect(shopList.getByRole('listitem').first()).toBeVisible()

  // Optimize → the app auto-navigates to Simulation and mounts the 3D canvas.
  await page.getByRole('button', { name: /^Optimize/i }).first().click()
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 })

  // Report → the overall score badge is present and above zero.
  await page.getByText('Report', { exact: true }).first().click()
  const scoreBadge = page.getByText(/\/\s*100/).first().locator('xpath=..')
  await expect(scoreBadge).toBeVisible()
  const scoreText = await scoreBadge.innerText()
  const scoreValue = parseInt(scoreText.match(/\d+/)?.[0] ?? '0', 10)
  expect(scoreValue).toBeGreaterThan(0)

  // Export → clicking "Result JSON" triggers a real file download.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Result JSON/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/loadwise-result-.*\.json/)

  expect(pageErrors, `page errors: ${pageErrors.join('; ')}`).toEqual([])
})
