'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { abbreviateParty, partyPillStyleSolid } from '@/lib/format'
import { stripHonorifics } from '@/lib/utils/formatNames'
import styles from './ConstituencySelector.module.css'
import { CONSTITUENCY_ELECTORATE } from '@/lib/constants/electorates'

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


export default function ConstituencySelector() {
  const [selected, setSelected] = useState<string | null>(null)
  const [mlas, setMlas] = useState<MLA[]>([])
  const [loadingMlas, setLoadingMlas] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileDropdownRef = useRef<HTMLDivElement>(null)
  const desktopTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const desktopListRef = useRef<HTMLUListElement>(null)
  const mobileListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (dropdownOpen) {
      // Move focus to the selected item or first item when dropdown opens
      const list = desktopListRef.current
      if (list) {
        const selected = list.querySelector<HTMLLIElement>('[aria-selected="true"]') ?? list.querySelector<HTMLLIElement>('li')
        selected?.focus()
      }
    } else {
      desktopTriggerRef.current?.focus()
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [dropdownOpen])

  useEffect(() => {
    if (!mobileDropdownOpen) {
      mobileTriggerRef.current?.focus()
    }
  }, [mobileDropdownOpen])

  useEffect(() => {
    if (!mobileDropdownOpen) return
    function handleOutsideClick(e: MouseEvent) {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target as Node)) {
        setMobileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [mobileDropdownOpen])

  async function fetchMlas(constituency: string) {
    setLoadingMlas(true)
    try {
      const res = await fetch(`/api/constituency/${encodeURIComponent(constituency)}`)
      const data = await res.json()
      setMlas(data)
    } catch {
      setMlas([])
    }
    setLoadingMlas(false)
  }

  function handleSelect(constituency: string) {
    setSelected(constituency)
    fetchMlas(constituency)
  }

  function handleClear() {
    setSelected(null)
    setMlas([])
  }

  function handleDropdownKeyDown(e: React.KeyboardEvent<HTMLLIElement>, listRef: React.RefObject<HTMLUListElement | null>, close: () => void, constituency: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect(constituency)
      close()
    } else if (e.key === 'Escape') {
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      const idx = items.indexOf(e.currentTarget)
      items[idx + 1]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(listRef.current?.querySelectorAll<HTMLLIElement>('li') ?? [])
      const idx = items.indexOf(e.currentTarget)
      items[idx - 1]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      listRef.current?.querySelector<HTMLLIElement>('li')?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      const items = listRef.current?.querySelectorAll<HTMLLIElement>('li')
      items?.[items.length - 1]?.focus()
    }
  }

  return (
    <div className={styles.wrap}>
      {mapError ? (
        <div className={styles.fallback}>
          <p className={styles.fallbackLabel}>Select your constituency</p>
          <select
            className={styles.fallbackSelect}
            style={{ borderRadius: selected ? '6px 6px 0 0' : '6px' }}
            value={selected ?? ''}
            onChange={e => e.target.value && handleSelect(e.target.value)}
          >
            <option value="">Select a constituency…</option>
            {CONSTITUENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className={`${styles.mapCard} ${dropdownOpen || mobileDropdownOpen ? styles.mapCardOpen : ''}`} style={{ borderRadius: selected ? '8px 8px 0 0' : '8px' }}>
          {/* Desktop header bar with custom dropdown */}
          <div
            className={`${styles.mapCardHeader} ${dropdownOpen ? styles.mapCardHeaderOpen : ''}`}
            ref={dropdownRef}
          >
            {selected ? (
              <span key={selected} className={styles.mapCardHintDesktop}>
                <span className={styles.mapCardHintName}>{selected}</span>
                <span className={styles.mapCardHintDivider} aria-hidden="true">|</span>
                <span className={styles.mapCardHintElectorate}>
                  <span className={styles.mapCardHintElectorateCount}>
                    {CONSTITUENCY_ELECTORATE[selected]?.toLocaleString()}
                  </span>
                  {' '}total electorate (Apr 2026)
                </span>
              </span>
            ) : (
              <span className={styles.mapCardHintDesktop}>
                Click your constituency on the map or use the dropdown
              </span>
            )}
            <div className={styles.dropdownWrap}>
              <button
                ref={desktopTriggerRef}
                className={styles.mapCardTrigger}
                onClick={() => setDropdownOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                {selected ?? 'Select a constituency…'}
                <svg className={`${styles.triggerChevron} ${dropdownOpen ? styles.triggerChevronOpen : ''}`} width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              {dropdownOpen && (
              <ul ref={desktopListRef} className={styles.dropdownList} role="listbox">
                {CONSTITUENCIES.map(c => (
                  <li
                    key={c}
                    role="option"
                    tabIndex={0}
                    aria-selected={c === selected}
                    className={`${styles.dropdownItem} ${c === selected ? styles.dropdownItemSelected : ''}`}
                    onClick={() => { handleSelect(c); setDropdownOpen(false) }}
                    onKeyDown={e => handleDropdownKeyDown(e, desktopListRef, () => setDropdownOpen(false), c)}
                  >
                    {c}
                  </li>
                ))}
              </ul>
              )}
            </div>
          </div>

          {/* Mobile top bar */}
          <div className={styles.mapCardTop}>
            <p className={styles.mapCardHint}>Select your constituency</p>
          </div>
          <div className={`${styles.mapSelectMobile} ${mobileDropdownOpen ? styles.mapSelectMobileOpen : ''}`} ref={mobileDropdownRef}>
            <button
              ref={mobileTriggerRef}
              className={styles.mapSelectMobileTrigger}
              onClick={() => setMobileDropdownOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={mobileDropdownOpen}
            >
              {selected ?? '— or choose from list —'}
              <svg className={`${styles.triggerChevron} ${mobileDropdownOpen ? styles.triggerChevronOpen : ''}`} width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {mobileDropdownOpen && (
              <ul ref={mobileListRef} className={styles.mobileDropdownList} role="listbox">
                {CONSTITUENCIES.map(c => (
                  <li
                    key={c}
                    role="option"
                    tabIndex={0}
                    aria-selected={c === selected}
                    className={`${styles.dropdownItem} ${c === selected ? styles.dropdownItemSelected : ''}`}
                    onClick={() => { handleSelect(c); setMobileDropdownOpen(false) }}
                    onKeyDown={e => handleDropdownKeyDown(e, mobileListRef, () => setMobileDropdownOpen(false), c)}
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.mapArea}>
            <span className="sr-only">Use the dropdown above to select your constituency</span>
            <ConstituencyMap selected={selected} onSelect={handleSelect} onError={() => setMapError(true)} />
          </div>

          {/* Mobile bottom bar */}
          <div className={styles.mapCardBottom}>
            <p className={styles.mapAttribution}>
              * Contains public sector information licensed under the terms of the{' '}
              <a
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Government Licence v3.0
              </a>
              .
            </p>
          </div>

          {/* Desktop footer bar with attribution */}
          <div className={styles.mapCardFooter}>
            * Contains public sector information licensed under the terms of the{' '}
            <a
              href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Government Licence v3.0
            </a>
            {' '}|{' '}Electorate counts:{' '}
            <a
              href="https://www.eoni.org.uk/results-data/electorate-statistics/"
              target="_blank"
              rel="noreferrer noopener"
            >
              EONI
            </a>
          </div>
        </div>
      )}

      {selected && (
        <div className={styles.results} aria-live="polite" aria-busy={loadingMlas}>
          <div className={styles.constituencyMeta}>
            <span className={styles.constituencyMetaName}>{selected}</span>
            <p className={styles.constituencyMetaElectorate}>
              <span>{CONSTITUENCY_ELECTORATE[selected]?.toLocaleString()} registered electors</span>
              {' '}
              <span className={styles.constituencyMetaDate}>(Apr 2026)</span>
            </p>
          </div>
          <div className={styles.resultsHeader}>
            <p className={styles.resultsTitle}>Your MLAs</p>
            <button className={styles.clearBtn} onClick={handleClear}>Clear</button>
          </div>

          {loadingMlas ? (
            <p className={styles.loading}>Loading…</p>
          ) : (
            <>
              <div className={styles.mlaGrid}>
                {mlas.map(mla => {
                  const pillStyle = partyPillStyleSolid(mla.party)
                  return (
                    <Link
                      key={mla.personId}
                      href={`/assembly/mlas/${mla.personId}`}
                      className={styles.mlaCard}
                      style={{ '--party-color': pillStyle.background } as React.CSSProperties}
                    >
                      {mla.imgUrl && (
                        <Image src={mla.imgUrl} alt={`Photo of ${mla.fullName}`} className={styles.mlaPhoto} width={64} height={64} unoptimized />
                      )}
                      <div className={styles.mlaInfo}>
                        <span className={styles.mlaName}>
                          {stripHonorifics(mla.fullName)}
                        </span>
                        <span className={styles.mlaParty} style={pillStyle}>
                          {abbreviateParty(mla.party)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
              {mlas.map(mla => (
                <Link
                  key={mla.personId}
                  href={`/assembly/mlas/${mla.personId}`}
                  className={styles.mlaRow}
                >
                  {mla.imgUrl && (
                    <Image src={mla.imgUrl} alt={`Photo of ${mla.fullName}`} width={40} height={40} className={styles.mlaPhoto} />
                  )}
                  <div className={styles.mlaInfo}>
                    <p className={styles.mlaName}>{stripHonorifics(mla.fullName)}</p>
                    <span className={styles.mlaParty} style={partyPillStyleSolid(mla.party)}>
                      {abbreviateParty(mla.party)}
                    </span>
                  </div>
                  <span className={styles.mlaChevron}>›</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
