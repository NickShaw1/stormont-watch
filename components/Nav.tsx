'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Home, Users, Users2, Scale, Vote, BarChart3, Building2 } from 'lucide-react'
import MandateSwitcher from './MandateSwitcher'
import ThemeToggle from './ThemeToggle'
import styles from './Nav.module.css'

function EyeLogo() {
  return (
    <svg
      className={styles.navLogo}
      width="31"
      height="31"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className={styles.navLogoBlink}>
        <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </g>
    </svg>
  )
}

const navLinks = [
  { href: '/assembly/mlas', label: 'MLAs' },
  { href: '/assembly/parties', label: 'Parties' },
  { href: '/assembly/bills', label: 'Legislation' },
  { href: '/assembly/votes', label: 'Votes' },
  { href: '/assembly/stats', label: 'Stats' },
  { href: '/assembly/structure', label: 'Assembly' },
]

const navIcons: Record<string, typeof Home> = {
  '/': Home,
  '/assembly/mlas': Users,
  '/assembly/parties': Users2,
  '/assembly/bills': Scale,
  '/assembly/votes': Vote,
  '/assembly/stats': BarChart3,
  '/assembly/structure': Building2,
}

// Cycles through the system's three sanctioned semantic colours (§4.1).
const navIconColors: Record<string, string> = {
  '/': 'var(--sw-accent)',
  '/assembly/mlas': 'var(--sw-accent-warm)',
  '/assembly/parties': 'var(--sw-success)',
  '/assembly/bills': 'var(--sw-accent)',
  '/assembly/votes': 'var(--sw-accent-warm)',
  '/assembly/stats': 'var(--sw-success)',
  '/assembly/structure': 'var(--sw-accent)',
}

const allLinks = [
  { href: '/', label: 'Home' },
  ...navLinks,
]

export default function Nav() {
  const pathname = usePathname()
  // When browsing an archive, keep every nav link inside that mandate.
  const archiveMatch = pathname.match(/^\/archive\/([^/]+)/)
  const basePath = archiveMatch ? `/archive/${archiveMatch[1]}` : ''
  const homeHref = basePath || '/'
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  const handleNavClick = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus trap: keep Tab cycling inside the drawer
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const el = drawerRef.current
    if (!el) return
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }, [])

  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, -parseInt(top || '0'))
    }
    return () => {
      const top = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (top) window.scrollTo(0, -parseInt(top))
    }
  }, [open])

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={`container ${styles.inner}`}>
        <Link href={homeHref} className={styles.navBrand}>
          <span className={styles.navLogoWrap}><EyeLogo /></span>
          <span className={styles.navWordmark}>
            <span className={styles.navStormont}>Stormont </span>
            <span className={styles.navWatch}>Watch</span>
          </span>
          {archiveMatch && <span className={styles.archiveBadge}>Archive</span>}
        </Link>

        <ul className={styles.links} role="list">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={`${basePath}${href}`}
                aria-current={pathname.startsWith(`${basePath}${href}`) ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.navRight}>
          <span className={styles.navThemeToggle}><ThemeToggle /></span>

          <MandateSwitcher />

          <button
            className={styles.hamburger}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open
              ? <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : (
                <span className={styles.hamburgerBars} aria-hidden="true">
                  <span /><span /><span />
                </span>
              )
            }
          </button>
        </div>
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div className={styles.mobileDrawerBackdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-menu" ref={drawerRef} className={styles.sidebar} role="dialog" aria-modal="true" aria-label="Navigation menu" onKeyDown={handleDrawerKeyDown}>
            <div className={styles.sidebarBody}>
            <ul className={styles.sidebarLinks} role="list">
              {allLinks.map(({ href, label }, i) => {
                const target = href === '/' ? homeHref : `${basePath}${href}`
                const isCurrent = pathname === target || (href !== '/' && pathname.startsWith(target))
                const Icon = navIcons[href]
                return (
                <li key={href} style={{ '--i': i } as React.CSSProperties}>
                  <Link
                    href={target}
                    className={styles.sidebarLink}
                    style={{ '--icon-color': navIconColors[href] } as React.CSSProperties}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={handleNavClick}
                  >
                    <span className={styles.sidebarLinkIconWrap}>
                      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className={styles.sidebarLinkLabel}>{label}</span>
                  </Link>
                </li>
                )
              })}
            </ul>
            <div className={styles.mobileMeta}>
              <Link href="/about" onClick={handleNavClick}>About</Link>
              <span>·</span>
              <Link href="/privacy" onClick={handleNavClick}>Privacy</Link>
              <span>·</span>
              <Link href="/terms" onClick={handleNavClick}>Terms</Link>
            </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </nav>
  )
}
