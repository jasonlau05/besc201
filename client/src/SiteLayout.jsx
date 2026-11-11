import { useLayoutEffect, useRef } from 'react'
import { createTabNavigation } from './tab-navigation.mjs'
import './SiteLayout.css'

// Lucide SVGs (ISC): https://github.com/lucide-icons/lucide
// Copyright and license: /licenses/lucide.txt
const navigation = [
  {
    page: 'problem', href: '/', label: 'Problem statement',
    icon: <><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  },
  {
    page: 'learn', href: '/learn', label: 'Learn',
    icon: <><path d="M12 5v16" /><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" /></>,
  },
  {
    page: 'info', href: '/info', label: 'EV guide',
    icon: <><path d="M5 21v-6" /><path d="M12 21V3" /><path d="M19 21V9" /></>,
  },
  {
    page: 'chargers', href: '/chargers', label: 'Chargers near me',
    icon: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  },
]

export function Group9Logo() {
  return <a className="brand group9-logo" href="/" aria-label="Group9 home">Group<span>9</span></a>
}

export function SiteHeader({ page, onNavigate }) {
  const navRef = useRef(null)
  const motionRef = useRef(null)
  const selected = Math.max(0, navigation.findIndex(item => item.page === page))
  useLayoutEffect(() => {
    const controller = createTabNavigation(navRef.current)
    motionRef.current = controller
    return () => controller.destroy()
  }, [])
  useLayoutEffect(() => { motionRef.current.update(selected, onNavigate) }, [selected, onNavigate])

  return <header className="topbar site-header" data-page={page}>
    <div className="site-header-inner">
    <Group9Logo />
    <nav ref={navRef} className="nav-links" aria-label="Main navigation">
      <span className="nav-tab-indicator" aria-hidden="true" />
      {navigation.map(item => <a key={item.page} href={item.href} draggable="false" className={page === item.page ? 'active' : undefined} aria-current={page === item.page ? 'page' : undefined} aria-label={item.label}>
        <svg className="nav-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          {item.icon}
        </svg>
        <span className="nav-desktop-label" aria-hidden="true">{item.label}</span>
      </a>)}
    </nav>
    </div>
  </header>
}

export function SiteFooter() {
  return <footer className="site-footer"><Group9Logo /></footer>
}
