'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { CURRENT_MANDATE, ARCHIVED_MANDATES } from '@/lib/constants/mandates'
import styles from './Nav.module.css'

const MANDATES = [CURRENT_MANDATE, ...ARCHIVED_MANDATES]

// Lands on that mandate's homepage; a deep page's sub-path has no cross-mandate counterpart.
const urlFor = (id: string) => (id === CURRENT_MANDATE.id ? '/' : `/archive/${id}`)

export default function MandateSwitcher({ variant = 'menu', onNavigate }: { variant?: 'menu' | 'list'; onNavigate?: () => void }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const m = pathname.match(/^\/archive\/([^/]+)(\/.*)?$/)
  const activeId = m ? m[1] : CURRENT_MANDATE.id
  const active = MANDATES.find((x) => x.id === activeId) ?? CURRENT_MANDATE

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

  // After all hooks so hook order stays stable (rules-of-hooks).
  if (MANDATES.length < 2) return null

  if (variant === 'list') {
    return (
      <>
        <p className={styles.listGroup}>Mandate</p>
        <ul className={styles.mandateList} role="list">
          {MANDATES.map((x) => (
            <li key={x.id}>
              <Link
                href={urlFor(x.id)}
                className={styles.mandateChip}
                aria-current={x.id === activeId ? 'true' : undefined}
                onClick={onNavigate}
              >
                {x.label}{x.isCurrent ? ' · current' : ' · archive'}
              </Link>
            </li>
          ))}
        </ul>
      </>
    )
  }

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
        <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
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
