'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { abbreviateParty } from '@/lib/format'
import { stripHonorifics } from '@/lib/utils/formatNames'
import styles from './ConstituencySelector.module.css'

const ConstituencyMap = dynamic(() => import('./ConstituencyMap'), { ssr: false })

type MLA = {
  personId: string
  fullName: string
  party: string
  imgUrl: string | null
}

const CONSTITUENCIES = [
  'East Antrim', 'East Belfast', 'East Londonderry',
  'Fermanagh and South Tyrone', 'Foyle', 'Lagan Valley',
  'Mid Ulster', 'Newry and Armagh', 'North Antrim',
  'North Belfast', 'North Down', 'South Antrim',
  'South Belfast', 'South Down', 'Strangford',
  'Upper Bann', 'West Belfast', 'West Tyrone',
]

export default function ConstituencySelector({ mlasByConstituency }: { mlasByConstituency: Record<string, MLA[]> }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [fetchError] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    const list = listRef.current
    if (list) {
      const sel = list.querySelector<HTMLLIElement>('[aria-selected="true"]') ?? list.querySelector<HTMLLIElement>('li')
      sel?.focus()
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [dropdownOpen])

  function handleSelect(constituency: string) {
    setSelected(constituency)
    setDropdownOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLLIElement>, constituency: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect(constituency)
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) + 1]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      items[items.indexOf(e.currentTarget) - 1]?.focus()
    }
  }

  if (mapError) {
    return (
      <div className={styles.fallback}>
        <select
          className={styles.fallbackSelect}
          aria-label="Select a constituency"
          value={selected ?? ''}
          onChange={e => e.target.value && handleSelect(e.target.value)}
        >
          <option value="">Select a constituency...</option>
          {CONSTITUENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selected && <MlaResults mlas={mlasByConstituency[selected] ?? []} error={fetchError} />}
      </div>
    )
  }

  return (
    <div className={styles.picker}>
      <div className={styles.mapWrap}>
        <ConstituencyMap selected={selected} onSelect={handleSelect} onError={() => setMapError(true)} />
      </div>

      <div className={styles.search}>
        <div>
          <h3 className={styles.searchTitle}>Select a <em className={styles.searchTitleEm}>constituency.</em></h3>
          <p className={styles.searchDesc}>Every constituency in Northern Ireland returns five MLAs.</p>
        </div>

        <div className={styles.dropdownWrap} ref={dropdownRef}>
          <button
            ref={triggerRef}
            className={styles.trigger}
            onClick={() => setDropdownOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            {selected
              ? <span>{selected}</span>
              : <span className={styles.triggerPlaceholder}>Select a constituency...</span>
            }
            <svg
              className={`${styles.triggerChevron} ${dropdownOpen ? styles.triggerChevronOpen : ''}`}
              width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
            >
              <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {dropdownOpen && (
            <ul ref={listRef} className={styles.dropdownList} role="listbox">
              {CONSTITUENCIES.map(c => (
                <li
                  key={c}
                  role="option"
                  tabIndex={0}
                  aria-selected={c === selected}
                  className={`${styles.dropdownItem} ${c === selected ? styles.dropdownItemSelected : ''}`}
                  onClick={() => handleSelect(c)}
                  onKeyDown={e => handleKeyDown(e, c)}
                >
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <>
            <div className={styles.selectedBar}>
              <span className={styles.selectedName}>{selected}</span>
              <button className={styles.clearBtn} onClick={() => setSelected(null)}>Clear</button>
            </div>
            <MlaResults mlas={mlasByConstituency[selected] ?? []} error={fetchError} />
          </>
        )}
      </div>
    </div>
  )
}

function MlaResults({ mlas, error }: { mlas: MLA[]; error: boolean }) {
  if (error) return <p className={styles.loading}>Failed to load MLAs. Please try again.</p>
  return (
    <div className={styles.mlaList}>
      {mlas.map(mla => (
        <Link
          key={mla.personId}
          href={`/assembly/mlas/${mla.personId}`}
          className={styles.mlaCard}
        >
          {mla.imgUrl && (
            <Image src={mla.imgUrl} alt={`Photo of ${stripHonorifics(mla.fullName)}`} className={styles.mlaPhoto} width={40} height={40} />
          )}
          <div className={styles.mlaInfo}>
            <span className={styles.mlaName}>{stripHonorifics(mla.fullName)}</span>
            <span className="party-pill" data-party={abbreviateParty(mla.party)}>
              {abbreviateParty(mla.party)}
            </span>
          </div>
          <span className={styles.mlaArrow}>→</span>
        </Link>
      ))}
    </div>
  )
}
