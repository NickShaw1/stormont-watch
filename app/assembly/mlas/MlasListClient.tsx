'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { SearchX, CalendarX } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import { formatDate, formatMemberName, formatPartyName, abbreviateParty, partyBorderColor, formatConstituency } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { useDropdown } from '@/lib/useDropdown'
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

// Plain Drizzle select from getFormerMembers(); no attendance/role, has mandateEnd.
interface FormerMlaRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  mandateEnd: string | null
}

interface FormerPartyGroup {
  party: string
  mlas: FormerMlaRow[]
}

interface Props {
  partyGroups: PartyGroup[]
  roleLookup: Record<string, string>
  formerGroups: FormerPartyGroup[]
}

type GroupMode = 'party' | 'constituency' | 'former'

const MODE_LABELS: Record<GroupMode, string> = {
  party: 'By party',
  constituency: 'By constituency',
  former: 'Former MLAs',
}

function abbreviateRole(role: string): string {
  return role
    .replace(/\bPrincipal\b/g, 'Pr.')
}

export default function MlasListClient({ partyGroups, roleLookup, formerGroups }: Props) {
  const { basePath } = useMandate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [partyFilter, setPartyFilter] = useState<string>('ALL')
  const [groupMode, setGroupMode] = useState<GroupMode>('party')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeDropdown = useDropdown()
  const partyDropdown = useDropdown()

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (val && partyFilter !== 'ALL') setPartyFilter('ALL')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQuery(val), 150)
  }

  function handleModeChange(mode: GroupMode) {
    setGroupMode(mode)
    modeDropdown.setOpen(false)
  }

  function handlePartyFilter(party: string) {
    setPartyFilter(party)
    partyDropdown.setOpen(false)
  }

  const q = debouncedQuery.toLowerCase().trim()

  const totalMlas = partyGroups.reduce((sum, g) => sum + g.mlas.length, 0)

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

  const filteredByFormer = formerGroups
    .map((group) => ({
      ...group,
      mlas: q
        ? group.mlas.filter(
            (m) =>
              m.fullName.toLowerCase().includes(q) ||
              (m.constituency ?? '').toLowerCase().includes(q),
          )
        : group.mlas,
    }))
    .filter((group) => group.mlas.length > 0)

  const totalPartyMlas = filteredByParty.reduce((s, g) => s + g.mlas.length, 0)
  const totalConstMlas = filteredByConstituency.reduce((s, g) => s + g.mlas.length, 0)
  const totalFormerFiltered = filteredByFormer.reduce((s, g) => s + g.mlas.length, 0)

  return (
    <div className="container">
      <div className={styles.filterPanel}>
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
          <button
            aria-pressed={groupMode === 'former'}
            className={`${styles.partyFilterBtn} ${groupMode === 'former' ? `${styles.partyFilterBtnActive} ${styles.partyFilterBtnActiveAll}` : ''}`}
            onClick={() => handleModeChange('former')}
          >
            Former MLAs
          </button>
        </div>

        <div className={styles.modeDropdownWrap}>
          <div className={styles.dropdownWrap} ref={modeDropdown.wrapRef}>
            <button
              ref={modeDropdown.triggerRef}
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => modeDropdown.setOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={modeDropdown.open}
            >
              {MODE_LABELS[groupMode]}
              <svg
                className={`${styles.dropdownTriggerChevron} ${modeDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
                width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
              >
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {modeDropdown.open && (
              <ul ref={modeDropdown.listRef} className={styles.dropdownList} role="listbox">
                {(Object.keys(MODE_LABELS) as GroupMode[]).map((mode) => (
                  <li
                    key={mode}
                    role="option"
                    tabIndex={0}
                    aria-selected={mode === groupMode}
                    className={`${styles.dropdownItem} ${mode === groupMode ? styles.dropdownItemSelected : ''}`}
                    onClick={() => handleModeChange(mode)}
                    onKeyDown={(e) => modeDropdown.handleKeyDown(e, () => handleModeChange(mode))}
                  >
                    {MODE_LABELS[mode]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {groupMode === 'party' && (
          <>
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
                return (
                  <button
                    key={group.party}
                    aria-pressed={isActive}
                    className={`${styles.partyFilterBtn} ${isActive ? styles.partyFilterBtnActive : ''}`}
                    onClick={() => handlePartyFilter(group.party)}
                  >
                    {formatPartyName(group.party, true)}
                    <span className={styles.partyFilterCount}>
                      {group.mlas.length}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={styles.partyDropdownWrap}>
              <div className={styles.dropdownWrap} ref={partyDropdown.wrapRef}>
                <button
                  ref={partyDropdown.triggerRef}
                  type="button"
                  className={styles.dropdownTrigger}
                  onClick={() => partyDropdown.setOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={partyDropdown.open}
                >
                  {partyFilter === 'ALL' ? 'All parties' : formatPartyName(partyFilter, true)}
                  <svg
                    className={`${styles.dropdownTriggerChevron} ${partyDropdown.open ? styles.dropdownTriggerChevronOpen : ''}`}
                    width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"
                  >
                    <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {partyDropdown.open && (
                  <ul ref={partyDropdown.listRef} className={styles.dropdownList} role="listbox">
                    <li
                      role="option"
                      tabIndex={0}
                      aria-selected={partyFilter === 'ALL'}
                      className={`${styles.dropdownItem} ${partyFilter === 'ALL' ? styles.dropdownItemSelected : ''}`}
                      onClick={() => handlePartyFilter('ALL')}
                      onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => handlePartyFilter('ALL'))}
                    >
                      All
                      <span className={styles.dropdownItemCount}>{totalMlas}</span>
                    </li>
                    {partyGroups.map((group) => (
                      <li
                        key={group.party}
                        role="option"
                        tabIndex={0}
                        aria-selected={partyFilter === group.party}
                        className={`${styles.dropdownItem} ${partyFilter === group.party ? styles.dropdownItemSelected : ''}`}
                        onClick={() => handlePartyFilter(group.party)}
                        onKeyDown={(e) => partyDropdown.handleKeyDown(e, () => handlePartyFilter(group.party))}
                      >
                        {formatPartyName(group.party, true)}
                        <span className={styles.dropdownItemCount}>{group.mlas.length}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

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
            : groupMode === 'constituency'
            ? `${totalConstMlas} MLA${totalConstMlas !== 1 ? 's' : ''} found`
            : `${totalFormerFiltered} MLA${totalFormerFiltered !== 1 ? 's' : ''} found`
        )}
      </p>

      {groupMode === 'party' && (
        <>
          {filteredByParty.length === 0 && (
            <p className={styles.emptyState}>
              <SearchX className={styles.emptyStateIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              No MLAs match your search.
            </p>
          )}
          {filteredByParty.map((group, i) => (
            <section
              key={group.party}
              aria-labelledby={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              className={`${styles.partySection} ${i === filteredByParty.length - 1 ? styles.sectionLast : ''}`}
            >
              <div className={styles.partyHead}>
                <h2
                  id={`party-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                  className={styles.partyHeading}
                >
                  <span className={styles.partySwatch} style={{ background: partyBorderColor(group.party) }} aria-hidden="true" />
                  <span className={styles.partyNameFull}>{group.party}</span>
                  <span className={styles.partyNameShort} aria-hidden="true">{abbreviateParty(group.party)}</span>
                </h2>
                <span className={styles.partyCount}>{filteredByParty.find(g => g.party === group.party)?.mlas.length ?? group.mlas.length} MLAs</span>
              </div>
              <ul className={styles.mlaGrid} role="list">
                {group.mlas.map((mla) => (
                  <li key={mla.person_id} className={styles.mlaCardWrapper}>
                    <div className={styles.mlaCard}>
                      <div className={styles.mlaMain}>
                        <div className={styles.mlaPhoto}>
                          <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={64} decorative square personId={mla.person_id} />
                        </div>
                        <div className={styles.mlaInfo}>
                          <Link
                            href={`${basePath}/assembly/mlas/${mla.person_id}`}
                            className={styles.mlaName}
                            aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                          >
                            {formatMemberName(mla.full_name)}
                          </Link>
                          <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                          <span className={`${styles.mlaAtt} ${styles.mlaAttRow}`}>
                            Att. <strong>{mla.assembly_role === 'Speaker' && !mla.assembly_role_end ? 'n/a' : (mla.attendance_pct ?? 'n/a')}%</strong>
                          </span>
                        </div>
                      </div>
                      <div className={styles.mlaFoot}>
                        {mla.party && (
                          <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                        )}
                        {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                          <span className={styles.roleBadge}>
                            {mla.assembly_role && !mla.assembly_role_end ? abbreviateRole(mla.assembly_role) : roleLookup[mla.person_id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {groupMode === 'constituency' && (
        <>
          {filteredByConstituency.length === 0 && (
            <p className={styles.emptyState}>
              <SearchX className={styles.emptyStateIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              No MLAs match your search.
            </p>
          )}
          {filteredByConstituency.map(({ constituency, mlas }, i) => {
            const slugId = `constituency-${constituency.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`
            return (
              <section key={constituency} aria-labelledby={slugId} className={`${styles.partySection} ${i === filteredByConstituency.length - 1 ? styles.sectionLast : ''}`}>
                <div className={styles.partyHead}>
                  <h2 id={slugId} className={styles.partyHeading}>
                    <span className={styles.partySwatch} style={{ background: 'var(--sw-text-tertiary)' }} aria-hidden="true" />
                    <span>{formatConstituency(constituency)}</span>
                  </h2>
                  <span className={styles.partyCount}>{mlas.length} MLAs</span>
                </div>
                <ul className={styles.mlaGrid} role="list">
                  {mlas.map((mla) => (
                    <li key={mla.person_id} className={styles.mlaCardWrapper}>
                      <div className={styles.mlaCard}>
                        <div className={styles.mlaMain}>
                          <div className={styles.mlaPhoto}>
                            <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={64} decorative square personId={mla.person_id} />
                          </div>
                          <div className={styles.mlaInfo}>
                            <Link
                              href={`${basePath}/assembly/mlas/${mla.person_id}`}
                              className={styles.mlaName}
                              aria-label={`View profile for ${formatMemberName(mla.full_name)}`}
                            >
                              {formatMemberName(mla.full_name)}
                            </Link>
                            <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                            <span className={`${styles.mlaAtt} ${styles.mlaAttRow}`}>
                              Att. <strong>{mla.assembly_role === 'Speaker' && !mla.assembly_role_end ? 'n/a' : (mla.attendance_pct ?? 'n/a')}%</strong>
                            </span>
                          </div>
                        </div>
                        <div className={styles.mlaFoot}>
                          {mla.party && (
                            <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                          )}
                          {(roleLookup[mla.person_id] || (mla.assembly_role && !mla.assembly_role_end)) && (
                            <span className={styles.roleBadge}>
                              {mla.assembly_role && !mla.assembly_role_end ? abbreviateRole(mla.assembly_role) : roleLookup[mla.person_id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}

      {groupMode === 'former' && (
        <>
          {filteredByFormer.length === 0 && (
            <p className={styles.emptyState}>
              <SearchX className={styles.emptyStateIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              No former MLAs match your search.
            </p>
          )}
          {filteredByFormer.map((group, i) => (
            <section
              key={group.party}
              aria-labelledby={`former-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
              className={`${styles.partySection} ${i === filteredByFormer.length - 1 ? styles.sectionLast : ''}`}
            >
              <div className={styles.partyHead}>
                <h2
                  id={`former-${group.party.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                  className={styles.partyHeading}
                >
                  <span className={styles.partySwatch} style={{ background: partyBorderColor(group.party) }} aria-hidden="true" />
                  <span className={styles.partyNameFull}>{group.party}</span>
                  <span className={styles.partyNameShort} aria-hidden="true">{abbreviateParty(group.party)}</span>
                </h2>
                <span className={styles.partyCount}>{group.mlas.length} MLAs</span>
              </div>
              <ul className={styles.mlaGrid} role="list">
                {group.mlas.map((mla) => (
                  <li key={mla.personId} className={styles.mlaCardWrapper}>
                    <div className={styles.mlaCard}>
                      <div className={styles.mlaMain}>
                        <div className={styles.mlaPhoto}>
                          <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={64} decorative square personId={mla.personId} />
                        </div>
                        <div className={styles.mlaInfo}>
                          <Link
                            href={`${basePath}/assembly/mlas/${mla.personId}`}
                            className={styles.mlaName}
                            aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                          >
                            {formatMemberName(mla.fullName)}
                          </Link>
                          <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
                        </div>
                      </div>
                      <div className={styles.mlaFoot}>
                        {mla.party && (
                          <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                        )}
                        <span className={`${styles.mlaConstituency} ${styles.mlaLeftDate}`}>
                          <CalendarX className={styles.mlaLeftDateIcon} size={11} strokeWidth={1.75} aria-hidden="true" />
                          {mla.mandateEnd ? `Left ${formatDate(mla.mandateEnd)}` : 'Left Assembly'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
