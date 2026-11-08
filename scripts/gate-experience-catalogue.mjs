import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const { outputText, diagnostics } = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true })
  assert.equal(diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, `Syntax errors in ${path}`)
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] } }, { filename: path })
  return module.exports
}
const clean = value => JSON.parse(JSON.stringify(value))
const filters = load('src/lib/catalogueFilters.ts')
assert.deepEqual(clean(filters.parseCatalogueSearch({ q: '  healing   WORD  ', category: '8', year: '2022' })), { q: 'healing WORD', category: 8, year: 2022 })
for (const bad of ['8 OR 1=1', '-1', '0', '1.2', {}, [], NaN]) assert.equal(filters.parseCategory(bad), undefined)
for (const bad of ['2022x', '22', '0000', '2022.5', {}, []]) assert.equal(filters.parseYear(bad), undefined)
for (const bad of ['2025-02-29', '2024-13-01', '2024-01-00', 'today', null]) assert.equal(filters.catalogueYear(bad), undefined)
assert.equal(filters.catalogueYear('2024-02-29'), 2024)
assert.equal(filters.catalogueYear('2022-12-31T23:59:59Z'), 2022)
assert.equal(filters.parseCatalogueSearch({ q: 'x'.repeat(500) }).q.length, 120)
const titles = [
  { id: 1, name: 'The Word', description: '<p>Healing and faith</p>', created_at: '2026-02-01 12:00:00', release_date: '2022-01-01', categories: [{ id: 8, name: 'Faith' }] },
  { id: 2, name: 'Healing 2026', created_at: '2026-03-03 00:00:00', release_date: '2023-01-01', categories: [{ id: 8, name: 'Faith' }, { id: 12, name: '2026' }] },
  { id: 3, name: 'Espíritu', created_at: '2026-03-03 00:00:00', release_date: null, categories: [{ id: 15, name: 'Teaching' }] },
]
assert.deepEqual(clean(filters.filterCatalogue(titles, { q: 'word HEALING', category: 8, year: 2022 }).map(item => item.id)), [1])
assert.equal(filters.filterCatalogue(titles, { q: 'healing', category: 8, year: 2026 }).length, 0, 'A year in the title/category/creation timestamp must not override the original catalogue date')
assert.equal(filters.filterCatalogue(titles, { year: 2026 }).length, 0, 'Missing catalogue dates must not fall back to import timestamps')
assert.equal(filters.filterCatalogue(titles, { category: 99999 }).length, 0)
assert.equal(filters.filterCatalogue(titles, { q: 'espiritu' })[0].id, 3)
assert.equal(filters.filterCatalogue(titles, {}).length, 3)
assert.equal(filters.filterCatalogue(titles, 8).length, 2, 'Legacy category-only callers still work')
assert.deepEqual(clean(filters.catalogueYears(titles)), [2023, 2022])
assert.deepEqual(clean(filters.catalogueCategories(titles).map(item => item.id)), [12, 8, 15])

// Run the production SQL against SQLite, including unpublished/deleted/restricted negative controls.
let child = 0
const execute = (sql, params) => {
  const program = `import sqlite3,json,sys
request=json.load(sys.stdin)
c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row
c.executescript('''
CREATE TABLE entertainments (id INTEGER,name TEXT,slug TEXT,description TEXT,type TEXT,poster_url TEXT,thumbnail_url TEXT,created_at TEXT,release_date TEXT,IMDb_rating TEXT,duration TEXT,language TEXT,movie_access TEXT,content_rating TEXT,trailer_url TEXT,bunny_video_url TEXT,bunny_trailer_url TEXT,video_url_input TEXT,video_upload_type TEXT,status INTEGER,deleted_at TEXT,is_restricted INTEGER);
CREATE TABLE genres(id INTEGER,name TEXT,status INTEGER,deleted_at TEXT);
CREATE TABLE entertainment_gener_mapping(id INTEGER,entertainment_id INTEGER,genre_id INTEGER,deleted_at TEXT);
CREATE TABLE seasons(id INTEGER,entertainment_id INTEGER,status INTEGER,deleted_at TEXT);
CREATE TABLE episodes(id INTEGER,entertainment_id INTEGER,season_id INTEGER,status INTEGER,deleted_at TEXT,is_restricted INTEGER);
INSERT INTO entertainments(id,name,type,release_date,status,is_restricted) VALUES
(1,'Alpha','movie','2022-03-02',1,0),(2,'Beta','movie','2023-01-01',1,0),(3,'Hidden','movie','1999-01-01',0,0),(4,'Restricted','movie','2010-01-01',1,1),(5,'Deleted','movie','2001-01-01',1,0),(6,'Series A','tvshow','2021-01-01',1,0),(7,'No episodes','tvshow','2020-01-01',1,0),(8,'Teaching','teaching','2024-01-01',1,0),(9,'Restricted episodes','tvshow','2019-01-01',1,0),(10,'Hidden season','tvshow','2018-01-01',1,0);
UPDATE entertainments SET created_at='2026-01-01';
UPDATE entertainments SET deleted_at='2026-01-01' WHERE id=5;
INSERT INTO genres VALUES (1,'Faith',1,NULL),(2,'Word',1,NULL),(3,'Hidden genre',0,NULL),(4,'Deleted genre',1,'2026-01-01'),(5,'Deleted mapping',1,NULL),(6,'Adult only',1,NULL);
INSERT INTO entertainment_gener_mapping VALUES (1,1,1,NULL),(2,1,1,NULL),(3,2,2,NULL),(4,1,3,NULL),(5,1,4,NULL),(6,1,5,'2026-01-01'),(7,4,6,NULL),(8,8,1,NULL);
INSERT INTO seasons VALUES(1,6,1,NULL),(2,9,1,NULL),(3,10,0,NULL);
INSERT INTO episodes VALUES(1,6,1,1,NULL,0),(2,9,2,1,NULL,1),(3,10,3,1,NULL,0),(4,7,1,1,NULL,0);
''')
print(json.dumps([dict(row) for row in c.execute(request['sql'],request['params'])]))`
  const result = spawnSync('python3', ['-c', program], { input: JSON.stringify({ sql, params }), encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}
const createServerFn = () => ({ validator(validate) { this.validate = validate; return this }, handler(handler) { const validate = this.validate; return ({ data }) => handler({ data: validate(data) }) } })
const server = load('src/lib/catalogue.ts', {
  '@tanstack/react-start': { createServerFn },
  './db': { all: async (sql, ...params) => execute(sql, params), first: async (_sql, profile, user) => { assert.deepEqual([profile, user], [21, 9]); return { is_child_profile: child } } },
  './viewer.server': { getActiveViewer: async () => ({ userId: 9, profileId: 21 }) },
  './catalogueFilters': filters,
})
const adult = await server.getCatalogue({ data: 'sermons' })
assert.deepEqual(clean(adult.items.map(item => item.id)), [1, 2, 4])
assert.deepEqual(clean(adult.years), [2023, 2022, 2010])
assert.deepEqual(clean(adult.categories.map(item => item.name)), ['Adult only', 'Faith', 'Word'])
assert.equal(adult.items[0].categories.length, 1, 'Duplicate mappings cannot duplicate facets')
child = 1
const kids = await server.getCatalogue({ data: 'sermons' })
assert.deepEqual(clean(kids.items.map(item => item.id)), [1, 2])
assert.deepEqual(clean(kids.years), [2023, 2022], 'Restricted years must not leak into child facets')
assert.equal(kids.categories.some(category => category.name === 'Adult only'), false)
assert.deepEqual(clean((await server.getCatalogue({ data: 'series' })).items.map(item => item.id)), [6])
child = 0
assert.deepEqual(clean((await server.getCatalogue({ data: 'series' })).items.map(item => item.id)), [9, 6])
assert.equal((await server.getCatalogue({ data: 'shows' })).items.length, 4)
assert.equal((await server.getCatalogue({ data: 'teachings' })).items[0].id, 8)
assert.throws(() => server.getCatalogue({ data: 'movie OR 1=1' }), /valid catalogue/)
assert.throws(() => server.getCatalogue({ data: '__proto__' }), /valid catalogue/)

for (const [path, kind] of [['movies', 'sermons'], ['tv-shows', 'shows'], ['series', 'series'], ['teachings', 'teachings']]) {
  const source = readFileSync(new URL('../src/routes/' + path + '.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('validateSearch: parseCatalogueSearch'))
  assert.ok(source.includes(`data: '${kind}'`))
  assert.ok(source.includes('resetScroll: false'))
  assert.ok(source.includes('<Catalogue'))
}
const ui = readFileSync(new URL('../src/components/Catalogue.tsx', import.meta.url), 'utf8')
assert.ok(ui.includes('label="Year"') && ui.includes('label="Category"'))
assert.ok(ui.includes('type="search"') && ui.includes('type="submit"'))
const picker = readFileSync(new URL('../src/components/ui/choice-picker.tsx', import.meta.url), 'utf8')
assert.ok(ui.includes('<ChoicePicker') && ui.includes('aria-live="polite"'))
assert.ok(picker.includes('showModal()') && picker.includes('ArrowDown') && picker.includes('preventScroll: true'))
assert.ok(picker.includes('No matches') && ui.includes('No ${plural} match these filters'))
const css = readFileSync(new URL('../src/catalogue.css', import.meta.url), 'utf8')
assert.ok(css.includes('@media(max-width:520px)') && css.includes('@media(min-width:1920px)'))
console.log('EXPERIENCE_CATALOGUE_PASS')
