import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { inflateSync } from 'node:zlib'

// Tesla cutaway rendering, native-scroll disassembly, and WebGL failure recovery.
const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const baseUrl = option('--url', 'http://127.0.0.1:5173').replace(/\/$/, '')
const output = path.resolve('.taste-skill/tesla-shots')
const profile = path.resolve('.taste-skill/chrome-tesla-cutaway-qa')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync)
if (!browser) throw new Error('Chrome or Edge is required for browser checks')
fs.mkdirSync(profile, { recursive: true })
fs.mkdirSync(output, { recursive: true })
const portFile = path.join(profile, 'DevToolsActivePort')
if (fs.existsSync(portFile)) fs.unlinkSync(portFile)
const child = spawn(browser, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const results = [], failures = [], browserErrors = []
let ws, currentCase = 'startup'
const pausedSources = []
const check = (pass, name, details = {}) => {
  const row = { case: currentCase, check: name, pass: Boolean(pass), ...details }
  results.push(row)
  if (!pass) { failures.push(row); console.error(`FAIL ${currentCase}: ${name}`, JSON.stringify(details)) }
}
// Decode Chrome's PNG screenshot to prove that a WebGL frame contains car pixels,
// rather than trusting the canvas element or a renderer-ready attribute alone.
function pixelStats(buffer) {
  let width, height, channels, offset = 8
  const chunks = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'IHDR') { width = buffer.readUInt32BE(offset + 8); height = buffer.readUInt32BE(offset + 12); channels = buffer[offset + 17] === 6 ? 4 : 3; if (buffer[offset + 16] !== 8 || ![2, 6].includes(buffer[offset + 17])) throw new Error('Unsupported screenshot PNG') }
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  const inflated = inflateSync(Buffer.concat(chunks)), stride = width * channels
  let previous = Buffer.alloc(stride), index = 0, min = 255, max = 0, sum = 0, squares = 0, dark = 0, pixels = 0
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
  for (let y = 0; y < height; y++) {
    const filter = inflated[index++], row = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0
      const prediction = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0
      row[x] = (inflated[index++] + prediction) & 255
    }
    for (let x = 0; x < stride; x += channels * 3) {
      const value = row[x] * .2126 + row[x + 1] * .7152 + row[x + 2] * .0722
      min = Math.min(min, value); max = Math.max(max, value); sum += value; squares += value * value; dark += value < 95 ? 1 : 0; pixels++
    }
    previous = row
  }
  return { width, height, range: max - min, deviation: Math.sqrt(Math.max(0, squares / pixels - (sum / pixels) ** 2)), darkFraction: dark / pixels }
}
try {
  let port
  for (let i = 0; i < 100 && !port; i++) { await sleep(100); try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) } catch { /* Browser starting. */ } }
  if (!port) throw new Error('Chrome did not start')
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
    else if (message.method === 'Fetch.requestPaused') pausedSources.push(message.params)
    else if (message.method === 'Runtime.exceptionThrown') browserErrors.push({ case: currentCase, kind: 'exception', details: message.params.exceptionDetails })
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') browserErrors.push({ case: currentCase, kind: 'console', text: message.params.args.map(arg => arg.value || arg.description).join(' ') })
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error(`${method} timed out`)) }, 20000)
    pending.set(key, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result) })
    ws.send(JSON.stringify({ id: key, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const s = (method, params) => send(method, params, sessionId)
  const ev = async (fn, ...values) => { const result = await s('Runtime.evaluate', { expression: `(${fn.toString()})(...${JSON.stringify(values)})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
  const waitFor = async (timeout, fn, ...values) => { const deadline = Date.now() + timeout; while (Date.now() < deadline) { try { if (await ev(fn, ...values)) return true } catch (error) { if (!/Execution context was destroyed|Cannot find context|Cannot find default execution context/.test(error.message)) throw error } await sleep(50) } return false }
  const until = (fn, ...values) => waitFor(15000, fn, ...values)
  const untilReady = (fn, ...values) => waitFor(30000, fn, ...values)
  await s('Page.enable'); await s('Runtime.enable'); await s('Page.bringToFront')
  const screenshot = async name => { const { data } = await s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, 'base64')) }
  const showCutaway = async () => {
    await untilReady(() => location.pathname === '/' && Boolean(document.querySelector('.ev-journey-stage')))
    await ev(() => document.querySelector('.ev-journey-stage').scrollIntoView({ block: 'center', behavior: 'instant' }))
  }
  const open = async (width = 1440, reduced = false, height = width < 600 ? 844 : 900) => {
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] })
    await s('Page.navigate', { url: baseUrl + '/' })
    await showCutaway()
    if (!await untilReady(() => document.readyState === 'complete' && !document.documentElement.dataset.pagePhase && document.querySelector('.minimal-landing #problem-title') && document.querySelector('.site-header')?.dataset.page === 'problem' && document.querySelector('[data-ev-journey] .tesla-scene')?.dataset.renderer === 'webgl')) {
      console.error('Readiness diagnostic', JSON.stringify(await ev(() => ({ url: location.href, state: document.readyState, heading: document.querySelector('h1')?.textContent, phase: document.documentElement.dataset.pagePhase, scenes: [...document.querySelectorAll('.tesla-scene')].map(el => ({ ...el.dataset })) }))), JSON.stringify(browserErrors))
      await screenshot('cutaway-readiness-failure'); throw new Error('Tesla cutaway did not become ready')
    }
    await ev(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0) })
  }
  const scroll = async fraction => {
    const target = await ev(progress => {
      const section = document.querySelector('[data-ev-journey]')
      const sticky = section.querySelector('.ev-journey-sticky')
      const bounds = section.getBoundingClientRect()
      const start = bounds.top + scrollY - (Number.parseFloat(getComputedStyle(sticky).top) || 0)
      const travel = Math.max(1, bounds.height - sticky.getBoundingClientRect().height)
      // Scroll positions can round to physical pixels on a fractional section boundary.
      const top = progress === 0 ? Math.floor(start) : progress === 1 ? Math.ceil(start + travel) : start + travel * progress
      const running = section.dataset.motion === 'running' && !matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top, behavior: 'instant' })
      return { top, progress, running }
    }, fraction)
    const reached = await until(expected => {
      const section = document.querySelector('[data-ev-journey]'), scene = section.querySelector('.tesla-scene'), progress = Number.parseFloat(section.style.getPropertyValue('--ev-progress'))
      return Math.abs(scrollY - expected.top) < 2 && (!expected.running || (Math.abs(progress - expected.progress) < .002 && (scene.dataset.renderer === 'fallback' ? Math.abs(Number(scene.querySelector('.ev-assembly-fit')?.dataset.fittedProgress) - expected.progress) < .002 : Math.abs(Number(scene.dataset.progress) - expected.progress) < .002)))
    }, target)
    if (!reached) console.error('Pose readiness diagnostic', JSON.stringify(await state()))
    return reached
  }
  const state = () => ev(() => {
    const section = document.querySelector('[data-ev-journey]'), scene = section.querySelector('.tesla-scene'), canvas = scene.querySelector('canvas'), pin = section.querySelector('.ev-journey-sticky')
    const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } }
    const visible = el => { for (let node = el; node; node = node.parentElement) { const style = getComputedStyle(node); if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .01) return false } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const fallback = scene.querySelector('.ev-assembly'), selectors = { body: '.ev-fallback-car-shell', battery: '[data-ev-layer="battery"]', cover: '[data-ev-layer="cover"]', modules: '[data-ev-layer="modules"]', cells: '[data-ev-layer="cells"]', cooling: '[data-ev-layer="cooling"]' }
    const fallbackLayers = fallback && scene.dataset.renderer === 'fallback' ? Object.fromEntries(Object.entries(selectors).map(([name, selector]) => { const el = fallback.querySelector(selector); return [name, el ? { transform: getComputedStyle(el).transform, visible: visible(el), rect: rect(el) } : null] })) : null
    const fallbackRects = fallback ? [...fallback.querySelectorAll("*")].filter(el => !el.matches(".ev-fallback-car-model, .ev-fallback-car-shell, .ev-fallback-car-shadow")).map(rect).filter(r => r.width || r.height) : []; const fallbackBounds = fallbackRects.length ? { top: Math.min(...fallbackRects.map(r => r.y)), bottom: Math.max(...fallbackRects.map(r => r.bottom)), left: Math.min(...fallbackRects.map(r => r.x)), right: Math.max(...fallbackRects.map(r => r.right)) } : null; return { fallbackScale: Number(scene.querySelector(".ev-assembly-fit")?.dataset.fittedScale), fallbackBounds, framing: JSON.parse(scene.dataset.framing || "null"), opacity: JSON.parse(scene.dataset.layerOpacity || "null"), copy: rect(section.querySelector(".ev-journey-copy")), viewport: { width: innerWidth, height: innerHeight }, motion: section.dataset.motion, car: scene.dataset.car, renderer: scene.dataset.renderer, progress: Number.parseFloat(section.style.getPropertyValue('--ev-progress')), renderedProgress: Number(scene.dataset.progress), rotationY: Number(scene.dataset.rotationY), bodyY: Number(scene.dataset.bodyY), coverY: Number(scene.dataset.coverY), moduleSpread: Number(scene.dataset.moduleSpread), cellSpread: Number(scene.dataset.cellSpread), count: Number(scene.dataset.renderCount), triangles: Number(scene.dataset.triangles), step: section.dataset.evStep, active: [...section.querySelectorAll('[data-ev-step-item][aria-current="step"]')].map(el => el.dataset.evStepItem), details: [...section.querySelectorAll('[data-ev-detail]')].filter(visible).map(el => ({ step: el.dataset.evDetail, text: el.textContent.trim() })), text: section.innerText, pin: rect(pin), inset: Number.parseFloat(getComputedStyle(pin).top) || 0, position: getComputedStyle(pin).position, scene: rect(scene), canvas: { width: canvas?.width, height: canvas?.height }, overflow: document.documentElement.scrollWidth > innerWidth + 1, fallbackVisible: fallback ? visible(fallback) : false, fallbackLayers }
  })
  const signature = frame => JSON.stringify(frame.renderer === 'fallback' ? frame.fallbackLayers && Object.fromEntries(Object.entries(frame.fallbackLayers).map(([name, layer]) => [name, layer?.transform])) : { progress: frame.renderedProgress, rotationY: frame.rotationY, bodyY: frame.bodyY, coverY: frame.coverY, moduleSpread: frame.moduleSpread, cellSpread: frame.cellSpread })
  const framePixels = async () => {
    // CDP clip coordinates are relative to the document, while client rects are
    // relative to the viewport. Include the native scroll offset for this pin.
    const clip = await ev(() => { const r = document.querySelector('[data-ev-journey] .tesla-scene canvas').getBoundingClientRect(), x = Math.max(0, r.x), y = Math.max(0, r.y); return { x: x + scrollX, y: y + scrollY, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y, scale: 1 } })
    return pixelStats(Buffer.from((await s('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: false })).data, 'base64'))
  }
  const samples = []
  for (const width of [1440, 390]) {
    currentCase = `cutaway/loading-${width}`
    // Force a fresh document; navigating to the same hash can reuse the page.
    await s('Page.navigate', { url: 'about:blank' })
    if (!await until(() => location.href === 'about:blank')) throw new Error('Loading check did not reset its document')
    const { identifier } = await s('Page.addScriptToEvaluateOnNewDocument', { source: `(${(() => {
      const original = window.requestAnimationFrame.bind(window)
      const audit = { held: [], hold: true, flashed: false }
      window.__teslaLoadingAudit = audit
      window.requestAnimationFrame = callback => {
        if (audit.hold && document.querySelector('.tesla-scene')?.dataset.renderer === 'loading' && new Error().stack.includes('TeslaScene')) {
          audit.held.push(callback)
          return original(() => {})
        }
        return original(callback)
      }
      const observer = new MutationObserver(() => {
        const scene = document.querySelector('.tesla-scene'), fallback = scene?.querySelector('.tesla-scene-fallback')
        if (fallback && scene.dataset.renderer !== 'webgl' && getComputedStyle(fallback).visibility !== 'hidden') audit.flashed = true
      })
      observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-renderer', 'class', 'style'] })
      window.__releaseTeslaLoading = () => {
        audit.hold = false
        window.requestAnimationFrame = original
        audit.held.forEach(callback => original(callback))
      }
    }).toString()})()` })
    pausedSources.length = 0
    await s('Network.enable')
    await s('Network.setCacheDisabled', { cacheDisabled: true })
    await s('Fetch.enable', { patterns: [{ urlPattern: '*TeslaScene*', resourceType: 'Script', requestStage: 'Request' }] })
    await s('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: false })
    await s('Page.navigate', { url: baseUrl + '/#full-picture' })
    await showCutaway()
    check(await until(() => document.querySelector('.tesla-loading') && !document.querySelector('.tesla-scene') && !document.documentElement.dataset.pagePhase), 'delayed Tesla download shows a loading state with no older car')
    check(pausedSources.length > 0, 'Tesla module download is deliberately held for regression verification')
    check(await ev(() => !document.querySelector('.ev-fallback-car') && document.querySelector('.tesla-loading').textContent.includes('Loading Tesla')), 'loading the renderer never mounts the green placeholder vehicle')
    await ev(() => document.querySelector('[data-ev-journey]').scrollIntoView({ behavior: 'instant' }))
    await screenshot(`tesla-${width}-download-loading`)
    for (const request of pausedSources) await s('Fetch.continueRequest', { requestId: request.requestId })
    await s('Fetch.disable')
    check(await untilReady(() => document.querySelector('.tesla-scene')?.dataset.renderer === 'loading' && window.__teslaLoadingAudit.held.length > 0), 'Tesla initialization is held before its first rendered frame')
    check(await ev(() => {
      const scene = document.querySelector('.tesla-scene')
      return getComputedStyle(scene.querySelector('.tesla-scene-fallback')).visibility === 'hidden' && Number(getComputedStyle(scene.querySelector('canvas')).opacity) === 0 && getComputedStyle(scene.querySelector('.tesla-scene-loading')).display !== 'none'
    }), 'initializing WebGL keeps the old car hidden and the loading state visible')
    await screenshot(`tesla-${width}-first-frame-loading`)
    await ev(() => window.__releaseTeslaLoading())
    check(await untilReady(() => document.querySelector('.tesla-scene')?.dataset.renderer === 'webgl'), 'the rendered Tesla replaces the loading state')
    check(await ev(() => !window.__teslaLoadingAudit.flashed && getComputedStyle(document.querySelector('.tesla-scene-loading')).display === 'none' && getComputedStyle(document.querySelector('.tesla-scene-fallback')).visibility === 'hidden'), 'the full loading sequence never flashes the old vehicle')
    await s('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    await s('Network.setCacheDisabled', { cacheDisabled: false })
    console.log(`Checked ${currentCase}`)
  }
  if (args.includes('--loading-only')) {
    check(browserErrors.length === 0, 'loading completes without JavaScript or console errors', { errors: browserErrors })
    fs.writeFileSync(path.join(output, 'loading-results.json'), JSON.stringify({ baseUrl, results, failures, browserErrors }, null, 2))
    console.log(`${failures.length ? 'FAIL' : 'PASS'}: ${results.length - failures.length}/${results.length} Tesla loading checks`)
    if (failures.length) process.exitCode = 1
    await send('Browser.close')
  } else {
  const checkFraming = frame => {
    check(frame.framing && Object.values(frame.framing.bounds).every(value => Math.abs(value) <= .920001), 'all pieces including ghost parts fit inside the camera with clear edges', { framing: frame.framing })
    check(frame.framing && Math.abs(frame.framing.moduleCenter.x) < .001 && (frame.viewport.width <= 760 || frame.progress < .27 || Math.abs(frame.framing.moduleCenter.y) < .001), 'battery modules are centered in the animation area')
    check(frame.scene.y >= frame.inset - 1 && frame.scene.bottom <= frame.pin.bottom - 8 && frame.scene.x >= -1 && frame.scene.right <= frame.viewport.width + 1 && frame.scene.bottom < frame.viewport.height, 'animation area stays inside the viewport below the navigation', { scene: frame.scene, viewport: frame.viewport })
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    currentCase = `cutaway/${width}`
    await open(width)
    check(await ev(() => document.querySelectorAll('.tesla-scene').length === 1 && !document.querySelector('.landing-page, .lp-header, [data-design], #lp-electricity, .ev-journey-footer, .ev-motion-toggle') && document.querySelector('.minimal-copy h1').textContent === 'Our Mission' && ['/', '/learn', '/info', '/chargers'].every(href => document.querySelector(`.site-header a[href="${href}"]`))), 'original homepage and navigation restored with only one Tesla scene')
    if ([1440, 390].includes(width)) await screenshot(`restored-home-${width}`)
    const frames = []
    for (const fraction of [0, .35, .7, .96]) {
      check(await scroll(fraction), `renderer reaches requested progress ${fraction}`)
      const frame = await state(); frames.push(frame)
      check(!frame.overflow, `no horizontal overflow at progress ${fraction}`)
      check(frame.renderer === 'webgl' && frame.car === 'Tesla Model 3' && frame.count > 0 && frame.triangles > 1000 && frame.canvas.width > 100 && frame.canvas.height > 100, `Tesla geometry renders at progress ${fraction}`, { renderer: frame.renderer, triangles: frame.triangles, canvas: frame.canvas })
      check(frame.active.length === 1 && frame.active[0] === frame.step && frame.details.length === 1 && frame.details[0].step === frame.step && frame.details[0].text.length > 30, `component explanation matches progress ${fraction}`, { step: frame.step, active: frame.active, details: frame.details })
      checkFraming(frame)
      const focus = ['body', 'pack', 'modules', 'cells'][Number(frame.step)]
      check(frame.opacity?.[focus] >= .99 && ['body', 'pack', 'modules', 'cells'].filter(layer => layer !== focus).every(layer => frame.opacity?.[layer] <= .13), `active ${focus} stays solid while inactive components are transparent`, { opacity: frame.opacity })
      if ([1440, 390].includes(width)) await screenshot(`tesla-${width}-step-${Math.round(fraction * 100)}`)
    }
    const [initial, middle, late, final] = frames
    check(frames.every(frame => frame.framing.viewHeight === initial.framing.viewHeight && Math.abs(frame.framing.projectionScale.x - initial.framing.projectionScale.x) < 1e-12 && Math.abs(frame.framing.projectionScale.y - initial.framing.projectionScale.y) < 1e-12), 'camera zoom remains fixed through every animation stage', { viewHeights: frames.map(frame => frame.framing.viewHeight) })
    check(frames.every(frame => frame.position === 'sticky' && Math.abs(frame.pin.y - frame.inset) < 2), 'cutaway remains pinned below the original navigation', { positions: frames.map(frame => frame.pin.y), insets: frames.map(frame => frame.inset) })
    check(initial.progress <= .02 && middle.progress > initial.progress && late.progress > middle.progress && final.progress >= .94, 'progress advances through the physical scroll section', { progress: frames.map(frame => frame.progress) })
    check(Number.isFinite(initial.bodyY) && final.bodyY > initial.bodyY, 'Tesla body lifts away from the chassis', { initial: initial.bodyY, final: final.bodyY })
    check(Number.isFinite(initial.coverY) && final.coverY > initial.coverY, 'battery cover moves independently', { initial: initial.coverY, final: final.coverY })
    check(final.moduleSpread > initial.moduleSpread && final.cellSpread > initial.cellSpread, 'modules and cells separate into their own layers', { initial: { modules: initial.moduleSpread, cells: initial.cellSpread }, final: { modules: final.moduleSpread, cells: final.cellSpread } })
    const pixels = await framePixels()
    // Ghost wheels are deliberately light; contrast and variation still prove
    // that the canvas contains geometry rather than a uniform empty frame.
    check(pixels.range > 75 && pixels.deviation > 6, 'exploded state contains visible rendered battery and car pixels', pixels)
    // CSS degrees round to two decimals and progress to four; allow their
    // combined quantization error (less than 0.02 degrees) between samples.
    check(frames.every(frame => Math.abs(frame.rotationY - (-.10 - Math.PI * frame.renderedProgress)) < .0003), 'the rendered assembly rotates continuously with scroll progress', { rotations: frames.map(frame => frame.rotationY) })
    const reachedEnd = await scroll(1), end = await state()
    check(end.framing.viewHeight === initial.framing.viewHeight, 'the final exploded pose uses the same scale as the assembled Tesla')
    checkFraming(end)
    check(reachedEnd && Math.abs(initial.rotationY - end.rotationY - Math.PI) < .00001, 'the complete sequence rotates the actual model exactly 180 degrees', { start: initial.rotationY, end: end.rotationY })
    if ([1440, 390].includes(width)) await screenshot(`tesla-${width}-180-degrees`)
    await scroll(0)
    check(signature(initial) === signature(await state()), 'reverse scrolling reassembles the same Tesla')
    await sleep(200); const idleStart = await state(); await sleep(300); const idleEnd = await state()
    check(idleStart.count === idleEnd.count, 'stationary scene has no perpetual render loop', { before: idleStart.count, after: idleEnd.count })
    samples.push({ width, frames })
    console.log(`Checked ${currentCase}`)
  }
  for (const [width, height] of [[1366, 650], [390, 667], [320, 568]]) {
    currentCase = `cutaway/short-${width}x${height}`
    await open(width, false, height)
    for (const fraction of [.38, .7, 1]) {
      check(await scroll(fraction), `short viewport reaches progress ${fraction}`)
      checkFraming(await state())
    }
    await screenshot(`tesla-short-${width}x${height}`)
    console.log(`Checked ${currentCase}`)
  }
  currentCase = 'restored-site/navigation'
  await open()
  for (const [href, heading] of [['/learn', 'learn-title'], ['/info', 'guide-title']]) {
    await ev(target => document.querySelector(`.site-header a[href="${target}"]`).click(), href)
    check(await until((target, id) => location.pathname === target && document.getElementById(id) && !document.querySelector('[data-ev-journey]') && !document.documentElement.dataset.pagePhase, href, heading), `original navigation opens ${href} and unmounts the animation`)
    await ev(() => document.querySelector('.site-header .group9-logo').click())
    await showCutaway()
    check(await untilReady(() => location.pathname === '/' && document.querySelectorAll('.tesla-scene').length === 1 && document.querySelector('.tesla-scene')?.dataset.renderer === 'webgl' && !document.documentElement.dataset.pagePhase), 'returning home mounts one working Tesla animation')
  }
  currentCase = 'cutaway/reduced-motion'
  await open(390, true)
  check(await until(() => Number(document.querySelector('[data-ev-journey] .tesla-scene').dataset.progress) === 1), 'reduced motion starts in the expanded cutaway')
  await scroll(0); const reducedStart = await state(); await scroll(1); const reducedEnd = await state()
  check(signature(reducedStart) === signature(reducedEnd) && reducedEnd.motion === 'paused', 'reduced-motion Tesla stays static while scrolling')
  check(reducedEnd.details.length === 4 && reducedEnd.details.every(item => item.text.length > 30) && !reducedEnd.overflow && reducedEnd.position !== 'sticky', 'static fallback keeps every component explanation in normal flow', { details: reducedEnd.details.length, position: reducedEnd.position })
  check(await ev(() => document.getAnimations().filter(animation => animation.playState === 'running').length === 0), 'reduced motion has no running animations')
  await ev(() => document.querySelector('[data-ev-journey] .tesla-scene').scrollIntoView({ block: 'center', behavior: 'instant' })); await screenshot('tesla-390-reduced-cutaway')
  currentCase = 'cutaway/live-preference'
  await open(); await scroll(.7)
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const settled = await until(() => document.querySelector('[data-ev-journey]').dataset.motion === 'paused' && Number(document.querySelector('[data-ev-journey] .tesla-scene').dataset.progress) === 1)
  const changed = await state(); await scroll(.1)
  check(settled && signature(changed) === signature(await state()), 'changing motion preference mid-scroll yields a static expanded Tesla')
  currentCase = 'cutaway/WebGL-recovery'
  await open(); await scroll(0)
  const canLoseContext = await ev(() => { const canvas = document.querySelector('[data-ev-journey] .tesla-scene canvas'), gl = canvas.getContext('webgl2'), extension = gl?.getExtension('WEBGL_lose_context'); if (!extension) return false; extension.loseContext(); return true })
  check(canLoseContext, 'browser exposes real context loss for failure-path verification')
  const fallbackReady = await until(() => document.querySelector('[data-ev-journey] .tesla-scene').dataset.renderer === 'fallback')
  const fallbackStart = await state()
  check(fallbackReady && fallbackStart.fallbackVisible && ['body', 'battery', 'cover', 'modules', 'cells', 'cooling'].every(name => fallbackStart.fallbackLayers?.[name]), 'WebGL loss reveals a complete CSS cutaway instead of a blank frame', { renderer: fallbackStart.renderer, fallbackVisible: fallbackStart.fallbackVisible, layers: Object.keys(fallbackStart.fallbackLayers || {}) })
  await scroll(.96); const fallbackEnd = await state()
  check(signature(fallbackStart) !== signature(fallbackEnd) && fallbackEnd.fallbackVisible, 'CSS fallback retains scroll-driven deconstruction after context loss')
  check(fallbackEnd.fallbackBounds && fallbackEnd.fallbackBounds.top >= fallbackEnd.scene.y - 1 && fallbackEnd.fallbackBounds.bottom <= fallbackEnd.scene.bottom + 1 && fallbackEnd.fallbackBounds.left >= fallbackEnd.scene.x - 1 && fallbackEnd.fallbackBounds.right <= fallbackEnd.scene.right + 1, 'fallback geometry also fits completely inside the animation area', { bounds: fallbackEnd.fallbackBounds, scene: fallbackEnd.scene })
  await screenshot('tesla-1440-context-loss-fallback')
  for (const [width, height] of [[1440, 900], [390, 667]]) {
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    let fixedScale
    for (const progress of [.38, .7, 1]) {
      check(await scroll(progress), `CSS fallback reaches progress ${progress} at ${width}px`)
      const frame = await state(), bounds = frame.fallbackBounds
      fixedScale ??= frame.fallbackScale
      check(frame.fallbackScale > 0 && frame.fallbackScale === fixedScale, `CSS fallback scale remains fixed at ${width}px`, { scale: frame.fallbackScale })
      check(bounds && bounds.top >= frame.scene.y - 1 && bounds.bottom <= frame.scene.bottom + 1 && bounds.left >= frame.scene.x - 1 && bounds.right <= frame.scene.right + 1, `CSS fallback keeps every piece in frame at ${width}px and progress ${progress}`, { bounds, scene: frame.scene })
    }
  }
  await screenshot('tesla-390-context-loss-fallback')
  check(browserErrors.length === 0, 'no unexpected console errors or JavaScript exceptions', { errors: browserErrors })
  fs.writeFileSync(path.join(output, 'cutaway-results.json'), JSON.stringify({ baseUrl, results, failures, browserErrors, samples }, null, 2))
  console.log(`${failures.length ? 'FAIL' : 'PASS'}: ${results.length - failures.length}/${results.length} Tesla cutaway checks`)
  if (failures.length) process.exitCode = 1
  await send('Browser.close')
  }
} finally { ws?.close(); child.kill() }
