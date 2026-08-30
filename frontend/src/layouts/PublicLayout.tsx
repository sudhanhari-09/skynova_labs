import React, { useEffect, useRef, useState } from "react"
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../store/authStore"
import { fetchNavigation, fetchPublicSite, NavItem } from "../services/api"
import { Menu, X } from "../components/icons"
import Logo from "../components/Logo"
import ScrollRestoration from "../components/ScrollRestoration"

const navGroups: { label: string; items: { to: string; label: string }[] }[] = [
  {
    label: "Work",
    items: [
      { to: "/projects", label: "Projects" },
      { to: "/solutions", label: "Solutions" },
      { to: "/products", label: "Products" },
    ],
  },
  {
    label: "Innovation",
    items: [
      { to: "/research", label: "Research" },
      { to: "/experiments", label: "Experiments" },
      { to: "/innovation-pipeline", label: "Innovation Pipeline" },
      { to: "/build-log", label: "Build Log" },
    ],
  },
  {
    label: "Learn",
    items: [
      { to: "/journal", label: "Journal" },
      { to: "/blog", label: "Blog" },
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

// Curated links shown in the desktop header nav (compact).
const desktopNav = [
  { to: "/projects", label: "Projects" },
  { to: "/solutions", label: "Solutions" },
  { to: "/products", label: "Products" },
  { to: "/journal", label: "Journal" },
  { to: "/about", label: "About" },
]

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

  const desktopItems = siteNav.length > 0
    ? siteNav.map((n) => ({ to: n.url, label: n.label })).slice(0, 5)
    : desktopNav
  const mobileGroups = siteNav.length > 0
    ? [{ label: "Menu", items: siteNav.flatMap((n) => [{ to: n.url, label: n.label }, ...(n.children ?? []).map((c) => ({ to: c.url, label: c.label }))]) }]
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
            <Link to="/solutions">Solutions</Link>
            <Link to="/products">Products</Link>
            <Link to="/innovation-pipeline">Innovation Pipeline</Link>
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
