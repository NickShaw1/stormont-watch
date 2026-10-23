import Link from 'next/link'
import { CheckCircle2, GitCompareArrows, Ruler, ArrowRight, Vote, XCircle, Scale, Megaphone, Stamp } from 'lucide-react'
import { getAllDivisionsForList, getDivisionPartyVotes } from '@/lib/db/queries'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import VotesListClient from './VotesListClient'
import type { VoteItem } from './VotesListClient'
import Breakdown, { type BreakdownSet } from './Breakdown'
import { VotesFiltersProvider } from './VotesFilters'
import type { FilterDim } from './VotesFilters'
import styles from './votes.module.css'
import type { Mandate } from '@/lib/constants/mandates'

const side = (a: number, n: number) => (a > n ? 'aye' : a < n ? 'no' : 'level')
const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function VotesPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const rows = await getAllDivisionsForList(mandate.id)

  const classOf = (d: (typeof rows)[number]): VoteItem['crossClass'] => {
    if (d.divisionType !== 'Cross-Community') return undefined
    if (d.nationalistAyes == null || d.nationalistNoes == null || d.unionistAyes == null || d.unionistNoes == null) return undefined
    const a = side(d.nationalistAyes, d.nationalistNoes)
    const b = side(d.unionistAyes, d.unionistNoes)
    if (a === 'level' || b === 'level') return 'level'
    if (a === 'aye' && b === 'aye') return 'both'
    if (a === 'no' && b === 'no') return 'against'
    return 'divided'
  }

  const allItems: VoteItem[] = rows.map((d) => {
    const statutory = /^The draft /i.test(d.title ?? '') || /^Prayer of Annulment:/i.test(d.title ?? '') || /^Applicability Motion/i.test(d.title ?? '')
    return {
      key: d.documentId,
      href: `${basePath}/assembly/divisions/${d.documentId}`,
      rawTitle: d.title ?? null,
      subject: d.subject ?? '',
      latestDate: d.divisionDate.toISOString(),
      passed: isPassed(d.outcome ?? null),
      outcome: d.outcome ?? null,
      motionText: d.motionText ?? null,
      isStatutory: statutory,
      isBill: !statutory && (/NIA Bill/i.test(d.subject ?? '') || /(?:First|Second|Committee|Consideration|Further Consideration|Final) Stage:/i.test(d.subject ?? '')),
      isCrossCommunity: d.divisionType === 'Cross-Community',
      totalAyes: d.totalAyes ?? null,
      totalNoes: d.totalNoes ?? null,
      crossClass: classOf(d),
    }
  })

  const total = allItems.length
  const passedCount = allItems.filter(i => i.passed === true).length
  const failedCount = allItems.filter(i => i.passed === false).length
  const decided = passedCount + failedCount
  const passRate = pctOf(passedCount, decided)

  const counted = allItems.filter(i => (i.totalAyes ?? 0) + (i.totalNoes ?? 0) > 0)
  const gap = (i: VoteItem) => Math.abs((i.totalAyes ?? 0) - (i.totalNoes ?? 0))
  const turnout = (i: VoteItem) => (i.totalAyes ?? 0) + (i.totalNoes ?? 0)
  const closest = counted.reduce<VoteItem | null>((b, i) => (b === null || gap(i) < gap(b) || (gap(i) === gap(b) && turnout(i) > turnout(b)) ? i : b), null)

  const split = { both: 0, divided: 0, against: 0, level: 0 }
  for (const i of allItems) if (i.crossClass) split[i.crossClass]++
  const crossTotal = split.both + split.divided + split.against + split.level

  const typeCount = (t: 'bill' | 'motion' | 'regs') =>
    allItems.filter(i => (t === 'bill' ? i.isBill : t === 'regs' ? i.isStatutory : !i.isBill && !i.isStatutory)).length
  const years = [...new Set(allItems.map(i => i.latestDate.slice(0, 4)))].sort()

  const make = (id: string, label: string, dim: FilterDim, setTotal: number, segs: { key: string; value: string; label: string; count: number; colour: string; detail: (n: number) => string }[]): BreakdownSet => ({
    id,
    label,
    dim,
    total: setTotal,
    segments: segs.map(s => ({ key: s.key, value: s.value, label: s.label, count: s.count, pct: pctOf(s.count, setTotal), colour: s.colour, detail: s.detail(s.count) })),
  })

  const sets: BreakdownSet[] = [
    make('outcome', 'Outcome', 'result', decided, [
      { key: 'passed', value: 'PASSED', label: 'Passed', count: passedCount, colour: 'var(--sw-success-solid)', detail: n => `${n} of ${decided} divisions passed.` },
      { key: 'failed', value: 'FAILED', label: 'Failed', count: failedCount, colour: 'var(--sw-error-solid)', detail: n => `${n} of ${decided} divisions failed.` },
    ]),
    make('type', 'Type', 'type', total, [
      { key: 'bills', value: 'BILLS', label: 'Bills', count: typeCount('bill'), colour: 'var(--c-purple)', detail: n => `${n} of ${total} divisions were on bills and their amendments.` },
      { key: 'motions', value: 'MOTIONS', label: 'Motions', count: typeCount('motion'), colour: 'var(--sw-accent-solid)', detail: n => `${n} of ${total} divisions were on motions and their amendments.` },
      { key: 'regs', value: 'REGULATIONS', label: 'Regulations', count: typeCount('regs'), colour: 'var(--c-pink)', detail: n => `${n} of ${total} divisions were on draft regulations and statutory rules.` },
    ]),
    make('year', 'Year', 'year', total, years.map((y, i) => ({
      key: y,
      value: y,
      label: y,
      count: allItems.filter(it => it.latestDate.startsWith(y)).length,
      colour: `color-mix(in srgb, var(--sw-accent-solid) ${Math.round(40 + (years.length > 1 ? (i / (years.length - 1)) * 60 : 60))}%, var(--tile-bg))`,
      detail: (n: number) => `${n} of ${total} divisions were held in ${y}.`,
    }))),
    make('cross', 'Cross-community', 'cross', crossTotal, [
      { key: 'both', value: 'both', label: 'Both sides in favour', count: split.both, colour: 'var(--sw-success-solid)', detail: n => `${n} of ${crossTotal} cross-community votes had both designations voting Aye.` },
      { key: 'divided', value: 'divided', label: 'Divided', count: split.divided, colour: 'var(--sw-accent-warm)', detail: n => `${n} of ${crossTotal} cross-community votes had one designation for, one against.` },
      { key: 'against', value: 'against', label: 'Both sides against', count: split.against, colour: 'var(--sw-error-solid)', detail: n => `${n} of ${crossTotal} cross-community votes had both designations voting No.` },
      { key: 'level', value: 'level', label: 'Level', count: split.level, colour: 'var(--sw-text-tertiary)', detail: n => `${n} of ${crossTotal} cross-community votes had a designation split evenly.` },
    ]),
  ]

  const latest = allItems[0] ?? null
  const latestTitle = latest ? formatDivisionSubject(latest.rawTitle ?? latest.subject) : null
  const lAyes = latest?.totalAyes ?? 0
  const lNoes = latest?.totalNoes ?? 0
  const lTotal = lAyes + lNoes
  const latestVotes = latest ? await getDivisionPartyVotes(latest.key, mandate.id) : []
  const ledgerTotal = Math.max(1, lAyes + lNoes + (latestVotes.reduce((s, p) => s + p.ABSTAINED + p.NO_SHOW, 0)))
  const ledger = [
    { tone: 'aye', label: 'Aye', n: lAyes },
    { tone: 'no', label: 'No', n: lNoes },
    { tone: 'abstain', label: 'Abstained', n: latestVotes.reduce((s, p) => s + p.ABSTAINED, 0) },
    { tone: 'none', label: 'Did not vote', n: latestVotes.reduce((s, p) => s + p.NO_SHOW, 0) },
  ].map(r => ({ ...r, pct: Math.round((r.n / ledgerTotal) * 100) }))

  const closestTitle = closest ? formatDivisionSubject(closest.rawTitle ?? closest.subject).title : ''

  return (
    <VotesFiltersProvider>
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage} ${styles.intro}`} aria-labelledby="votes-title">
        <div className="container">
          <div className={styles.introInner}>
            <header className={styles.head}>
              <span className={styles.eyebrow}>The vote record</span>
              <h1 className={styles.h1} id="votes-title">Votes</h1>
              <p className={styles.headSub}>Every recorded division in the Assembly since {mandate.startLabel}, including cross-community votes, opposition motions and bill stages. Select a vote for the full breakdown: party and designation splits, and how each MLA voted.</p>
            </header>

            <ul className={styles.headline} aria-label="Headline figures">
              <li className={styles.hItem}>
                <div className={styles.hHead}>
                  <span className={`${styles.iconTile} ${styles.tnBlue}`}><Vote size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.hLabel}>Divisions</span>
                </div>
                <span className={styles.hFigure}>{total}</span>
                <span className={styles.hSub}>recorded since {mandate.startLabel}</span>
              </li>
              <li className={styles.hItem}>
                <div className={styles.hHead}>
                  <span className={`${styles.iconTile} ${styles.tnGreen}`}><CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.hLabel}>Passed</span>
                </div>
                <span className={styles.hFigure}>{passRate}<small className={styles.hPct}>%</small></span>
                <span className={styles.hSub}>{passedCount} passed, {failedCount} failed</span>
              </li>
              <li className={styles.hItem}>
                <div className={styles.hHead}>
                  <span className={`${styles.iconTile} ${styles.tnAmber}`}><GitCompareArrows size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.hLabel}>Cross-community</span>
                </div>
                <span className={styles.hFigure}>{crossTotal}</span>
                <span className={styles.hSub}>{split.both} backed by both sides</span>
              </li>
              {closest && (
                <li className={`${styles.hItem} ${styles.hLink}`}>
                  <div className={styles.hHead}>
                    <span className={`${styles.iconTile} ${styles.tnPurple}`}><Ruler size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.hLabel}>Closest vote</span>
                  </div>
                  <span className={styles.hFigure}>{Math.max(closest.totalAyes ?? 0, closest.totalNoes ?? 0)} to {Math.min(closest.totalAyes ?? 0, closest.totalNoes ?? 0)}</span>
                  <Link href={closest.href} className={styles.hAnchor}>{closestTitle}<span className="sr-only">, {formatDate(closest.latestDate)}</span></Link>
                  <ArrowRight className={styles.hArrow} size={18} strokeWidth={2} aria-hidden="true" />
                </li>
              )}
            </ul>

            <div className={styles.lowerRow}>
              <Breakdown sets={sets} />

              {latest && latestTitle && (
                <Link href={latest.href} className={`${styles.tile} ${styles.spot}`} data-tone={latest.passed === null ? 'none' : latest.passed ? 'pass' : 'fail'}>
                  <div className={styles.spotTop}>
                    <div className={styles.spotHeadLeft}>
                      <span className={`${styles.iconTile} ${latest.isBill ? styles.tnPurple : latest.isStatutory ? styles.tnPink : styles.tnBlue}`}>
                        {latest.isBill ? <Scale size={22} strokeWidth={2} aria-hidden="true" /> : latest.isStatutory ? <Stamp size={22} strokeWidth={2} aria-hidden="true" /> : <Megaphone size={22} strokeWidth={2} aria-hidden="true" />}
                      </span>
                      <div className={styles.spotHeadText}>
                        <h2 className={styles.spotEyebrow} id="latest-heading">
                          Latest vote<span aria-hidden="true"> · </span><time dateTime={latest.latestDate.slice(0, 10)}>{formatDate(latest.latestDate)}</time>
                        </h2>
                        <p className={styles.spotKind}>
                          <b data-type={latest.isBill ? 'bill' : latest.isStatutory ? 'regs' : 'motion'}>{latest.isBill ? 'Bill' : latest.isStatutory ? 'Regulations' : 'Motion'}</b>
                          {latestTitle.subtitle && <span>{latestTitle.subtitle}</span>}
                          {latest.isCrossCommunity && <span className={styles.spotCross}>Cross-community</span>}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className={styles.spotArrow} size={22} strokeWidth={2} aria-hidden="true" />
                  </div>

                  <h3 className={styles.spotTitle} title={latestTitle.title}>{latestTitle.title}</h3>

                  <div className={styles.ledger}>
                    <p className={styles.verdict}>
                      <span className={styles.verdictPill}>
                        {latest.passed !== null && (latest.passed ? <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" /> : <XCircle size={14} strokeWidth={2} aria-hidden="true" />)}
                        {latest.passed === null ? 'No outcome' : latest.passed ? 'Passed' : 'Failed'}
                      </span>
                      {lTotal > 0 && <span className={styles.verdictBy}>by {Math.abs(lAyes - lNoes)} {Math.abs(lAyes - lNoes) === 1 ? 'vote' : 'votes'}</span>}
                    </p>
                    <ul className={styles.ledgerRows}>
                      {ledger.map(r => (
                        <li key={r.tone} className={styles.ledgerRow} data-tone={r.tone}>
                          <i className={styles.ledgerDot} aria-hidden="true" />
                          <span className={styles.ledgerLabel}>{r.label}</span>
                          <span className={styles.ledgerMeter} aria-hidden="true"><span style={{ width: `${r.pct}%` }} /></span>
                          <b className={styles.ledgerCount}>{r.n}</b>
                          <span className={styles.ledgerPct}>{r.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <VotesListClient
        allItems={allItems}
        note={mandate.hadEarlySuspension ? 'The Assembly did not sit between May 2022 and February 2024. No divisions were recorded during this period aside from procedural Speaker nomination votes.' : null}
      />
    </div>
    </VotesFiltersProvider>
  )
}
