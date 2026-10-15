import './SiteLayout.css'

export function Group9Logo() {
  return <a className="brand group9-logo" href="/" aria-label="Group9 home">Group<span>9</span></a>
}

export function SiteHeader({ page }) {
  return <nav className="topbar site-header" aria-label="Main navigation">
    <div className="site-header-inner">
    <Group9Logo />
    <div className="nav-links">
      <a href="/" className={page === 'problem' ? 'active' : undefined} aria-current={page === 'problem' ? 'page' : undefined}>Problem statement</a>
      <a href="/info" className={page === 'info' ? 'active' : undefined} aria-current={page === 'info' ? 'page' : undefined}>EV guide</a>
    </div>
    </div>
  </nav>
}

export function SiteFooter() {
  return <footer className="site-footer"><Group9Logo /></footer>
}
