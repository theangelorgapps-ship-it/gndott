import { createFileRoute } from '@tanstack/react-router'
import { AccountShell, FlowLoadError } from '../components/Account'
import { ViewingLibrary } from '../components/ViewingLibrary'

export const Route = createFileRoute('/continue-watching')({
  errorComponent: ({ reset }) => <FlowLoadError title="Your viewing could not load." reset={reset} />,
  component: () => <AccountShell title="Your viewing."><ViewingLibrary /></AccountShell>,
})
