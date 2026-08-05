import Link from 'next/link'
import { Vote, CheckCircle2, Handshake, Scale, Users, CalendarCheck, ArrowLeftRight } from 'lucide-react'
import {
  getMlaLeaderboard,
  getAssemblyStats,
  getAverageAttendance,
  getPartyCohesion,
  getMostRebelliousMla,
  getMostCrossCommunityAgreement,
  getCrossCommunityTrends,
  getOverallAgreementRate,
  getPartyAttendanceAll,
  getAllMandateMembers,
  getPartyAlignmentWithBigTwo,
  getBigTwoAgreement,
  getBlocAgreement,
  getPartyAgreedDivisions,
  getBigTwoAgreedDivisions,
} from '@/lib/db/queries'
import StatsRankingTabs from '../StatsRankingTabs'
import CrossCommunityTrendsClient from '../CrossCommunityTrendsClient'
import PartyAttendanceChart from '../PartyAttendanceChart'
import PartyAlignmentTable from '../PartyAlignmentTable'
import AgreementCard from '../AgreementCard'
import StatsBreadcrumb from '../StatsBreadcrumb'
import MlaPhoto from '@/components/MlaPhoto'
import { formatMemberName, partyBorderColor, abbreviateParty } from '@/lib/format'
import PartyName from '@/components/PartyName'
import styles from '../stats.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

/**
 * Shared body for the voting stats page — rendered by both the live route (current
 * mandate, basePath '') and the archive route (`/archive/<id>`). `mandate` drives the
 * queries and copy; `basePath` prefixes internal links.
 */
export default async function VotingPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [leaderboard, assemblyStats, avgAttendance, partyCohesion, rebelliousMla, crossCommunity, crossCommunityTrends, overallAgreementRate, partyAttendance, allMandateMembers, partyAlignment, bigTwoAgreement, blocAgreement, agreedDivisions, bigTwoAgreedDivisions] = await Promise.all([
    getMlaLeaderboard(mandate.id),
    getAssemblyStats(mandate.id),
    getAverageAttendance(mandate.id),
    getPartyCohesion(mandate.id),
    getMostRebelliousMla(mandate.id),
    getMostCrossCommunityAgreement(mandate.id),
    getCrossCommunityTrends(mandate.id),
    getOverallAgreementRate(mandate.id),
    getPartyAttendanceAll(mandate.id),
    getAllMandateMembers(mandate.id),
    getPartyAlignmentWithBigTwo(mandate.id),
    getBigTwoAgreement(mandate.id),
    getBlocAgreement(mandate.id),
    getPartyAgreedDivisions(mandate.id),
    getBigTwoAgreedDivisions(mandate.id),
  ])

  void assemblyStats
  void overallAgreementRate
  void allMandateMembers

  type RawDivisionRow = { document_id?: string; documentId?: string; subject?: string }
  const crossCommunityDivisionId = crossCommunity
    ? ((crossCommunity as unknown as RawDivisionRow).document_id ?? (crossCommunity as unknown as RawDivisionRow).documentId ?? null)
    : null
  const crossCommunitySubject = crossCommunity
    ? (crossCommunity as unknown as RawDivisionRow).subject ?? null
    : null

  return (
    <div className="container">
      <header className={styles.pageHeader}>
        <StatsBreadcrumb label="Voting and Attendance" basePath={basePath} />
        <h1 className={styles.pageHeaderTitle}>
          <Vote className={styles.pageHeaderIcon} size={29} strokeWidth={1.75} aria-hidden="true" />
          Voting and Attendance
        </h1>
        <p className={styles.lede}>How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</p>
      </header>

      {/* MLA Voting */}
      <section aria-labelledby="mla-stats-heading" className={styles.section} style={{ marginTop: 0 }}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Individual performance</span>
          <h2 id="mla-stats-heading" className={styles.sectionTitle}>
            <CheckCircle2 className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            MLA Voting
          </h2>
          <p className={styles.sectionDesc}>Who shows up, who votes Aye and who votes No. The top and bottom 5 {sittingAdjective(mandate)} MLAs ranked.</p>
          <div className={`note-card ${styles.mlaVotingNote}`}>
            <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p>Ministers may record lower division attendance due to Executive and departmental responsibilities.</p>
          </div>
        </div>
        <StatsRankingTabs data={leaderboard} />

        {partyAttendance.length > 0 && (
          <div style={{ marginTop: 'var(--sw-space-9)' }}>
            <h3 className={styles.chartTitle} style={{ marginTop: 0 }}>
              <CalendarCheck className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              Party Attendance
            </h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Average percentage of divisions attended by each party&apos;s current and former MLAs across the {mandate.label} mandate, excluding presiding officers. MLAs are only counted from the date they took their seat.</p>
            <PartyAttendanceChart data={partyAttendance} />
          </div>
        )}
      </section>

      {/* How parties vote */}
      <section aria-labelledby="patterns-heading" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Party behaviour</span>
          <h2 id="patterns-heading" className={styles.sectionTitle}>
            <Handshake className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            How parties vote
          </h2>
        </div>
        <div className={styles.patternsGrid}>
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>
              Party cohesion
              <Users className={styles.cardTitleIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
            </p>
            <p className={styles.partyRankingSubtitle}>Percentage of votes where all party members who voted, voted the same way.</p>
            <table className={`${styles.partyRankingTable} ${styles.partyRankingTablePct}`}>
              <colgroup>
                <col className={styles.colRank} />
                <col className={styles.colParty} />
                <col className={styles.colMbrs} />
                <col className={styles.colBar} />
                <col className={styles.colTotal} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={styles.thRank} aria-label="Rank"></th>
                  <th scope="col">Party</th>
                  <th scope="col" className={styles.thMbrs}><abbr title="Members">Mbrs</abbr></th>
                  <th scope="col" aria-label="Proportion"></th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {partyCohesion.map((row, i) => (
                  <tr key={row.party}>
                    <td className={styles.partyRankingRank}>{i + 1}</td>
                    <td>
                      <span className={styles.partyRankingParty}>
                        <span className={styles.partyDot} style={{ background: partyBorderColor(row.party) }} aria-hidden="true" />
                        <PartyName party={row.party} />
                      </span>
                    </td>
                    <td className={styles.cohesionMembers}>{row.memberCount}</td>
                    <td className={styles.partyRankingBarCell}>
                      <div className={styles.partyRankingBarTrack} aria-hidden="true">
                        <div className={styles.partyRankingBarFill} style={{ width: `${row.cohesionPct}%`, background: partyBorderColor(row.party) }} />
                      </div>
                    </td>
                    <td className={styles.partyRankingValue}>{row.cohesionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.patternStack}>
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Average {sittingAdjective(mandate)} MLA attendance</h3>
              <span className={styles.patternBigValue}>{avgAttendance}%</span>
              <span className={styles.patternNote}>of divisions attended, excluding presiding officers</span>
            </div>
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Most cross-community agreement</h3>
              {crossCommunity && crossCommunityDivisionId ? (
                <>
                  <span className={styles.patternNote}>The division with the strongest cross-community consensus by total votes cast.</span>
                  <Link
                    href={`${basePath}/assembly/divisions/${crossCommunityDivisionId}`}
                    className={styles.patternDivisionLink}
                    aria-label={crossCommunitySubject ? `View division: ${crossCommunitySubject}` : 'View division'}
                  >
                    View division
                  </Link>
                </>
              ) : <span className={styles.overviewMeta}>No data</span>}
            </div>
            <div className={styles.patternStackItem}>
              <h3 className={styles.overviewLabel}>Most rebellious MLA</h3>
              {rebelliousMla ? (
                <div className={styles.rebelliousCard}>
                  <MlaPhoto name={rebelliousMla.fullName} imgUrl={rebelliousMla.imgUrl ?? ''} size={64} decorative square personId={rebelliousMla.personId} />
                  <div className={styles.rebelliousInfo}>
                    <Link href={`${basePath}/assembly/mlas/${rebelliousMla.personId}`} className={styles.patternName}>
                      {formatMemberName(rebelliousMla.fullName)}
                    </Link>
                    <span className="party-pill" data-party={abbreviateParty(rebelliousMla.party)}>
                      <PartyName party={rebelliousMla.party} />
                    </span>
                    <span className={styles.patternNote}>
                      <strong>{rebelliousMla.rebellionPct}%</strong> rebellion rate<span aria-hidden="true"> · </span>{rebelliousMla.rebellionCount} votes against party
                    </span>
                  </div>
                </div>
              ) : <span className={styles.overviewMeta}>No data</span>}
            </div>
          </div>
        </div>

        {partyAlignment.rows.length > 0 && (
          <div>
            <h3 className={styles.chartTitle}>
              <ArrowLeftRight className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              Smaller party alignment with SF &amp; DUP
            </h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--s-4)' }}>
              For each of the {partyAlignment.totalDivisions}{' '}divisions since {mandate.startLabel}, each party&apos;s majority position is whichever of Aye, No, Abstain, or No Show was recorded by the most of its MLAs. Both current and former mandate MLAs are included. Click a party to see the divisions where its position matched.
            </p>
            <div className={styles.stackedCards}>
              <PartyAlignmentTable data={partyAlignment.rows} agreedDivisions={agreedDivisions} tableKey="sf" title="Agreement with Sinn Féin" partnerParty="Sinn Féin" basePath={basePath} />
              <PartyAlignmentTable data={partyAlignment.rows} agreedDivisions={agreedDivisions} tableKey="dup" title="Agreement with DUP" partnerParty="DUP" basePath={basePath} />
            </div>
          </div>
        )}

        {bigTwoAgreement.totalDivisions > 0 && (
          <div>
            <h3 className={styles.chartTitle}>
              <Handshake className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              How often Sinn Féin and the DUP agree
            </h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--s-4)' }}>
              For each of the {bigTwoAgreement.totalDivisions}{' '}divisions since {mandate.startLabel}, each party&apos;s majority position is whichever of Aye, No, Abstain, or No Show was recorded by the most of its MLAs. Both current and former mandate MLAs are included.
            </p>
            <AgreementCard
              title="Agreement between Sinn Féin and the DUP"
              agreePct={bigTwoAgreement.agreePct}
              agreed={bigTwoAgreement.agreed}
              totalDivisions={bigTwoAgreement.totalDivisions}
              items={[
                { label: 'Both Aye', value: bigTwoAgreement.bothAye },
                { label: 'Both No', value: bigTwoAgreement.bothNo },
                { label: 'Both Abstain', value: bigTwoAgreement.bothAbstain },
                { label: 'Both No Show', value: bigTwoAgreement.bothNoShow },
                { label: 'Did not agree', value: bigTwoAgreement.disagreed },
              ]}
              expandable={{ partyA: 'Sinn Féin', partyB: 'DUP', divisions: bigTwoAgreedDivisions, basePath }}
            />
          </div>
        )}

        {blocAgreement.totalDivisions > 0 && (
          <div>
            <h3 className={styles.chartTitle}>
              <Vote className={styles.chartTitleIcon} size={18} strokeWidth={1.75} aria-hidden="true" />
              How often the unionist and nationalist blocs agree
            </h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--s-4)' }}>
              For each of the {blocAgreement.totalDivisions}{' '}divisions since {mandate.startLabel}, a bloc&apos;s position is the side taken by more than half of that bloc&apos;s MLAs who voted. This is measured differently to the party figures above: it groups MLAs by designation rather than party, excludes MLAs who designate as neither unionist nor nationalist, and counts only Aye and No votes, so abstentions and absences are left out. Divisions where a whole bloc cast no Aye or No votes, such as a Speaker nomination Sinn Féin did not contest, are shown separately rather than counted as disagreement.
            </p>
            <AgreementCard
              title="Agreement between unionist and nationalist blocs"
              barColor="#6366F1"
              agreePct={blocAgreement.agreePct}
              agreed={blocAgreement.agreed}
              totalDivisions={blocAgreement.totalDivisions - blocAgreement.noParticipation}
              items={[
                { label: 'Both Aye', value: blocAgreement.bothAye },
                { label: 'Both No', value: blocAgreement.bothNo },
                { label: 'Did not agree', value: blocAgreement.disagreed },
                { label: 'One bloc did not vote', value: blocAgreement.noParticipation },
              ]}
            />
          </div>
        )}
      </section>

      {/* Bloc voting agreement */}
      <section aria-labelledby="cross-community-heading" className={`${styles.section} ${styles.sectionLast}`}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionEyebrow}>Unionist and nationalist blocs</span>
          <h2 id="cross-community-heading" className={styles.sectionTitle}>
            <Scale className={styles.sectionTitleIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Bloc voting agreement
          </h2>
          <p className={styles.sectionDesc}>How often unionist and nationalist MLAs voted the same way on the same division.</p>
          <div className={`note-card ${styles.mlaVotingNote}`}>
            <svg className="note-card-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#9ca3af"/>
              <rect x="9" y="9" width="2" height="6" rx="1" fill="white"/>
              <rect x="9" y="5" width="2" height="2" rx="1" fill="white"/>
            </svg>
            <p>Figures cover divisions where a formal vote was called. Items passed without division are not included.</p>
          </div>
        </div>
        <CrossCommunityTrendsClient data={crossCommunityTrends} />
      </section>
    </div>
  )
}
