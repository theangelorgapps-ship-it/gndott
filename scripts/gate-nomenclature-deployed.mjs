const origin = 'https://gndott.theangelorgapps.workers.dev'

async function visibleText(path) {
  const response = await fetch(origin + path, { headers: { 'cache-control': 'no-cache' } })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  const html = await response.text()
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
}
function assert(value, message) {
  if (!value) throw new Error(message)
}

try {
  const home = await visibleText('/')
  for (const label of ['Sermons', 'Shows', 'Teachings', 'New Released Sermons', 'Popular Shows']) assert(home.includes(label), `home missing ${label}`)
  const sermons = await visibleText('/movies')
  assert(sermons.includes('Sermons'), 'Sermons listing label missing')
  const shows = await visibleText('/tv-shows')
  assert(shows.includes('Shows') && !shows.includes('TV Shows'), 'Shows nomenclature incorrect')
  const teachings = await visibleText('/teachings')
  assert(teachings.includes('Teachings') && teachings.includes('Accessing The Highest Dimensions Of Power'), 'Admin-backed Teachings collection missing')
  const search = await visibleText('/search?q=teaching')
  assert(search.includes('Teachings'), 'Teachings search results missing')
  for (const path of ['/videos', '/video/50']) {
    const text = await visibleText(path)
    assert(!/IMDb|IMDB/.test(text), `${path} still visibly references IMDb`)
  }
  const sermon = await visibleText('/movie/108')
  assert(sermon.includes('IMDb'), 'Non-video IMDb positive control missing')
  console.log('NOMENCLATURE_DEPLOYED_OK')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
