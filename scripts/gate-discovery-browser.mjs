// Shipping React routes and TanStack navigation. Only server functions use local fixtures.
// No live accounts or service calls; browser and localhost server are closed in finally.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = await mkdtemp(resolve(tmpdir(), 'halobox-discovery-ui-'))
const evidence = process.env.GATE_ARTIFACT_DIR || '/tmp/halobox-nov09-library/discovery-evidence'
let server, browser
try {
  await mkdir(evidence, { recursive: true })
  await build({ entryPoints: [resolve(root, 'scripts/fixtures/discovery.tsx')], outfile: resolve(temp, 'fixture.js'), bundle: true, external: ['/*.avif'], format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{
    name: 'local-server-boundaries', setup(b) {
      b.onLoad({ filter: /src\/lib\/(api|catalogue|liveTv|playback|library|bible|people)\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8')
        const names = [...source.matchAll(/export (?:const|(?:async )?function) (\w+)/g)].map(x => x[1])
        return { contents: await readFile(resolve(root, 'scripts/fixtures/discovery-boundaries.js'), 'utf8') + '\n' + names.map(name => `export const ${name} = (...args) => boundary(${JSON.stringify(name)}, ...args);`).join('\n'), loader: 'js' }
      })
      b.onLoad({ filter: /\.css$/ }, async ({ path }) => ({ contents: (await readFile(path, 'utf8')).replace(/@import "tailwindcss\/[^;]+;/g, ''), loader: 'css' }))
    }
  }], logLevel: 'warning' })
  server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
      const path = new URL(req.url, 'http://localhost').pathname
      const file = /^\/fixture\.(js|css)$/.test(path) ? resolve(temp, path.slice(1)) : path.endsWith('.avif') ? resolve(root, 'public' + path) : null
      if (!file) { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><head></head><body><script type="module" src="/fixture.js"></script></body></html>'); return }
      const bytes = await readFile(file)
      res.setHeader('content-type', { '.js': 'text/javascript', '.css': 'text/css', '.avif': 'image/avif' }[extname(file)]); res.end(bytes)
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  const errors = []
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.setDefaultTimeout(5000)
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort())
  await page.addInitScript(() => sessionStorage.setItem('halobox-intro-v1', '1'))
  await page.goto(base + '/')
  await page.locator('.header-search').click()
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/', 'Opening search preserves the current page')
  assert.equal(await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).evaluate(el => el.matches(':modal')), true, 'Search makes the background inert through a native modal')
  const input = page.getByRole('combobox', { name: 'Search Sermons, Shows, Teachings and Videos' })
  await input.waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'combobox')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await page.getByRole('button', { name: 'Close catalogue search' }).evaluate(el => el === document.activeElement), true)
  await page.keyboard.press('Shift+Tab')
  assert.equal(await page.getByRole('button', { name: 'Watchlist', exact: true }).evaluate(el => el === document.activeElement), true, 'Focus stays inside modal')
  await page.screenshot({ path: resolve(evidence, 'spotlight-desktop.png') })
  await input.fill('slow')
  await page.getByText('Searching the catalogue…', { exact: true }).waitFor()
  await page.waitForTimeout(250)
  await input.fill('empty')
  await page.getByText('No catalogue titles match “empty”. Try another title or browse the catalogue.', { exact: true }).waitFor()
  await page.waitForTimeout(950)
  assert.equal(await page.getByRole('option').count(), 0, 'Stale results cannot replace current empty search')
  await input.fill('error')
  await page.getByText('Search is unavailable right now.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByText('Searching the catalogue…', { exact: true }).waitFor()
  await page.getByText('Search is unavailable right now.', { exact: true }).waitFor()
  await input.fill('Faith')
  await page.getByRole('option', { name: 'Faith for Today Sermon · 2025', exact: true }).waitFor()
  await input.press('End')
  assert.equal(await page.getByRole('option', { selected: true }).innerText(), 'Faith in Practice\nTeaching · 2025')
  await input.press('Home')
  assert.equal(await page.getByRole('option', { selected: true }).innerText(), 'Faith for Today\nSermon · 2025')
  await input.press('ArrowDown')
  await page.screenshot({ path: resolve(evidence, 'spotlight-results-desktop.png') })
  await input.press('Enter')
  await page.getByRole('heading', { name: 'Selected destination' }).waitFor()
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, '/teaching/faith-in-practice-2#watch')
  await page.goto(base + '/')
  await page.locator('.header-search').click()
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.header-search').evaluate(el => el === document.activeElement), true, 'Escape restores search trigger focus')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/search')
  await page.getByRole('searchbox', { name: 'Search sermons, shows, and more' }).waitFor()
  const field = await page.locator('.tv-search-entry').boundingBox()
  const categories = await page.getByRole('region', { name: 'Browse categories' }).boundingBox()
  assert.ok(field.y + field.height < categories.y, 'Search field appears before discovery categories on mobile')
  await page.getByRole('heading', { name: 'Browse by category', exact: true }).waitFor()
  await page.screenshot({ path: resolve(evidence, 'search-mobile.png') })
  await page.locator('.tv-search-genres').getByRole('link', { name: 'Faith', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '2 results' }).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('genre'), '1')
  const searchField = page.getByRole('searchbox', { name: 'Search sermons, shows, and more' })
  await searchField.fill('Faith')
  await page.waitForURL(url => url.searchParams.get('q') === 'Faith')
  assert.equal(new URL(page.url()).searchParams.get('genre'), '1', 'Typing preserves selected category')
  await page.goBack()
  await page.getByRole('heading', { name: 'Browse by category', exact: true }).waitFor()
  assert.equal(await searchField.inputValue(), '', 'Back restores authoritative URL query')
  await page.goForward()
  await page.getByRole('status').filter({ hasText: '2 results' }).waitFor()
  assert.equal(await searchField.inputValue(), 'Faith', 'Forward restores query and category')
  await page.goto(base + '/')
  await page.locator('.mobile-search-circle').click()
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
  await page.screenshot({ path: resolve(evidence, 'spotlight-mobile.png') })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.mobile-search-circle').evaluate(el => el === document.activeElement), true)
  await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await page.getByRole('button', { name: 'Search messages, shows and more', exact: true }).click()
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate(el => el === document.activeElement), true, 'Menu search returns focus to surviving menu trigger')
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
  await input.fill('Faith')
  await page.getByRole('option').first().waitFor()
  await page.getByRole('button', { name: 'View all results', exact: true }).click()
  await page.getByRole('heading', { name: 'Search', exact: true }).waitFor()
  assert.equal(new URL(page.url()).searchParams.get('q'), 'Faith')
  await page.goto(base + '/sermons')
  await page.getByRole('navigation', { name: 'Sermons categories' }).getByRole('button', { name: 'Faith', exact: true }).click()
  assert.equal(new URL(page.url()).searchParams.get('category'), '1')
  assert.equal(await page.getByRole('navigation', { name: 'Sermons categories' }).getByRole('button', { name: 'Faith', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.screenshot({ path: resolve(evidence, 'category-glass-mobile.png') })
  for (const [width, height] of [[1440,900], [768,1024], [390,844], [320,740], [844,390]]) {
    await page.emulateMedia({ reducedMotion: width === 1440 ? 'no-preference' : 'reduce' })
    await page.setViewportSize({ width, height })
    await page.goto(base + '/')
    await page.getByRole('heading', { name: 'Explore', exact: true }).waitFor()
    const cards = page.locator('.home-explore-card')
    assert.equal(await cards.count(), 4)
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox()
      assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < .02, 'Explore cards stay landscape')
    }
    await page.screenshot({ path: resolve(evidence, `explore-${width}.png`) })
    await page.keyboard.press('Control+k')
    await page.getByRole('dialog', { name: 'Search the catalogue', exact: true }).waitFor()
    if (width === 1440) await page.waitForTimeout(500)
    const bounds = await page.locator('.spotlight-panel').boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, JSON.stringify(bounds))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow')
    await page.screenshot({ path: resolve(evidence, `spotlight-${width}.png`) })
    await page.keyboard.press('Escape')
  }
  assert.deepEqual(errors, [])
  console.log('DISCOVERY_BROWSER_OK: header/dock/menu/keyboard, modal focus, live results/loading/error/empty/stale, result navigation, URL back-forward, categories and 5 responsive sizes')
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.close(resolve))
  await rm(temp, { recursive: true, force: true })
}
