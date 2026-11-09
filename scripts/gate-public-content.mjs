import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, mocks) {
  const module={exports:{}};const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  vm.runInNewContext(js,{module,exports:module.exports,require:name=>name in mocks?mocks[name]:{},URL,console},{filename:file});return module.exports
}
const sanitizer=load('src/lib/content-html.ts',{'sanitize-html':require('sanitize-html')})
const sql=new DatabaseSync(':memory:')
sql.exec('CREATE TABLE pages(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,description TEXT,status INTEGER,deleted_at TEXT);CREATE TABLE faqs(id INTEGER PRIMARY KEY,question TEXT,answer TEXT,status INTEGER,deleted_at TEXT)')
const hostile='<h2>About</h2><p>Welcome <strong>home</strong>.</p><ul><li>One</li></ul><a href="https://halobox.tv">Read more</a><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Unsafe</a>'
for(const [id,status,deleted] of [[1,1,null],[2,0,null],[3,1,'2026-01-01']]) { sql.prepare('INSERT INTO pages VALUES(?,?,?,?,?,?)').run(id,'About','about-'+id,hostile,status,deleted);sql.prepare('INSERT INTO faqs VALUES(?,?,?,?,?)').run(id,'Question?',hostile,status,deleted) }
const createServerFn=()=>{let validate=value=>value;return{validator(fn){validate=fn;return this},handler(fn){return input=>fn({data:validate(input?.data)})}}}
const api=load('src/lib/api.ts',{'@tanstack/react-start':{createServerFn},'./content-html':sanitizer,'./db':{first:async(query,...args)=>sql.prepare(query).get(...args)||null,all:async(query,...args)=>sql.prepare(query).all(...args)}})
const page=await api.getPage({data:'about-1'});const faqs=await api.getFaqs()
assert.equal(faqs.length,1);assert.equal(page.description,faqs[0].answer)
assert.match(page.description,/<h2>About<\/h2>/);assert.match(page.description,/<ul><li>One<\/li><\/ul>/);assert.match(page.description,/href="https:\/\/halobox.tv"/)
assert.doesNotMatch(page.description,/<script|onerror|javascript:|<img/)
assert.match(page.description,/rel="noopener noreferrer"/)
assert.equal(await api.getPage({data:'about-2'}),null);assert.equal(await api.getPage({data:'about-3'}),null);assert.equal(await api.getPage({data:'missing'}),null)
sql.close();console.log('PUBLIC_CONTENT_OK: real getPage/getFaqs SQL readers preserve semantic formatting, sanitize legacy HTML and preserve published/deleted filters')
