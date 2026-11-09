import { createServerFn } from '@tanstack/react-start'

export const getPersonalities = createServerFn({ method: 'GET' }).handler(async () => {
  const { loadPersonalities } = await import('./people.server')
  return loadPersonalities()
})

export const getPersonalityDetail = createServerFn({ method: 'GET' })
  .validator((id: number) => id)
  .handler(async ({ data }) => {
    const { loadPersonalityDetail } = await import('./people.server')
    return loadPersonalityDetail(data)
  })
