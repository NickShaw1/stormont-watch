'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import styles from './Nav.module.css'

function EyeLogo() {
  return (
    <svg
      className={styles.navLogo}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 12C2 12 5.5 5 12 5C18.5 5 22 12 22 12C22 12 18.5 19 12 19C5.5 19 2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.5"
        className={styles.navLogoIris}
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        fill="currentColor"
        className={styles.navLogoPupil}
      />
    </svg>
  )
}

const navLinks = [
  { href: '/assembly/structure', label: 'Assembly' },
  { href: '/assembly/mlas', label: 'MLAs' },
  { href: '/assembly/bills', label: 'Legislation' },
  { href: '/assembly/votes', label: 'Votes' },
  { href: '/assembly/stats', label: 'Stats' },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      closeBtnRef.current?.focus()
    } else {
      hamburgerRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
    return () => {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1)
    }
  }, [open])

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.navBrand}>
          <EyeLogo />
          <span className={styles.navWordmark}>
            <span className={styles.navStormont}>Stormont </span>
            <span className={styles.navWatch}>Watch</span>
          </span>
        </Link>

        <ul className={styles.links} role="list">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname.startsWith(href) ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          ref={hamburgerRef}
          className={styles.hamburger}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Full-screen sidebar */}
      <div
        id="mobile-menu"
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
        aria-hidden={!open}
      >
        <div className={styles.sidebarTop}>
          <Link href="/" className={styles.navBrand} onClick={() => setOpen(false)}>
            <EyeLogo />
            <span className={styles.navWordmark}>
            <span className={styles.navStormont}>Stormont </span>
            <span className={styles.navWatch}>Watch</span>
          </span>
          </Link>
          <button
            ref={closeBtnRef}
            className={styles.closeBtn}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <span />
            <span />
          </button>
        </div>

        <ul className={styles.sidebarLinks} role="list">
          <li>
            <Link
              href="/"
              className={`${styles.sidebarLink} ${open ? styles.sidebarLinkVisible : ''}`}
              aria-current={pathname === '/' ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
          </li>
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`${styles.sidebarLink} ${open ? styles.sidebarLinkVisible : ''}`}
                aria-current={pathname.startsWith(href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
