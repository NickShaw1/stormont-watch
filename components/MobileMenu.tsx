'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import MandateSwitcher from './MandateSwitcher'
import { HOME_LINK, PRIMARY_LINKS, type NavItem } from '@/lib/constants/navigation'
import styles from './MobileMenu.module.css'

const INERT_SELECTOR = '#main-content, footer, .skip-link'
const CLOSE_MS = 220

export default function MobileMenu({
  pathname,
  basePath,
  homeHref,
  onClose,
}: {
  pathname: string
  basePath: string
  homeHref: string
  onClose: () => void
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  const requestClose = useCallback(() => {
    if (closeTimer.current !== undefined) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return }
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, CLOSE_MS)
  }, [onClose])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    closeRef.current?.focus()
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>(INERT_SELECTOR))
    inertTargets.forEach((el) => el.setAttribute('inert', ''))

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    const mq = window.matchMedia('(min-width: 1025px)')
    const onResize = () => { if (mq.matches) onClose() }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)

    return () => {
      html.style.overflow = previousOverflow
      inertTargets.forEach((el) => el.removeAttribute('inert'))
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
    }
  }, [onClose, requestClose])

  const trapFocus = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const focusable = Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }, [])

  const row = (item: NavItem, target: string) => {
    const Icon = item.icon
    const current = pathname === target || (item.href !== '/' && pathname.startsWith(`${target}/`))
    return (
      <li key={item.href}>
        <Link href={target} className={styles.row} aria-current={current ? 'page' : undefined} onClick={requestClose}>
          <span className={styles.rowIcon}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
          <span>{item.label}</span>
        </Link>
      </li>
    )
  }

  return createPortal(
    <>
      <div className={styles.backdrop} data-closing={closing || undefined} onClick={requestClose} aria-hidden="true" />
      <div
        id="mobile-menu"
        ref={sheetRef}
        className={styles.sheet}
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onKeyDown={trapFocus}
      >
        <div className={styles.header}>
          <span className={styles.title}>
            <span className={styles.stormont}>Stormont </span><span className={styles.watch}>Watch</span>
          </span>
          <button ref={closeRef} type="button" className={styles.close} aria-label="Close menu" onClick={requestClose}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.scroll}>
          <ul className={styles.list} role="list">
            {row(HOME_LINK, homeHref)}
            {PRIMARY_LINKS.map((item) => row(item, `${basePath}${item.href}`))}
          </ul>

          <MandateSwitcher variant="list" onNavigate={requestClose} />
        </div>
      </div>
    </>,
    document.body,
  )
}
