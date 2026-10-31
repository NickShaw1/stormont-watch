'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import MandateSwitcher from './MandateSwitcher'
import ThemeToggle from './ThemeToggle'
import Logo from './Logo'
import { useArchiveBase } from '@/lib/hooks/useArchiveBase'
import { PRIMARY_LINKS } from '@/lib/constants/navigation'
import styles from './Nav.module.css'

const MobileMenu = dynamic(() => import('./MobileMenu'), { ssr: false })

export default function Nav() {
  const { pathname, archiveId, basePath, homeHref } = useArchiveBase()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (wasOpen.current && !open) hamburgerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <nav className={styles.nav} data-scrolled={scrolled ? 'true' : undefined} aria-label="Main navigation">
      <div className={`container ${styles.inner}`}>
        <Link href={homeHref} className={styles.brand}>
          <span className={styles.logoWrap}><Logo size={26} className={styles.logo} blinkClassName={styles.logoBlink} /></span>
          <span className={styles.wordmark}>
            <span className={styles.stormont}>Stormont </span>
            <span className={styles.watch}>Watch</span>
          </span>
          {archiveId && <span className={styles.archiveBadge}>Archive</span>}
        </Link>

        <ul className={styles.links} role="list">
          {PRIMARY_LINKS.map(({ href, label }) => {
            const target = `${basePath}${href}`
            const current = pathname === target || pathname.startsWith(`${target}/`)
            return (
              <li key={href}>
                <Link href={target} data-label={label} aria-current={current ? 'page' : undefined}>{label}</Link>
              </li>
            )
          })}
        </ul>

        <div className={styles.right}>
          <ThemeToggle />
          <span className={styles.desktopOnly}><MandateSwitcher /></span>
          <button
            ref={hamburgerRef}
            type="button"
            className={styles.hamburger}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <span className={styles.bars} aria-hidden="true"><span /><span /><span /></span>
          </button>
        </div>
      </div>

      {open && (
        <MobileMenu pathname={pathname} basePath={basePath} homeHref={homeHref} onClose={() => setOpen(false)} />
      )}
    </nav>
  )
}
