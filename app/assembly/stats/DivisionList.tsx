'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, XCircle, MinusCircle, ChevronDown, ListFilter } from 'lucide-react'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import type { AgreedDivisionRow } from '@/lib/db/queries'
import styles from './statsKit.module.css'

type Filter = 'ALL' | 'PASSED' | 'FAILED' | 'WINNING' | 'LOSING'

const LIMIT = 8

const VOTE_LABEL: Record<AgreedDivisionRow['sharedVote'], string> = { AYE: 'Aye', NO: 'No', ABSTAINED: 'Abstain', NO_SHOW: 'No show' }

interface Props {
  partyA: string
  partyB: string
  divisions: AgreedDivisionRow[]
  basePath?: string
  total?: number
  wide?: boolean
}

export default function DivisionList({ partyA, partyB, divisions, basePath = '', total, wide = false }: Props) {
  const { basePath: mandateBase } = useMandate()
  const base = basePath || mandateBase
  const [filter, setFilter] = useState<Filter>('ALL')
  const [showAll, setShowAll] = useState(false)

  const matched = divisions.filter((d) => d.wonOverall).length
  const against = divisions.length - matched
  const passedN = divisions.filter((d) => isPassed(d.outcome) === true).length
  const failedN = divisions.filter((d) => isPassed(d.outcome) === false).length
  const share = total ? Math.round((divisions.length / total) * 1000) / 10 : null
  const pct = divisions.length > 0 ? Math.round((matched / divisions.length) * 100) : 0
  const by = (v: AgreedDivisionRow['sharedVote']) => divisions.filter((d) => d.sharedVote === v).length
  const chips = (['AYE', 'NO', 'ABSTAINED', 'NO_SHOW'] as const).map((v) => ({ v, n: by(v), label: v === 'AYE' ? 'Both Aye' : v === 'NO' ? 'Both No' : v === 'ABSTAINED' ? 'Both abstain' : 'Both no show' }))

  const filters: { key: Filter; label: string; n: number; short?: string }[] = [
    { key: 'ALL', label: 'All', n: divisions.length },
    { key: 'PASSED', label: 'Passed', n: passedN },
    { key: 'FAILED', label: 'Failed', n: failedN },
    { key: 'WINNING', label: 'Winning side', n: matched, short: 'Winning' },
    { key: 'LOSING', label: 'Losing side', n: against, short: 'Losing' },
  ]

  const keep = (d: AgreedDivisionRow) => {
    if (filter === 'WINNING') return d.wonOverall
    if (filter === 'LOSING') return !d.wonOverall
    if (filter === 'PASSED') return isPassed(d.outcome) === true
    if (filter === 'FAILED') return isPassed(d.outcome) === false
    return true
  }
  const shown = divisions.filter(keep).slice().sort((a, b) => b.divisionDate.getTime() - a.divisionDate.getTime())

  const pick = (f: Filter) => { setFilter(f); setShowAll(false) }

  return (
    <div className={`${styles.dWrap} ${wide ? styles.dWide : ''}`}>
      <div className={styles.dSummary}>
        <div>
          <span className={styles.dBig}>{share !== null ? `${share}%` : divisions.length}</span>
          <p className={styles.dCaption}>{partyA} and {partyB} took the same position in {divisions.length}{total ? ` of ${total}` : ''} division{divisions.length === 1 ? '' : 's'}. They were on the winning side in {matched} ({pct}%).</p>
        </div>
        <div className={styles.dChips}>
          {chips.map((c) => (
            <span key={c.v} className={styles.dChip} data-vote={c.v} data-zero={c.n === 0 ? '' : undefined}><b>{c.n}</b><span>{c.label}</span></span>
          ))}
        </div>
      </div>

      <div className={`${styles.chipRow} ${styles.dFilterPills}`} role="group" aria-label="Filter divisions">
        {filters.map((f) => (
          <button key={f.key} type="button" className={styles.chipBtn} aria-pressed={filter === f.key} onClick={() => pick(f.key)}>
            <span className={styles.dPillLabel}>{f.label}</span><span className={styles.dPillShort} aria-hidden="true">{f.short ?? f.label}</span> <span className={styles.chipCount}>{f.n}</span>
          </button>
        ))}
      </div>
      <div className={styles.dFilterSheet}>
        <SheetSelect
          className={styles.phoneSwitch}
          options={filters.map((f) => ({ key: f.key, label: f.label, icon: ListFilter, meta: String(f.n), color: 'var(--sw-accent-solid)' }))}
          value={filter}
          onPick={(k) => pick(k as Filter)}
          eyebrow="Show"
          title="Filter divisions"
          headIcon={ListFilter}
        />
      </div>

      <ul className={styles.dList}>
        {shown.length === 0 && <li className={styles.dEmpty}>No divisions match this filter.</li>}
        {(showAll ? shown : shown.slice(0, LIMIT)).map((d) => {
          const { title } = formatDivisionSubject(d.title ?? d.subject)
          const passed = isPassed(d.outcome)
          const tone = passed === null ? 'none' : passed ? 'pass' : 'fail'
          const Icon = passed === null ? MinusCircle : passed ? CheckCircle2 : XCircle
          return (
            <li key={d.documentId}>
              <Link href={`${base}/assembly/divisions/${d.documentId}`} className={styles.dRow}>
                <span className={styles.dMain}>
                  <span className={styles.dResult} data-tone={tone}><Icon size={16} strokeWidth={2.25} aria-hidden="true" />{passed === null ? 'No result' : passed ? 'Passed' : 'Failed'}</span>
                  <span className={styles.dTitle}>{title}</span>
                  <span className={styles.dMeta}><span>{formatDate(d.divisionDate.toISOString())}</span><span className={styles.dSep}> · </span><span>{partyA} and {partyB} voted <b className={styles.dVote} data-vote={d.sharedVote}>{VOTE_LABEL[d.sharedVote]}</b></span></span>
                </span>
                <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
      {shown.length > LIMIT && (
        <button type="button" className={styles.expandBtn} aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          <span className={styles.swapLabel}><span data-on={!showAll ? '' : undefined}>{`Show all ${shown.length}`}</span><span data-on={showAll ? '' : undefined}>Show fewer</span></span>
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
