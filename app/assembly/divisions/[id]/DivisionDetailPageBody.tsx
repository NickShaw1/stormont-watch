import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, MinusCircle, CalendarDays, User, FileText, ArrowUpRight, ArrowRight, Pencil, Scale, Megaphone, Stamp, Landmark } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { getDivisionWithVotes, getHansardReportId, getAmendmentMotionTexts } from '@/lib/db/queries'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatTabledBy } from '@/lib/utils/formatNames'
import type { Mandate } from '@/lib/constants/mandates'
import LobbiesClient from './LobbiesClient'
import MobileVote from './MobileVote'
import TabledBy from './TabledBy'
import PartyChart from './PartyChart'
import DesignationChart from './DesignationChart'
import { toBallots, VOTE_ORDER, VOTE_LABEL, type VoteKey } from './voteMeta'
import styles from './divisionDetail.module.css'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

const norm = (t: string) => t.replace(/[‘’‚‛]/g, "'").replace(/[“”„]/g, '"')
const stripQuotes = (t: string) => t.trim().replace(/^['"]+/, '').replace(/['"]+[.;]?$/, '').trim()

type Segment = { text: string; cut?: boolean }
type Diff = { segments: Segment[]; instruction: string; inserted: string }

function amendmentDiff(original: string, amendment: string): Diff | null {
  const a = norm(amendment)
  const on = norm(original).toLowerCase()

  const allAfter = a.match(/^\s*Leave out all after\s+'([\s\S]+?)'(?=\s*(?:and\b|:))\s*(?:and\s+(?:insert|substitute)\s*)?:?\s*([\s\S]*)$/i)
  if (allAfter) {
    const idx = on.indexOf(allAfter[1].toLowerCase())
    if (idx < 0) return null
    const end = idx + allAfter[1].length
    const insertedRaw = allAfter[2]
    return {
      segments: [{ text: original.slice(0, end) }, { text: original.slice(end), cut: true }],
      instruction: amendment.slice(0, amendment.length - insertedRaw.length).trim(),
      inserted: stripQuotes(insertedRaw),
    }
  }

  const swap = a.match(/^\s*Leave out\s+'([\s\S]+?)'\s+and\s+insert\s+'([\s\S]+?)'\s*\.?\s*$/i)
  if (swap) {
    const idx = on.indexOf(swap[1].toLowerCase())
    if (idx < 0) return null
    const end = idx + swap[1].length
    return {
      segments: [{ text: original.slice(0, idx) }, { text: original.slice(idx, end), cut: true }, { text: original.slice(end) }],
      instruction: `Leave out '${swap[1]}' and insert:`,
      inserted: swap[2].trim(),
    }
  }
  return null
}

const CAT = {
  bill: { label: 'Bill', Icon: Scale },
  regs: { label: 'Regulations', Icon: Stamp },
  motion: { label: 'Motion', Icon: Megaphone },
} as const

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function DivisionDetailPageBody({
  id,
  mandate,
  basePath,
}: {
  id: string
  mandate: Mandate
  basePath: string
}) {
  const data = await getDivisionWithVotes(id, mandate.id)
  if (!data) notFound()

  const { division, votes } = data
  const documentId = id

  const billStage = await db
    .select({ billId: schema.billStages.billId })
    .from(schema.billStages)
    .where(eq(schema.billStages.divisionId, documentId))
    .limit(1)

  const parentBill = billStage[0]?.billId
    ? await db
        .select({ shortTitle: schema.bills.shortTitle })
        .from(schema.bills)
        .where(eq(schema.bills.billId, billStage[0].billId))
        .limit(1)
    : null

  const plenaryDateStr = new Date(division.divisionDate).toISOString().slice(0, 10)
  const amendmentTexts = !division.isMotionAmendment && division.title
    ? await getAmendmentMotionTexts(division.title, plenaryDateStr)
    : []

  const reportDocId = await getHansardReportId(plenaryDateStr)
  const officialReportUrl = reportDocId
    ? `https://aims.niassembly.gov.uk/officialreport/report.aspx?&eveDate=${plenaryDateStr.replace(/-/g, '/')}&docID=${reportDocId}`
    : null

  const ballots = toBallots(votes)
  const count = (v: VoteKey) => ballots.filter((b) => b.vote === v).length
  const totalAyes = division.totalAyes ?? count('AYE')
  const totalNoes = division.totalNoes ?? count('NO')
  const totalAbstain = division.totalAbstains ?? count('ABSTAINED')
  const totalNoShow = count('NO_SHOW')
  const tally: Record<VoteKey, number> = { AYE: totalAyes, NO: totalNoes, ABSTAINED: totalAbstain, NO_SHOW: totalNoShow }
  const share = ballots.length || totalAyes + totalNoes + totalAbstain + totalNoShow
  const pct = (n: number) => (share > 0 ? Math.round((n / share) * 100) : 0)

  const passed = isPassed(division.outcome)
  const margin = Math.abs(totalAyes - totalNoes)
  const VerdictIcon = passed === null ? MinusCircle : passed ? CheckCircle2 : XCircle
  const verdict = passed === null ? 'No outcome' : passed ? 'Passed' : 'Failed'
  const outcomeNote = division.outcome && !/^(passed|failed)$/i.test(division.outcome.trim()) ? division.outcome.trim() : null

  const raw = division.title ?? division.subject
  const { title: displayTitle, subtitle } = formatDivisionSubject(raw)
  const tabledByClean = formatTabledBy(division.tabledBy)

  const statutory = /^The draft /i.test(division.title ?? '') || /^Prayer of Annulment:/i.test(division.title ?? '') || /^Applicability Motion/i.test(division.title ?? '')
  const isBill = !statutory && (!!billStage[0]?.billId || /NIA Bill/i.test(division.subject ?? ''))
  const cat = statutory ? 'regs' : isBill ? 'bill' : 'motion'
  const { label: catLabel, Icon: CatIcon } = CAT[cat]
  const crossCommunity = division.divisionType === 'Cross-Community'

  const byDesignation = (d: 'Unionist' | 'Nationalist' | 'Other') => {
    const members = ballots.filter((b) => (b.designation ?? 'Other') === d)
    return {
      abstains: members.filter((b) => b.vote === 'ABSTAINED').length,
      noShows: members.filter((b) => b.vote === 'NO_SHOW').length,
    }
  }
  const designations = [
    { key: 'Unionist', colour: '#f97316', ayes: division.unionistAyes ?? 0, noes: division.unionistNoes ?? 0, ...byDesignation('Unionist') },
    { key: 'Nationalist', colour: '#15803d', ayes: division.nationalistAyes ?? 0, noes: division.nationalistNoes ?? 0, ...byDesignation('Nationalist') },
    { key: 'Other', colour: '#9e9e9e', ayes: division.otherAyes ?? 0, noes: division.otherNoes ?? 0, ...byDesignation('Other') },
  ]
  const hasDesignation = designations.some((d) => d.ayes + d.noes > 0)
  const sideOf = (a: number, n: number) => (a > n ? 'aye' : a < n ? 'no' : 'level')
  const uSide = sideOf(designations[0].ayes, designations[0].noes)
  const nSide = sideOf(designations[1].ayes, designations[1].noes)
  const insight =
    designations[0].ayes + designations[0].noes > 0 && designations[1].ayes + designations[1].noes > 0
      ? uSide === 'level' || nSide === 'level'
        ? { label: 'A designation split evenly', tone: 'warn' }
        : uSide === nSide
          ? uSide === 'aye'
            ? { label: 'Both sides in favour', tone: 'good' }
            : { label: 'Both sides against', tone: 'bad' }
          : { label: 'Divided', tone: 'warn' }
      : null

  const isAmendment = division.isMotionAmendment === true
  const motionText = division.motionText
  const asAmendedNoText = !isAmendment && amendmentTexts.length === 0 && /as amended/i.test(division.outcome ?? '')
  const showSplit = !!motionText && ((isAmendment && !!division.parentMotionText) || amendmentTexts.length > 0 || asAmendedNoText)
  const originalText = isAmendment ? division.parentMotionText : motionText
  const amendTexts = isAmendment ? (motionText ? [motionText] : []) : amendmentTexts.map((a) => a.motion_text as string)
  const diff = showSplit && originalText && amendTexts.length === 1 ? amendmentDiff(originalText, amendTexts[0]) : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'
  const breadcrumbItems = parentBill?.[0]
    ? [
        { '@type': 'ListItem', position: 1, name: 'Legislation', item: `${siteUrl}${basePath}/assembly/bills` },
        { '@type': 'ListItem', position: 2, name: parentBill[0].shortTitle, item: `${siteUrl}${basePath}/assembly/bills/${billStage[0]?.billId ?? ''}` },
        { '@type': 'ListItem', position: 3, name: displayTitle, item: `${siteUrl}${basePath}/assembly/divisions/${id}` },
      ]
    : [
        { '@type': 'ListItem', position: 1, name: 'Votes', item: `${siteUrl}${basePath}/assembly/votes` },
        { '@type': 'ListItem', position: 2, name: displayTitle, item: `${siteUrl}${basePath}/assembly/divisions/${id}` },
      ]
  const breadcrumbJsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems }

  let bandIndex = 0
  const nextBand = () => `${styles.band} ${bandIndex++ % 2 === 0 ? styles.bandTint : styles.bandPlain}`

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="division-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>Division {documentId}</span>
            <h1 className={styles.h1} id="division-title">{displayTitle}</h1>
            <ul className={styles.chips} aria-label="Type">
              <li><span className={styles.pill} data-cat={cat}><CatIcon size={14} strokeWidth={2} aria-hidden="true" />{catLabel}</span></li>
              {subtitle && <li><span className={styles.pill} data-cat="neutral"><Pencil size={14} strokeWidth={2} aria-hidden="true" />{subtitle}</span></li>}
              {crossCommunity && <li><span className={styles.pill} data-cat="xc">Cross-community</span></li>}
            </ul>
            <ul className={styles.facts} aria-label="Details">
              <li className={styles.fact}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><CalendarDays size={18} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.factBody}>
                  <span className={styles.factLabel}>Date</span>
                  <span className={styles.factValue}>{formatDate(division.divisionDate.toISOString())}</span>
                </span>
              </li>
              {tabledByClean && (
                <li className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles.tnPurple}`}><User size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factLabel}>Tabled by</span>
                    <TabledBy names={tabledByClean.split(', ')} />
                  </span>
                </li>
              )}
              {parentBill?.[0] && billStage[0]?.billId && (
                <li className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles.tnPurple}`}><Landmark size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factLabel}>Bill</span>
                    <Link href={`${basePath}/assembly/bills/${billSlug(billStage[0].billId)}`} className={`${styles.factValue} ${styles.factLink}`}>
                      {parentBill[0].shortTitle}
                      <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </span>
                </li>
              )}
              {officialReportUrl && (
                <li className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles.tnGreen}`}><FileText size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factLabel}>Report</span>
                    <a href={officialReportUrl} target="_blank" rel="noopener noreferrer" className={`${styles.factValue} ${styles.factLink}`}>
                      Official Report
                      <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </span>
                </li>
              )}
            </ul>
          </header>

          {ballots.length > 0 && (
            <MobileVote ballots={ballots} verdict={verdict} passed={passed} detail={passed === null ? null : `${passed ? 'Carried' : 'Defeated'} by ${margin} ${margin === 1 ? 'vote' : 'votes'}`} insight={insight} originalText={originalText ?? null} amendTexts={showSplit ? amendTexts : []} isAmendment={isAmendment} />
          )}
          <div className={`${styles.bandStack} ${styles.desktopOnly}`}>
          {motionText && (
        <section className={styles.tile} aria-labelledby="wording-heading">
          <div className={styles.tileHead}>
            <span className={`${styles.iconTile} ${styles.tnPurple}`}><FileText size={22} strokeWidth={2} aria-hidden="true" /></span>
            <h2 className={styles.tileTitle} id="wording-heading">What was voted on</h2>
            {showSplit && (
              <span className={styles.pill} data-cat="motion">
                {isAmendment ? `Amendment ${passed === null ? '' : passed ? 'agreed' : 'defeated'}`.trim() : amendTexts.length > 0 ? 'Motion as amended' : 'Motion as amended'}
              </span>
            )}
          </div>

          {showSplit ? (
            <div className={styles.wordGrid}>
              <div className={styles.wordCard}>
                <div className={styles.wordHead}>
                  <span className={`${styles.iconTile} ${styles.tnBlue}`}><FileText size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={styles.wordTitle}>Original motion</h3>
                </div>
                
                  <p className={styles.wordText}>
                    {diff
                      ? diff.segments.map((s, i) => (s.cut ? <del key={i} className={styles.cut}>{s.text}</del> : <span key={i}>{s.text}</span>))
                      : originalText}
                  </p>
                
              </div>
              <span className={styles.wordArrow} aria-hidden="true">
                <ArrowRight size={20} strokeWidth={2} />
              </span>
              <div className={styles.wordCard} data-kind="amend">
                <div className={styles.wordHead}>
                  <span className={`${styles.iconTile} ${styles.tnAmber}`}><Pencil size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <h3 className={styles.wordTitle}>{isAmendment ? 'The amendment' : amendTexts.length === 1 ? 'Amendment agreed' : 'Amendments agreed'}</h3>
                </div>
                {diff ? (
                  <>
                    <p className={styles.instruction}>{diff.instruction}</p>
                    <p className={styles.add}><span className={styles.addLabel}>Replacement wording</span>{diff.inserted}</p>
                  </>
                ) : amendTexts.length > 0 ? (
                  amendTexts.map((t) => <p key={t} className={styles.wordText}>{t}</p>)
                ) : (
                  <p className={styles.wordNote}>
                    The amendment was agreed without a formal division, so its wording is not in the data.{' '}
                    {officialReportUrl ? (
                      <a href={officialReportUrl} target="_blank" rel="noopener noreferrer">See the Official Report<span className="sr-only"> (opens in a new tab)</span></a>
                    ) : (
                      'See the Official Report for the full text.'
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.wordCard}>
              {isAmendment && <p className={styles.instruction}>This amendment proposes changes to the original motion text.</p>}
              <p className={`${styles.wordText} ${styles.single}`}>{motionText}</p>
            </div>
          )}
        </section>
          )}
            <section className={`${styles.tile} ${styles.result}`} data-tone={passed === null ? 'none' : passed ? 'pass' : 'fail'} aria-labelledby="result-heading">
              <div className={styles.resultTop}>
                <div className={styles.verdictBlock}>
                  <span className={styles.tileLabel}>Result</span>
                  <div className={styles.verdictRow}>
                    <span className={`${styles.iconTile} ${styles.verdictIcon}`}><VerdictIcon size={30} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 className={styles.verdict} id="result-heading">{verdict}</h2>
                  </div>
                  {passed !== null && (
                    <p className={styles.verdictSub}>
                      {passed ? 'Carried' : 'Defeated'} by <b>{margin}</b> {margin === 1 ? 'vote' : 'votes'}.
                    </p>
                  )}
                  {outcomeNote && <p className={styles.outcomeNote}>Recorded as: {outcomeNote}</p>}
                </div>
              </div>
              <div className={styles.board} role="group" aria-label="Vote totals">
                {VOTE_ORDER.filter((v) => tally[v] > 0 || v === 'AYE' || v === 'NO').map((v) => (
                  <div key={v} className={styles.boardCell} data-vote={v} style={{ flexGrow: Math.max(tally[v], 1) }}>
                    <span className={styles.boardLabel}>{VOTE_LABEL[v]}</span>
                    <span className={styles.boardNum}>{tally[v]}</span>
                    <span className={styles.boardPct}>{pct(tally[v])}% of {share} MLAs</span>
                  </div>
                ))}
              </div>
              <PartyChart ballots={ballots} />
              {hasDesignation && <DesignationChart ballots={ballots} insight={insight} />}
            </section>
          </div>
        </div>
      </section>


      {ballots.length > 0 && (
        <div className={`${nextBand()} ${styles.desktopOnly}`}>
          <div className="container">
            <div className={styles.bandStack}>
              <LobbiesClient ballots={ballots} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
