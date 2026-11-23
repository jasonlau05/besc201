import { build, createServer } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { getPage, indexablePaths, pages, SITE_URL } from '../src/seo.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const escape = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

await build({ root, build: { manifest: true } })
const template = await readFile(join(dist, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(join(dist, '.vite/manifest.json'), 'utf8'))
// Include the lazy vehicle's styles before hydration so its HTML never flashes unstyled.
const vehicleStyles = (manifest['src/ev-animation/TeslaScene.jsx']?.css || [])
  .map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n    ')
const server = await createServer({ root, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { render } = await server.ssrLoadModule('/src/entry-server.jsx')
  for (const path of [...Object.keys(pages), '/404']) {
    const page = getPage(path)
    const canonical = pages[path] ? new URL(path, SITE_URL).href : null
    const website = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: 'Group9', alternateName: ['Group 9', 'BESC 201 Group 9'],
      url: `${SITE_URL}/`,
    }).replace(/</g, '\\u003c')
    const head = [
      `<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow'}" />`,
      '<meta property="og:site_name" content="Group9" />',
      `<meta name="twitter:title" content="${escape(page.title)}" />`,
      `<meta name="twitter:description" content="${escape(page.description)}" />`,
      `<meta name="twitter:image" content="${SITE_URL}/share.png" />`,
      ...(canonical ? [
        `<link rel="canonical" href="${canonical}" />`,
        `<meta property="og:url" content="${canonical}" />`,
      ] : []),
      `<script type="application/ld+json">${website}</script>`,
    ].join('\n    ')
    const markup = await render(path)
    const html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(page.description)}" />`)
      .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(page.title)}" />`)
      .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(page.description)}" />`)
      .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${SITE_URL}/share.png" />`)
      .replace('</head>', `    ${head}\n    ${path === '/' ? vehicleStyles : ''}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root" data-prerendered="true">${markup}</div>`)
    const filename = path === '/' ? 'index.html' : `${path.slice(1)}.html`
    await writeFile(join(dist, filename), html)
    console.log(`Prerendered ${path} → ${filename}`)
  }
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + indexablePaths.map(path => `  <url><loc>${new URL(path, SITE_URL).href}</loc></url>`).join('\n')
    + '\n</urlset>\n'
  await writeFile(join(dist, 'sitemap.xml'), sitemap)
  const robots = await readFile(join(root, 'public/robots.txt'), 'utf8')
  await writeFile(join(dist, 'robots.txt'), `${robots.trim()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
} finally {
  await server.close()
}
