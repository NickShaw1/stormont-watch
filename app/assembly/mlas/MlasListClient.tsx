'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, formatPartyName, abbreviateParty, partyBorderColor, partyFilterActiveStyle, formatConstituency } from '@/lib/format'
import styles from './mlas.module.css'

interface MlaRow {
  person_id: string
  full_name: string
  party: string | null
  constituency: string | null
  img_url: string | null
  assembly_role: string | null
  assembly_role_end: string | null
  attendance_pct: number | null
}

interface PartyGroup {
  party: string
  mlas: MlaRow[]
}

interface Props {
  partyGroups: PartyGroup[]
  roleLookup: Record<string, string>
}

const MOBILE_PAGE_SIZE = 25

function abbreviateRole(role: string): string {
  return role
    .replace(/\bPrincipal\b/g, 'Pr.')
}

export default function MlasListClient({ partyGroups, roleLookup }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const [groupMode, setGroupMode] = useState<'party' | 'constituency'>('party')
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (val && partyFilter !== 'ALL') setPartyFilter('ALL')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQuery(val), 150)
    setVisibleCount(MOBILE_PAGE_SIZE)
  }

  function handleModeChange(mode: 'party' | 'constituency') {
    setGroupMode(mode)
    setVisibleCount(MOBILE_PAGE_SIZE)
  }

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
    setVisibleCount(MOBILE_PAGE_SIZE)
  }

  const q = debouncedQuery.toLowerCase().trim()

  const totalMlas = partyGroups.reduce((sum, g) => sum + g.mlas.length, 0)

  // Party mode: existing logic
  const filteredByParty = (partyFilter === 'ALL' ? partyGroups : partyGroups.filter((g) => g.party === partyFilter))
    .map((group) => ({
      ...group,
      mlas: q
        ? group.mlas.filter(
            (m) =>
              m.full_name.toLowerCase().includes(q) ||
              (m.constituency ?? '').toLowerCase().includes(q),
          )
        : group.mlas,
    }))
    .filter((group) => group.mlas.length > 0)

  // Constituency mode: flatten, group, sort
  const filteredByConstituency = (() => {
    const allMlas = partyGroups.flatMap((g) => g.mlas)
    const filtered = q
      ? allMlas.filter(
          (m) =>
            m.full_name.toLowerCase().includes(q) ||
            (m.constituency ?? '').toLowerCase().includes(q),
        )
      : allMlas
    const map = new Map<string, MlaRow[]>()
    for (const mla of filtered) {
      const key = mla.constituency ?? 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(mla)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([constituency, mlas]) => ({
        constituency,
        mlas: [...mlas].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      }))
  })()

  // Paginated party groups — slice flat MLA list then reconstruct groups
  const allPartyMlas = filteredByParty.flatMap((g) => g.mlas.map((m) => ({ ...m, _party: g.party })))
  const visiblePartyMlas = new Set(allPartyMlas.slice(0, visibleCount).map((m) => m.person_id))
  const paginatedByParty = filteredByParty
    .map((g) => ({ ...g, mlas: g.mlas.filter((m) => visiblePartyMlas.has(m.person_id)) }))
    .filter((g) => g.mlas.length > 0)
  const totalPartyMlas = allPartyMlas.length

  // Paginated constituency groups
  const allConstMlas = filteredByConstituency.flatMap((g) => g.mlas.map((m) => ({ ...m, _constituency: g.constituency })))
  const visibleConstMlas = new Set(allConstMlas.slice(0, visibleCount).map((m) => m.person_id))
  const paginatedByConstituency = filteredByConstituency
    .map((g) => ({ ...g, mlas: g.mlas.filter((m) => visibleConstMlas.has(m.person_id)) }))
    .filter((g) => g.mlas.length > 0)
  const totalConstMlas = allConstMlas.length

  return (
    <div className="container">
      <div className={styles.modeChips}>
        <button
          aria-pressed={groupMode === 'party'}
          className={`${styles.partyFilterBtn} ${groupMode === 'party' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
          onClick={() => handleModeChange('party')}
        >
          By Party
        </button>
        <button
          aria-pressed={groupMode === 'constituency'}
          className={`${styles.partyFilterBtn} ${groupMode === 'constituency' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
          onClick={() => handleModeChange('constituency')}
        >
          By Constituency
        </button>
      </div>

      {groupMode === 'party' && (
        <div className={styles.partyFilter}>
          <button
            aria-pressed={partyFilter === 'ALL'}
            className={`${styles.partyFilterBtn} ${partyFilter === 'ALL' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
            onClick={() => handlePartyFilter('ALL')}
          >
            All
            <span className={styles.partyFilterCount}>{totalMlas}</span>
          </button>
          {partyGroups.map((group) => {
            const isActive = partyFilter === group.party
            const activeStyle = isActive ? partyFilterActiveStyle(group.party) : null
            return (
              <button
                key={group.party}
                aria-pressed={isActive}
                className={`${styles.partyFilterBtn} ${isActive ? styles.partyFilterBtnActive : ''}`}
                style={activeStyle ? {
                  background: activeStyle.background,
                  color: activeStyle.color,
                  borderColor: activeStyle.borderColor,
                } : undefined}
                onClick={() => handlePartyFilter(group.party)}
              >
                {formatPartyName(group.party, true)}
                <span
                  className={styles.partyFilterCount}
                  style={activeStyle ? {
                    background: activeStyle.countBg,
                    color: activeStyle.countColor,
                    borderColor: activeStyle.borderColor,
                  } : undefined}
                >
                  {group.mlas.length}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.searchWrap}>
        <label htmlFor="mla-search" className="sr-only">Search MLAs</label>
        <input
          id="mla-search"
          type="search"
          placeholder="Search by name or constituency…"
          value={query}
          onChange={handleSearch}
          className={styles.search}
        />
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {(q || partyFilter !== 'ALL') && (
          groupMode === 'party'
            ? `${totalPartyMlas} MLA${totalPartyMlas !== 1 ? 's' : ''} found`
            : `${totalConstMlas} MLA${totalConstMlas !== 1 ? 's' : ''} found`
        )}
      </p>

      {groupMode === 'party' && (
        <>
          {paginatedByParty.length === 0 && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-3)', fontStyle: 'italic' }}>No MLAs match your search.</p>
          )}
          {paginatedByParty.map((group) => (
            <section
              key={group.party}
              aria-labelledby={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              className={styles.partySection}
            >
              <h2
                id={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                className={styles.partyHeading}
              >
                <span className={styles.partySwatch} style={{ background: partyBorderColor(group.party) }} aria-hidden="true" />
                <span className={styles.partyNameFull}>{group.party}</span>
                <span className={styles.partyNameShort} aria-hidden="true">{abbreviateParty(group.party)}</span>
                <span className={styles.partyCount}>{filteredByParty.find(g => g.party === group.party)?.mlas.length ?? group.mlas.length} MLAs</span>
              </h2>
              <ul className={styles.mlaGrid} role="list">
                {group.mlas.map((mla) => (
                  <li key={mla.person_id} className={styles.mlaCardWrapper}>
                    <div className={styles.mlaCard} style={{ '--party-c': partyBorderColor(mla.party) } as React.CSSProperties}>
                      {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                        <span className={styles.roleBadge}>
                          {mla.assembly_role && !mla.assembly_role_end ? abbreviateRole(mla.assembly_role) : roleLookup[mla.person_id]}
                        </span>
                      )}
                      <div className={styles.mlaPhoto}>
                        <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={64} decorative />
                      </div>
                      <Link
                        href={`/assembly/mlas/${mla.person_id}`}
                        className={styles.mlaName}
                        aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                      >
                        {formatMemberName(mla.full_name)}
                      </Link>
                      <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                      <div className={styles.mlaFoot}>
                        <span className={styles.mlaAtt}>
                          Att. <strong>{mla.assembly_role && !mla.assembly_role_end ? '—' : (mla.attendance_pct ?? '—')}%</strong>
                        </span>
                        {mla.party && (
                          <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {visibleCount < totalPartyMlas && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreBtn} onClick={() => setVisibleCount(v => v + MOBILE_PAGE_SIZE)}>
                Load more ({totalPartyMlas - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {groupMode === 'constituency' && (
        <>
          {paginatedByConstituency.length === 0 && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-3)', fontStyle: 'italic' }}>No MLAs match your search.</p>
          )}
          {paginatedByConstituency.map(({ constituency, mlas }) => {
            const slugId = `constituency-${constituency.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
            return (
              <section key={constituency} aria-labelledby={slugId} className={styles.partySection}>
                <h2 id={slugId} className={styles.partyHeading}>
                  <span className={styles.partySwatch} style={{ background: 'var(--ink-4)' }} aria-hidden="true" />
                  <span>{formatConstituency(constituency)}</span>
                </h2>
                <ul className={styles.mlaGrid} role="list">
                  {mlas.map((mla) => (
                    <li key={mla.person_id} className={styles.mlaCardWrapper}>
                      <div className={styles.mlaCard} style={{ '--party-c': partyBorderColor(mla.party) } as React.CSSProperties}>
                        {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                          <span className={styles.roleBadge}>
                            {mla.assembly_role && !mla.assembly_role_end ? abbreviateRole(mla.assembly_role) : roleLookup[mla.person_id]}
                          </span>
                        )}
                        <div className={styles.mlaPhoto}>
                          <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={64} decorative />
                        </div>
                        <Link
                          href={`/assembly/mlas/${mla.person_id}`}
                          className={styles.mlaName}
                          aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                        >
                          {formatMemberName(mla.full_name)}
                        </Link>
                        <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                        <div className={styles.mlaFoot}>
                          <span className={styles.mlaAtt}>
                            Att. <strong>{mla.assembly_role && !mla.assembly_role_end ? '—' : (mla.attendance_pct ?? '—')}%</strong>
                          </span>
                          {mla.party && (
                            <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {visibleCount < totalConstMlas && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreBtn} onClick={() => setVisibleCount(v => v + MOBILE_PAGE_SIZE)}>
                Load more ({totalConstMlas - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
