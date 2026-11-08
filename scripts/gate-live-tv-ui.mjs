// Browser integration is local-only. Uses an installed Playwright Python runtime.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
const python=process.env.LIVE_TV_PYTHON || `${homedir()}/.codex/skills/seo/.venv/bin/python3`
if(!existsSync(python)) throw new Error('Set LIVE_TV_PYTHON to a Python interpreter with Playwright installed.')
const result=spawnSync(python,['scripts/gate-live-tv-ui.py'],{stdio:'inherit',timeout:180000})
if(result.error)throw result.error
if(result.status!==0)process.exit(result.status||1)
console.log('LIVE_UI_PASS')
