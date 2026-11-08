import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/movies')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'sermons' }),
  component: Movies,
})

function Movies() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Sermons" singular="sermon" base="/movie" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
