import './SiteLayout.css'

export function Group9Logo() {
  return <a className="brand group9-logo" href="/" aria-label="Group9 home">Group<span>9</span></a>
}

export function SiteHeader({ page }) {
  return <nav className="topbar site-header" aria-label="Main navigation">
    <div className="site-header-inner">
    <Group9Logo />
    <div className="nav-links">
      <a href="/" className={page === 'problem' ? 'active' : undefined} aria-current={page === 'problem' ? 'page' : undefined} aria-label="Problem statement"><span className="nav-desktop-label">Problem statement</span><span className="nav-mobile-label" aria-hidden="true">Problem</span></a>
      <a href="/learn" className={page === 'learn' ? 'active' : undefined} aria-current={page === 'learn' ? 'page' : undefined}>Learn</a>
      <a href="/info" className={page === 'info' ? 'active' : undefined} aria-current={page === 'info' ? 'page' : undefined}>EV guide</a>
      <a href="/chargers" className={page === 'chargers' ? 'active' : undefined} aria-current={page === 'chargers' ? 'page' : undefined}>Chargers near me</a>
    </div>
    </div>
  </nav>
}

export function SiteFooter() {
  return <footer className="site-footer"><Group9Logo /></footer>
}
