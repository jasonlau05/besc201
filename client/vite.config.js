import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { normalizePath, pages } from './src/seo.mjs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'prerendered-preview-routes',
    // Match Vercel's clean page URLs when checking the production build locally.
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://localhost')
        const path = normalizePath(url.pathname)
        if (pages[path] && path !== '/') request.url = `${path}.html${url.search}`
        else if (!pages[path] && !url.pathname.split('/').pop().includes('.')) {
          try {
            const html = await readFile(resolve(server.config.root, server.config.build.outDir, '404.html'))
            response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
            response.end(html)
            return
          } catch (error) { next(error); return }
        }
        next()
      })
    },
  }],
  server: { proxy: { '/api': 'http://localhost:5000' } },
})
