import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/videos')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'videos' }),
  component: Videos,
})

function Videos() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Videos" singular="video" base="/video" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
