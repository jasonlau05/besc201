import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const rates = JSON.parse(readFileSync(new URL('../../server/data/electricity-rates.json', import.meta.url)))

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort())
})

test('follow Compare by keyboard and apply a saved state rate', async ({ page }) => {
  await page.goto('/learn')
  await page.getByRole('link', { name: 'Compare', exact: true }).press('Enter')
  await expect(page).toHaveTitle('EV vs Gas Cost & Carbon Calculator — Group9')
  await expect(page.locator('#guide-title')).toBeFocused()
  await page.locator('#rate-state').selectOption('CA')
  await page.getByRole('button', { name: 'Use this rate in the calculator' }).click()
  await expect(page.locator('#electricity')).toHaveValue(String(rates.states.CA.price))
  await expect(page).toHaveURL(/#cost$/)
})

test('find chargers, select a station and change search radius', async ({ page }) => {
  await page.goto('/chargers')
  await page.locator('#charger-address').fill('Chicago')
  await page.getByRole('button', { name: 'Find chargers' }).click()
  const station = page.locator('.charger-station-select').nth(1)
  await station.click()
  await expect(station).toHaveAttribute('aria-pressed', 'true')
  const destination = new URL(await page.locator('.is-selected a[href*="/dir/"]').getAttribute('href')).searchParams.get('destination')
  await expect.poll(async () => new URL(await page.locator('.charger-map').getAttribute('src')).searchParams.get('q')).toBe(destination)
  await page.locator('#charger-radius').selectOption('5')
  await expect(page.locator('#charger-search-status')).toContainText('found within 5 miles')
})

test('unknown links lead back to the lesson', async ({ page }) => {
  await page.goto('/missing-lesson')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Learn about EVs', exact: true }).click()
  await expect(page).toHaveTitle('Electric Vehicle Basics — Group9')
})

test('mobile chat keeps the input above the tabs during overscroll', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile chat layout')
  await page.goto('/chat')

  const input = page.getByRole('textbox', { name: 'Your question about electric vehicles' })
  const tabs = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(input).toBeVisible()
  const inputBottom = () => input.evaluate(element => element.getBoundingClientRect().bottom)
  const restingBottom = await inputBottom()
  expect(restingBottom).toBeLessThan(await tabs.evaluate(element => element.getBoundingClientRect().top))

  for (const offset of [-36, 36]) {
    await page.evaluate(offsetTop => {
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: offsetTop })
      visualViewport.dispatchEvent(new Event('scroll'))
    }, offset)
    expect(await inputBottom()).toBeCloseTo(restingBottom)
  }

  await input.focus()
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 0 })
    Object.defineProperty(visualViewport, 'height', { value: innerHeight - 240 })
    visualViewport.dispatchEvent(new Event('resize'))
  })
  await expect(tabs).toBeHidden()
  await expect(input).toBeFocused()
  expect(await inputBottom()).toBeLessThan(await page.evaluate(() => visualViewport.height))
})

test('carbon chart marks the reversal when the EV starts cleaner', async ({ page }) => {
  await page.goto('/info')
  await page.locator('#ev-production').press('Home')
  await page.locator('#carbon-efficiency').press('End')
  await page.locator('#carbon-mpg').press('End')
  const result = page.locator('.carbon-result .carbon-big')
  await expect(result).toContainText('113,048 miles')
  await expect(result).toContainText('gas car has the lower total footprint')
  const marker = page.locator('.carbon-chart circle')
  const markerX = Number(await marker.getAttribute('cx'))
  expect(markerX).toBeCloseTo(50 + (113048 / 150000) * 360, 1)
  await page.locator('#carbon-mpg').press('Home')
  await expect(result).toContainText('No crossing')
  await expect(marker).toHaveCount(0)
})
