import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const read = file => readFile(new URL(file, dist), 'utf8')
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"')
const expected = [
  ['index.html', '/', 'BESC 201 Group 9 — Electric Vehicle Guide', 'problem-title'],
  ['learn.html', '/learn', 'Electric Vehicle Basics — Group9', 'learn-title'],
  ['info.html', '/info', 'EV vs Gas Cost & Carbon Calculator — Group9', 'guide-title'],
  ['chargers.html', '/chargers', 'Find Nearby EV Charging Stations — Group9', 'charger-title'],
]

test('public pages ship readable HTML and distinct metadata before JavaScript', async () => {
  const descriptions = new Set()
  for (const [file, path, title, heading] of expected) {
    const html = await read(file)
    assert.equal(decode(html.match(/<title>(.*?)<\/title>/s)[1]), title)
    assert.equal(html.match(/<title>/g).length, 1)
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1]
    assert.ok(description.length > 80)
    descriptions.add(description)
    assert.equal(html.match(/rel="canonical"/g).length, 1)
    assert.ok(html.includes(`rel="canonical" href="https://besc201.vercel.app${path}"`))
    assert.ok(html.includes('<meta name="robots" content="index, follow"'))
    assert.match(html, /id="root" data-prerendered="true"><a /)
    assert.match(html, new RegExp(`<h1 id="${heading}"[^>]*>.+?</h1>`))
    assert.doesNotMatch(html, /Switched to client rendering|<!--\$!-->|data-msg=/)
    const website = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])
    assert.equal(website['@type'], 'WebSite')
    assert.equal(website.name, 'Group9')
    assert.equal(website.url, 'https://besc201.vercel.app/')
    assert.ok(website.alternateName.includes('BESC 201 Group 9'))
    const assetLinks = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
    for (const [, asset] of assetLinks) await read(asset.slice(1))
  }
  assert.equal(descriptions.size, expected.length)
  assert.match(await read('index.html'), /We’re Group 9\. We built this guide for BESC 201/)
  const compare = await read('info.html')
  assert.match(compare, /EV vs gas energy cost calculator/)
  assert.match(compare, /<h2 id="carbon-title">When does electric break even\?<\/h2>/)
  assert.match(compare, /href="https:\/\/www\.tesla\.com\/modely\/design\?#overview">Help Elon buy his 5th superyacht<\/a>/)
  assert.match(compare, /13,662/)
  assert.match(compare, /excludes purchase price/)
})

test('sitemap contains only the four public canonical pages; robots advertises it', async () => {
  const xml = await read('sitemap.xml')
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]),
    expected.map(([, path]) => `https://besc201.vercel.app${path}`))
  assert.match(await read('robots.txt'), /Allow: \/\s+Sitemap: https:\/\/besc201.vercel.app\/sitemap.xml/)
  for (const file of ['chat.html', '404.html']) {
    assert.match(await read(file), /name="robots" content="noindex, follow"/)
  }
  const missing = await read('404.html')
  assert.doesNotMatch(missing, /rel="canonical"/)
  const target = missing.match(/class="site-skip" href="#([^"]+)"/)[1]
  assert.ok(missing.includes(`<h1 id="${target}"`))
})

test('Vercel routes each direct page request to its own prerendered HTML', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))
  for (const path of ['/learn', '/info', '/chargers', '/chat']) {
    const rewrite = config.services.client.rewrites.find(rule => rule.source === path)
    assert.equal(rewrite?.destination, `${path}.html`)
    await read(`${path.slice(1)}.html`)
  }
  assert.equal(config.rewrites[0].source, '/api/(.*)')
})
