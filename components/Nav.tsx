'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MandateSwitcher from './MandateSwitcher'
import styles from './Nav.module.css'

function EyeLogo() {
  return (
    <svg
      className={styles.navLogo}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  )
}

const navLinks = [
  { href: '/assembly/structure', label: 'Assembly' },
  { href: '/assembly/mlas', label: 'MLAs' },
  { href: '/assembly/parties', label: 'Parties' },
  { href: '/assembly/bills', label: 'Legislation' },
  { href: '/assembly/votes', label: 'Votes' },
  { href: '/assembly/stats', label: 'Stats' },
]

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

        <MandateSwitcher />

        <div className={styles.navRight}>
          <button
            className={styles.hamburger}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open
              ? <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
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
              {allLinks.map(({ href, label }) => {
                const target = href === '/' ? homeHref : `${basePath}${href}`
                return (
                <li key={href}>
                  <Link
                    href={target}
                    className={styles.sidebarLink}
                    aria-current={pathname === target ? 'page' : href !== '/' && pathname.startsWith(target) ? 'page' : undefined}
                    onClick={handleNavClick}
                  >
                    <span>{label}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
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
