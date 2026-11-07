import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import postcss from 'postcss'

// The driver saved the complete dirty working tree before this cleanup.
const baseline = path.resolve('.unlazy/cleanup-baseline')
assert(existsSync(path.join(baseline, 'manifest.json')), 'Restore the pre-cleanup audit baseline to .unlazy/cleanup-baseline before running this local equivalence gate.')
const readBefore = file => readFileSync(path.join(baseline, file), 'utf8')
const readNow = file => readFileSync(file, 'utf8')
const expected = new Map()
const removeLines = (file, spans) => expected.set(file, readBefore(file).split(/(?<=\n)/).filter((_, index) => !spans.some(([first, last]) => index + 1 >= first && index + 1 <= last)).join(''))
removeLines('src/components/Detail.tsx', [[35, 53], [181, 203]])
removeLines('src/components/Poster.tsx', [[49, 51], [55, 60], [501, 504]])
removeLines('src/components/ui/liquid-glass-logo-reveal.tsx', [[1107, 1135]])
removeLines('src/components/ui/liquid-glass.tsx', [[1, 2], [8, 11]])
removeLines('src/styles.css', [[57, 57], [345, 345], [462, 462], [988, 988]])
for (const [file, replacements] of Object.entries({
  '.gitignore': [['verification/*.log\n', '']],
  'src/routes/change-password.tsx': [['AccountShell, NeedsAuth', 'AccountShell']],
  'src/routes/subscription-plan.tsx': [['createFileRoute, Link, useRouter', 'createFileRoute, useRouter']],
  'src/lib/api.ts': [
    ['transactionId: string; couponCode?: string | null; discount?: number', 'transactionId: string; discount?: number'],
    ['transactionId, couponCode, discount } = opts', 'transactionId, discount } = opts'],
    ['transactionId: txn, couponCode: data.couponCode, discount,', 'transactionId: txn, discount,'],
    ['couponCode: json.metadata?.coupon_code || null, discount: Number(json.metadata?.discount) || 0,', 'discount: Number(json.metadata?.discount) || 0,'],
  ],
})) {
  let value = readBefore(file)
  for (const [before, after] of replacements) {
    assert.equal(value.split(before).length, 2, `${file}: replacement must occur exactly once`)
    value = value.replace(before, after)
  }
  expected.set(file, value)
}
// Separately authorized schema compatibility repair; never count it as cleanup.
const compatibility = new Map()
for (const [file, replacements] of Object.entries({
  'src/lib/api.ts': [
    ['content_rating, trailer_url, bunny_trailer_url, video_url_input, 0 AS total_views', 'content_rating, trailer_url, NULL AS bunny_trailer_url, video_url_input, 0 AS total_views'],
    ["duration, trailer_url, bunny_trailer_url, video_url_input, 'video' AS type", "duration, trailer_url, NULL AS bunny_trailer_url, video_url_input, 'video' AS type"],
  ],
  'scripts/gate-tv-data.mjs': [
    ['content_rating TEXT, trailer_url TEXT, created_at TEXT', 'content_rating TEXT, trailer_url TEXT, video_url_input TEXT, created_at TEXT'],
    ["content(11, { type: 'tvshow' })", "content(11, { type: 'tvshow' })\ninsert('videos', { id: 100, name: 'Video fixture', status: 1, access: 'free', trailer_url: 'https://example.test/video-trailer.mp4', video_url_input: 'https://example.test/video-full.mp4' })\ninsert('videos', { id: 101, name: 'Inactive video', status: 0 })\ninsert('videos', { id: 102, name: 'Deleted video', status: 1, deleted_at: '2024-01-01' })"],
    ["  assert.equal(dashboard.bunnyLibraryId, 'library-fixture')", "  assert.equal(dashboard.bunnyLibraryId, 'library-fixture')\n  const videos = await api.getVideos()\n  assert.deepEqual(ids(videos), [100], 'Video catalogue excludes inactive and deleted rows')\n  assert.equal(videos[0].name, 'Video fixture')\n  assert.deepEqual(Object.keys(videos[0]).sort(), ['id', 'name', 'slug', 'description', 'poster_url', 'thumbnail_url', 'release_date', 'IMDb_rating', 'duration'].sort(), 'Video catalogue retains its existing public response fields')\n  assert.deepEqual(ids(dashboard.mostWatched), [100], 'Dashboard video query must return real active rows')\n  for (const [label, rows] of [['dashboard', dashboard.mostWatched], ['recommendations', dashboard.recommendations.forYou]]) {\n    const video = rows.find(item => item.id === 100)\n    assert.ok(video, `${label} must retain the video fixture`)\n    assert.equal(video.trailer_url, 'https://example.test/video-trailer.mp4', `${label} must retain the trailer source`)\n    assert.equal(video.video_url_input, 'https://example.test/video-full.mp4', `${label} must retain the full video source`)\n    assert.equal(video.bunny_trailer_url, null, `${label} must preserve the absent Bunny field without querying a nonexistent videos column`)\n  }"],
    ['seven hero projections, episode sources/access', 'seven hero projections, video catalogue/dashboard/recommendation sources, episode sources/access'],
  ],
})) {
  let value = expected.get(file) ?? readBefore(file)
  for (const [before, after] of replacements) {
    assert.equal(value.split(before).length, 2, `${file}: compatibility replacement must occur exactly once`)
    value = value.replace(before, after)
  }
  compatibility.set(file, value)
}
const deletedFiles = ['src/components/ui/liquid-glass-button.tsx', 'src/components/ui/glass-button.tsx', 'src/components/ui/discrete-tab.tsx']
const deletedDependencies = ['lenis', 'motion', 'class-variance-authority']
for (const file of deletedFiles) assert(!existsSync(file), `${file} remains`)
const packageBefore = JSON.parse(readBefore('package.json'))
const lockBefore = JSON.parse(readBefore('package-lock.json'))
for (const dependency of deletedDependencies) {
  delete packageBefore.dependencies[dependency]
  delete lockBefore.packages[''].dependencies[dependency]
  delete lockBefore.packages[`node_modules/${dependency}`]
  assert(!existsSync(`node_modules/${dependency}`), `${dependency} remains installed`)
}
for (const [file, data] of [['package.json', packageBefore], ['package-lock.json', lockBefore]]) {
  assert.deepEqual(JSON.parse(readNow(file)), data, `${file}: only the three audited dependencies may change`)
  expected.set(file, JSON.stringify(data, null, 2) + '\n')
}

const manifestBefore = JSON.parse(readBefore('src/lib/img-manifest.json'))
const manifestAfter = JSON.parse(readNow('src/lib/img-manifest.json'))
const stem = key => key.replace(/\.(png|jpe?g|webp)$/i, '')
const manifestExpected = Object.fromEntries(Object.entries(manifestBefore).filter(([key, value]) => key === stem(key) || manifestBefore[stem(key)] !== value))
assert.deepEqual(manifestAfter, manifestExpected)
expected.set('src/lib/img-manifest.json', JSON.stringify(manifestExpected))
const targets = new Set(Object.values(manifestBefore))
assert.deepEqual(new Set(Object.values(manifestAfter)), targets)
for (const target of targets) assert(existsSync(path.join('public', target)), `Missing image target ${target}`)

// The driver subsequently approved the audit's exact 266 CSS rule removals.
const cms = JSON.parse(readBefore('cms-class-scan.json'))
assert.equal(cms.rows, 31)
assert.deepEqual(cms.class_tokens, [])
assert.equal(cms.has_style_element, false)
assert.equal(cms.has_script_element, false)
const cssSpecs = [...readNow('gates/cleanup-live/audit-frontend.md').matchAll(/^\| (src\/[^|]+\.css) \| (\d+)(?:-(\d+))? \| (.+) \|$/gm)]
  .map(match => ({ file: match[1], start: +match[2], end: +(match[3] || match[2]), selector: match[4] }))
assert.equal(cssSpecs.length, 266)
const cssRules = root => { const rules = []; root.walkRules(rule => rules.push(rule)); return rules }
const cssSignature = rule => {
  const ancestors = []
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) ancestors.unshift(parent.type === 'atrule' ? [parent.name, parent.params] : [parent.type, parent.selector])
  return JSON.stringify([ancestors, rule.selector, rule.toString()])
}
for (const [file, specs] of Map.groupBy(cssSpecs, spec => spec.file)) {
  const originalRules = cssRules(postcss.parse(readBefore(file)))
  const before = postcss.parse(expected.get(file) ?? readBefore(file))
  const rules = cssRules(before)
  const selected = new Set()
  for (const spec of specs) {
    const original = originalRules.find(rule => rule.source.start.line === spec.start && rule.source.end.line === spec.end && rule.selector === spec.selector)
    assert(original, `${file}:${spec.start} original CSS rule missing`)
    const matches = rules.filter(rule => !selected.has(rule) && cssSignature(rule) === cssSignature(original))
    assert.equal(matches.length, 1, `${file}:${spec.start} CSS removal is ambiguous`)
    selected.add(matches[0])
  }
  const retained = rules.filter(rule => !selected.has(rule)).map(cssSignature)
  for (const rule of selected) rule.remove()
  before.walkAtRules(rule => { if (rule.nodes && rule.nodes.length === 0) rule.remove() })
  const after = before.toString()
  assert.deepEqual(cssRules(postcss.parse(after)).map(cssSignature), retained, `${file}: retained CSS selector/declarations/conditions changed`)
  expected.set(file, after)
}
console.log(`CSS_EQUIVALENCE_OK: ${cssSpecs.length} approved rules removed; retained rule selectors, declarations and conditions unchanged`)

const parse = (file, source) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const imgSource = source => parse('Poster.tsx', source).statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'img').getText()
const beforeImg = imgSource(readBefore('src/components/Poster.tsx'))
assert.equal(imgSource(readNow('src/components/Poster.tsx')), beforeImg, 'Image resolver changed')
const compiledImg = ts.transpileModule(beforeImg.replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const makeImg = MANIFEST => vm.runInNewContext(`${compiledImg}\nimg`, { MANIFEST, DEFAULT_IMG: '/default-image.jpg' })
const oldImg = makeImg(manifestBefore)
const newImg = makeImg(manifestAfter)
const inputs = [undefined, null, '', '/images/unchanged.png', '/media/unchanged.png', 'https://example.com/remote.jpg', 'http://example.com/remote.jpg', 'missing-image.png']
for (const key of Object.keys(manifestBefore)) inputs.push(key, `nested/${key}`, `http://localhost:3000/storage/${key}`, `http://127.0.0.1/storage/${key}`, `https://localhost/storage/${key}`)
for (const input of inputs) assert.equal(newImg(input), oldImg(input), `Image resolution changed: ${input}`)

const inventory = JSON.parse(readBefore('manifest.json'))
let bytesRemoved = 0
let linesRemoved = 0
let compatibilityBytesAdded = 0
let compatibilityLinesAdded = 0
let unchanged = 0
const changed = []
const lineCount = text => (text.match(/\n/g) ?? []).length
for (const [file, metadata] of Object.entries(inventory)) {
  if (deletedFiles.includes(file)) {
    bytesRemoved += metadata.bytes
    linesRemoved += lineCount(readBefore(file))
    changed.push(file)
  } else if (expected.has(file) || compatibility.has(file)) {
    assert.equal(readNow(file), compatibility.get(file) ?? expected.get(file), `${file}: unexpected cleanup/compatibility delta`)
    if (expected.has(file)) {
      const byteDelta = metadata.bytes - Buffer.byteLength(expected.get(file))
      const lineDelta = lineCount(readBefore(file)) - lineCount(expected.get(file))
      bytesRemoved += byteDelta
      linesRemoved += lineDelta
      changed.push(file)
      console.log(`DELTA ${file}: -${byteDelta} bytes, -${lineDelta} physical lines`)
    }
    if (compatibility.has(file)) {
      const cleanupOnly = expected.get(file) ?? readBefore(file)
      compatibilityBytesAdded += Buffer.byteLength(readNow(file)) - Buffer.byteLength(cleanupOnly)
      compatibilityLinesAdded += lineCount(readNow(file)) - lineCount(cleanupOnly)
    }
  } else {
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), metadata.sha256, `${file}: unrelated baseline content changed`)
    unchanged++
  }
}
const sourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sourceFiles(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : [])
let serverFunctions = 0
let routeFiles = 0
for (const file of sourceFiles('src')) {
  const source = readNow(file)
  serverFunctions += (source.match(/createServerFn\(/g) ?? []).length
  if (file.startsWith('src/routes/')) routeFiles++
  const checkImports = node => {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null
    if (specifier && ts.isStringLiteral(specifier)) {
      assert(!deletedDependencies.some(name => specifier.text === name || specifier.text.startsWith(`${name}/`)), `${file} imports removed dependency ${specifier.text}`)
      assert(!deletedFiles.some(removed => specifier.text.endsWith(path.basename(removed, '.tsx'))), `${file} imports a removed module`)
    }
    ts.forEachChild(node, checkImports)
  }
  checkImports(parse(file, source))
}
assert.equal(serverFunctions, 70, 'Public server-function count changed')
assert.equal(routeFiles, 37, 'Public route count changed')
console.log(`MANIFEST_EQUIVALENCE_OK: ${inputs.length} cases; ${Object.keys(manifestBefore).length - Object.keys(manifestAfter).length} aliases removed; ${targets.size} targets retained`)
console.log(`SCHEMA_COMPATIBILITY_DELTA: ${compatibility.size} paths; +${compatibilityBytesAdded} bytes; +${compatibilityLinesAdded} physical lines; excluded from cleanup savings`)
console.log(`CLEANUP_EQUIVALENCE_OK: ${changed.length} approved cleanup paths; ${unchanged} baseline files unchanged; ${serverFunctions} server functions; ${routeFiles} routes; -${bytesRemoved} bytes; -${linesRemoved} physical lines; -${deletedDependencies.length} dependencies`)
