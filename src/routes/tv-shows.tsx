import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/tv-shows')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'shows' }),
  component: TvShows,
})

function TvShows() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Shows" singular="show" base="/tv-show" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
