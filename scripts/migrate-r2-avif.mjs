import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash,createHmac} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
const action = process.argv[2] ?? 'inventory'
const endpoint = process.env.MEDIA_MIGRATION_URL
const secretFile = process.env.MEDIA_MIGRATION_SECRET_FILE
if(!endpoint || !secretFile) throw Error('Set MEDIA_MIGRATION_URL and MEDIA_MIGRATION_SECRET_FILE (0600 file).')
if(!['inventory','convert','verify','rewrite','prune'].includes(action)) throw Error('Use inventory, convert, verify, rewrite, or prune.')
const secret = (await fs.readFile(secretFile,'utf8')).trim()
if(secret.length<32) throw Error('Migration secret is too short.')
const base = process.env.MEDIA_MIGRATION_BACKUP_DIR || path.join(os.homedir(),'Documents/Codex/media-backups/gndott-nov08-r2')
await fs.mkdir(base,{recursive:true,mode:0o700})
const manifestFile = path.join(base,'manifest.json')
const lockFile = path.join(base,'runner.lock')
const hash = bytes=>createHash('sha256').update(bytes).digest('hex')
const exists = file=>fs.access(file).then(()=>true,()=>false)
const limit=process.env.MEDIA_MIGRATION_LIMIT ? Number(process.env.MEDIA_MIGRATION_LIMIT) : Infinity
const requestedConcurrency=Number(process.env.MEDIA_MIGRATION_CONCURRENCY || 4)
if(limit!==Infinity && (!Number.isSafeInteger(limit)||limit<1)) throw Error('MEDIA_MIGRATION_LIMIT must be a positive integer.')
if(!Number.isSafeInteger(requestedConcurrency)||requestedConcurrency<1||requestedConcurrency>4) throw Error('MEDIA_MIGRATION_CONCURRENCY must be an integer from 1 to 4.')
const concurrency=action==='prune'||action==='inventory' ? 1 : requestedConcurrency
let stopped=false,stopCode=130,saveTail=Promise.resolve(),saveSequence=0
const stop=(signal)=>{if(!stopped)console.log(`R2_STOP_REQUESTED ${signal}; draining in-flight work and manifest saves`);stopped=true;stopCode=signal==='SIGTERM'?143:130}
const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM')
process.on('SIGINT',interrupt)
process.on('SIGTERM',terminate)

async function request(data,binary=false) {
  const body = JSON.stringify(data)
  const url = new URL('/operate',endpoint)
  // At most three attempts; refresh the signed timestamp on every retry.
  for(let attempt=1;attempt<=3;attempt++) {
    const time = String(Date.now())
    const signature = createHmac('sha256',secret).update(`${time}\nPOST\n${url.pathname}\n${body}`).digest('hex')
    const response = await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-media-time':time,'x-media-signature':signature},body,signal:AbortSignal.timeout(120000)})
    if(response.ok) return binary ? Buffer.from(await response.arrayBuffer()) : response.json()
    const message=(await response.text()).slice(0,500)
    const transient=response.status===429||response.status>=500&&response.status<=599
    if(!transient||attempt===3) throw Error(`Migration ${data.action} failed (${response.status}): ${message}`)
    const retryHeader=response.headers.get('retry-after')
    const retrySeconds=retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : retryHeader ? Math.max(0,(Date.parse(retryHeader)-Date.now())/1000) : NaN
    const waitMs=Math.min(5000,Number.isFinite(retrySeconds)?retrySeconds*1000:500*2**(attempt-1))
    console.log(`R2_RETRY ${data.action}; status=${response.status}; nextAttempt=${attempt+1}/3; delayMs=${Math.round(waitMs)}`)
    await delay(waitMs)
  }
}
function save(manifest) {
  // Capture an immutable snapshot in completion order, then serialize all atomic writes.
  const snapshot=JSON.stringify(manifest,null,2)+'\n'
  const temporary=`${manifestFile}.${process.pid}.${++saveSequence}.tmp`
  saveTail=saveTail.then(async()=>{
    const handle=await fs.open(temporary,'wx',0o600)
    try { await handle.writeFile(snapshot);await handle.sync() } finally { await handle.close() }
    await fs.rename(temporary,manifestFile)
  })
  return saveTail
}
async function acquireLock() {
  try { return await fs.open(lockFile,'wx',0o600) }
  catch(error) {
    if(error.code!=='EEXIST')throw error
    const prior=JSON.parse(await fs.readFile(lockFile,'utf8'))
    if(!Number.isSafeInteger(prior.pid)||prior.pid<1)throw Error('Invalid runner.lock; inspect it before retrying.')
    try { process.kill(prior.pid,0);throw Error(`Another migration runner is active (PID ${prior.pid}). Stop it before resuming.`) }
    catch(error) { if(error.code!=='ESRCH')throw error }
    await fs.unlink(lockFile)
    return fs.open(lockFile,'wx',0o600)
  }
}
const lock=await acquireLock()
try {
  await lock.writeFile(JSON.stringify({pid:process.pid,action,startedAt:new Date().toISOString()}))
  if(action==='inventory') {
    if(await exists(manifestFile)) throw Error('Manifest exists; resume using convert/verify/rewrite/prune instead of overwriting it.')
    const objects=[];let cursor
    do { const page=await request({action:'inventory',cursor});objects.push(...page.objects);cursor=page.cursor } while(cursor&&!stopped)
    if(!stopped) {
      await save({version:1,createdAt:new Date().toISOString(),objects})
      console.log(`R2_INVENTORY ${objects.length} original images; ${objects.reduce((sum,x)=>sum+x.size,0)} bytes`)
    }
  } else {
    const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'))
    const seen=new Set()
    for(const item of manifest.objects) {
      if(!/^(private\/)?legacy-20261105\/[a-f0-9]{64}\.(png|jpe?g|webp)$/i.test(item.key)||seen.has(item.key))throw Error('Manifest contains an invalid or duplicate owned source key.')
      seen.add(item.key)
    }
    const pending=manifest.objects.filter(item=>!(action==='convert'&&item.converted || action==='rewrite'&&item.rewritten || action==='prune'&&item.pruned)).slice(0,limit)
    // Validate the complete selected phase before starting any concurrent requests.
    for(const item of pending) {
      if(action!=='convert'&&!item.converted)throw Error('Convert every selected original before proceeding.')
      if(action==='prune'&&!item.rewritten)throw Error('Rewrite and verify references before pruning.')
    }
    let cursor=0,count=0,failure=null
    console.log(`R2_${action.toUpperCase()}_START ${pending.length} pending; concurrency=${concurrency}`)
    async function processItem(item) {
      const backupFile=path.join(base,'originals',item.key)
      if(action==='convert') {
        if(!await exists(backupFile)) {
          const bytes=await request({action:'backup',key:item.key},true)
          if(bytes.length!==item.size) throw Error(`Original changed in size: ${item.key}`)
          await fs.mkdir(path.dirname(backupFile),{recursive:true,mode:0o700})
          const temporary=`${backupFile}.${process.pid}.tmp`
          await fs.writeFile(temporary,bytes,{mode:0o600})
          await fs.rename(temporary,backupFile)
        }
        const backup=await fs.readFile(backupFile)
        if(backup.length!==item.size)throw Error(`Existing original backup has the wrong size: ${item.key}`)
        const backupSha256=hash(backup)
        const result=await request({action,key:item.key,backupSha256})
        if(result.sourceSha256!==backupSha256) throw Error('Backup hash disagrees with server.')
        Object.assign(item,result,{converted:true})
      } else {
        if(action==='prune'&&hash(await fs.readFile(backupFile))!==item.sourceSha256) throw Error('Local original backup failed verification.')
        const result=await request({action,key:item.key,backupSha256:item.sourceSha256,sha256:item.sha256})
        if(result.sha256!==item.sha256) throw Error('Replacement hash changed.')
        if(action==='rewrite') {
          if(result.references!==0)throw Error('Original references remain after rewrite.')
          item.rewritten=true
        }
        if(action==='prune') {
          if(result.pruned!==true)throw Error('Server did not confirm original deletion.')
          item.pruned=true
        }
        if(action==='verify') item.verifiedAt=new Date().toISOString()
      }
      await save(manifest)
      count++
      if(count===1||count%10===0||count===pending.length)console.log(`R2_${action.toUpperCase()} ${count}/${pending.length} processed; ${manifest.objects.filter(x=>x.converted).length}/${manifest.objects.length} converted; ${manifest.objects.filter(x=>x.pruned).length} pruned`)
    }
    async function worker() {
      while(!stopped&&!failure&&cursor<pending.length) {
        const item=pending[cursor++]
        try { await processItem(item) } catch(error) { failure??=error }
      }
    }
    await Promise.all(Array.from({length:Math.min(concurrency,pending.length)},()=>worker()))
    await saveTail
    if(failure)throw failure
    if(!stopped)console.log(`R2_${action.toUpperCase()}_PASS ${count} processed; manifest=${manifestFile}`)
  }
} finally {
  // Workers finish before this block: a stopped/failed run leaves all confirmed receipts durable.
  await saveTail.catch(()=>{})
  await lock.close()
  await fs.unlink(lockFile)
  process.removeListener('SIGINT',interrupt)
  process.removeListener('SIGTERM',terminate)
  if(stopped)process.exitCode=stopCode
}
