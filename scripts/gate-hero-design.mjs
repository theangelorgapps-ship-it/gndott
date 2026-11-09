#!/usr/bin/env node
// Offline checks of actual hero SQL, safe parsing, and React server rendering. No network or production writes.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
export const HERO_SQL_SCHEMA = `
PRAGMA foreign_keys=ON;
CREATE TABLE entertainments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, slug TEXT, description TEXT,
 poster_url TEXT, thumbnail_url TEXT, release_date TEXT, duration TEXT, movie_access TEXT DEFAULT 'free',
 status INTEGER DEFAULT 1, deleted_at TEXT, is_restricted INTEGER DEFAULT 0, video_url_input TEXT,
 bunny_video_url TEXT, bunny_trailer_url TEXT, trailer_url TEXT, language TEXT, content_rating TEXT,
 IMDb_rating TEXT, created_at TEXT, updated_at TEXT, created_by INTEGER, updated_by INTEGER, plan_id INTEGER, total_views INTEGER
);
CREATE TABLE videos (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, description TEXT, poster_url TEXT,
 thumbnail_url TEXT, release_date TEXT, duration TEXT, access TEXT DEFAULT 'free', status INTEGER DEFAULT 1,
 deleted_at TEXT, is_restricted INTEGER DEFAULT 0, video_url_input TEXT, bunny_video_url TEXT,
 trailer_url TEXT, IMDb_rating TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE banners (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, type TEXT, type_id TEXT, banner_for TEXT,
 status INTEGER DEFAULT 1, file_url TEXT, poster_url TEXT, deleted_at TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE banner_order (banner_id INTEGER PRIMARY KEY REFERENCES banners(id), sort_order INTEGER NOT NULL);`
export const serial = value => JSON.parse(JSON.stringify(value))

export function createHeroHarness(database) {
  const cache = new Map()
  function load(relative) {
    const path = resolve(root, relative)
    if (cache.has(path)) return cache.get(path)
    if (path.endsWith('.css')) return {}
    if (path.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'))
    const module = { exports: {} }; cache.set(path, module.exports)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const localRequire = id => {
      if (id === './db') return { all: async (sql, ...values) => database.prepare(sql).all(...values) }
      if (id.startsWith('.')) {
        const base = resolve(dirname(path), id)
        const file = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(candidate => existsSync(candidate))
        if (!file) throw new Error(`Unresolved test dependency ${id} from ${path}`)
        return load(file)
      }
      return require(id)
    }
    vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, URL, console }, { filename: path })
    return module.exports
  }
  return { ...load('src/lib/heroes.server.ts'), ...load('src/lib/hero-design.ts'), ...load('src/components/HeroArtwork.tsx') }
}

export function runHeroRenderingGate(hero) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const frame = (image, x = 50, y = 50, fit = 'cover', align = 'center') => ({ image, x, y, fit, align })
  const design = { version: 1, devices: {
    phone: frame('/media/phone.avif', 12, 34, 'contain', 'left'),
    tablet: frame('/media/tablet.avif', 45, 67, 'cover', 'right'),
    web: frame('/media/web.avif', 89, 10, 'contain', 'center'),
    app: frame('/media/app.avif'),
  } }
  const item = { poster_url: '/media/poster.avif', thumbnail_url: '/media/landscape.avif', hero_design: JSON.stringify(design) }
  const html = renderToStaticMarkup(React.createElement(hero.HeroArtwork, { item, active: true, priority: true }))
  assert.equal((html.match(/<picture\b/g) ?? []).length, 1, 'Responsive artwork must use exactly one picture')
  assert.equal((html.match(/<img\b/g) ?? []).length, 1, 'Responsive artwork must not download three independent images')
  assert.equal((html.match(/<source\b/g) ?? []).length, 2)
  assert.match(html, /<picture class="hero-artwork-layer is-active">/)
  assert.match(html, /<source media="\(max-width: 600px\)" srcSet="\/media\/phone\.avif"/)
  assert.match(html, /<source media="\(max-width: 1024px\)" srcSet="\/media\/tablet\.avif"/)
  assert.match(html, /<img[^>]+src="\/media\/web\.avif"/)
  assert.match(html, /loading="eager"/)
  assert.match(html, /fetchPriority="high"/)
  assert.match(html, /--hero-phone-position:12% 34%/)
  assert.match(html, /--hero-tablet-fit:cover/)
  assert.match(html, /--hero-web-position:89% 10%/)
  assert.ok(!html.includes('/media/app.avif'), 'Native-app artwork is preserved in data, not loaded by website markup')
  const inactive = renderToStaticMarkup(React.createElement(hero.HeroArtwork, { item, active: false }))
  assert.match(inactive, /<picture class="hero-artwork-layer">/)
  assert.ok(!inactive.includes('is-active'))
  assert.match(inactive, /loading="lazy"/)
  const catalogueCss = readFileSync(resolve(root, 'src/catalogue.css'), 'utf8')
  assert.match(catalogueCss, /\.hero-artwork-layer\s*\{[^}]*opacity:\s*0/)
  assert.match(catalogueCss, /\.hero-artwork-layer\.is-active\s*\{[^}]*opacity:\s*1/)
  assert.deepEqual(serial(hero.heroCopyStyle(item)), {
    '--hero-phone-align': 'left', '--hero-phone-items': 'flex-start',
    '--hero-tablet-align': 'right', '--hero-tablet-items': 'flex-end',
    '--hero-web-align': 'center', '--hero-web-items': 'center',
  })
  assert.equal(hero.parseHeroDesign('{broken'), undefined)
  for (const invalid of [null, [], {}, { version: 2, devices: {} }, { version: 1, devices: [] }]) assert.equal(hero.parseHeroDesign(invalid), undefined)
  for (const image of ['javascript:alert(1)', 'http://example.test/image.jpg', 'data:image/svg+xml,<svg/>', '//example.test/image.jpg', '/media/../secret', 'https://user:pass@example.test/image.jpg']) {
    const parsed = hero.parseHeroDesign({ version: 1, devices: { phone: frame(image), web: frame('/media/safe.avif') } })
    assert.deepEqual(Object.keys(parsed.devices), ['web'], `Unsafe artwork rejected: ${image}`)
    const safeMarkup = renderToStaticMarkup(React.createElement(hero.HeroArtwork, { item: { ...item, hero_design: { version: 1, devices: { web: frame(image) } } }, active: true }))
    assert.ok(!safeMarkup.includes(image), 'Rejected URL cannot reach rendered markup')
    assert.match(safeMarkup, /src="\/media\/landscape\.avif"/)
  }
  for (const patch of [{ x: -1 }, { x: Infinity }, { y: 101 }, { fit: 'stretch' }, { align: 'justify' }, { image: 123 }]) {
    assert.deepEqual(serial(hero.parseHeroDesign({ version: 1, devices: { web: { ...frame('/media/web.avif'), ...patch } } }).devices), {})
  }
  assert.deepEqual(serial(hero.parseHeroDesign(design)), design)
  const fallback = renderToStaticMarkup(React.createElement(hero.HeroArtwork, { item: { ...item, hero_design: '{broken' }, active: false }))
  assert.match(fallback, /srcSet="\/media\/poster\.avif"/)
  assert.match(fallback, /src="\/media\/landscape\.avif"/)
}

async function main() {
  const database = new DatabaseSync(':memory:')
  try {
    database.exec(HERO_SQL_SCHEMA)
    database.exec('CREATE TABLE banner_designs(banner_id INTEGER PRIMARY KEY REFERENCES banners(id), design_json TEXT NOT NULL CHECK(json_valid(design_json)))')
    database.exec(`INSERT INTO entertainments(id,name,type,status,movie_access,video_url_input,bunny_video_url,poster_url) VALUES
      (1,'Public sermon','movie',1,'free','https://media.example.test/free.mp4','private-bunny-free','/media/poster.avif'),
      (2,'Paid sermon','movie',1,'paid','https://media.example.test/paid.mp4','private-bunny-paid','/media/paid.avif');
      INSERT INTO banners(id,title,type,type_id,banner_for,status) VALUES(1,'Public hero','movie',1,'home',1),(2,'Paid hero','movie',2,'home',1);
      INSERT INTO banner_designs VALUES(1,'{"version":1,"devices":{}}'),(2,'{"version":1,"devices":{}}');`)
    const hero = createHeroHarness(database)
    const rows = await hero.loadConfiguredHeroes('home')
    assert.equal(rows.length, 2)
    assert.equal(rows[0].video_url_input, 'https://media.example.test/free.mp4')
    assert.equal(rows[1].video_url_input, null)
    assert.ok(!JSON.stringify(rows).includes('private-bunny'))
    await assert.rejects(() => hero.loadConfiguredHeroes('unknown'), /placement/)
    runHeroRenderingGate(hero)
    console.log('HERO_DESIGN_OK sql=actual rendering=SSR sources=2 images=1')
  } finally { database.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
