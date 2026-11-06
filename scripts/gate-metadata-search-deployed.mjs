import { spawnSync } from 'node:child_process'

const result = spawnSync('python3', ['scripts/gate-metadata-search-live.py'], {
  encoding: 'utf8',
  env: {
    ...process.env,
    STREAMIT_BASE_URL: 'https://gndott.theangelorgapps.workers.dev',
    STREAMIT_START_SERVER: '0',
    STREAMIT_EVIDENCE_PREFIX: 'metadata-search-live',
  },
})
if (result.error) throw result.error
if (result.status !== 0 || !result.stdout.includes('METADATA_SEARCH_LIVE_OK')) {
  process.stderr.write(result.stdout + result.stderr)
  process.exit(result.status || 1)
}
console.log('METADATA_SEARCH_DEPLOYED_OK')
