'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { CURRENT_MANDATE, ARCHIVED_MANDATES } from '@/lib/constants/mandates'
import styles from './Nav.module.css'

const MANDATES = [CURRENT_MANDATE, ...ARCHIVED_MANDATES]

export default function MandateSwitcher() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Which mandate are we on?
  const m = pathname.match(/^\/archive\/([^/]+)(\/.*)?$/)
  const activeId = m ? m[1] : CURRENT_MANDATE.id
  const active = MANDATES.find((x) => x.id === activeId) ?? CURRENT_MANDATE

  // Switching mandate lands on that mandate's homepage, not the equivalent deep page — a
  // division / MLA / bill from one mandate has no counterpart in another, so preserving the
  // sub-path would 404 or mislead. The homepage is always a valid landing point.
  const urlFor = (id: string) => (id === CURRENT_MANDATE.id ? '/' : `/archive/${id}`)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Nothing to switch between while only the current mandate is visible (no begun archives).
  // Placed after all hooks so hook order stays stable (rules-of-hooks).
  if (MANDATES.length < 2) return null

  return (
    <div className={styles.mandateSwitch} ref={ref}>
      <button
        className={styles.mandateBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-archive={active.isCurrent ? undefined : 'true'}
      >
        <span>{active.label}{active.isCurrent ? '' : ' archive'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className={styles.mandateMenu} role="menu">
          {MANDATES.map((x) => (
            <li key={x.id} role="none">
              <Link
                role="menuitem"
                href={urlFor(x.id)}
                onClick={() => setOpen(false)}
                aria-current={x.id === activeId ? 'true' : undefined}
              >
                {x.label}{x.isCurrent ? ' · current' : ' · archive'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
