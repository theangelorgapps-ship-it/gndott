// Real React components/router in Chromium. Only server boundaries use local fixtures;
// all network writes are blocked and this harness never opens the live application.
import { build } from 'esbuild'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir, homedir } from 'node:os'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = await mkdtemp(resolve(tmpdir(), 'halobox-player-ui-'))
let server
try {
  const fixture = resolve(root, 'scripts/fixtures/player-interactions.tsx')
  const boundaries = new Set(['api', 'liveTv', 'playback', 'library', 'bible', 'people'])
  await build({entryPoints:[fixture],outfile:resolve(temp,'fixture.js'),bundle:true,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{
    name:'local-server-boundaries',setup(b) {
      b.onLoad({filter:/src\/lib\/(api|liveTv|playback|library|bible|people)\.ts$/},async ({path})=>{
        const name = path.split('/').at(-1).replace('.ts','')
        if (!boundaries.has(name)) return
        const source = await readFile(path,'utf8')
        const names = [...source.matchAll(/export (?:const|(?:async )?function) (\w+)/g)].map(x=>x[1])
        const values = await readFile(resolve(root,'scripts/fixtures/player-boundaries.js'),'utf8')
        return {contents:values+'\n'+names.map(name=>`export const ${name} = (...args) => boundary(${JSON.stringify(name)}, ...args);`).join('\n'),loader:'js'}
      })
      b.onLoad({filter:/\.css$/},async ({path})=>({contents:(await readFile(path,'utf8')).replace(/@import "tailwindcss\/[^;]+;/g,''),loader:'css'}))
    }
  }],logLevel:'warning'})
  const styleNames = [...(await readFile(resolve(root,'src/routes/__root.tsx'),'utf8')).matchAll(/import '\.\.\/([^']+\.css)'/g)].map(x=>x[1])
  const css = (await Promise.all(styleNames.map(n=>readFile(resolve(root,'src',n),'utf8')))).join('\n').replace(/@import "tailwindcss\/[^;]+;/g,'').replace('@import "./tv-tokens.css";', await readFile(resolve(root,'src/tv-tokens.css'),'utf8'))
  await writeFile(resolve(temp,'global.css'),css)
  await writeFile(resolve(temp,'index.html'),'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><link rel="stylesheet" href="/global.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
  const video = spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x15283b:s=640x360:r=10','-t','60','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',resolve(temp,'fixture.mp4')],{timeout:30000})
  if(video.status!==0) throw Error('Could not create local video fixture: '+video.stderr)
  const hls=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',resolve(temp,'fixture.mp4'),'-c','copy','-hls_time','4','-hls_list_size','0',resolve(temp,'fixture.m3u8')],{timeout:30000})
  if(hls.status!==0)throw Error('Could not create local HLS fixture: '+hls.stderr)
  server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url,'http://localhost').pathname
      if(req.method!=='GET'){res.writeHead(405);res.end();return}
      const file=(/^\/fixture(?:\d+)?\.(?:js|css|mp4|m3u8|ts)$/.test(path)||path==='/global.css')?resolve(temp,path.slice(1)):path.startsWith('/images/')?resolve(root,'public'+path):resolve(temp,'index.html')
      const bytes=await readFile(file)
      const type={'.js':'text/javascript','.css':'text/css','.mp4':'video/mp4','.m3u8':'application/vnd.apple.mpegurl','.ts':'video/mp2t','.avif':'image/avif','.html':'text/html'}[extname(file)]||'application/octet-stream'
      res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length});res.end(bytes)
    }catch{res.writeHead(404);res.end()}
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const python=process.env.PLAYER_UI_PYTHON||`${homedir()}/.codex/skills/seo/.venv/bin/python3`
  const child=spawn(python,['-u',resolve(root,'scripts/gate-player-interactions.py'),`http://127.0.0.1:${server.address().port}`],{cwd:root,stdio:'inherit'})
  const timeout=setTimeout(()=>child.kill('SIGTERM'),180000)
  const code=await new Promise(resolve=>child.on('exit',resolve));clearTimeout(timeout)
  if(code!==0)throw Error('Player browser verification failed: '+code)
}finally{
  if(server)await new Promise(resolve=>server.close(resolve))
  await rm(temp,{recursive:true,force:true})
}
