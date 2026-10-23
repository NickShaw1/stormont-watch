import Link from 'next/link'
import { Vote, Users, Handshake, PoundSterling, Trophy, Lightbulb, ArrowRight, Scale, PiggyBank, Activity, Wallet, Coins, MessageSquare, Mic, ListChecks } from 'lucide-react'
import {
  getAssemblyStats,
  getPassRateByYear,
  getOverallAgreementRate,
  getAllMembers,
  getAllExpensesLeagueTable,
  getLatestExpensesYear,
  getAverageAttendance,
  getBigTwoAgreement,
  getPartyAlignmentWithBigTwo,
  getPartyCohesion,
  getHansardTopByMLA,
} from '@/lib/db/queries'
import StatsHighlights from './StatsHighlights'
import HeroArt from './HeroArt'
import styles from './statsKit.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'
import { formatMemberName } from '@/lib/format'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function StatsPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [assemblyStats, passRateByYear, overallAgreementRate, allCurrentMembers, allExpenseRows, latestExpensesYear,
    averageAttendance, bigTwoAgreement, partyAlignment, partyCohesion, topSittingsMla] = await Promise.all([
    getAssemblyStats(mandate.id),
    getPassRateByYear(mandate.id),
    getOverallAgreementRate(mandate.id),
    getAllMembers(mandate.id),
    getAllExpensesLeagueTable(mandate.id),
    getLatestExpensesYear(mandate.id),
    getAverageAttendance(mandate.id),
    getBigTwoAgreement(mandate.id),
    getPartyAlignmentWithBigTwo(mandate.id),
    getPartyCohesion(mandate.id),
    getHansardTopByMLA(1, 'sittings', mandate.id),
  ])

  const { totalDivisions, crossCommunityCount } = assemblyStats
  const allPassRates = passRateByYear.map(r => ({ year: Number(r.year), total: Number(r.total), passed: Number(r.passed) }))
  const totalPassed = allPassRates.reduce((s, r) => s + r.passed, 0)
  const overallPassRate = totalDivisions > 0 ? Math.round(totalPassed * 100 / totalDivisions) : 0
  const busiestYear = allPassRates.length > 0
    ? allPassRates.reduce((best, r) => r.total > best.total ? r : best, allPassRates[0])
    : null
  const currentMlaCount = allCurrentMembers.length
  const currentPartyCount = new Set(allCurrentMembers.map(m => m.party).filter(p => p && p !== 'Independent')).size
  // Latest published year across every MLA with expenses, current and former, as on the Spending page.
  const expensesLeague = allExpenseRows.filter(r => r.financialYear === latestExpensesYear)
  const totalExpenses = expensesLeague.reduce((sum, r) => sum + parseFloat(r.total ?? '0'), 0)

  const topSfAlignedParty = partyAlignment.rows.length > 0
    ? [...partyAlignment.rows].sort((a, b) => b.sfAgreePct - a.sfAgreePct)[0]
    : null
  const topDupAlignedParty = partyAlignment.rows.length > 0
    ? [...partyAlignment.rows].sort((a, b) => b.dupAgreePct - a.dupAgreePct)[0]
    : null
  const mostCohesiveParty = partyCohesion.length > 0
    ? [...partyCohesion].sort((a, b) => b.cohesionPct - a.cohesionPct)[0]
    : null
  const topSittings = topSittingsMla[0] ?? null
  const highestExpenseClaim = expensesLeague.length > 0 ? expensesLeague[0] : null

  const rankings = [
    { group: 'Public spending', items: [
      { href: '/assembly/salaries', title: 'Salaries', desc: `All ${sittingAdjective(mandate)} MLAs ranked by current annual salary and total mandate earnings.`, Icon: Wallet, tone: 'tnGreen' },
      { href: '/assembly/expenses', title: 'Expenses', desc: 'Every MLA with published expenses, current and former, ranked by total claimed.', Icon: Coins, tone: 'tnGreen' },
      { href: '/assembly/overall-cost', title: 'Overall cost', desc: `Every MLA of the ${mandate.label} mandate, current and former, ranked by estimated salary plus all published expenses.`, Icon: PiggyBank, tone: 'tnGreen' },
    ] },
    { group: 'Parliamentary activity', items: [
      { href: '/assembly/questions', title: 'Questions', desc: `All ${sittingAdjective(mandate)} MLAs except ministers and the Speaker, ranked by questions tabled since the ${mandate.label} mandate began.`, Icon: MessageSquare, tone: 'tnPurple' },
      { href: '/assembly/sittings', title: 'Sittings', desc: `All ${sittingAdjective(mandate)} MLAs except presiding officers, ranked by plenary sittings spoken in.`, Icon: Mic, tone: 'tnPurple' },
      { href: '/assembly/topics', title: 'Topics', desc: `All ${sittingAdjective(mandate)} MLAs except presiding officers, ranked by debate topics spoken on.`, Icon: ListChecks, tone: 'tnPurple' },
    ] },
  ]

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="stats-title">
        <div className="container">
          <div className={styles.headRow}>
            <header className={styles.head}>
              <span className={styles.eyebrow}>Statistics</span>
              <h1 className={styles.h1} id="stats-title">The {mandate.label} mandate in numbers</h1>
              <p className={styles.headSub}>Voting, attendance, spending and participation across the {mandate.label} mandate.</p>
            </header>
            <HeroArt className={styles.headArt} />
          </div>
          <ul className={styles.headline} aria-label="Headline figures">
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnBlue}`}><Vote size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Divisions</span></div>
              <span className={styles.hFigure}>{totalDivisions}</span>
              <span className={styles.hSub}>since {mandate.startLabel}</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnPurple}`}><Users size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>{mandate.isCurrent ? 'Current' : 'Sitting'} MLAs</span></div>
              <span className={styles.hFigure}>{currentMlaCount}</span>
              <span className={styles.hSub}>across {currentPartyCount} parties</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnAmber}`}><Handshake size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Consent votes</span></div>
              <span className={styles.hFigure}>{crossCommunityCount}</span>
              <span className={styles.hSub}>cross-community</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnGreen}`}><PoundSterling size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Expenses</span></div>
              <span className={styles.hFigure}>£{(totalExpenses / 1000000).toFixed(1)}m</span>
              <span className={styles.hSub}>current and former MLAs, {latestExpensesYear}</span>
            </li>
            <li className={`${styles.hItem} ${styles.hideOnPhone}`}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnPink}`}><Trophy size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Busiest year</span></div>
              <span className={styles.hFigure}>{busiestYear?.year ?? '-'}</span>
              <span className={styles.hSub}>{busiestYear?.total ?? 0} divisions</span>
            </li>
          </ul>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="explore-heading">
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Explore</span>
            <h2 className={styles.h2} id="explore-heading">Dig into the numbers</h2>
            <p className={styles.sectionSub}>Dive deeper into voting, spending and activity across the {mandate.label} mandate.</p>
          </div>
          <div className={styles.hubGrid}>
            {[
              { href: '/assembly/stats/voting', title: 'Voting', desc: `How MLAs and parties vote. Attendance, party cohesion, rebellion rates and cross-community trends since ${mandate.startLabel}.`, Icon: Scale, tone: 'tnBlue' },
              { href: '/assembly/stats/spending', title: 'Spending', desc: `Salaries, office expenses and the overall public cost of the Assembly since ${mandate.startLabel}.`, Icon: PoundSterling, tone: 'tnGreen' },
              { href: '/assembly/stats/activity', title: 'Activity', desc: `Questions to ministers and chamber participation across the ${mandate.label} mandate.`, Icon: Activity, tone: 'tnAmber' },
            ].map(({ href, title, desc, Icon, tone }) => (
              <Link key={href} href={`${basePath}${href}`} className={`${styles.hubTile} ${styles[tone]}`}>
                <span className={styles.hubIcon}><Icon size={30} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.hubTitle}>{title}</span>
                <span className={styles.hubDesc}>{desc}</span>
                <ArrowRight className={styles.hubArrow} size={22} strokeWidth={2} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="rankings-heading">
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Rankings</span>
            <h2 className={styles.h2} id="rankings-heading">Full rankings</h2>
            <p className={styles.sectionSub}>Complete MLA rankings across salary, expenses, overall cost and parliamentary questions.</p>
          </div>
          <div className={styles.rankGroups}>
          {rankings.map((g) => (
            <div key={g.group}>
              <h3 className={styles.rankGroup}>{g.group}</h3>
              <div className={styles.rankGrid}>
                {g.items.map(({ href, title, desc, Icon, tone }) => (
                  <Link key={href} href={`${basePath}${href}`} className={`${styles.rankRow} ${styles[tone]}`}>
                    <span className={`${styles.iconTile} ${styles[tone]}`}><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
                    <span className={styles.rankText}>
                      <span className={styles.rankTitle}>{title}</span>
                      <span className={styles.rankDesc}>{desc}</span>
                    </span>
                    <ArrowRight className={styles.rankArrow} size={20} strokeWidth={2} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
          </div>
          <p className={styles.footnote}>Some statistics reflect {sittingAdjective(mandate)} MLAs only. Others include former MLAs where data is available. Every effort has been made to clarify which applies throughout.</p>
        </div>
      </section>

      <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="highlights-heading">
        <div className="container">
          <div className={styles.bento}>
            <div className={`${styles.span12} ${styles.stack}`}>
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnAmber}`}><Lightbulb size={22} strokeWidth={2} aria-hidden="true" /></span>
                <h2 className={styles.tileTitle} id="highlights-heading">Did you know</h2>
              </div>
              <StatsHighlights
                overallPassRate={overallPassRate}
                overallAgreementRate={overallAgreementRate}
                averageAttendance={averageAttendance}
                sittingAdjective={sittingAdjective(mandate)}
                bigTwoAgreePct={bigTwoAgreement.agreePct}
                topSfAlignedParty={topSfAlignedParty}
                topDupAlignedParty={topDupAlignedParty}
                mostCohesiveParty={mostCohesiveParty}
                topSittings={topSittings ? { fullName: formatMemberName(topSittings.fullName), sittings: Number(topSittings.sittings) } : null}
                highestExpenseClaim={highestExpenseClaim ? { fullName: formatMemberName(highestExpenseClaim.fullName), total: parseFloat(highestExpenseClaim.total ?? '0'), period: highestExpenseClaim.period } : null}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
