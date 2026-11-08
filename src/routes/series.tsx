import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/series')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'series' }),
  component: Series,
})

function Series() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Series" singular="series" base="/tv-show" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
