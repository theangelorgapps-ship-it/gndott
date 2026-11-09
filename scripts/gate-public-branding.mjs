import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  const module = { exports: {} }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => { assert.ok(name in imports, name); return imports[name] } })
  return module.exports
}
const routes = load('src/lib/contentRoutes.ts')
for (const [type, oldBase, base] of [
  ['movie', '/movie', '/sermon'], ['teaching', '/teaching', '/teachings'],
  ['tvshow', '/tv-show', '/shows'], ['video', '/video', '/videos'],
]) {
  for (const explicitBase of [undefined, oldBase, base]) {
    assert.equal(routes.contentPath({ id: 109, name: 'A Word & Faith', type }, explicitBase), `${base}/a-word-faith-109`)
  }
  assert.equal(routes.contentPath({ id: 109, slug: 'a-word-109', type }), `${base}/a-word-109`)
  const { Route } = load(`src/routes/${oldBase.slice(1)}.$id.tsx`, {
    '@tanstack/react-router': { createFileRoute: () => options => options, redirect: options => options },
    '../lib/contentRoutes': routes,
  })
  for (const [searchStr, hash] of [['', ''], ['?episode=104&q=faith%20%26%20word', 'watch-episode-104']]) {
    let redirect
    try { Route.beforeLoad({ location: { pathname: `${oldBase}/a-word-109`, searchStr, hash } }) } catch (error) { redirect = error }
    assert.equal(redirect.statusCode, 301)
    assert.equal(redirect.href, `${base}/a-word-109${searchStr}${hash ? '#' + hash : ''}`)
  }
}
assert.equal(routes.contentPath({ id: 34, name: 'Pray' }, '/channel'), '/channel/pray-34')
for (const path of ['109', 'putin-prophet-uebert-angel-109']) assert.equal(routes.contentIdFromPath(path), 109)
for (const path of ['0', '-1', '../109', '1.2']) assert.ok(Number.isNaN(routes.contentIdFromPath(path)))
console.log('PUBLIC_BRANDING_ROUTES_PASS: canonical links, legacy redirects, preserved playback/query state')
