import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { Globe, BookOpen, Gauge, PieChart, Gavel, ShieldCheck, ArrowUpRight } from 'lucide-react'
import { getPartyBySlug, getAllPartiesWithStats, getPartyAssemblyStats, getPartyExpenses, getPartyMandateExpenses, getPartyMandateMlaExpenses, getQuestionStatsByParty, getQuestionRankingByParty, getHansardStatsByParty, getHansardPartyRank, getHansardPartyDebateRank, getHansardSittingsByMonthForParty, getMembersGroupedByParty, getAverageAttendance, getPartyTrendRanks } from '@/lib/db/queries'
import { partyBorderColor, formatShare } from '@/lib/format'
import { attendanceFloor, gradeAttendance } from '@/lib/attendance'
import { heroColours } from '@/lib/partyInk'
import type { Mandate } from '@/lib/constants/mandates'
import m from '@/app/assembly/mlas/[id]/mlaDetail.module.css'
import styles from './partyDetail.module.css'
import PartyDetailClient from './PartyDetailClient'
import PartyStatsClient from './PartyStatsClient'
import PartyExpensesClient from './PartyExpensesClient'
import PartyChamberClient from './PartyChamberClient'
import PartyQuestionsClient from './PartyQuestionsClient'
import PartySeats from './PartySeats'

const PARTY_URLS: Record<string, string> = {
  'Sinn Féin': 'https://sinnfein.ie/',
  'Democratic Unionist Party': 'https://mydup.com/',
  'Alliance Party': 'https://www.allianceparty.org/',
  'Ulster Unionist Party': 'https://www.uup.org/',
  'Social Democratic and Labour Party': 'https://www.sdlp.ie/',
  'People Before Profit Alliance': 'https://www.pbp.ie/',
  'Traditional Unionist Voice': 'https://www.tuv.org.uk/',
}

const PARTY_WIKIPEDIA: Record<string, string> = {
  'Sinn Féin': 'https://en.wikipedia.org/wiki/Sinn_F%C3%A9in',
  'Democratic Unionist Party': 'https://en.wikipedia.org/wiki/Democratic_Unionist_Party',
  'Alliance Party': 'https://en.wikipedia.org/wiki/Alliance_Party_of_Northern_Ireland',
  'Ulster Unionist Party': 'https://en.wikipedia.org/wiki/Ulster_Unionist_Party',
  'Social Democratic and Labour Party': 'https://en.wikipedia.org/wiki/Social_Democratic_and_Labour_Party',
  'People Before Profit Alliance': 'https://en.wikipedia.org/wiki/People_Before_Profit',
  'Traditional Unionist Voice': 'https://en.wikipedia.org/wiki/Traditional_Unionist_Voice',
}

const PARTY_DESCRIPTIONS: Record<string, string> = {
  'Sinn Féin': 'Sinn Féin is an Irish republican and democratic socialist political party operating across the island of Ireland. Founded in 1905, the party advocates for Irish unity and has been a central figure in Northern Ireland politics since the Good Friday Agreement.',
  'Democratic Unionist Party': 'The Democratic Unionist Party is a unionist and social conservative political party in Northern Ireland. Founded in 1971 by Ian Paisley, the DUP has been one of the most significant players in Northern Ireland politics for over five decades.',
  'Alliance Party': 'The Alliance Party of Northern Ireland is a cross-community liberal and centrist political party. Founded in 1970, Alliance is distinctive in Northern Ireland politics for drawing support from both unionist and nationalist communities, designating as neither.',
  'Ulster Unionist Party': 'The Ulster Unionist Party is a unionist and conservative political party in Northern Ireland. For much of the twentieth century the UUP was the dominant presence in Northern Ireland politics, governing the region from partition until the introduction of direct rule.',
  'Social Democratic and Labour Party': 'The Social Democratic and Labour Party is an Irish nationalist and social democratic political party in Northern Ireland. Founded in 1970, the SDLP played a pivotal role in the peace process and was instrumental in negotiating the Good Friday Agreement, with former leader John Hume awarded the Nobel Peace Prize in 1998.',
  'People Before Profit Alliance': 'People Before Profit is a left-wing socialist and anti-austerity political party operating across Ireland. The party advocates for radical economic reform, public ownership of key industries, and opposition to austerity measures.',
  'Traditional Unionist Voice': 'Traditional Unionist Voice is a unionist political party in Northern Ireland founded in 2007 by Jim Allister, who remains its leader. The party was established in opposition to the St Andrews Agreement and takes a hardline unionist position.',
  'Independent': 'Independent MLAs sit in the Northern Ireland Assembly without a party designation, elected or choosing to sit outside the main political parties.',
}

const GRADE_STROKE = {
  good: 'var(--sw-success-solid)',
  low: 'var(--sw-accent-warm)',
  poor: 'var(--sw-error-solid)',
} as const

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function PartyDetailPageBody({
  slug,
  mandate,
  basePath,
}: {
  slug: string
  mandate: Mandate
  basePath: string
}) {
  const party = await getPartyBySlug(slug, mandate.id)
  if (!party) notFound()

  const [stats, expenses, mandateExpenses, mandateMlaExpenses, questionStatsRows, questionRanking, hansardStats, hansardPartyRank, hansardPartyDebateRank, hansardSittingsByMonth, allParties, partyGroups, averageAttendance, trendRanks] = await Promise.all([
    getPartyAssemblyStats(party.party, mandate.id),
    getPartyExpenses(party.party, mandate.id),
    getPartyMandateExpenses(party.party, mandate.id),
    getPartyMandateMlaExpenses(party.party, mandate.id),
    getQuestionStatsByParty(party.party, mandate.id),
    getQuestionRankingByParty(party.party, mandate.id),
    getHansardStatsByParty(party.party, mandate.id),
    getHansardPartyRank(party.party, mandate.id),
    getHansardPartyDebateRank(party.party, mandate.id),
    getHansardSittingsByMonthForParty(party.party, mandate.start, mandate.id),
    getAllPartiesWithStats(mandate.id),
    getMembersGroupedByParty(mandate.id),
    getAverageAttendance(mandate.id),
    getPartyTrendRanks(party.party, mandate.id),
  ])

  const colour = partyBorderColor(party.party)
  const hero = heroColours(colour)
  const totalQuestions = questionStatsRows.reduce((s, r) => s + r.writtenCount + r.oralCount, 0)
  const writtenCount = questionStatsRows.reduce((s, r) => s + r.writtenCount, 0)
  const oralCount = questionStatsRows.reduce((s, r) => s + r.oralCount, 0)

  const partyUrl = PARTY_URLS[party.party]
  const wikiUrl = PARTY_WIKIPEDIA[party.party]
  const description = PARTY_DESCRIPTIONS[party.party]

  const totalSeats = allParties.reduce((sum, p) => sum + p.mlaCount, 0)
  const seatShare = totalSeats > 0 ? (party.mlaCount / totalSeats) * 100 : 0
  const ministerCount = (party.ministers ?? []).length
  const chairCount = (party.committeeChairs ?? []).length

  // Mean of each current MLA's own figure, the same method and data as the MLAs and parties pages.
  const floor = attendanceFloor(partyGroups.flatMap((g) => g.mlas), averageAttendance)
  const figures = party.mlas.map((x) => x.attendancePctExact).filter((v): v is number => v !== null && v !== undefined)
  const mean = figures.length > 0 ? figures.reduce((a, b) => a + b, 0) / figures.length : null
  const attendancePct = mean === null ? null : Math.round(mean * 10) / 10
  const grade = mean === null ? null : gradeAttendance(mean, averageAttendance, floor)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PoliticalParty',
    name: party.party,
    url: `https://www.stormontwatch.com${basePath}/assembly/parties/${slug}`,
    ...(partyUrl ? { sameAs: [partyUrl, wikiUrl].filter(Boolean) } : {}),
  }

  const execRoles = (party.ministers ?? [])
    .filter((x) => x.department === 'The Executive Office' && /first minister/i.test(x.roleTitle ?? ''))
    .map((x) => (x.roleTitle ?? '').replace(/^./, (c) => c.toUpperCase()))
  const seatsLabel = `${party.mlaCount} of ${totalSeats} seats in the Assembly are held by ${party.party}.`

  return (
    <div className={m.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className={`${m.band} ${m.bandPage}`} aria-labelledby="party-name">
        <div className="container">
          <div className={styles.hero} style={{ '--party': colour, '--hero-bg': hero.bg, '--hero-ink': hero.ink } as CSSProperties}>
            <div className={styles.heroCopy}>
              <h1 id="party-name" className={styles.heroTitle}>{party.party}</h1>
              {description && <p className={styles.heroDesc}>{description}</p>}
              {(partyUrl || wikiUrl) && (
                <div className={styles.heroLinks}>
                  {partyUrl && (
                    <a href={partyUrl} target="_blank" rel="noopener noreferrer" className={styles.heroBtn}>
                      <Globe size={18} strokeWidth={2} aria-hidden="true" />
                      Official website
                      <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  {wikiUrl && (
                    <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className={styles.heroBtn}>
                      <BookOpen size={18} strokeWidth={2} aria-hidden="true" />
                      Wikipedia
                      <ArrowUpRight size={16} strokeWidth={2.25} aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              )}
            </div>
            <PartySeats
              parties={allParties.map((p) => ({ party: p.party, slug: p.slug, mlaCount: p.mlaCount }))}
              party={party.party}
              label={seatsLabel}
            />
          </div>

          <ul className={`${m.bento} ${styles.statTiles}`}>
            <li className={`${m.tile} ${m.tQuarter} ${styles.statTile}`}>
              <div className={`${m.tileHead} ${styles.statHead}`}>
                <span className={`${m.iconTile} ${m.tnAmber}`}><PieChart size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Share of seats</span>
              </div>
              <span className={m.figValue}>{formatShare(party.mlaCount, totalSeats)}<small>%</small></span>
              <span className={styles.shareTrack} aria-hidden="true">
                <span className={styles.shareFill} style={{ width: `${seatShare}%`, background: colour }} />
              </span>
              <p className={m.kpiSub}>{party.mlaCount} of {totalSeats} seats.</p>
            </li>

            <li className={`${m.tile} ${m.tQuarter} ${styles.statTile}`}>
              <div className={`${m.tileHead} ${styles.statHead}`}>
                <span className={`${m.iconTile} ${m.tnGreen}`}><Gauge size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Division attendance</span>
              </div>
              <span className={m.figValue}>
                {grade && attendancePct !== null ? <>{attendancePct.toFixed(1)}<small>%</small></> : <span className={m.valMuted}>N/A</span>}
              </span>
              <span className={styles.shareTrack} aria-hidden="true">
                {grade && attendancePct !== null && (
                  <span className={styles.shareFill} style={{ width: `${attendancePct}%`, background: GRADE_STROKE[grade] }} />
                )}
              </span>
              {grade ? (
                <p className={m.kpiSub}>
                  <span className={`${styles.gradeText} ${m[`tone_${grade === 'good' ? 'good' : grade === 'low' ? 'warn' : 'bad'}`]}`}>
                    {grade === 'good' ? 'At or above average' : grade === 'low' ? 'Below average' : 'Far below average'}
                  </span>
                  .<span className={styles.hideSm}> Current MLAs; Assembly average {averageAttendance.toFixed(1)}%.</span>
                </p>
              ) : (
                <p className={m.kpiSub}>No current MLA has a division record.</p>
              )}
            </li>

            <li className={`${m.tile} ${m.tQuarter} ${styles.statTile}`}>
              <div className={`${m.tileHead} ${styles.statHead}`}>
                <span className={`${m.iconTile} ${m.tnIndigo}`}><Gavel size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Ministers</span>
              </div>
              <span className={m.figValue}>{ministerCount}</span>
              <p className={m.kpiSub}>{ministerCount === 0 ? 'No ministerial posts.' : execRoles.length > 0 ? `Includes the ${execRoles.join(' and the ')}.` : 'Executive and departmental posts.'}</p>
            </li>

            <li className={`${m.tile} ${m.tQuarter} ${styles.statTile}`}>
              <div className={`${m.tileHead} ${styles.statHead}`}>
                <span className={`${m.iconTile} ${m.tnGreen}`}><ShieldCheck size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={m.tileLabel}>Committee chairs</span>
              </div>
              <span className={m.figValue}>{chairCount}</span>
              <p className={m.kpiSub}>{chairCount === 0 ? 'No committee chairs.' : 'Scrutiny committees led by the party.'}</p>
            </li>
          </ul>

          <div className={`${m.tile} ${m.activityTile} ${m.activity} ${styles.activityGap}`} role="region" aria-labelledby="party-activity-heading">
          <h2 id="party-activity-heading" className="sr-only">Party activity and finances</h2>
          <PartyDetailClient
            mlas={party.mlas}
            ministers={party.ministers ?? []}
            chairs={party.committeeChairs ?? []}
            averageAttendance={averageAttendance}
            attendanceFloor={floor}
            hasQuestions={totalQuestions > 0}
            statsContent={<PartyStatsClient stats={stats} trendRanks={trendRanks} partyColor={colour} mlaCount={party.mlaCount} current={grade && attendancePct !== null ? { pct: attendancePct, count: figures.length, grade, average: averageAttendance } : null} />}
            chamberContent={
              <PartyChamberClient
                hansardStats={hansardStats}
                hansardPartyRank={hansardPartyRank}
                hansardPartyDebateRank={hansardPartyDebateRank}
                hansardSittingsByMonth={hansardSittingsByMonth}
                partyColor={colour}
                party={party.party}
              />
            }
            expensesContent={
              expenses ? (
                <PartyExpensesClient expenses={expenses} mandateExpenses={mandateExpenses} mandateMlas={mandateMlaExpenses} partyColor={colour} />
              ) : (
                <p className={m.tileText}>No expenses data available.</p>
              )
            }
            questionsContent={
              <PartyQuestionsClient
                totalQuestions={totalQuestions}
                writtenCount={writtenCount}
                oralCount={oralCount}
                questionStats={questionStatsRows}
                questionRanking={questionRanking}
                partyColor={colour}
              />
            }
          />
          </div>
        </div>
      </section>
    </div>
  )
}
