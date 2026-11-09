import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, imports = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => { assert.ok(name in imports, name); return imports[name] } })
  return module.exports
}
const clean = value => JSON.parse(JSON.stringify(value))
const { parseCatalogueSearch, filterCatalogue } = load('src/lib/catalogueFilters.ts')
const input = [
  { id: 'missing', name: 'Unknown', release_date: null },
  { id: 'old', name: 'Faith', release_date: '2016-01-01', categories: [{ id: 1, name: 'Faith' }] },
  { id: 'new', name: 'Faith today', release_date: '2026-02-01', categories: [{ id: 1, name: 'Faith' }] },
  { id: 'older', name: 'A word', release_date: '2015', description: 'Faith', categories: [{ id: 2, name: 'Word' }] },
  { id: 'invalid', name: 'Bad date', release_date: '2016-02-30' },
  { id: 'tie', name: 'Faith again', release_date: '2016-01-01', categories: [{ id: 1, name: 'Faith' }] },
]
const ids = search => clean(filterCatalogue(input, search).map(item => item.id))
const before = JSON.stringify(input)
assert.deepEqual(ids({ sort: 'newest' }), ['new', 'old', 'tie', 'older', 'missing', 'invalid'])
assert.deepEqual(ids({ sort: 'oldest' }), ['older', 'old', 'tie', 'new', 'missing', 'invalid'])
assert.deepEqual(ids({ q: 'faith' }), ['old', 'new', 'tie', 'older'], 'Exact title before prefix before description-only relevance')
assert.deepEqual(ids({ q: 'faith', category: 1, year: 2016, sort: 'newest' }), ['old', 'tie'])
assert.equal(JSON.stringify(input), before, 'Sorting must never mutate shared loader data')
assert.equal(parseCatalogueSearch({ sort: 'newest' }).sort, 'newest')
assert.equal(parseCatalogueSearch({ sort: 'oldest' }).sort, 'oldest')
for (const sort of ['random', {}, [], 'NEWEST', '__proto__']) assert.equal(parseCatalogueSearch({ sort }).sort, undefined)

// Exercise the redirect handlers, including encoded queries and hash fragments.
for (const [legacy, canonical] of [['movies', 'sermons'], ['tv-shows', 'shows']]) {
  const { Route } = load(`src/routes/${legacy}.tsx`, {
    '@tanstack/react-router': {
      createFileRoute: path => options => { assert.equal(path, '/' + legacy); return options },
      redirect: options => options,
    },
  })
  for (const [searchStr, hash, suffix] of [
    ['', '', ''],
    ['?q=faith%20%26%20word&year=2016&sort=oldest', 'watch', '?q=faith%20%26%20word&year=2016&sort=oldest#watch'],
    ['?category=4', '#chapters', '?category=4#chapters'],
  ]) {
    let caught
    try { Route.beforeLoad({ location: { searchStr, hash } }) } catch (error) { caught = error }
    assert.deepEqual(clean(caught), { href: '/' + canonical + suffix, statusCode: 301 })
  }
}
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
for (const path of ['src/routes/index.tsx', 'src/routes/search.tsx', 'src/components/ui/apple-spotlight.tsx']) {
  assert.equal(/['"]\/(?:movies|tv-shows)['"]/.test(read(path)), false, `Legacy internal listing link in ${path}`)
}
for (const name of ['sermons', 'shows', 'teachings', 'videos', 'series']) assert.match(read(`src/routes/${name}.tsx`), /<Catalogue /)
assert.match(read('src/components/Catalogue.tsx'), /label="Relevance"/)
assert.match(read('src/routes/shop.index.tsx'), /<CatalogueFilterBar /)
assert.match(read('src/routes/shop.tsx'), /className="store-order-history"/)
console.log('CATALOGUE_REFINEMENT_PASS')
