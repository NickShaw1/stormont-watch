import Link from 'next/link'
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
  const [leaderboard, assemblyStats, avgAttendance, partyCohesion, rebelliousMla, crossCommunity, crossCommunityTrends, overallAgreementRate, partyAttendance, allMandateMembers, partyAlignment, bigTwoAgreement, blocAgreement] = await Promise.all([
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
      <header className="page-header">
        <StatsBreadcrumb label="Voting and Attendance" basePath={basePath} />
        <h1>Voting and Attendance</h1>
        <p className="lede">How MLAs and parties vote. Attendance records, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</p>
      </header>

      {/* MLA Voting */}
      <section aria-labelledby="mla-stats-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Individual performance</p>
          <h2 id="mla-stats-heading" className={styles.sectionTitle}>MLA Voting</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>Who shows up, who votes Aye and who votes No. The top and bottom 5 <strong>{sittingAdjective(mandate)} MLAs</strong> ranked.</p>
          <div className="note-card">
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
          <div style={{ marginTop: 'var(--s-10)' }}>
            <h3 className={styles.chartTitle} style={{ marginTop: 0 }}>Party Attendance</h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>Average percentage of divisions attended by each party&apos;s <strong>current and former MLAs</strong> across the {mandate.label} mandate, excluding presiding officers and divisions before each MLA&apos;s mandate start date.</p>
            <PartyAttendanceChart data={partyAttendance} />
          </div>
        )}
      </section>

      <hr className="section-rule" />

      {/* How parties vote */}
      <section aria-labelledby="patterns-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Party behaviour</p>
          <h2 id="patterns-heading" className={styles.sectionTitle}>How parties vote</h2>
          <div className={styles.sectionRule}></div>
        </div>
        <div className={styles.patternsGrid}>
          <div className={styles.partyRankingCard}>
            <p className={styles.partyRankingTitle}>Party cohesion</p>
            <p className={styles.partyRankingSubtitle}>Percentage of votes where all party members who voted, voted the same way.</p>
            <table className={styles.partyRankingTable}>
              <thead>
                <tr>
                  <th scope="col">Party</th>
                  <th scope="col"><abbr title="Members">Mbrs</abbr></th>
                  <th scope="col" aria-label="Proportion"></th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                {partyCohesion.map((row, i) => (
                  <tr key={row.party}>
                    <td>
                      <span className={styles.partyRankingParty}>
                        <span className={styles.partyRankingRank}>{i + 1}</span>
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
                  <MlaPhoto name={rebelliousMla.fullName} imgUrl={rebelliousMla.imgUrl ?? ''} size={64} decorative square />
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
          <div style={{ marginTop: 'var(--s-10)' }}>
            <h3 className={styles.chartTitle} style={{ marginTop: 0 }}>Smaller party alignment with SF &amp; DUP</h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--spacing-md)' }}>
              For each of the {partyAlignment.totalDivisions}{' '}divisions since {mandate.startLabel}, each party&apos;s majority position is whichever of Aye, No, Abstain, or No Show was recorded by the most of its MLAs. Both current and former mandate MLAs are included.
            </p>
            <div className={styles.patternsGrid}>
              <PartyAlignmentTable data={partyAlignment.rows} />
            </div>
          </div>
        )}

        {bigTwoAgreement.totalDivisions > 0 && (
          <div style={{ marginTop: 'var(--s-10)' }}>
            <h3 className={styles.chartTitle} style={{ marginTop: 0 }}>How often Sinn Féin and the DUP agree</h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--spacing-md)' }}>
              For each of the {bigTwoAgreement.totalDivisions}{' '}divisions since {mandate.startLabel}, each party&apos;s majority position is whichever of Aye, No, Abstain, or No Show was recorded by the most of its MLAs. Both current and former mandate MLAs are included. Sinn Féin and the DUP recorded the same position {bigTwoAgreement.agreed} times.
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
            />
          </div>
        )}

        {blocAgreement.totalDivisions > 0 && (
          <div style={{ marginTop: 'var(--s-10)' }}>
            <h3 className={styles.chartTitle} style={{ marginTop: 0 }}>How often the unionist and nationalist blocs agree</h3>
            <p className={styles.sectionDesc} style={{ marginBottom: 'var(--spacing-md)' }}>
              For each of the {blocAgreement.totalDivisions}{' '}divisions since {mandate.startLabel}, a bloc&apos;s position is the side taken by more than half of that bloc&apos;s MLAs who voted. This is measured differently to the party figures above: it groups MLAs by designation rather than party, excludes MLAs who designate as neither unionist nor nationalist, and counts only Aye and No votes, so abstentions and absences are left out. The two blocs took the same side {blocAgreement.agreed} times.
            </p>
            <AgreementCard
              title="Agreement between unionist and nationalist blocs"
              barColor="#6366F1"
              agreePct={blocAgreement.agreePct}
              agreed={blocAgreement.agreed}
              totalDivisions={blocAgreement.totalDivisions}
              items={[
                { label: 'Both Aye', value: blocAgreement.bothAye },
                { label: 'Both No', value: blocAgreement.bothNo },
                { label: 'Did not agree', value: blocAgreement.disagreed },
              ]}
            />
          </div>
        )}
      </section>

      <hr className="section-rule" />

      {/* Bloc voting agreement */}
      <section aria-labelledby="cross-community-heading" className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className="eyebrow">Unionist and nationalist blocs</p>
          <h2 id="cross-community-heading" className={styles.sectionTitle}>Bloc voting agreement</h2>
          <div className={styles.sectionRule}></div>
          <p className={styles.sectionDesc}>How often unionist and nationalist MLAs voted the same way on the same division.</p>
          <div className="note-card">
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
