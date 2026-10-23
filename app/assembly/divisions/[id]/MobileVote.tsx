'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, MinusCircle, ChevronDown, Search, FileText, Layers, ListFilter, Check, X, Minus, UserX, LayoutGrid, Users, User } from 'lucide-react'
import SheetSelect from '@/app/assembly/mlas/[id]/SheetSelect'
import MlaPhoto from '@/components/MlaPhoto'
import { inkFor } from '@/lib/partyInk'
import { abbreviateParty, formatMemberName, getSurname, partyBorderColor } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import { VOTE_ORDER, VOTE_LABEL, type VoteKey, type Ballot } from './voteMeta'
import styles from './divisionDetail.module.css'

type Tab = 'overview' | 'parties' | 'mlas'

const VOTE_ICON = { AYE: Check, NO: X, ABSTAINED: Minus, NO_SHOW: UserX } as const
const VOTE_COLOUR = {
  AYE: { bg: 'var(--sw-success-solid)', on: undefined },
  NO: { bg: 'var(--sw-error-solid)', on: undefined },
  ABSTAINED: { bg: 'var(--sw-accent-warm)', on: '#1a1d21' },
  NO_SHOW: { bg: '#656b72', on: undefined },
} as const

interface Props {
  ballots: Ballot[]
  verdict: string
  passed: boolean | null
  detail: string | null
  insight: { label: string; tone: string } | null
  originalText: string | null
  amendTexts: string[]
  isAmendment: boolean
}

const VOTE_SHORT: Record<VoteKey, string> = { AYE: 'Aye', NO: 'No', ABSTAINED: 'Abs', NO_SHOW: 'DNV' }
const partyKey = (b: Ballot) => b.party ?? 'Independent'
const shortOf = (p: string) => (p === 'Independent' ? 'Independent' : abbreviateParty(p))

export default function MobileVote({ ballots, verdict, passed, detail, insight, originalText, amendTexts, isAmendment }: Props) {
  const { basePath } = useMandate()
  const [tab, setTab] = useState<Tab>('overview')
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<VoteKey | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [showText, setShowText] = useState(false)

  const counts = useMemo(() => {
    const c: Record<VoteKey, number> = { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
    for (const b of ballots) c[b.vote]++
    return c
  }, [ballots])

  const parties = useMemo(() => {
    const m = new Map<string, Ballot[]>()
    for (const b of ballots) m.set(partyKey(b), [...(m.get(partyKey(b)) ?? []), b])
    return [...m.entries()]
      .map(([party, members]) => {
        const split: Record<VoteKey, number> = { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
        for (const x of members) split[x.vote]++
        const sorted = [...members].sort((a, b) => VOTE_ORDER.indexOf(a.vote) - VOTE_ORDER.indexOf(b.vote) || getSurname(a.fullName).localeCompare(getSurname(b.fullName)))
        return { party, members: sorted, split }
      })
      .sort((a, b) => b.members.length - a.members.length)
  }, [ballots])

  const desig = useMemo(() => (['Unionist', 'Nationalist', 'Other'] as const).map((k) => {
    const split: Record<VoteKey, number> = { AYE: 0, NO: 0, ABSTAINED: 0, NO_SHOW: 0 }
    for (const b of ballots) if ((b.designation ?? 'Other') === k) split[b.vote]++
    return { k, split, total: VOTE_ORDER.reduce((n, v) => n + split[v], 0) }
  }).filter((d) => d.total > 0), [ballots])

  const q = query.trim().toLowerCase()
  const list = ballots
    .filter((b) => (filter === 'ALL' || b.vote === filter) && (!q || b.fullName.toLowerCase().includes(q) || (b.party ?? '').toLowerCase().includes(q) || (b.constituency ?? '').toLowerCase().includes(q)))
    .sort((a, b) => (a.party ?? '').localeCompare(b.party ?? '') || getSurname(a.fullName).localeCompare(getSurname(b.fullName)))

  const presentVotes = VOTE_ORDER.filter((v) => counts[v] > 0)
  const VIcon = passed === null ? MinusCircle : passed ? CheckCircle2 : XCircle
  const total = ballots.length || 1
  const bar = (split: Record<VoteKey, number>) => (
    <span className={styles.mBar} aria-hidden="true">
      {VOTE_ORDER.filter((v) => split[v] > 0).map((v) => <span key={v} data-vote={v} style={{ flexGrow: split[v] }} />)}
    </span>
  )
  const splitText = (split: Record<VoteKey, number>) => VOTE_ORDER.filter((v) => split[v] > 0).map((v) => `${split[v]} ${VOTE_LABEL[v]}`).join(' · ')

  const row = (b: Ballot, showParty: boolean, showVote = true) => (
    <li key={b.personId} className={styles.mRow} data-vote={b.vote}>
      <span className={styles.mAvatar}><MlaPhoto name={b.fullName} imgUrl={b.imgUrl ?? ''} size={96} decorative square personId={b.personId} /></span>
      <span className={styles.mWho}>
        <Link href={`${basePath}/assembly/mlas/${b.personId}`} className={styles.mLink}>{formatMemberName(b.fullName)}</Link>
        {showParty && (
          <span className={styles.mSub}><i style={{ background: partyBorderColor(b.party) }} aria-hidden="true" />{shortOf(partyKey(b))}</span>
        )}
      </span>
      {showVote && <span className={styles.mVote} data-vote={b.vote}>{VOTE_LABEL[b.vote]}</span>}
    </li>
  )

  return (
    <div className={styles.mobileVote}>
      <section className={styles.mVerdict} data-tone={passed === null ? 'none' : passed ? 'pass' : 'fail'} aria-label="Result">
        <div className={styles.mVerdictTop}>
          <VIcon size={30} strokeWidth={2} aria-hidden="true" />
          <div>
            <h2 className={styles.mVerdictWord}>{verdict}</h2>
            {detail && <p className={styles.mVerdictSub}>{detail}</p>}
          </div>
        </div>
        <span className={styles.mBar} data-big="" role="img" aria-label={VOTE_ORDER.map((v) => `${counts[v]} ${VOTE_LABEL[v]}`).join(', ')}>
          {VOTE_ORDER.filter((v) => counts[v] > 0).map((v) => <span key={v} data-vote={v} style={{ flexGrow: counts[v] }} />)}
        </span>
        <ul className={styles.mKey}>
          {VOTE_ORDER.filter((v) => counts[v] > 0).map((v) => (
            <li key={v} data-vote={v}><i aria-hidden="true" /><b>{counts[v]}</b> {VOTE_LABEL[v]}</li>
          ))}
        </ul>
      </section>

      {originalText && (
        <section className={styles.mMotion} aria-labelledby="m-motion-heading">
          <div className={styles.mMotionHead}>
            <span className={`${styles.iconTile} ${styles.tnPurple}`}><FileText size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h2 className={styles.mMotionTitle} id="m-motion-heading">What was voted on</h2>
          </div>
          <div className={styles.mMotionBody} data-open={showText ? '' : undefined}>
            <h3>{isAmendment ? 'Original motion' : amendTexts.length > 0 ? 'Original motion' : 'Motion'}</h3>
            <p>{originalText}</p>
            {showText && amendTexts.length > 0 && (
              <>
                <h3>{isAmendment ? 'The amendment' : 'Amended to'}</h3>
                {amendTexts.map((t) => <p key={t}>{t}</p>)}
              </>
            )}
          </div>
          <button type="button" className={styles.mMotionBtn} aria-expanded={showText} onClick={() => setShowText(!showText)}>
            {showText ? 'Show less' : amendTexts.length > 0 ? 'Read the motion and amendment' : 'Read the full motion'}
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" data-open={showText ? '' : undefined} />
          </button>
        </section>
      )}

      <SheetSelect
        options={[
          { key: 'overview', label: 'Overview', icon: LayoutGrid, meta: 'Result and the divide', color: 'var(--sw-accent-solid)' },
          { key: 'parties', label: 'Parties', icon: Users, meta: `${parties.length} parties`, color: '#8b5cf6' },
          { key: 'mlas', label: 'MLAs', icon: User, meta: `${total} MLAs`, color: 'var(--sw-success-solid)' },
        ]}
        value={tab}
        onPick={(k) => setTab(k as Tab)}
        eyebrow="Show"
        title="Section"
        headIcon={LayoutGrid}
        hideTriggerMeta
        className={styles.mSelect}
      />

      {tab === 'overview' && (
        <div role="region" aria-label="Overview" className={styles.mPanel}>
          <h3 className={styles.mH}>How each party voted</h3>
          <div className={styles.mTableWrap}>
            <table className={styles.mTable}>
              <caption className="sr-only">MLAs by party and vote</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Party</span></th>
                  {VOTE_ORDER.filter((v) => v !== 'NO_SHOW' || counts.NO_SHOW > 0).map((v) => <th key={v} scope="col" data-vote={v}>{VOTE_SHORT[v]}</th>)}
                </tr>
              </thead>
              <tbody>
                {parties.map(({ party, split }) => (
                  <tr key={party}>
                    <th scope="row">
                      <span className={styles.mPartyTag} style={{ background: inkFor(partyBorderColor(party)) === '#ffffff' ? `color-mix(in srgb, ${partyBorderColor(party)} 80%, #000000)` : partyBorderColor(party), color: inkFor(partyBorderColor(party)) }} title={party}>{party === 'Independent' ? 'Ind' : shortOf(party)}</span>
                    </th>
                    {VOTE_ORDER.filter((v) => v !== 'NO_SHOW' || counts.NO_SHOW > 0).map((v) => (
                      <td key={v} data-vote={v} data-zero={split[v] === 0 ? '' : undefined}>{split[v] === 0 ? <><span aria-hidden="true">-</span><span className="sr-only">0</span></> : split[v]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mChart} role="img" aria-label="Which parties made up each vote">
            {presentVotes.map((v) => {
              const max = Math.max(...presentVotes.map((x) => counts[x]))
              return (
                <div key={v} className={styles.mChartRow} data-vote={v}>
                  <span className={styles.mChartLabel}>{VOTE_LABEL[v]}</span>
                  <span className={styles.mChartTrack}>
                    <span className={styles.mChartBar} style={{ width: `${(counts[v] / max) * 100}%` }}>
                      {parties.filter((p) => p.split[v] > 0).map((p) => (
                        <span key={p.party} title={`${p.party}: ${p.split[v]}`} data-small={p.split[v] / max < 0.07 ? '' : undefined} style={{ flexGrow: p.split[v], background: partyBorderColor(p.party), color: inkFor(partyBorderColor(p.party)) }}>{p.split[v]}</span>
                      ))}
                    </span>
                  </span>
                  <b className={styles.mChartTotal}>{counts[v]}</b>
                </div>
              )
            })}
          </div>
          <div className={styles.mHeadRow}>
            <h3 className={styles.mH}>Across the divide</h3>
            {insight && <span className={styles.pill} data-cat={insight.tone}>{insight.label}</span>}
          </div>
          <ul className={styles.mList}>
            {desig.map((d) => (
              <li key={d.k} className={styles.mCard}>
                <div className={styles.mCardTop}><b>{d.k}</b><span>{d.total} MLAs</span></div>
                {bar(d.split)}
                <span className={styles.mSplit}>{splitText(d.split)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'parties' && (
        <div role="region" aria-label="Parties" className={styles.mPanel}>
          <ul className={styles.mList}>
            {parties.map(({ party, members, split }) => {
              const isOpen = open === party
              return (
                <li key={party} className={styles.mCard} data-open={isOpen ? '' : undefined}>
                  <button type="button" className={styles.mCardBtn} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : party)}>
                    <span className={styles.mCardTop}>
                      <b><i className={styles.mSq} style={{ background: partyBorderColor(party) }} aria-hidden="true" />{party === 'Independent' ? 'Independent' : party}</b>
                      <ChevronDown size={18} strokeWidth={2} aria-hidden="true" data-open={isOpen ? '' : undefined} />
                    </span>
                    {bar(split)}
                    <span className={styles.mSplit}>{splitText(split)}</span>
                  </button>
                  {isOpen && <ul className={styles.mRows}>{members.map((b) => row(b, false))}</ul>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {tab === 'mlas' && (
        <div role="region" aria-label="MLAs" className={styles.mPanel}>
          <div className={styles.searchWrap}>
            <label htmlFor="m-search" className="sr-only">Search MLAs</label>
            <Search className={styles.searchIcon} size={20} strokeWidth={2} aria-hidden="true" />
            <input id="m-search" type="search" className={styles.search} placeholder="Name, party or constituency" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <SheetSelect
            options={[
              { key: 'ALL', label: 'All votes', icon: Layers, meta: `${total}`, color: 'var(--sw-accent-strong-solid)' },
              ...VOTE_ORDER.filter((v) => counts[v] > 0).map((v) => ({ key: v, label: VOTE_LABEL[v], icon: VOTE_ICON[v], meta: `${counts[v]}`, color: VOTE_COLOUR[v].bg, on: VOTE_COLOUR[v].on })),
            ]}
            value={filter}
            onPick={(k) => setFilter(k as VoteKey | 'ALL')}
            eyebrow="Filter by"
            title="Vote"
            headIcon={ListFilter}
            className={styles.mSelect}
          />
          <p className="sr-only" aria-live="polite">{list.length} MLAs shown</p>
          {VOTE_ORDER.map((v) => {
            const group = list.filter((b) => b.vote === v)
            if (group.length === 0) return null
            return (
              <section key={v} className={styles.mGroup} data-vote={v} aria-label={VOTE_LABEL[v]}>
                <h3 className={styles.mGroupHead}><i aria-hidden="true" />{VOTE_LABEL[v]}<span>{group.length}</span></h3>
                <ul className={styles.mRows}>{group.map((b) => row(b, true, false))}</ul>
              </section>
            )
          })}
          {list.length === 0 && <p className={styles.mSplit}>No MLAs match.</p>}
        </div>
      )}
    </div>
  )
}
