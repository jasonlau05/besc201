import './SiteLayout.css'

const navigation = [
  {
    page: 'problem', href: '/', label: 'Problem statement',
    icon: <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
    activeIcon: <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
  },
  {
    page: 'learn', href: '/learn', label: 'Learn',
    icon: <><path d="M12 6v15M3 4h4a7 7 0 0 1 5 2 7 7 0 0 1 5-2h4v15h-4a7 7 0 0 0-5 2 7 7 0 0 0-5-2H3Z" /></>,
    activeIcon: <path d="M3 4h4a7 7 0 0 1 4.25 1.7v14.5A8 8 0 0 0 7 19H3ZM21 4h-4a7 7 0 0 0-4.25 1.7v14.5A8 8 0 0 1 17 19h4Z" />,
  },
  {
    page: 'info', href: '/info', label: 'EV guide',
    icon: <><path d="m5 10 2-6h10l2 6M4 10h16v8H4Zm2 8v3m12-3v3M7 14h2m6 0h2" /></>,
    activeIcon: <path fillRule="evenodd" d="M6.5 3h11l2.5 7h1v8h-2v3h-3v-3H8v3H5v-3H3v-8h1ZM7.9 5 6 10h12l-1.9-5ZM7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />,
  },
  {
    page: 'chargers', href: '/chargers', label: 'Chargers near me',
    icon: <><path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13Z" /><path d="m13 5-4 5h6l-4 5" /></>,
    activeIcon: <path fillRule="evenodd" d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13ZM13 4l-5 7h5l-2 6 5-8h-5Z" />,
  },
]

export function Group9Logo() {
  return <a className="brand group9-logo" href="/" aria-label="Group9 home">Group<span>9</span></a>
}

export function SiteHeader({ page }) {
  return <header className="topbar site-header">
    <div className="site-header-inner">
    <Group9Logo />
    <nav className="nav-links" aria-label="Main navigation">
      {navigation.map(item => <a key={item.page} href={item.href} className={page === item.page ? 'active' : undefined} aria-current={page === item.page ? 'page' : undefined} aria-label={item.label}>
        <svg className="nav-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <g className="nav-icon-outline">{item.icon}</g>
          <g className="nav-icon-filled" fill="currentColor" stroke="none">{item.activeIcon}</g>
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
