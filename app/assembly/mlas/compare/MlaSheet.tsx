'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, UserSearch, X } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { displayParty, formatConstituency, formatMemberName, partyBorderColor } from '@/lib/format'
import type { CompareMla } from '@/lib/db/queries/compare'
import { SEARCH_MAX, cleanQuery, filterMlas } from './search'
import styles from './compare.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
  mlas: CompareMla[]
  otherId: string | null
  currentId: string | null
  ord: 'first' | 'second'
}

export default function MlaSheet({ open, onClose, onPick, mlas, otherId, currentId, ord }: Props) {
  const uid = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')

  const results = useMemo(() => filterMlas(mlas, query, otherId), [mlas, query, otherId])

  const close = useCallback(() => onClose(), [onClose])
  const focusIndex = Math.max(0, results.findIndex((m) => m.id === currentId))

  useEffect(() => {
    if (!open) return
    setQuery('')
    const html = document.documentElement
    const previousOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    const inertTargets = Array.from(document.querySelectorAll<HTMLElement>('#main-content, footer, .skip-link'))
    inertTargets.forEach((el) => el.setAttribute('inert', ''))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const mq = window.matchMedia('(min-width: 1101px)')
    const onResize = () => { if (mq.matches) close() }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onResize)
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimer)
      html.style.overflow = previousOverflow
      inertTargets.forEach((el) => el.removeAttribute('inert'))
      window.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onResize)
    }
  }, [open, close])

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li[role="option"]') ?? [])

  function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]') ?? [])
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); rows()[0]?.focus() }
    else if (e.key === 'Enter' && results[0]) { e.preventDefault(); onPick(results[0].id) }
  }

  function onRowKey(e: React.KeyboardEvent<HTMLLIElement>, id: string) {
    const items = rows()
    const i = items.indexOf(e.currentTarget)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(id) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[i + 1]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (i === 0) inputRef.current?.focus(); else items[i - 1]?.focus() }
  }

  if (!open) return null

  return createPortal(
    <>
      <div className={styles.sheetBackdrop} onClick={close} aria-hidden="true" />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onKeyDown={trapFocus}>
        <span className={styles.sheetGrip} aria-hidden="true" />
        <div className={styles.sheetHead}>
          <span className={styles.sheetIcon}><UserSearch size={22} strokeWidth={2} aria-hidden="true" /></span>
          <div className={styles.sheetHeadText}>
            <span className={styles.sheetEyebrow}>{ord === 'first' ? 'First MLA' : 'Second MLA'}</span>
            <h2 id={`${uid}-title`} className={styles.sheetTitle}>Choose an MLA</h2>
          </div>
          <button type="button" className={styles.sheetClose} aria-label="Close" onClick={close}>
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <label className={styles.sheetSearch}>
          <Search size={20} strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">Search MLAs</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(cleanQuery(e.target.value))}
            onKeyDown={onInputKey}
            placeholder="Name, party or area"
            maxLength={SEARCH_MAX}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <span className="sr-only" role="status" aria-live="polite">{`${results.length} ${results.length === 1 ? 'MLA' : 'MLAs'} found`}</span>
        {results.length > 0 ? (
        <ul ref={listRef} className={styles.sheetList} role="listbox" aria-labelledby={`${uid}-title`}>
          {results.map((m, i) => (
            <li
              key={m.id}
              role="option"
              tabIndex={i === focusIndex ? 0 : -1}
              aria-selected={m.id === currentId}
              className={styles.sheetItem}
              onClick={() => onPick(m.id)}
              onKeyDown={(e) => onRowKey(e, m.id)}
            >
              <span className={styles.sheetPhoto}>
                <MlaPhoto name={m.name} imgUrl={m.imgUrl ?? ''} size={96} decorative square personId={m.id} />
              </span>
              <span className={styles.sheetItemText}>
                <span className={styles.sheetItemName}>{formatMemberName(m.name)}</span>
                <span className={styles.sheetItemSub}>
                  {m.party && <i className={styles.sheetSwatch} style={{ background: partyBorderColor(m.party) }} aria-hidden="true" />}
                  <span>{[m.party ? displayParty(m.party) : null, m.constituency ? formatConstituency(m.constituency) : null].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
              {m.id === currentId && <span className={styles.sheetCheck}><Check size={14} strokeWidth={3} aria-hidden="true" /></span>}
            </li>
          ))}
        </ul>
        ) : (
          <p className={styles.sheetEmpty}>No MLAs match.</p>
        )}
      </div>
    </>,
    document.body,
  )
}
