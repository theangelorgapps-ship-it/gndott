// Render shipping components with fixture responses only at server-function boundaries.
import { build } from 'esbuild'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { tmpdir, homedir } from 'node:os'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temp = await mkdtemp(resolve(tmpdir(), 'halobox-feedback-ui-'))
let server
try {
  await build({ entryPoints: [resolve(root, 'scripts/fixtures/feedback-people.tsx')], outfile: resolve(temp, 'fixture.js'), bundle: true, format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{
    name: 'fixture-server-functions', setup(b) {
      b.onLoad({ filter: /src\/lib\/(api|liveTv|playback|library|bible|people)\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8')
        const names = [...source.matchAll(/export (?:const|(?:async )?function) (\w+)/g)].map(match => match[1])
        return { contents: names.map(name => `export async function ${name}(input) { const response = await fetch('/fixture-api/${name}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input ?? {}) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); return result; }`).join('\n'), loader: 'js' }
      })
      b.onLoad({ filter: /\.css$/ }, async ({ path }) => ({ contents: (await readFile(path, 'utf8')).replace(/@import "tailwindcss\/[^;]+;/g, ''), loader: 'css' }))
    }
  }], logLevel: 'warning' })
  const styleNames = [...(await readFile(resolve(root, 'src/routes/__root.tsx'), 'utf8')).matchAll(/import '\.\.\/([^']+\.css)'/g)].map(match => match[1])
  const css = (await Promise.all(styleNames.map(name => readFile(resolve(root, 'src', name), 'utf8')))).join('\n').replace(/@import "tailwindcss\/[^;]+;/g, '').replace('@import "./tv-tokens.css";', await readFile(resolve(root, 'src/tv-tokens.css'), 'utf8'))
  await writeFile(resolve(temp, 'global.css'), css)
  await writeFile(resolve(temp, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>')
  server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
      const path = new URL(req.url, 'http://localhost').pathname
      const file = ['/fixture.js', '/fixture.css', '/global.css'].includes(path) ? resolve(temp, path.slice(1)) : path.startsWith('/images/') ? resolve(root, 'public' + path) : resolve(temp, 'index.html')
      const bytes = await readFile(file)
      res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.css': 'text/css', '.avif': 'image/avif', '.html': 'text/html' }[extname(file)] ?? 'application/octet-stream' }); res.end(bytes)
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const child = spawn(process.env.FEEDBACK_UI_PYTHON || `${homedir()}/.codex/skills/seo/.venv/bin/python3`, ['-u', resolve(root, 'scripts/gate-feedback-people.py'), `http://127.0.0.1:${server.address().port}`, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' })
  const timeout = setTimeout(() => child.kill('SIGTERM'), 120000)
  const code = await new Promise(resolve => child.on('exit', resolve)); clearTimeout(timeout)
  if (code !== 0) throw Error('Feedback/About browser verification failed: ' + code)
} finally {
  if (server) await new Promise(resolve => server.close(resolve))
  await rm(temp, { recursive: true, force: true })
}
