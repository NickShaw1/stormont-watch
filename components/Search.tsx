'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import styles from './Search.module.css'

interface MlaResult  { type: 'mla';  id: string; name: string; party: string; constituency: string; href: string }
interface VoteResult { type: 'vote'; id: string; title: string; date: string; passed: boolean | null; href: string }
interface BillResult { type: 'bill'; id: string; title: string; stage: string; href: string }

type SearchIndex = {
  mlas: MlaResult[]
  votes: VoteResult[]
  legislation: BillResult[]
}

type AnyResult = MlaResult | VoteResult | BillResult

let cachedIndex: SearchIndex | null = null

function score(text: string, query: string): number {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t === q) return 3
  if (t.startsWith(q)) return 2
  if (t.includes(q)) return 1
  return 0
}

function search(index: SearchIndex, query: string): { mlas: MlaResult[]; votes: VoteResult[]; legislation: BillResult[] } {
  const q = query.trim().toLowerCase()
  if (!q) return { mlas: [], votes: [], legislation: [] }

  const mlas = index.mlas
    .map((m) => ({ item: m, s: Math.max(score(m.name, q), score(m.party, q), score(m.constituency, q)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.item)

  const votes = index.votes
    .map((v) => ({ item: v, s: score(v.title, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.item)

  const legislation = index.legislation
    .map((b) => ({ item: b, s: Math.max(score(b.title, q), score(b.stage, q)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.item)

  return { mlas, votes, legislation }
}

function flatResults(r: ReturnType<typeof search>): AnyResult[] {
  return [...r.mlas, ...r.legislation, ...r.votes]
}

export default function Search() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const results = index ? search(index, query) : { mlas: [], votes: [], legislation: [] }
  const flat = flatResults(results)
  const hasResults = flat.length > 0

  const openModal = useCallback(() => {
    setOpen(true)
    if (!cachedIndex) {
      fetch('/api/search')
        .then((r) => r.json())
        .then((data: SearchIndex) => {
          cachedIndex = data
          setIndex(data)
        })
        .catch(() => {})
    } else {
      setIndex(cachedIndex)
    }
  }, [])

  const closeModal = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIdx(0)
  }, [])

  // ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) { closeModal() } else { openModal() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, openModal, closeModal])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0) }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flat[activeIdx]) {
      router.push(flat[activeIdx].href)
      closeModal()
    } else if (e.key === 'Escape') {
      closeModal()
    }
  }

  if (!open) {
    return (
      <button className={styles.trigger} onClick={openModal} aria-label="Search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className={styles.triggerText}>Search MLAs, bills, votes…</span>
        <kbd className={styles.triggerKbd}>⌘K</kbd>
      </button>
    )
  }

  return (
    <>
      <div className={styles.backdrop} onClick={closeModal} aria-hidden="true" />
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Search">
        <div className={styles.inputRow}>
          <svg className={styles.inputIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Search MLAs, bills, votes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button className={styles.escBtn} onClick={closeModal} aria-label="Close search">
            <kbd>Esc</kbd>
          </button>
        </div>

        {query && (
          <div className={styles.results}>
            {!hasResults && (
              <p className={styles.empty}>No results for &ldquo;{query}&rdquo;</p>
            )}

            {results.mlas.length > 0 && (
              <section>
                <p className={styles.groupLabel}>MLAs</p>
                {results.mlas.map((m) => {
                  const idx = flat.indexOf(m)
                  return (
                    <Link
                      key={m.id}
                      href={m.href}
                      className={`${styles.resultItem} ${idx === activeIdx ? styles.active : ''}`}
                      onClick={closeModal}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className={styles.resultTitle}>{m.name}</span>
                      <span className={styles.resultMeta}>{m.party}{m.constituency ? ` · ${m.constituency}` : ''}</span>
                    </Link>
                  )
                })}
              </section>
            )}

            {results.legislation.length > 0 && (
              <section>
                <p className={styles.groupLabel}>Bills</p>
                {results.legislation.map((b) => {
                  const idx = flat.indexOf(b)
                  return (
                    <Link
                      key={b.id}
                      href={b.href}
                      className={`${styles.resultItem} ${idx === activeIdx ? styles.active : ''}`}
                      onClick={closeModal}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className={styles.resultTitle}>{b.title}</span>
                      <span className={styles.resultMeta}>{b.stage}</span>
                    </Link>
                  )
                })}
              </section>
            )}

            {results.votes.length > 0 && (
              <section>
                <p className={styles.groupLabel}>Votes</p>
                {results.votes.map((v) => {
                  const idx = flat.indexOf(v)
                  return (
                    <Link
                      key={v.id}
                      href={v.href}
                      className={`${styles.resultItem} ${idx === activeIdx ? styles.active : ''}`}
                      onClick={closeModal}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className={styles.resultTitle}>{v.title}</span>
                      <span className={styles.resultMeta}>{v.date}{v.passed !== null ? ` · ${v.passed ? 'Passed' : 'Failed'}` : ''}</span>
                    </Link>
                  )
                })}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}
