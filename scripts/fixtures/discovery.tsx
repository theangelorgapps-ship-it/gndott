import { createRoot } from 'react-dom/client'
import { createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { Route as root } from '../../src/routes/__root'
import { Route as home } from '../../src/routes/index'
import { Route as search } from '../../src/routes/search'
import { Route as sermons } from '../../src/routes/sermons'
import { Route as genres } from '../../src/routes/genres'

const head = root.options.head
root.update({ head: (...args: any[]) => ({ ...head?.(...args), links: [{ rel: 'stylesheet', href: '/fixture.css' }] }) } as any)
const routes = [home, search, sermons, genres]
const paths = ['/', '/search', '/sermons', '/genres']
routes.forEach((route: any, index) => route.update({ id: paths[index], path: paths[index], getParentRoute: () => root }))
const destinations = ['/movie/$id', '/video/$id', '/tv-show/$id', '/teaching/$id', '/channel/$id', '/shows', '/teachings', '/videos', '/live-tv', '/watchlist', '/account-setting']
const router = createRouter({ routeTree: root.addChildren([...routes, ...destinations.map(path => createRoute({ getParentRoute: () => root, path, component: () => <h1>Selected destination</h1> }))]), defaultPendingMinMs: 0 })
createRoot(document).render(<RouterProvider router={router} />)
