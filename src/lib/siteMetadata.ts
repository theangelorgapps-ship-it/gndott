export const SITE_TITLE = 'HaloBox - With Prophet Uebert Angel'
export const SITE_DESCRIPTION = 'Watch sermons and teachings with Prophet Uebert Angel on HaloBox. Discover inspiring shows, videos and live TV, and keep your favourites in one place.'
const SOCIAL_IMAGE = 'https://halobox.tv/images/halobox-social-20261109.jpg'
const SOCIAL_ALT = 'HaloBox — With Prophet Uebert Angel. Sermons, Teachings, Shows and Live TV.'

export function siteHead(pathname: string) {
  const url = 'https://halobox.tv' + (pathname.startsWith('/') ? pathname : '/')
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'theme-color', content: '#080d19' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'HaloBox' },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:url', content: url },
      { property: 'og:image', content: SOCIAL_IMAGE },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: SOCIAL_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: SOCIAL_IMAGE },
      { name: 'twitter:image:alt', content: SOCIAL_ALT },
    ],
    links: [
      { rel: 'canonical', href: url },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png?v=20261109' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192.png?v=20261109' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=20261109' },
    ],
  }
}
