import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = process.cwd()
const manifestPath = path.join(root, 'gates/nov08-refinement/static-avif-manifest.json')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const walk = async dir => (await Promise.all((await fs.readdir(dir, {withFileTypes:true})).map(async entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : path.join(dir,entry.name)))).flat()
const exists = async file => fs.access(file).then(()=>true,()=>false)
const mode = process.argv[2] ?? 'verify'
if (!['convert','verify','prune'].includes(mode)) throw Error('Use convert, verify, or prune.')
if (mode === 'convert') {
  const backup = path.join(os.homedir(), 'Documents/Codex/media-backups/gndott-nov08-public')
  const files = (await walk(path.join(root,'public'))).filter(file=>/\.(png|jpe?g|webp)$/i.test(file)).sort()
  if (!files.length) throw Error('No originals found; retain the existing manifest.')
  const entries = []
  for (const file of files) {
    const source = '/' + path.relative(path.join(root,'public'),file)
    const original = await fs.readFile(file)
    const sourceHash = hash(original)
    // Keep source extension in the target name when two source basenames collide.
    let target = source.replace(/\.[^.]+$/, '.avif')
    if (entries.some(entry=>entry.target===target)) target = source + '.avif'
    const outputFile = path.join(root,'public',target)
    const output = await sharp(original,{limitInputPixels:100000000}).rotate().avif({quality:58,effort:5,chromaSubsampling:'4:4:4'}).toBuffer()
    const metadata = await sharp(output).metadata()
    await sharp(output).raw().toBuffer() // Force a full decode, not just a header probe.
    if (metadata.format !== 'heif' || !metadata.width || !metadata.height) throw Error(`Invalid output: ${source}`)
    const backupFile = path.join(backup,source)
    await fs.mkdir(path.dirname(backupFile),{recursive:true})
    await fs.writeFile(backupFile,original)
    if(hash(await fs.readFile(backupFile))!==sourceHash) throw Error(`Backup mismatch: ${source}`)
    await fs.writeFile(outputFile,output)
    entries.push({source,target,sourceSha256:sourceHash,sha256:hash(output),originalBytes:original.length,bytes:output.length,width:metadata.width,height:metadata.height})
    if(entries.length%50===0) console.log(`Verified ${entries.length}/${files.length} static AVIF images`)
  }
  await fs.writeFile(manifestPath,JSON.stringify({version:1,backup,entries},null,2)+'\n')
  const aliases = Object.fromEntries(entries.map(entry=>[entry.source,entry.target]))
  const legacy = JSON.parse(await fs.readFile('src/lib/img-manifest.json','utf8'))
  for(const key of Object.keys(legacy)) if(aliases[legacy[key]]) legacy[key] = aliases[legacy[key]]
  Object.assign(legacy,aliases)
  for(let n=1;n<=8;n++) legacy[`/avatars/avatar-${n}.png`] = aliases[`/images/avatars/icon${n}.webp`]
  await fs.writeFile('src/lib/img-manifest.json',JSON.stringify(legacy)+'\n')
}
const manifest = JSON.parse(await fs.readFile(manifestPath,'utf8'))
const aliases = JSON.parse(await fs.readFile('src/lib/img-manifest.json','utf8'))
for(const entry of manifest.entries) {
  const file = path.join(root,'public',entry.target)
  const bytes = await fs.readFile(file)
  if(hash(bytes)!==entry.sha256) throw Error(`Replacement changed: ${entry.target}`)
  const decoded = await sharp(bytes).raw().toBuffer({resolveWithObject:true})
  if(decoded.info.width!==entry.width||decoded.info.height!==entry.height) throw Error(`Replacement dimensions changed: ${entry.target}`)
  if(aliases[entry.source]!==entry.target) throw Error(`Missing legacy alias: ${entry.source}`)
  if(mode==='prune') {
    const sourceFile = path.join(root,'public',entry.source)
    if(await exists(sourceFile)) {
      if(hash(await fs.readFile(sourceFile))!==entry.sourceSha256||hash(await fs.readFile(path.join(manifest.backup,entry.source)))!==entry.sourceSha256) throw Error(`Original/backup changed: ${entry.source}`)
    }
  }
}
for(const value of new Set(Object.values(aliases))) if(!await exists(path.join(root,'public',value))) throw Error(`Manifest points to missing image: ${value}`)
if(mode==='prune') {
  const sources = await walk(path.join(root,'src'))
  for(const file of sources.filter(file=>/\.(tsx?|css)$/.test(file))) {
    const text = await fs.readFile(file,'utf8')
    for(const entry of manifest.entries) if(text.includes(entry.source)) throw Error(`Update reference before pruning: ${path.relative(root,file)} → ${entry.source}`)
  }
  for(const entry of manifest.entries) await fs.rm(path.join(root,'public',entry.source),{force:true})
}
console.log(`STATIC_AVIF_PASS ${manifest.entries.length} images; ${manifest.entries.reduce((n,e)=>n+e.originalBytes,0)} original bytes; ${manifest.entries.reduce((n,e)=>n+e.bytes,0)} AVIF bytes; mode=${mode}`)
