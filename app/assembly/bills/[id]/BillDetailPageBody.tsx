import { notFound } from 'next/navigation'
import {
  GitBranch, FileText, CalendarCheck, CalendarClock,
  Milestone, ArrowUpRight, Timer, Vote, Users, Landmark, ScrollText,
} from 'lucide-react'
import { getAllBills, getBillStages, getBillCommitteeItems, getBillTablers, getMembersGroupedByParty } from '@/lib/db/queries'
import MlaRow, { type MlaRowPerson } from '@/components/MlaRow'
import { buildCommitteeSummary, buildPetitions, findSponsors, groupTablersByDocument } from '@/lib/bills/billActivity'
import { computeBillProgress } from '@/lib/bills/billProgress'
import { billStatus } from '@/lib/bills/billStatus'
import { daysToLawOf } from '@/lib/bills/billStats'
import { getBillSummary } from '@/lib/summaries'
import { STAGE_INFO } from '@/lib/bills/stageInfo'
import { formatDate, dayMonthOrdinalParts } from '@/lib/format'
import { railModel, splitBillId, type BillKind } from '@/components/bills/BillCard'
import type { Mandate } from '@/lib/constants/mandates'
import BillTimeline from './BillTimeline'
import PetitionsTile from './PetitionsTile'
import styles from './billDetail.module.css'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

const IMPACT_LABELS: { key: string; label: string }[] = [
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'rights', label: 'Rights and Equality' },
  { key: 'publicServices', label: 'Public Services' },
  { key: 'crossCommunity', label: 'Cross-community' },
  { key: 'environment', label: 'Environment' },
]

const LEVEL_ORDER = ['none', 'low', 'medium', 'high'] as const
type ImpactLevel = typeof LEVEL_ORDER[number]


const DATE_LABEL: Record<BillKind, string> = {
  scheduled: 'Scheduled',
  active: 'Last in Assembly',
  awaiting: 'Final Stage',
  law: 'Royal Assent',
  failed: 'Defeated',
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function ImpactDots({ level }: { level: ImpactLevel }) {
  const active = LEVEL_ORDER.indexOf(level)
  return (
    <span className={styles.dotsWrap} aria-hidden="true">
      {LEVEL_ORDER.slice(1).map((l, i) => (
        <span
          key={l}
          className={styles.dot}
          data-active={i + 1 <= active}
          data-level={i + 1 <= active ? level : 'none'}
        />
      ))}
    </span>
  )
}

interface CardRequest {
  key: string
  personId: string
  fullName: string
  constituency: string | null
  imgUrl: string | null
  party: string | null
}

async function mlaCards(requests: CardRequest[], mandateId: string) {
  const cards = new Map<string, MlaRowPerson>()
  if (requests.length === 0) return cards
  const partyGroups = await getMembersGroupedByParty(mandateId)
  const allMlas = partyGroups.flatMap(g => g.mlas)
  for (const r of requests) {
    const m = allMlas.find(x => x.person_id === r.personId)
    cards.set(r.key, {
      id: r.personId,
      fullName: m?.full_name ?? r.fullName,
      constituency: m?.constituency ?? r.constituency,
      imgUrl: m?.img_url ?? r.imgUrl,
      party: m?.party ?? r.party,
      roles: [],
      attendance: null,
    })
  }
  return cards
}

// Shared by the live route and the archive route; mandate/basePath vary per route.
export default async function BillDetailPageBody({
  id,
  mandate,
  basePath,
}: {
  id: string
  mandate: Mandate
  basePath: string
}) {
  const allBills = await getAllBills(mandate.id)
  const bill = allBills.find(b => billSlug(b.bill_id) === id) ?? null
  if (!bill) notFound()

  const displayTitle = bill.royal_assent_date && bill.act_title ? bill.act_title : bill.short_title

  const [stages, summary, committeeItems, tablers] = await Promise.all([
    getBillStages(bill.bill_id),
    getBillSummary(id),
    getBillCommitteeItems(bill.bill_id),
    getBillTablers(bill.bill_id),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Legislation', item: `${siteUrl}${basePath}/assembly/bills` },
      { '@type': 'ListItem', position: 2, name: displayTitle, item: `${siteUrl}${basePath}/assembly/bills/${id}` },
    ],
  }

  const { kind, passed } = billStatus(bill)
  const { stageIdx, scheduledIdx, committeeInferred } = computeBillProgress(bill.stage_history, bill.royal_assent_date, passed === true, { isAccelerated: bill.is_accelerated })
  const { nodes } = railModel({ stageIdx: Math.max(stageIdx, 0), scheduledIdx }, kind)

  const today = new Date().toISOString().slice(0, 10)
  const petitions = buildPetitions(stages, tablers)
  const committeeSummary = buildCommitteeSummary(committeeItems, stages, today)
  const sponsors = findSponsors(stages, tablers)
  const sponsorRequests: CardRequest[] = sponsors
    .filter(t => t.person_id)
    .map(t => ({ key: `s-${t.document_id}-${t.tabler_order}`, personId: t.person_id as string, fullName: t.tabler_name, constituency: t.constituency, imgUrl: t.img_url, party: t.party }))
  const signatoryRequests: CardRequest[] = [...new Map(petitions.flatMap(g => g.signatories).map(sg => [sg.personId, sg])).values()]
    .map(sg => ({ key: `g-${sg.personId}`, personId: sg.personId, fullName: sg.name, constituency: null, imgUrl: null, party: sg.party }))
  const cards = await mlaCards([...sponsorRequests, ...signatoryRequests], mandate.id)
  const sponsorList = sponsorRequests.map(r => ({ key: r.key, person: cards.get(r.key) as MlaRowPerson }))
  const signatoryCards = Object.fromEntries(signatoryRequests.map(r => [r.personId, cards.get(r.key) as MlaRowPerson]))
  const introducer = (() => {
    if (bill.bill_type === 'Committee Bill') {
      const committee = sponsors.map(t => t.tabler_title?.match(/^Committee Chair\s*-\s*(.+)$/i)?.[1]?.trim()).find(Boolean)
      return committee ? { title: committee, Icon: Users } : null
    }
    if (bill.bill_type === 'Executive Bill') {
      const minister = sponsors.map(t => t.tabler_title?.trim()).find(t => t && /\bMinister\b/i.test(t))
      return minister ? { title: minister.replace(/\bdeputy\b/g, 'Deputy'), Icon: Landmark } : null
    }
    if (bill.bill_type === 'Assembly Commission Bill') return { title: 'Assembly Commission', Icon: Landmark }
    return null
  })()
  const showTablers = sponsorList.length > 0 && sponsorList.length <= 2 && !/\bFirst Minister\b/.test(introducer?.title ?? '')
  const sponsorStage = sponsors[0] ? stages.find(s => s.document_id === sponsors[0].document_id) : undefined
  const sponsorDate = showTablers && sponsorStage
    ? `${sponsorStage.plenary_date.slice(0, 10) > today ? 'Scheduled' : 'Tabled'} ${formatDate(sponsorStage.plenary_date)}`
    : undefined
  const tablersByDoc = groupTablersByDocument(tablers)
  const dates = stages.map(s => s.plenary_date).filter(d => !isNaN(new Date(d).getTime())).sort()
  const latest = kind === 'law' && bill.royal_assent_date ? bill.royal_assent_date : bill.latest_date
  const { prefix: idPrefix, number: idNumber } = splitBillId(bill.bill_id)

  const acts = daysToLawOf(allBills.map(b => ({
    slug: billSlug(b.bill_id),
    title: b.short_title,
    billType: b.bill_type,
    stageHistory: b.stage_history,
    royalAssentDate: b.royal_assent_date,
    passed: null,
  })))
  const thisAct = acts?.acts.find(a => a.slug === id) ?? null
  const plenaryDays = new Set(dates.map(d => d.slice(0, 10))).size
  const divisionCount = stages.filter(s => s.has_division && s.division_id).length

  const journey = nodes.map(n => {
    if (n.stage === 'Royal Assent') {
      return { ...n, date: bill.royal_assent_date, votes: 0 }
    }
    const rows = stages.filter(s => s.stage.toLowerCase() === n.stage.toLowerCase())
    const days = [...new Set(rows.map(r => r.plenary_date.slice(0, 10)))].sort()
    return { ...n, date: days[0] ?? null, votes: rows.filter(r => r.has_division && r.division_id).length }
  })
  const reached = journey.filter(j => j.state === 'done' || j.state === 'current')
  const nextNode = journey.find(j => j.state === 'scheduled') ?? null
  const focus = reached[reached.length - 1] ?? nextNode ?? journey[0]
  const focusKey = kind === 'law' ? 'Became law' : kind === 'awaiting' ? 'Awaiting Royal Assent' : kind === 'failed' ? 'Defeated' : focus.stage
  const focusLabel = kind === 'scheduled' ? (focus === nextNode ? 'Next stage' : 'Current stage') : kind === 'active' ? 'Current stage' : focusKey
  const focusExplain = STAGE_INFO[focusKey]?.summary ?? ''
  const lastReached = reached.length - 1
  const tiles = journey.map((j) => ({
    ...j,
    parts: dayMonthOrdinalParts(j.date),
    word: j.date ? '' : j.index === 1 ? 'Introduced' : j.index === 3 ? 'In committee' : j.state === 'scheduled' ? 'Awaiting' : j.state ? 'Held' : 'Pending',
    tone: kind === 'law' ? 'law'
      : kind === 'awaiting' && j.state === 'scheduled' ? 'awaiting'
      : kind === 'failed' && j.stage === reached[lastReached]?.stage ? 'failed'
      : 'default',
    meta: [j.date ? j.date.slice(0, 4) : '', j.votes > 0 ? plural(j.votes, 'vote', 'votes') : ''].filter(Boolean).join(' · '),
  }))
  const focusParts = dayMonthOrdinalParts(latest)
  const dateIcon = kind === 'scheduled' ? CalendarClock : CalendarCheck
  const dateTone = kind === 'law' ? 'tnGreen' : kind === 'awaiting' ? 'tnAmber' : kind === 'failed' ? 'tnRed' : 'tnBlue'
  const panelFacts: { label: string; value: React.ReactNode; sub?: string; Icon: typeof Timer; tone: string }[] = [
    ...(kind === 'scheduled' && nextNode?.date
      ? [{
          label: 'Next stage',
          value: formatDate(nextNode.date),
          sub: nextNode.stage,
          Icon: CalendarClock,
          tone: 'tnBlue',
        }]
      : focusParts
      ? [{
          label: DATE_LABEL[kind],
          value: formatDate(latest),
          Icon: dateIcon,
          tone: dateTone,
        }]
      : []),
    {
      label: divisionCount === 1 ? 'Division held' : 'Divisions held',
      value: divisionCount,
      Icon: Vote,
      tone: 'tnPurple',
    },
    thisAct
      ? { label: 'To become law', value: <>{thisAct.days} <small>days</small></>, sub: acts ? `Median Act ${acts.median} days` : undefined, Icon: Timer, tone: 'tnTeal' }
      : { label: plenaryDays === 1 ? 'Sitting day so far' : 'Sitting days so far', value: plenaryDays, Icon: Timer, tone: 'tnTeal' },
  ]

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className={`${styles.band} ${styles.bandPage} ${styles.intro}`} aria-labelledby="bill-title">
        <div className="container">
          <div className={styles.introTop}>
            <header className={styles.introCopy}>
              <span className={styles.eyebrow}>
                <span className={styles.eyebrowNo}>{idPrefix ?? 'Bill'} {idNumber} · </span>
                {bill.bill_type ?? 'Bill'}{bill.is_accelerated ? ' · Accelerated passage' : ''}
              </span>
              <h1 className={styles.h1} id="bill-title">{displayTitle}</h1>
              {bill.long_title && <p className={styles.headSub}>{bill.long_title}</p>}
              {bill.legislation_url && (
                <a href={bill.legislation_url} target="_blank" rel="noopener noreferrer" className={styles.actLink}>
                  <span className={styles.actIcon}><ScrollText size={26} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.actLabel}>View Act</span>
                  <span className={styles.actDesc}>Read the law as passed, on legislation.gov.uk.</span>
                  <ScrollText className={styles.actMark} size={160} strokeWidth={1.5} aria-hidden="true" />
                  <ArrowUpRight className={styles.actArrow} size={16} strokeWidth={2} aria-hidden="true" />
                  <span className={styles.srOnly}>(opens in a new tab)</span>
                </a>
              )}
            </header>
            <div className={styles.billNo} aria-hidden="true">
              <span className={styles.billNoCap}>{idPrefix ?? 'Bill'}</span>
              <span className={styles.billNoNum}>{idNumber}</span>
            </div>
          </div>

          <div className={styles.bar} aria-hidden="true">
            {tiles.map((t, i) => <span key={t.stage} className={styles.seg} data-state={t.state} data-tone={t.tone} style={{ '--o': 0.4 + (i / 6) * 0.6 } as React.CSSProperties} />)}
          </div>

          <ol className={styles.stages}>
            {tiles.map(t => (
              <li key={t.stage} className={styles.stage} data-state={t.state} data-tone={t.tone} data-focus={t.stage === focus.stage ? '' : undefined}>
                <span className={styles.stageNode} aria-hidden="true">{t.index}</span>
                <span className={styles.stageValue}>
                  {t.parts
                    ? <>{t.parts.day}<sup>{t.parts.suffix}</sup> {t.parts.month}</>
                    : <span className={styles.stageWord}>{t.word}</span>}
                </span>
                <span className={styles.stageLabel}>{t.stage.replace(/ Stage$/, '')}</span>
                {t.meta && <span className={styles.stageMeta}>{t.meta}</span>}
                <span className={styles.srOnly}>
                  {t.state === 'done' || t.state === 'current' ? ', completed' : t.state === 'scheduled' ? ', next' : ', not yet reached'}
                </span>
              </li>
            ))}
          </ol>

          {(showTablers || introducer) && (
            <div className={styles.attribution}>
              {introducer && (
                <div className={styles.introCard}>
                  <span className={`${styles.iconTile} ${styles.tnBlue} ${styles.introIcon}`}>
                    <introducer.Icon size={40} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className={styles.introText}>
                    <span className={styles.introEyebrow}>Introduced by</span>
                    <span className={styles.introTitle}>{introducer.title}</span>
                    {bill.bill_type && <span className={styles.introSub}>{bill.bill_type}</span>}
                  </span>
                </div>
              )}
              {showTablers && sponsorList.map(c => (
                <MlaRow key={c.key} person={c.person} basePath={basePath} surface eyebrow="Second Stage tabled by" showAttendance={false} date={sponsorDate} />
              ))}
            </div>
          )}

          <section className={styles.focusTile} aria-labelledby="journey-heading">
            <div className={styles.focusMain}>
            <div className={styles.phoneRail} data-kind={kind}>
              <ol className={styles.pNodes}>
                {nodes.map(n => (
                  <li key={n.stage} className={styles.pStep} data-state={n.state} data-left={n.left} data-right={n.right}>
                    <span className={styles.pNode} aria-hidden="true">{n.index}</span>
                    <span className={styles.srOnly}>
                      {n.stage}
                      {n.state === 'done' || n.state === 'current' ? ', completed' : n.state === 'scheduled' ? ', next' : ', not yet reached'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
              <div className={styles.focusHead}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><Milestone size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.focusTitles}>
                  <span className={styles.focusEyebrow}>Stage {focus.index} · {focusLabel}</span>
                  <h2 className={styles.focusTitle} id="journey-heading">{focus.stage}</h2>
                </div>
              </div>
              {focusExplain && <p className={styles.focusText}>{focusExplain}</p>}
            </div>
            <ul className={styles.facts} role="list">
              {panelFacts.map(f => (
                <li key={f.label} className={styles.fact}>
                  <span className={`${styles.iconTile} ${styles[f.tone]}`}><f.Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                  <span className={styles.factBody}>
                    <span className={styles.factText}>
                      <span className={styles.factLabel}>{f.label}</span>
                      {f.sub && <span className={styles.factSub}>{f.sub}</span>}
                    </span>
                    <span className={styles.factValue}>{f.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      {petitions.length > 0 && (
        <section className={`${styles.band} ${styles.bandTint}`} aria-label="Petitions of concern">
          <div className="container">
            <PetitionsTile groups={petitions} basePath={basePath} signatoryCards={signatoryCards} />
          </div>
        </section>
      )}

      <section className={`${styles.band} ${petitions.length > 0 ? styles.bandPage : styles.bandTint}`} aria-label="Bill details">
        <div className="container">
          <div className={styles.bento}>
            {summary && (
              <>
                <section className={`${styles.tile} ${styles.tSeven}`} aria-labelledby="summary-heading">
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnPurple}`}><FileText size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 className={styles.tileTitle} id="summary-heading">What this bill does</h2>
                  </div>
                  <p className={styles.summaryText}>{summary.summary}</p>
                </section>

                <section className={`${styles.tile} ${styles.tFive}`} aria-labelledby="impact-heading">
                  <div className={styles.tileHead}>
                    <span className={`${styles.iconTile} ${styles.tnTeal}`}><GitBranch size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <h2 className={styles.tileTitle} id="impact-heading">Impact areas</h2>
                  </div>
                  <ul className={styles.impactList} role="list">
                    {IMPACT_LABELS.map(({ key, label }) => {
                      type ImpactKey = 'fiscal' | 'rights' | 'publicServices' | 'crossCommunity' | 'environment'
                      const level: ImpactLevel = (summary.impact?.[key as ImpactKey] as ImpactLevel) ?? 'none'
                      const levelLabel = level.charAt(0).toUpperCase() + level.slice(1)
                      return (
                        <li key={key} className={styles.impactItem}>
                          <span className={styles.impactLabel}>{label}</span>
                          <ImpactDots level={level} />
                          <span className={styles.impactValue} data-level={level}>{levelLabel}</span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </>
            )}

            <section className={`${styles.tile} ${styles.tFull}`} aria-labelledby="stages-heading">
              <BillTimeline
                stages={stages}
                committeeItems={committeeItems}
                tablersByDoc={tablersByDoc}
                royalAssentDate={bill.royal_assent_date}
                latestDate={bill.latest_date}
                today={today}
                committeeInferred={committeeInferred}
                committeeSummary={committeeSummary}
              />
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
