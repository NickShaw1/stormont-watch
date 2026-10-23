'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Flag, X } from 'lucide-react'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import { formatMemberName, abbreviateParty, partyBorderColor, formatConstituency, orderedParties } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import styles from './statsKit.module.css'

export interface RankRow {
  id: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  value: number
  display: string
  rank: string | number | null
  note?: string
  service?: string
}

interface Props {
  rows: RankRow[]
  ariaLabel: string
  countSuffix?: string
  toolbar?: React.ReactNode
  note?: React.ReactNode
  after?: (activeParty: string) => React.ReactNode
  dirty?: boolean
  onClear?: () => void
  showService?: boolean
  filterable?: boolean
  partyOptions?: string[]
}

const partyShort = (p: string) => abbreviateParty(p) || p

export default function RankingList({ rows, ariaLabel, countSuffix = '', toolbar, note, after, dirty = false, onClear, showService = false, filterable = true, partyOptions }: Props) {
  const { basePath } = useMandate()
  const [party, setParty] = useState('ALL')
  const parties = partyOptions ?? orderedParties(rows)
  const active = party === 'ALL' || parties.includes(party) ? party : 'ALL'
  const shown = active === 'ALL' ? rows : rows.filter((r) => r.party === active)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const counts = new Map(parties.map((p) => [p, rows.filter((r) => r.party === p).length]))

  return (
    <div className={styles.rlWrap}>
      {(toolbar || filterable) && (
        <div className={styles.rlToolbar}>
          {toolbar}
          {filterable && parties.length > 1 && (
            <div className={styles.rlField}>
              <span className={styles.rlFieldLabel}>Party</span>
              <div className={`${styles.chipRow} ${styles.rlChips}`} role="group" aria-label="Filter by party">
                <button type="button" className={styles.chipBtn} aria-pressed={active === 'ALL'} onClick={() => setParty('ALL')}>
                  All<span className={`${styles.chipCount} ${styles.chipCountAll}`}>{rows.length}</span>
                </button>
                {parties.map((p) => (
                  <button key={p} type="button" className={styles.chipBtn} aria-pressed={active === p} title={p} disabled={(counts.get(p) ?? 0) === 0 && active !== p} onClick={() => setParty(p)}>
                    <i className={styles.chipDot} style={{ background: partyBorderColor(p) }} aria-hidden="true" />
                    {partyShort(p)}<span className={styles.chipCount}>{counts.get(p)}</span>
                  </button>
                ))}
              </div>
              <div className={styles.rlSheet}>
                <SheetSelect
                  className={styles.phoneSwitch}
                  options={[
                    { key: 'ALL', label: 'All parties', icon: Flag, meta: `${rows.length}`, color: 'var(--sw-accent-solid)' },
                    ...parties.filter((p) => (counts.get(p) ?? 0) > 0 || active === p).map((p) => ({ key: p, label: partyShort(p), icon: Flag, meta: `${counts.get(p)}`, color: partyBorderColor(p) })),
                  ]}
                  value={active}
                  onPick={setParty}
                  eyebrow="Party"
                  title="Filter by party"
                  headIcon={Flag}
                />
              </div>
            </div>
          )}
          <div className={styles.rlCountRow}>
            <p className={styles.rlCount} aria-live="polite" aria-atomic="true">
              <strong>{shown.length}</strong> {active === 'ALL' ? '' : `${partyShort(active)} `}MLA{shown.length !== 1 ? 's' : ''}{countSuffix}
            </p>
            {(active !== 'ALL' || dirty) && (
              <button type="button" className={styles.rlClear} onClick={() => { setParty('ALL'); onClear?.() }}>
                <X size={16} strokeWidth={2} aria-hidden="true" />Clear filters
              </button>
            )}
          </div>
          {note}
        </div>
      )}

      <ol className={styles.rlList} aria-label={ariaLabel}>
        {shown.map((r) => (
          <li key={r.id} className={`${styles.rlRow} ${showService ? styles.rlWithService : ''}`} style={{ ['--pc' as string]: partyBorderColor(r.party) }}>
            <span className={styles.rlRank}>{r.rank ?? '-'}</span>
            <span className={styles.rankPhoto}><MlaPhoto name={r.fullName} imgUrl={r.imgUrl ?? ''} size={128} decorative square personId={r.id} /></span>
            <span className={styles.rlWho}>
              <Link href={`${basePath}/assembly/mlas/${r.id}`} className={styles.rlName}>{formatMemberName(r.fullName)}</Link>
              {r.note && <span className={styles.rlNote}>{r.note}</span>}
              <span className={styles.rlMeta}>
                {r.party && <span className="party-pill" data-party={abbreviateParty(r.party)}><PartyName party={r.party} /></span>}
              </span>
              <span className={styles.rlMetaPhone}>
                {r.party && <i style={{ background: partyBorderColor(r.party) }} aria-hidden="true" />}
                <span>{r.party ? abbreviateParty(r.party) : ''}</span>
              </span>
            </span>
            <span className={styles.rlConst}>{r.constituency ? formatConstituency(r.constituency) : '-'}</span>
            {showService && <span className={styles.rlService}>{r.service ? `${r.service} service` : '-'}</span>}
            <span className={styles.rlValue}>
              <b className={styles.rlNum} data-muted={r.value === 0 ? '' : undefined}>{r.display}</b>
              {r.value > 0 && <span className={styles.rlBar} aria-hidden="true"><i style={{ width: `${Math.round((r.value / max) * 100)}%` }} /></span>}
            </span>
          </li>
        ))}
      </ol>
      {after?.(active)}
    </div>
  )
}
