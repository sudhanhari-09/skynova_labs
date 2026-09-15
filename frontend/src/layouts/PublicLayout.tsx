import React, { useEffect, useRef, useState } from "react"
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../store/authStore"
import { fetchNavigation, fetchPublicSite, NavItem } from "../services/api"
import { Menu, X } from "../components/icons"
import Logo from "../components/Logo"
import ScrollRestoration from "../components/ScrollRestoration"

// The five independent public sections. These are the canonical routes every
// site visitor must be able to reach from the header.
const coreNav: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "Projects" },
  { to: "/research", label: "Research" },
  { to: "/experiments", label: "Experiments" },
  { to: "/blog", label: "Blog" },
]

// The legacy/CMS navigation rows referenced Projects/Research/Experiments as
// anchor sections on the Home page (e.g. "/#projects") and About as a CMS
// page route that does not exist in the React Router table. Normalize those
// URLs to the real independent routes so header links navigate directly.
const NAV_URL_FIXUP: Record<string, string> = {
  "/#projects": "/projects",
  "/#research": "/research",
  "/#experiments": "/experiments",
  "/#blog": "/blog",
  "/pages/about-us": "/about",
}

// The public Contact feature has been removed from the site. CMS navigation
// rows may still reference it, so any Contact item coming from the backend is
// dropped here to keep the public header, mobile menu and footer free of
// Contact links (there is no /contact route to navigate to).
function isContactNavItem(item: { url: string; label: string }): boolean {
  return /contact/i.test(item.url || "") || /contact/i.test(item.label || "")
}

function normalizeNavUrl(url: string): string {
  return NAV_URL_FIXUP[url] ?? url
}

const navGroups: { label: string; items: { to: string; label: string }[] }[] = [
  {
    label: "Main",
    items: [
      { to: "/", label: "Home" },
      { to: "/projects", label: "Projects" },
      { to: "/research", label: "Research" },
      { to: "/experiments", label: "Experiments" },
      { to: "/blog", label: "Blog" },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/solutions", label: "Solutions" },
      { to: "/products", label: "Products" },
    ],
  },
  {
    label: "Innovation",
    items: [
      { to: "/innovation-pipeline", label: "Innovation Pipeline" },
      { to: "/build-log", label: "Build Log" },
    ],
  },
  {
    label: "Learn",
    items: [
      { to: "/journal", label: "Journal" },
    ],
  },
  {
    label: "Company",
    items: [
      { to: "/about", label: "About" },
      { to: "/collaborate", label: "Collaborate" },
      { to: "/start-a-project", label: "Start a Project" },
    ],
  },
]

// Curated links shown in the desktop header nav (compact) when the backend
// has not published any header navigation items.
const desktopNav = coreNav

const PublicLayout: React.FC = () => {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const [siteNav, setSiteNav] = useState<NavItem[]>([])
  const [brand, setBrand] = useState("SkyNova Project Labs")

  // Load data-driven navigation and brand settings from the backend.
  useEffect(() => {
    let active = true
    ;(async () => {
      const [nav, site] = await Promise.all([
        fetchNavigation().catch(() => []),
        fetchPublicSite().catch(() => null),
      ])
      if (!active) return
      if (Array.isArray(nav) && nav.length > 0) setSiteNav(nav.filter((n) => n.location === "header"))
      if (site?.settings?.brand_name) setBrand(String(site.settings.brand_name))
    })()
    return () => {
      active = false
    }
  }, [])

  // Build the desktop nav from the backend config but always guarantee the
  // five independent sections appear in a stable order. URLs that legacy CMS
  // rows stored as Home-page anchors are normalized to their real routes.
  const desktopItems = (() => {
    const mapped = siteNav.length > 0
      ? siteNav
          .filter((n) => !isContactNavItem(n))
          .map((n) => ({ to: normalizeNavUrl(n.url), label: n.label }))
      : desktopNav
    const result: { to: string; label: string }[] = []
    const seen = new Set<string>()
    for (const item of coreNav) {
      const match = mapped.find((m) => m.to === item.to) ?? item
      result.push(match)
      seen.add(item.to)
    }
    for (const m of mapped) {
      if (!seen.has(m.to)) {
        result.push(m)
        seen.add(m.to)
      }
    }
    return result.slice(0, 8)
  })()
  const mobileGroups = siteNav.length > 0
    ? [{
        label: "Menu",
        items: siteNav
          .filter((n) => !isContactNavItem(n))
          .flatMap((n) => [{ to: n.url, label: n.label }, ...(n.children ?? []).map((c) => ({ to: c.url, label: c.label }))]),
      }]
    : navGroups

  // Lock body scroll and manage focus while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", onKey)
      previouslyFocused?.focus()
    }
  }, [menuOpen])

  // Close the menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollRestoration />
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand">
            <Logo />
            <span>{brand}</span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            {desktopItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/quote" className="btn-primary site-nav__cta">
              Get a Quote
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/admin" className="btn-secondary site-nav__cta">
                  Dashboard
                </Link>
                <button type="button" className="btn-link site-nav__cta" onClick={async () => { await logout(); navigate("/"); }}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="btn-secondary site-nav__cta">
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              ref={menuButtonRef}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <header>
            <Logo width={28} />
            <span className="font-bold text-gray-900">{brand}</span>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </header>
          <nav aria-label="Mobile">
            {navGroups.map((group) => (
              <div key={group.label}>
                <a href="#" onClick={(e) => e.preventDefault()} aria-hidden="true" className="mobile-menu__group-label">
                  {group.label}
                </a>
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <hr className="my-3 border-gray-100" />
            <NavLink to="/quote" className={({ isActive }) => (isActive ? "active" : undefined)}>Get a Quote</NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : undefined)}>Dashboard</NavLink>
                <a href="#" onClick={async (e) => { e.preventDefault(); await logout(); navigate("/"); }}>Sign out</a>
              </>
            ) : (
              <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : undefined)}>Sign in</NavLink>
            )}
          </nav>
        </div>
      )}

      <div className="site-main flex-1">
        <Outlet />
      </div>

      <footer className="site-footer" aria-label="Site footer">
        <div className="site-footer__inner">
          <div>
            <Logo width={32} className="site-logo" />
            <span className="site-footer__brand-name">SkyNova Project Labs</span>
            <p>
              A premium technology research and development company turning
              ambitious ideas into reliable, production-ready products.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/projects">Projects</Link>
            <Link to="/research">Research</Link>
            <Link to="/experiments">Experiments</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/solutions">Solutions</Link>
            <Link to="/products">Products</Link>
            <Link to="/journal">Journal</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About</Link>
            <Link to="/collaborate">Collaborate</Link>
            <Link to="/start-a-project">Start a Project</Link>
            <Link to="/quote">Get a Quote</Link>
            {isAuthenticated ? (
              <Link to="/admin">Dashboard</Link>
            ) : (
              <Link to="/login">Sign in</Link>
            )}
          </div>
        </div>
        <div className="site-footer__bottom">
          © {new Date().getFullYear()} SkyNova Project Labs. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default PublicLayout
