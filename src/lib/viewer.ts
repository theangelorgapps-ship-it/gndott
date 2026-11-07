import { createServerFn } from '@tanstack/react-start'
import { getActiveViewer, readViewerState, selectOwnedViewerProfile } from './viewer.server'

export const getViewer = createServerFn({ method: 'GET' }).handler(async () => getActiveViewer())
export const getViewerState = createServerFn({ method: 'GET' }).handler(async () => readViewerState())
export const selectViewerProfile = createServerFn({ method: 'POST' })
  .validator((data: { profileId: number }) => data)
  .handler(async ({ data }) => selectOwnedViewerProfile(data?.profileId))
