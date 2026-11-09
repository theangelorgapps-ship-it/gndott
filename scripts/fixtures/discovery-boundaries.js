const image = '/images/entertainment/movie/thumb/the_daring_player_thumb.avif'
const movie = { id: 1, name: 'Faith for Today', type: 'movie', slug: 'faith-for-today', thumbnail_url: image, release_date: '2025-01-01' }
const teaching = { ...movie, id: 2, name: 'Faith in Practice', type: 'teaching', slug: 'faith-in-practice' }
const all = { movies: [movie], teachings: [teaching], tvshows: [], videos: [], channels: [] }
async function boundary(name, input) {
  if (name === 'getSessionUser') return null
  if (name === 'getFooterData') return { premium: [], latest: [] }
  if (name === 'getHomeAds') return []
  if (name === 'getContinueWatching') return { items: [] }
  if (name === 'getDashboard') return { heroes: [], top10: [], recommendations: {}, popular: [], latest: [], channels: [], free: [], genres: [{ id: 1, name: 'Faith' }], collections: ['movie', 'teaching', 'tvshow', 'video'].map(type => ({ type, count: 2, artwork: image })) }
  if (name === 'getGenresPage') return [{ id: 1, name: 'Faith' }, { id: 2, name: 'Prayer' }]
  if (name === 'getTrending') return [movie]
  if (name === 'getGenreContent') return { genre: { name: input.data === 1 ? 'Faith' : 'Prayer' }, items: input.data === 1 ? [movie, teaching] : [] }
  if (name === 'getCatalogue') return { heroes: [], suggestions: [], items: [movie, teaching], categories: [{ id: 1, name: 'Faith' }, { id: 2, name: 'Prayer' }], years: [2025] }
  if (name === 'searchContent') {
    // Hold the actual server-function boundary so loading, stale response and errors are observable.
    const term = input.data.toLowerCase()
    await new Promise(resolve => setTimeout(resolve, term === 'slow' ? 900 : 100))
    if (term === 'error') throw Error('Local catalogue service unavailable')
    if (term === 'empty') return { movies: [], teachings: [], tvshows: [], videos: [], channels: [] }
    return all
  }
  throw Error('Unexpected discovery boundary: ' + name)
}
