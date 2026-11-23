import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4189' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', use: { viewport: { width: 320, height: 568 } } },
  ],
  webServer: { command: 'node e2e/server.cjs', url: 'http://127.0.0.1:4189/api/health' },
})
