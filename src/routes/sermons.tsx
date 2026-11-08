import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/sermons')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'sermons' }),
  component: Sermons,
})

function Sermons() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Sermons" singular="sermon" base="/movie" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
