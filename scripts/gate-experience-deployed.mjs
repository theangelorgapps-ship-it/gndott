import { spawnSync } from 'node:child_process'

const result = spawnSync('python3', ['scripts/gate-experience-local.py'], {
  encoding: 'utf8',
  env: {
    ...process.env,
    STREAMIT_BASE_URL: 'https://gndott.theangelorgapps.workers.dev',
    STREAMIT_START_SERVER: '0',
    STREAMIT_EVIDENCE_PREFIX: 'experience-deployed',
  },
})
if (result.error) throw result.error
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
if (result.status !== 0 || !result.stdout.includes('EXPERIENCE_LOCAL_OK')) {
  process.exit(result.status || 1)
}
console.log('EXPERIENCE_DEPLOYED_OK')
