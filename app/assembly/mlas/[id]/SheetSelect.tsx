'use client'

import { useCallback, useEffect, useId, useRef, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, X } from 'lucide-react'
import { useDropdown } from '@/lib/useDropdown'
import styles from './mlaDetail.module.css'

type OptionIcon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

export type SheetOption = {
  key: string
  label: string
  icon: OptionIcon
  meta?: string
  color?: string
  on?: string
}

type Props = {
  options: SheetOption[]
  value: string
  onPick: (key: string) => void
  eyebrow: string
  title: string
  headIcon: OptionIcon
  className?: string
  hideTriggerMeta?: boolean
}

function tileStyle(o: SheetOption): CSSProperties | undefined {
  return o.color ? { background: o.color, color: o.on ?? '#ffffff' } : undefined
}

export default function SheetSelect({ options, value, onPick, eyebrow, title, headIcon: HeadIcon, className, hideTriggerMeta }: Props) {
  const uid = useId()
  const dropdown = useDropdown()
  const sheetRef = useRef<HTMLDivElement>(null)
  const open = dropdown.open
  const current = options.find((o) => o.key === value) ?? options[0]

  const close = useCallback(() => {
    dropdown.setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    const triggerEl = dropdown.triggerRef.current
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('#main-content, footer, .skip-link'))
    inertTargets.forEach((el) => el.setAttribute('inert', ''))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const mq = window.matchMedia('(min-width: 641px)')
    const onResize = () => { if (mq.matches) close() }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    return () => {
      html.style.overflow = previousOverflow
      inertTargets.forEach((el) => el.removeAttribute('inert'))
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
      triggerEl?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close])

  function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? [])
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const inList = document.activeElement?.getAttribute('role') === 'option'
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && (document.activeElement === last || inList)) { e.preventDefault(); first.focus() }
  }

  function pick(key: string) {
    onPick(key)
    dropdown.setOpen(false)
  }

  return (
    <div className={`${styles.sheetSelectWrap}${className ? ` ${className}` : ''}`}>
      <button
        ref={dropdown.triggerRef}
        type="button"
        className={styles.sheetSelect}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${uid}-value`}
        onClick={() => dropdown.setOpen((o) => !o)}
      >
        <span className={styles.optIcon} style={tileStyle(current)}><current.icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
        <span id={`${uid}-value`} className={styles.sheetSelectValue}>{current.label}</span>
        {current.meta && !hideTriggerMeta && <span className={styles.sheetSelectMeta}>{current.meta}</span>}
        <ChevronDown className={styles.sheetSelectChev} size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && createPortal(
        <>
          <div className={styles.sheetBackdrop} onClick={close} aria-hidden="true" />
          <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onKeyDown={trapFocus}>
            <span className={styles.sheetGrip} aria-hidden="true" />
            <div className={styles.sheetHead}>
              <span className={styles.sheetIcon}><HeadIcon size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div className={styles.sheetHeadText}>
                <span className={styles.sheetEyebrow}>{eyebrow}</span>
                <h2 id={`${uid}-title`} className={styles.sheetTitle}>{title}</h2>
              </div>
              <button type="button" className={styles.sheetClose} aria-label="Close" onClick={close}>
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <ul ref={dropdown.listRef} className={styles.sheetList} role="listbox" aria-labelledby={`${uid}-title`}>
              {options.map((o) => (
                <li
                  key={o.key}
                  role="option"
                  tabIndex={value === o.key ? 0 : -1}
                  aria-selected={value === o.key}
                  className={styles.sheetItem}
                  onClick={() => pick(o.key)}
                  onKeyDown={(e) => dropdown.handleKeyDown(e, () => pick(o.key))}
                >
                  <span className={styles.optIcon} style={tileStyle(o)}><o.icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
                  <span className={styles.sheetItemText}>
                    <span className={styles.sheetItemName}>{o.label}</span>
                    {o.meta && <span className={styles.sheetItemSub}>{o.meta}</span>}
                  </span>
                  {value === o.key && <span className={styles.sheetCheck}><Check size={14} strokeWidth={3} aria-hidden="true" /></span>}
                </li>
              ))}
            </ul>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
