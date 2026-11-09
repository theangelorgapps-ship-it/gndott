#!/usr/bin/env node
// Executes the actual migration and public/admin handlers against isolated SQLite.
// No remote writes, user records, application server or emails are involved.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const adminRoot = process.env.HALOBOX_ADMIN_ROOT ?? '/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin'
const db = new DatabaseSync(':memory:')
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE cast_crew (id INTEGER PRIMARY KEY, name TEXT, file_url TEXT, type TEXT, bio TEXT, designation TEXT, place_of_birth TEXT, dob TEXT, status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE entertainment_talent_mapping (id INTEGER PRIMARY KEY, entertainment_id INTEGER, talent_id INTEGER, type TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE entertainments (id INTEGER PRIMARY KEY, name TEXT, type TEXT, poster_url TEXT, IMDb_rating TEXT, status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT, updated_by INTEGER);
CREATE TABLE videos (id INTEGER PRIMARY KEY, name TEXT, status INTEGER DEFAULT 1, deleted_at TEXT);
CREATE TABLE episodes (id INTEGER PRIMARY KEY, name TEXT, entertainment_id INTEGER, status INTEGER DEFAULT 1, deleted_at TEXT);
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, user_type TEXT, deleted_at TEXT, first_name TEXT, last_name TEXT, status INTEGER DEFAULT 1, is_banned INTEGER DEFAULT 0);
CREATE TABLE genres (id INTEGER PRIMARY KEY,name TEXT,deleted_at TEXT);
CREATE TABLE plan (id INTEGER PRIMARY KEY,name TEXT,level INTEGER,deleted_at TEXT);
CREATE TABLE entertainment_gener_mapping (entertainment_id INTEGER,genre_id INTEGER);
INSERT INTO users (id,email,user_type,deleted_at) VALUES (1,'admin@example.test','admin',NULL),(2,'viewer@example.test','user',NULL),(3,'demo@example.test','demo_admin',NULL);
INSERT INTO entertainments (id,name,type,status) VALUES (1,'Public sermon','movie',1),(2,'Hidden sermon','movie',0),(3,'Deleted sermon','movie',1);
UPDATE entertainments SET deleted_at='2026-01-01' WHERE id=3;
INSERT INTO videos VALUES (1,'Distinct video with same ID',1,NULL);
INSERT INTO episodes VALUES (1,'Episode',1,1,NULL);`)
const insertPerson = db.prepare(`INSERT INTO cast_crew (id,name,type,status,bio,designation,dob,file_url,deleted_at) VALUES (?,?,?,?,?,?,?,?,?)`)
for (const [id, name] of [[48, 'Sri Lanka'], [49, 'South Africa'], [50, 'United States Of America'], [51, 'Dubai'], [52, 'United Kingdom'], [53, 'Zimbabwe']]) insertPerson.run(id,name,'director',1, name,null,null,null,null)
insertPerson.run(41,'Public personality','actor',1,'Actual biography','Speaker','1980-01-02','/media/portrait.avif',null)
insertPerson.run(42,'Hidden personality','actor',0,null,null,null,null,null)
insertPerson.run(43,'Deleted personality','actor',1,null,null,null,null,'2026-01-01')
insertPerson.run(90,'A real director','director',1,'A person, not a place.','Director',null,null,null)
const mapping = db.prepare(`INSERT INTO entertainment_talent_mapping (entertainment_id,talent_id,deleted_at) VALUES (?,?,?)`)
for (const id of [41,42,43,48,49,50,51,52,53,90,1]) mapping.run(1,id,null)
mapping.run(2,51,'2026-01-01'); mapping.run(2,41,null); mapping.run(3,41,null); mapping.run(1,53,'2026-01-01')
const beforePeople = JSON.stringify(db.prepare('SELECT * FROM cast_crew ORDER BY id').all())
const beforeMappings = JSON.stringify(db.prepare('SELECT * FROM entertainment_talent_mapping ORDER BY id').all())
const migration = readFileSync(resolve(root, 'migrations/20261108_locations.sql'), 'utf8')
db.exec(migration); db.exec(migration)
assert.equal(db.prepare('SELECT COUNT(*) n FROM locations').get().n,6)
assert.equal(db.prepare('SELECT COUNT(*) n FROM content_location_mapping').get().n,6)
assert.equal(JSON.stringify(db.prepare('SELECT * FROM cast_crew ORDER BY id').all()),beforePeople)
assert.equal(JSON.stringify(db.prepare('SELECT * FROM entertainment_talent_mapping ORDER BY id').all()),beforeMappings)
assert.equal(db.prepare('SELECT COUNT(*) n FROM locations WHERE source_cast_crew_id=90').get().n,0)
const venueId = db.prepare('SELECT id FROM locations WHERE source_cast_crew_id=48').get().id
db.prepare('DELETE FROM content_location_mapping WHERE location_id=?').run(venueId)
db.exec(migration)
assert.equal(db.prepare('SELECT COUNT(*) n FROM content_location_mapping WHERE location_id=?').get(venueId).n,0,'Migration replay must preserve an admin unlink')

let failMapping = false
let session = null
let method = 'GET'
const executed = []
const d1 = {
  prepare(sql) {
    return { bind(...values) {
      const execute = mode => {
        executed.push(sql)
        if (failMapping && /^INSERT INTO content_location_mapping/.test(sql)) throw new Error('Injected mapping failure')
        const statement = db.prepare(sql)
        if (mode === 'all') return { results: statement.all(...values) }
        if (mode === 'first') return statement.get(...values) ?? null
        const info = statement.run(...values)
        return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } }
      }
      return { sql, values, all: async () => execute('all'), first: async () => execute('first'), run: async () => execute('run') }
    } }
  },
  async batch(statements) {
    db.exec('BEGIN')
    try { const results=[]; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results }
    catch(error) { db.exec('ROLLBACK'); throw error }
  },
}
const cache = new Map()
function load(path) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path)
  const mod = { exports: {} }
  cache.set(path,mod.exports)
  const source = ts.transpileModule(readFileSync(path,'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const require = name => {
    if (name === 'cloudflare:workers') return { env: { DB: d1 } }
    if (name === '@tanstack/react-start/server') return { getRequest: () => ({ method }) }
    if (name === '@tanstack/react-start') return { createServerOnlyFn: fn => fn, createServerFn: ({ method: requestMethod }) => {
      let validate = data => data
      const builder = { validator(fn) { validate=fn; return builder }, handler(fn) { return async (args={}) => { method=requestMethod; return fn({ data:validate(args.data) }) } } }
      return builder
    } }
    if (name === './session.server') return { getSession:async()=>session }
    if (name === './bunny') return { normalizeBunnyFields:data=>data }
    if (name === './series-validation') return { groupedType:()=>null, isSeriesEntity:()=>false, assertGroupedRecord:async()=>{}, validateGroupedValues:async()=>{} }
    if (name.startsWith('.')) return load(resolve(dirname(path),`${name}.ts`))
    throw new Error(`Unexpected module ${name}`)
  }
  vm.runInNewContext(source, { exports:mod.exports, module:mod, require, console, URL, Date, Intl }, { filename:path })
  return mod.exports
}
const people = load(resolve(root,'src/lib/people.server.ts'))
const peopleApi = load(resolve(root,'src/lib/people.ts'))
const admin = load(resolve(adminRoot,'src/lib/admin.ts'))
const normal = value => JSON.parse(JSON.stringify(value))
const ids = rows => Array.from(rows,row=>row.id)
assert.deepEqual(ids(await people.loadPersonalities()),[41,90])
assert.deepEqual(ids(await peopleApi.getPersonalities()),[41,90])
assert.equal((await peopleApi.getPersonalityDetail({data:41})).person.id,41)
assert.deepEqual(ids(await people.loadTitlePeople(1)),[41,90])
assert.equal(await people.loadPersonalityDetail(48),null)
assert.equal(await people.loadPersonalityDetail(42),null)
assert.equal(await people.loadPersonalityDetail(43),null)
assert.equal(await people.loadPersonalityDetail(NaN),null)
const profile = await people.loadPersonalityDetail(41)
assert.equal(profile.person.bio,'Actual biography')
assert.deepEqual(ids(profile.works),[1])
assert.equal(profile.links.length,0,'No invented social links')
assert.deepEqual(Object.keys(profile.person).sort(),['bio','designation','dob','file_url','id','name','place_of_birth','type'].sort(),'Explicit public fields only')
assert.equal((await people.loadTitleLocations('entertainment',1)).length,5)
assert.equal((await people.loadTitleLocations('video',1)).length,0,'Same numeric IDs must not leak across title kinds')

const location = { name:'Editorially supplied location', status:1, file_url:'/media/location.avif', assignments:[{content_type:'video',content_id:1},{content_type:'episode',content_id:1}] }
const guardedReads = [()=>admin.adminListLocations(),()=>admin.adminLocationOptions(),()=>admin.adminGetLocation({data:venueId})]
const guardedWrites = [()=>admin.adminUpsertLocation({data:location}),()=>admin.adminDeleteLocation({data:venueId})]
for (const uid of [null,2]) {
  session=uid?{uid}:null
  for (const fn of [...guardedReads,...guardedWrites]) await assert.rejects(fn,/Sign in required|Admin access required/)
}
session={uid:3}
assert.equal((await admin.adminListLocations()).length,6)
for (const fn of guardedWrites) await assert.rejects(fn,/read-only/)
session={uid:1}
failMapping=true
await assert.rejects(()=>admin.adminUpsertLocation({data:location}),/Injected mapping failure/)
failMapping=false
assert.equal(db.prepare('SELECT COUNT(*) n FROM locations').get().n,6,'A failed mapping rolls back the newly created location')
const created = await admin.adminUpsertLocation({data:location})
assert.ok(created.id)
assert.equal((await people.loadTitleLocations('video',1))[0].name,location.name)
assert.equal((await people.loadTitleLocations('episode',1))[0].id,created.id,'Multiple associations use same newly created ID')
assert.equal((await people.loadTitleLocations('entertainment',1)).length,5)
const loaded = await admin.adminGetLocation({data:created.id})
assert.deepEqual(normal(loaded.assignments).sort((a,b)=>a.content_type.localeCompare(b.content_type)),location.assignments.toSorted((a,b)=>a.content_type.localeCompare(b.content_type)))
await admin.adminUpsertLocation({data:{...loaded,name:'Updated venue',status:0,assignments:[{content_type:'video',content_id:1}]}})
assert.equal((await people.loadTitleLocations('video',1)).length,0)
assert.equal(db.prepare('SELECT COUNT(*) n FROM content_location_mapping WHERE location_id=?').get(created.id).n,1)
await admin.adminDeleteLocation({data:created.id})
await assert.rejects(()=>admin.adminGetLocation({data:created.id}),/not found/)
assert.equal(db.prepare('SELECT COUNT(*) n FROM content_location_mapping WHERE location_id=?').get(created.id).n,1,'Soft deletion preserves associations')
await admin.adminDeleteLocation({data:venueId})
assert.deepEqual(ids(await people.loadPersonalities()),[41,90],'Deleting a location must not restore legacy personality')
for (const invalid of [
  {...location,name:' '}, {...location,status:7}, {...location,file_url:'javascript:alert(1)'}, {...location,file_url:'//evil.test/x'},
  {...location,assignments:[{content_type:'users',content_id:1}]}, {...location,assignments:[{content_type:'video',content_id:-1}]},
  {...location,assignments:[{content_type:'video',content_id:99999}]},
]) await assert.rejects(()=>admin.adminUpsertLocation({data:invalid}))
assert.equal(db.prepare('SELECT COUNT(*) n FROM locations').get().n,7,'Rejected input creates no rows')

for (const entity of ['actors','directors']) {
  assert.ok(!(await admin.adminTable({data:entity})).some(row=>row.id>=48&&row.id<=53))
  await assert.rejects(()=>admin.adminGetRow({data:{entity,id:49}}),/not found/)
  await assert.rejects(()=>admin.adminUpsertRow({data:{entity,id:49,values:{name:'Wrong editor'}}}),/not found/)
  await assert.rejects(()=>admin.adminDeleteRow({data:{entity,id:49}}),/not found/)
}
await assert.rejects(()=>admin.adminUpsertRow({data:{entity:'actors',id:41,values:{social_instagram:'https://example.test/fake'}}}),/official HTTPS/)
await admin.adminUpsertRow({data:{entity:'actors',id:41,values:{social_instagram:'https://www.instagram.com/actual-editor-supplied-account/'}}})
assert.equal((await people.loadPersonalityDetail(41)).links.length,1)
db.prepare(`INSERT INTO personality_social_links VALUES (41,'website','javascript:alert(1)')`).run()
assert.equal((await people.loadPersonalityDetail(41)).links.length,1,'Malicious stored URLs are never public links')
await admin.adminUpsertRow({data:{entity:'actors',id:41,values:{social_instagram:''}}})
assert.equal((await people.loadPersonalityDetail(41)).links.length,0)
await assert.rejects(()=>admin.adminUpsertContent({data:{id:1,name:'Rejected edit',type:'movie',cast_ids:[49]}}),/Assign venues from Locations/)
const legacyLocationsBefore = JSON.stringify(db.prepare('SELECT * FROM entertainment_talent_mapping WHERE talent_id BETWEEN 48 AND 53 ORDER BY id').all())
await admin.adminUpsertContent({data:{id:1,name:'Edited sermon',type:'movie',cast_ids:[41],director_ids:[90]}})
assert.equal(JSON.stringify(db.prepare('SELECT * FROM entertainment_talent_mapping WHERE talent_id BETWEEN 48 AND 53 ORDER BY id').all()),legacyLocationsBefore,'Normal content editing retains every legacy venue association')
assert.deepEqual(ids(await people.loadTitlePeople(1)),[41,90])

const helpers = load(resolve(root,'src/lib/personalityData.ts'))
assert.equal(helpers.personalityBirthDate('2024-02-30'),null)
assert.equal(helpers.personalityBirthDate('2999-01-01'),null)
assert.equal(helpers.personalityRole({id:1,name:'No supplied role',type:'actor'}),null)
assert.equal(helpers.safePersonalityLink({provider:'x',url:'https://x.com.evil.test/handle'}),null)
assert.equal(helpers.safePersonalityLink({provider:'website',url:'https://user:password@example.test'}),null)
console.log('PASS: six audited locations; migration replay/source preservation; typed CRUD/atomic links; unauthenticated/viewer/demo denial; inactive/deleted privacy; real directors retained; social validation; birth-date sanity; ordinary title edits preserve venue mappings.')
db.close()
