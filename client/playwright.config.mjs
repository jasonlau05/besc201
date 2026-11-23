import { defineConfig, devices, webkit } from '@playwright/test'

const canRunWebkit = await (async () => {
  try {
    const browser = await webkit.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
})()

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4189' },
  projects: [
    { name: 'desktop', testIgnore: '**/iphone.spec.mjs', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: canRunWebkit ? 'webkit' : 'chromium' } },
    { name: 'mobile', testIgnore: '**/iphone.spec.mjs', use: { viewport: { width: 320, height: 568 } } },
  ],
  webServer: { command: 'node e2e/server.cjs', url: 'http://127.0.0.1:4189/api/health' },
})
