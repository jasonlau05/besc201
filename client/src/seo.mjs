export const SITE_URL = 'https://besc201.vercel.app'

export const pages = {
  '/': {
    name: 'problem', heading: 'problem-title',
    title: 'BESC 201 Group 9 — Electric Vehicle Guide',
    description: 'Explore the BESC 201 Group 9 project: compare electric and gas vehicle emissions, estimate energy costs, learn EV basics, and find U.S. charging stations.',
  },
  '/learn': {
    name: 'learn', heading: 'learn-title',
    title: 'Electric Vehicle Basics — Group9',
    description: 'Learn how electric vehicles work, compare electric and hybrid cars, and understand charging, battery production, and environmental tradeoffs with Group9.',
  },
  '/info': {
    name: 'info', heading: 'guide-title',
    title: 'EV vs Gas Cost & Carbon Calculator — Group9',
    description: 'Compare EV and gas energy costs, estimate carbon break-even mileage, and explore state electricity prices with Group9’s interactive BESC 201 project.',
  },
  '/chargers': {
    name: 'chargers', heading: 'charger-title',
    title: 'Find Nearby EV Charging Stations — Group9',
    description: 'Find public U.S. EV charging stations by address or location. Check connector types, access, and directions using saved DOE AFDC station data.',
  },
  '/chat': {
    name: 'chat', heading: 'ev-chat-title',
    title: 'EV Assistant — Group9',
    description: 'Ask Group9’s AI assistant about electric vehicles, charging, energy costs, and sustainability. Answers may be inaccurate; check the educational sources.',
    noindex: true,
  },
}

export const notFound = {
  name: 'not-found', heading: 'not-found-title',
  title: 'Page Not Found — Group9',
  description: 'This page could not be found. Explore Group9’s electric vehicle guide, cost and carbon calculators, and public charging station finder.',
  noindex: true,
}

export const normalizePath = path => {
  const clean = path.replace(/\/$/, '') || '/'
  if (clean === '/index.html') return '/'
  const htmlPath = clean.replace(/\.html$/, '')
  return Object.hasOwn(pages, htmlPath) ? htmlPath : clean
}
export const getPage = path => pages[normalizePath(path)] || notFound
export const indexablePaths = Object.keys(pages).filter(path => !pages[path].noindex)

export function applyPageMetadata(path, doc = document) {
  const normalized = normalizePath(path)
  const page = getPage(normalized)
  doc.title = page.title
  const setMeta = (attribute, name, content) => {
    let element = doc.head.querySelector(`meta[${attribute}="${name}"]`)
    if (!element) {
      element = doc.createElement('meta')
      element.setAttribute(attribute, name)
      doc.head.append(element)
    }
    element.content = content
  }
  setMeta('name', 'description', page.description)
  setMeta('name', 'robots', page.noindex ? 'noindex, follow' : 'index, follow')
  setMeta('property', 'og:title', page.title)
  setMeta('property', 'og:description', page.description)
  setMeta('name', 'twitter:title', page.title)
  setMeta('name', 'twitter:description', page.description)
  let canonical = doc.head.querySelector('link[rel="canonical"]')
  if (pages[normalized]) {
    const url = new URL(normalized, SITE_URL).href
    if (!canonical) {
      canonical = doc.createElement('link')
      canonical.rel = 'canonical'
      doc.head.append(canonical)
    }
    canonical.href = url
    setMeta('property', 'og:url', url)
  } else {
    canonical?.remove()
    doc.head.querySelector('meta[property="og:url"]')?.remove()
  }
}
