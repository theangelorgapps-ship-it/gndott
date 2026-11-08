import { createFileRoute } from '@tanstack/react-router'
import { Catalogue } from '../components/Catalogue'
import { getCatalogue } from '../lib/catalogue'
import { parseCatalogueSearch } from '../lib/catalogueFilters'

export const Route = createFileRoute('/teachings')({
  validateSearch: parseCatalogueSearch,
  loader: () => getCatalogue({ data: 'teachings' }),
  component: Teachings,
})

function Teachings() {
  const navigate = Route.useNavigate()
  return <Catalogue title="Teachings" singular="teaching" base="/teaching" data={Route.useLoaderData()} search={Route.useSearch()} onSearchChange={search => { void navigate({ search, resetScroll: false }) }} />
}
