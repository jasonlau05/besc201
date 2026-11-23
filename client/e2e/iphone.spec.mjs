import { expect, test } from '@playwright/test'

test('a fresh presentation link shows the mission and all tabs before hydration', async ({ page }) => {
  await page.route('**/*.js', route => route.abort())
  await page.goto('/?source=presentation')
  await expect(page.locator('#root')).toHaveCSS('opacity', '1', { timeout: 300 })
  await expect(page.getByRole('heading', { name: 'Our Mission' })).toBeInViewport()
  await expect(page.getByRole('link', { name: 'Learn about EVs' })).toBeInViewport()
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5)
  await page.screenshot({ path: test.info().outputPath('landing.png'), scale: 'css' })
  await page.getByRole('link', { name: 'Compare', exact: true }).tap()
  await expect(page.locator('#guide-title')).toBeInViewport()
})

test('rotate from the cutaway, switch tabs and type a question', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const stage = page.locator('.ev-journey-stage')
  await expect(page.locator('.tesla-scene')).toHaveCount(0)
  await page.locator('#full-picture').scrollIntoViewIfNeeded()
  const scene = stage.locator('.tesla-scene')
  await expect(scene).toBeAttached({ timeout: 5000 })
  await expect(scene).toHaveAttribute('data-renderer', /webgl|fallback/, { timeout: 10000 })
  await page.setViewportSize({ width: 844, height: 390 })
  const nav = page.getByRole('navigation')
  const chat = nav.getByRole('link', { name: 'Chat with Elon' })
  await expect(chat).toBeInViewport()
  await expect.poll(() => page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect()
    return box('.ev-journey-stage').bottom <= box('.nav-links').top &&
      box('.ev-journey-stage').height > 80
  })).toBe(true)
  await page.screenshot({ path: test.info().outputPath('landscape-cutaway.png'), scale: 'css' })
  const addressTab = nav.getByRole('link', { name: 'Chargers near me' })
  await addressTab.tap()
  await expect(page.locator('#charger-title')).toBeFocused()
  await chat.tap()
  const draft = page.getByRole('textbox')
  await draft.fill('How does charging work?')
  await page.setViewportSize({ width: 390, height: 664 })
  await expect(draft).toHaveValue('How does charging work?')
  await expect(draft).toBeInViewport()
  await expect(chat).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page.locator('#charger-title')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect(errors).toEqual([])
})

test('learn page: hero cta, animated details accordions, and link to carbon simulator', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')

  // Tap "Learn about EVs" CTA on home page
  await page.getByRole('link', { name: 'Learn about EVs' }).tap()
  await expect(page).toHaveURL(/\/learn$/)
  await expect(page.locator('#learn-title')).toBeVisible()

  // Tap "Start with the basics" jump link
  await page.getByRole('link', { name: 'Start with the basics' }).tap()
  await expect(page.locator('#basics')).toBeInViewport()

  // Check energy flow SVG diagram is present
  await expect(page.locator('.learn-energy-flow svg')).toHaveCount(3)

  // Expand an FAQ item via touch tap
  const faqSummary = page.getByText('What affects an EV’s range?')
  await faqSummary.tap()
  await expect(page.getByText('Speed, temperature, cabin heating')).toBeVisible()

  // Tap link to carbon simulator on Compare page
  await page.getByRole('link', { name: 'Explore the carbon break-even simulator' }).tap()
  await expect(page).toHaveURL(/\/info#fit$/)
  await expect(page.locator('#fit')).toBeInViewport()
  expect(errors).toEqual([])
})

test('compare page: state rate selector and slider touch interactions', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/info')

  // Hero jump link
  await page.getByRole('link', { name: 'Let’s find out' }).tap()
  await expect(page.locator('#fit')).toBeInViewport()

  // State rate selector
  await page.locator('#rate-state').selectOption('IL')
  await page.getByRole('button', { name: 'Use this rate in the calculator' }).tap()
  await expect(page).toHaveURL(/#cost$/)
  await expect(page.locator('#cost')).toBeInViewport()

  // Carbon simulator slider interaction
  const evSlider = page.locator('#ev-production')
  await evSlider.fill('8')
  await expect(page.locator('.carbon-chart')).toBeVisible()

  // Expand animated details on compare page
  const assumptions = page.getByText('Our fixed comparison & sources')
  await assumptions.tap()
  await expect(page.getByText('EPA’s gasoline emissions factor')).toBeVisible()

  expect(errors).toEqual([])
})

test('chargers page: mobile search, station accordion details, and directions', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/chargers')

  // Search input and submission
  await page.locator('#charger-address').fill('Chicago')
  await page.getByRole('button', { name: 'Find chargers' }).tap()

  // Select station to open details
  const station = page.locator('.charger-station-select').first()
  await station.tap()
  await expect(station).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.is-selected .charger-station-details')).toBeVisible()
  await expect(page.locator('.is-selected a[href*="google.com/maps/dir"]')).toBeVisible()

  // Change radius
  await page.locator('#charger-radius').selectOption('10')
  await expect(page.locator('#charger-search-status')).toContainText('found within 10 miles')

  expect(errors).toEqual([])
})

test('ev-journey cutaway: reduced motion mode stays responsive and stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const journey = page.locator('#full-picture')
  await journey.scrollIntoViewIfNeeded()
  await expect(journey).toHaveAttribute('data-motion', 'paused')

  // In reduced motion, all details remain rendered
  await expect(journey.locator('[data-ev-detail="0"]')).toBeVisible()
  await expect(journey.locator('[data-ev-detail="3"]')).toBeVisible()
})

test('rapid scrolling down to the cutaway stage reliably activates the 3D cutaway without getting stuck on loading', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')

  const stage = page.locator('.ev-journey-stage')
  // Initially before scrolling, cutaway is not loaded
  await expect(stage.locator('.tesla-scene')).toHaveCount(0)

  // Rapidly scroll down directly to the cutaway section
  await page.evaluate(() => {
    const journey = document.querySelector('#full-picture')
    if (journey) {
      window.scrollTo({ top: journey.offsetTop + 100, behavior: 'instant' })
    }
  })

  // Ensure cutaway element appears
  const scene = stage.locator('.tesla-scene')
  await expect(scene).toBeAttached({ timeout: 5000 })

  // Verify it reliably transitions to a valid renderer (webgl or fallback) and never gets stuck on 'loading'
  await expect(scene).toHaveAttribute('data-renderer', /^(webgl|fallback)$/, { timeout: 10000 })
  expect(await scene.getAttribute('data-renderer')).not.toBe('loading')

  expect(errors).toEqual([])
})

test('switching orientation maintains valid data-renderer and does not reset to loading', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')

  // Start in iPhone portrait (390 x 844)
  await page.setViewportSize({ width: 390, height: 844 })
  const stage = page.locator('.ev-journey-stage')
  await page.locator('#full-picture').scrollIntoViewIfNeeded()

  const scene = stage.locator('.tesla-scene')
  await expect(scene).toBeAttached({ timeout: 5000 })
  await expect(scene).toHaveAttribute('data-renderer', /^(webgl|fallback)$/, { timeout: 10000 })
  const activeRenderer = await scene.getAttribute('data-renderer')
  expect(['webgl', 'fallback']).toContain(activeRenderer)

  // Switch to landscape (844 x 390)
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(scene).toHaveAttribute('data-renderer', activeRenderer)
  expect(await scene.getAttribute('data-renderer')).not.toBe('loading')

  // Switch back to portrait (390 x 844)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(scene).toHaveAttribute('data-renderer', activeRenderer)
  expect(await scene.getAttribute('data-renderer')).not.toBe('loading')

  expect(errors).toEqual([])
})


