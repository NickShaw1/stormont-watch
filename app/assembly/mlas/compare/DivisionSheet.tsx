'use client'

import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './compare.module.css'

type Props = {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  children: ReactNode
}

export default function DivisionSheet({ open, onClose, eyebrow, title, children }: Props) {
  const uid = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('#main-content, footer, .skip-link'))
    inertTargets.forEach((el) => el.setAttribute('inert', ''))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const mq = window.matchMedia('(min-width: 641px)')
    const onResize = () => { if (mq.matches) onClose() }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      html.style.overflow = previousOverflow
      inertTargets.forEach((el) => el.removeAttribute('inert'))
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className={styles.sheetBackdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${styles.sheetCompact}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); closeRef.current?.focus() } }}
      >
        <span className={styles.sheetGrip} aria-hidden="true" />
        <div className={styles.sheetHead}>
          <div className={styles.sheetHeadText}>
            <span className={styles.sheetEyebrow}>{eyebrow}</span>
            <h2 id={`${uid}-title`} className={styles.sheetDivTitle}>{title}</h2>
          </div>
          <button ref={closeRef} type="button" className={styles.sheetClose} aria-label="Close" onClick={onClose}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}
