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
  roleLookupFull: Record<string, string>
}

export default function MlasListClient({ partyGroups, roleLookup, roleLookupFull }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const [groupMode, setGroupMode] = useState<'party' | 'constituency'>('party')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (val && partyFilter !== 'ALL') setPartyFilter('ALL')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQuery(val), 150)
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

  return (
    <div className="container">
      <div className={styles.modeChips}>
        <button
          aria-pressed={groupMode === 'party'}
          className={`${styles.partyFilterBtn} ${groupMode === 'party' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
          onClick={() => setGroupMode('party')}
        >
          By Party
        </button>
        <button
          aria-pressed={groupMode === 'constituency'}
          className={`${styles.partyFilterBtn} ${groupMode === 'constituency' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
          onClick={() => setGroupMode('constituency')}
        >
          By Constituency
        </button>
      </div>

      {groupMode === 'party' && (
        <div className={styles.partyFilter}>
          <button
            aria-pressed={partyFilter === 'ALL'}
            className={`${styles.partyFilterBtn} ${partyFilter === 'ALL' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
            onClick={() => setPartyFilter('ALL')}
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
                onClick={() => setPartyFilter(group.party)}
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

      <hr className={styles.searchRule} />

      {groupMode === 'party' && (
        <>
          {filteredByParty.length === 0 && (
            <p className="text-secondary">No MLAs match your search.</p>
          )}
          {filteredByParty.map((group, i) => (
            <React.Fragment key={group.party}>
            {i > 0 && <hr className={styles.sectionRule} />}
            <section
              aria-labelledby={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              className={styles.partySection}
            >
              <h2
                id={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                style={{ borderLeft: `4px solid ${partyBorderColor(group.party)}` }}
                className={`${styles.partyHeading}${group.party === 'Independent' ? ` ${styles.partyHeadingInd}` : ''}`}
              >
                <span className={styles.partyNameFull}>{group.party}</span>
                <span className={styles.partyNameShort} aria-hidden="true">{abbreviateParty(group.party)}</span>
                <span className={styles.partyCount}>{group.mlas.length}</span>
              </h2>
              <ul className={styles.mlaGrid} role="list">
                {group.mlas.map((mla) => (
                  <li key={mla.person_id} className={styles.mlaCardWrapper} style={{ '--party-color': partyBorderColor(mla.party) } as React.CSSProperties}>
                    {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                      <div className={styles.mlaRoleBanner}>
                        {mla.assembly_role && !mla.assembly_role_end ? mla.assembly_role : roleLookupFull[mla.person_id]}
                      </div>
                    )}
                    <div
                      className={styles.mlaCard}
                    >
                      <MlaPhoto
                        name={mla.full_name}
                        imgUrl={mla.img_url ?? ''}
                        size={100}
                        decorative
                      />
                      <Link
                        href={`/assembly/mlas/${mla.person_id}`}
                        className={styles.mlaName}
                        aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                      >
                        {formatMemberName(mla.full_name)}
                      </Link>
                      <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                      <div className={styles.mlaRoleSlot}>
                        {(roleLookup[mla.person_id] || mla.assembly_role) && (
                          <span className={styles.roleBadge}>
                            {mla.assembly_role ?? roleLookup[mla.person_id]}
                          </span>
                        )}
                      </div>
                      <span
                        className={styles.attendanceBadge}
                        style={
                          mla.attendance_pct !== null && !(mla.assembly_role && !mla.assembly_role_end)
                            ? { color: mla.attendance_pct >= 80 ? '#065F46' : mla.attendance_pct >= 60 ? '#92400E' : '#991B1B' }
                            : undefined
                        }
                        aria-label={
                          mla.assembly_role && !mla.assembly_role_end
                            ? 'Attendance data not available'
                            : `${mla.attendance_pct ?? 0}% voting attendance`
                        }
                      >
                        {mla.assembly_role && !mla.assembly_role_end
                          ? '— voting attendance'
                          : `${mla.attendance_pct ?? '—'}% voting attendance`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            </React.Fragment>
          ))}
        </>
      )}

      {groupMode === 'constituency' && (
        <>
          {filteredByConstituency.length === 0 && (
            <p className="text-secondary">No MLAs match your search.</p>
          )}
          {filteredByConstituency.map(({ constituency, mlas }, i) => {
            const slugId = `constituency-${constituency.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
            return (
              <React.Fragment key={constituency}>
              {i > 0 && <hr className={styles.sectionRule} />}
              <section
                aria-labelledby={slugId}
                className={styles.partySection}
              >
                <h2
                  id={slugId}
                  style={{ borderLeft: '4px solid var(--border)' }}
                  className={styles.partyHeading}
                >
                  <span>{formatConstituency(constituency)}</span>
                </h2>
                <ul className={styles.mlaGrid} role="list">
                  {mlas.map((mla) => (
                    <li key={mla.person_id} className={styles.mlaCardWrapper} style={{ '--party-color': partyBorderColor(mla.party) } as React.CSSProperties}>
                      {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                        <div className={styles.mlaRoleBanner}>
                          {mla.assembly_role && !mla.assembly_role_end ? mla.assembly_role : roleLookupFull[mla.person_id]}
                        </div>
                      )}
                      <div
                        className={styles.mlaCard}
                      >
                        <MlaPhoto
                          name={mla.full_name}
                          imgUrl={mla.img_url ?? ''}
                          size={100}
                          decorative
                        />
                        <Link
                          href={`/assembly/mlas/${mla.person_id}`}
                          className={styles.mlaName}
                          aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                        >
                          {formatMemberName(mla.full_name)}
                        </Link>
                        <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                        <div className={styles.mlaRoleSlot}>
                          {mla.party && (
                            <span className={styles.partyPill} data-party={abbreviateParty(mla.party)}>
                              {abbreviateParty(mla.party)}
                            </span>
                          )}
                          {(roleLookup[mla.person_id] || mla.assembly_role) && (
                            <span className={styles.roleBadge}>
                              {(mla.assembly_role ?? roleLookup[mla.person_id]).replace(/Junior Minister/gi, 'Jr. Min')}
                            </span>
                          )}
                        </div>
                        <span
                          className={styles.attendanceBadge}
                          style={
                            mla.attendance_pct !== null && !(mla.assembly_role && !mla.assembly_role_end)
                              ? { color: mla.attendance_pct >= 80 ? '#065F46' : mla.attendance_pct >= 60 ? '#92400E' : '#991B1B' }
                              : undefined
                          }
                          aria-label={
                            mla.assembly_role && !mla.assembly_role_end
                              ? 'Attendance data not available'
                              : `${mla.attendance_pct ?? 0}% attendance`
                          }
                        >
                          {mla.assembly_role && !mla.assembly_role_end
                            ? '— attendance'
                            : `${mla.attendance_pct ?? '—'}% attendance`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              </React.Fragment>
            )
          })}
        </>
      )}
    </div>
  )
}
