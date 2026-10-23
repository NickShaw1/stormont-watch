'use client'

import { useState, useSyncExternalStore } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { abbreviateParty, partyBorderColor } from '@/lib/format'
import type { PartyAlignmentRow, PartyAgreedDivisions } from '@/lib/db/queries'
import DivisionList from './DivisionList'
import { rankRows } from './rankUtils'
import styles from './statsKit.module.css'

type Partner = 'sf' | 'dup'

const PARTNERS: { key: Partner; full: string }[] = [
  { key: 'sf', full: 'Sinn Féin' },
  { key: 'dup', full: 'DUP' },
]

interface Props {
  data: PartyAlignmentRow[]
  agreedDivisions: PartyAgreedDivisions[]
  basePath?: string
  totalDivisions: number
}

const short = (p: string) => (p === 'Independent' ? 'Independent' : abbreviateParty(p))
const PANEL = 'alliance-panel'

function useStacked() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(max-width: 1023px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(max-width: 1023px)').matches,
    () => false,
  )
}

export default function PartyAlliances({ data, agreedDivisions, basePath = '', totalDivisions }: Props) {
  const [open, setOpen] = useState<{ party: string; partner: Partner } | null>(null)
  const stacked = useStacked()

  const pct = (r: PartyAlignmentRow, k: Partner) => (k === 'sf' ? r.sfAgreePct : r.dupAgreePct)
  const count = (r: PartyAlignmentRow, k: Partner) => (k === 'sf' ? r.sfAgreed : r.dupAgreed)
  const toggle = (party: string, partner: Partner) =>
    setOpen((cur) => (cur && cur.party === party && cur.partner === partner ? null : { party, partner }))

  const openEntry = open ? agreedDivisions.find((a) => a.party === open.party) : undefined
  const openPartner = open ? PARTNERS.find((p) => p.key === open.partner)! : null
  const openDivisions = open ? (open.partner === 'sf' ? openEntry?.sfAgreed : openEntry?.dupAgreed) ?? [] : []

  const panel = (
    <div id={PANEL} className={styles.alPanel} role="region" aria-label={open ? `${short(open.party)} and ${openPartner!.full} divisions` : undefined} hidden={!open}>
      {open && openPartner && (
        <>
          <div className={styles.alPanelHead}>
            <h4 className={styles.alPanelTitle}>
              <i style={{ background: partyBorderColor(open.party) }} aria-hidden="true" />{short(open.party)} and {openPartner.full}
            </h4>
            <button type="button" className={styles.alClose} aria-label="Close divisions" onClick={() => setOpen(null)}>
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <DivisionList key={`${open.party}-${open.partner}`} wide partyA={short(open.party)} partyB={openPartner.full} divisions={openDivisions} basePath={basePath} total={totalDivisions} />
        </>
      )}
    </div>
  )

  return (
    <div className={styles.alTwo} data-partner={open?.partner}>
      {PARTNERS.map((p) => {
        const rows = rankRows([...data].sort((a, b) => pct(b, p.key) - pct(a, p.key)), (r) => pct(r, p.key))
        return (
          <section key={p.key} className={styles.alSection} data-p={p.key} aria-labelledby={`al-h-${p.key}`}>
            <h4 className={styles.alHead} id={`al-h-${p.key}`}>
              <i style={{ background: partyBorderColor(p.full) }} aria-hidden="true" />With {p.full}
            </h4>
            <p className={styles.alHint}>Select a party to see the divisions they agreed on.</p>
            <ol className={styles.alList} aria-label={`Parties ranked by agreement with ${p.full}`}>
              {rows.map((r) => {
                const isOpen = open?.party === r.party && open.partner === p.key
                return (
                  <li key={r.party}>
                    <button
                      type="button"
                      className={styles.alRow}
                      style={{ ['--bc' as string]: partyBorderColor(p.full), ['--pc' as string]: partyBorderColor(r.party) }}
                      aria-expanded={isOpen}
                      aria-controls={PANEL}
                      aria-label={`${r.rank}. ${short(r.party)} with ${p.full}: ${pct(r, p.key)}%, ${count(r, p.key)} of ${totalDivisions} divisions`}
                      onClick={() => toggle(r.party, p.key)}
                    >
                      <span className={styles.alRankNum} aria-hidden="true">{r.rank}</span>
                      <span className={styles.alName} aria-hidden="true"><i />{short(r.party)}</span>
                      <span className={styles.alTrack} aria-hidden="true"><span style={{ width: `${pct(r, p.key)}%` }} /></span>
                      <span className={styles.alPct} aria-hidden="true">{pct(r, p.key)}%</span>
                      <ChevronDown className={styles.alChev} size={20} strokeWidth={2} aria-hidden="true" />
                    </button>
                    {stacked && isOpen && panel}
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      {!stacked && panel}
    </div>
  )
}
