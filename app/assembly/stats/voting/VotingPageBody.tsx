import Link from 'next/link'
import { CheckCircle2, Handshake, Scale, Users, CalendarCheck, ArrowLeftRight, Gauge, ArrowRight, Info, Flame } from 'lucide-react'
import {
  getMlaLeaderboard,
  getAverageAttendance,
  getPartyCohesion,
  getMostRebelliousMla,
  getMostCrossCommunityAgreement,
  getCrossCommunityTrends,
  getPartyAttendanceAll,
  getPartyAlignmentWithBigTwo,
  getBigTwoAgreement,
  getBlocAgreement,
  getPartyAgreedDivisions,
  getBigTwoAgreedDivisions,
} from '@/lib/db/queries'
import RankingTile from '../RankingTile'
import PartyBars from '../PartyBars'
import PartyAlliances from '../PartyAlliances'
import AgreementPair from '../AgreementPair'
import BlocTrends from '../BlocTrends'
import PhoneSections from '../PhoneSections'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { isPassed } from '@/lib/bills'
import styles from '../statsKit.module.css'
import { type Mandate, sittingAdjective } from '@/lib/constants/mandates'

// Shared by the live route and archive routes; mandate/basePath vary per route.
export default async function VotingPageBody({
  mandate,
  basePath,
}: {
  mandate: Mandate
  basePath: string
}) {
  const [leaderboard, avgAttendance, partyCohesion, rebelliousMla, crossCommunity, crossCommunityTrends, partyAttendance, partyAlignment, bigTwoAgreement, blocAgreement, agreedDivisions, bigTwoAgreedDivisions] = await Promise.all([
    getMlaLeaderboard(mandate.id),
    getAverageAttendance(mandate.id),
    getPartyCohesion(mandate.id),
    getMostRebelliousMla(mandate.id),
    getMostCrossCommunityAgreement(mandate.id),
    getCrossCommunityTrends(mandate.id),
    getPartyAttendanceAll(mandate.id),
    getPartyAlignmentWithBigTwo(mandate.id),
    getBigTwoAgreement(mandate.id),
    getBlocAgreement(mandate.id),
    getPartyAgreedDivisions(mandate.id),
    getBigTwoAgreedDivisions(mandate.id),
  ])

  type RawDivisionRow = { document_id?: string; documentId?: string; subject?: string }
  const ccRow = crossCommunity as unknown as RawDivisionRow | null
  const crossCommunityDivisionId = ccRow ? (ccRow.document_id ?? ccRow.documentId ?? null) : null
  const ccPassed = crossCommunity ? isPassed(crossCommunity.outcome) : null
  const ccTone = ccPassed === null ? 'none' : ccPassed ? 'pass' : 'fail'
  const ccBlocs = crossCommunity
    ? [
        { label: 'Nationalist', aye: Number(crossCommunity.nationalistAyes), no: Number(crossCommunity.nationalistNoes) },
        { label: 'Unionist', aye: Number(crossCommunity.unionistAyes), no: Number(crossCommunity.unionistNoes) },
        { label: 'Other', aye: Number(crossCommunity.otherAyes), no: Number(crossCommunity.otherNoes) },
      ]
    : []
  const mostCohesive = partyCohesion.length > 0 ? [...partyCohesion].sort((a, b) => b.cohesionPct - a.cohesionPct)[0] : null

  const attendance = (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="attendance-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Individual performance</span>
          <h2 className={styles.h2} id="attendance-heading">Attendance and voting</h2>
          <p className={styles.sectionSub}>Who shows up, who votes Aye and who votes No. The top five {sittingAdjective(mandate)} MLAs for each measure, excluding presiding officers.</p>
        </div>
        <div className={styles.bento}>
          <section className={`${styles.span7} ${styles.tile}`} aria-labelledby="ranking-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnGreen}`}><CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" /></span>
              <h3 className={styles.tileTitle} id="ranking-heading">MLA rankings</h3>
            </div>
            <RankingTile data={leaderboard} />
            <div className={styles.note}>
              <Info size={18} strokeWidth={2} aria-hidden="true" />
              <p>Ministers may record lower division attendance due to Executive and departmental responsibilities.</p>
            </div>
          </section>
          {partyAttendance.length > 0 && (
            <section className={`${styles.span5} ${styles.tile}`} aria-labelledby="party-att-heading">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnBlue}`}><CalendarCheck size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="party-att-heading">Party attendance</h3>
                  <p className={styles.tileSub}>Average attendance of each party&apos;s {sittingAdjective(mandate)} MLAs at divisions, excluding the Speaker.</p>
                </div>
              </div>
              <PartyBars rows={partyAttendance.map((r) => ({ party: r.party, value: r.attendancePct }))} format={(v) => `${v.toFixed(1)}%`} label="Average attendance by party" />
            </section>
          )}
        </div>
      </div>
    </section>
  )

  const parties = (
    <section className={`${styles.band} ${styles.bandPlain}`} aria-labelledby="parties-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Party behaviour</span>
          <h2 className={styles.h2} id="parties-heading">How parties vote</h2>
        </div>
        <div className={styles.stack}>
          {partyAlignment.rows.length > 0 && (
            <section className={styles.tile} aria-labelledby="alliances-heading">
              <div className={styles.tileHead}>
                <span className={`${styles.iconTile} ${styles.tnIndigo}`}><ArrowLeftRight size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="alliances-heading">Who votes with Sinn Féin and the DUP</h3>
                  <p className={styles.tileSub}>Share of the {partyAlignment.totalDivisions} divisions where each party&apos;s majority position matched Sinn Féin&apos;s or the DUP&apos;s. Select a party to see the divisions.</p>
                </div>
              </div>
              <PartyAlliances data={partyAlignment.rows} agreedDivisions={agreedDivisions} basePath={basePath} totalDivisions={partyAlignment.totalDivisions} />
            </section>
          )}

          <AgreementPair
            bigTwo={bigTwoAgreement.totalDivisions > 0 ? {
              agreePct: bigTwoAgreement.agreePct,
              agreed: bigTwoAgreement.agreed,
              totalDivisions: bigTwoAgreement.totalDivisions,
              items: [
                { label: 'Both Aye', value: bigTwoAgreement.bothAye },
                { label: 'Both No', value: bigTwoAgreement.bothNo },
                { label: 'Both abstain', value: bigTwoAgreement.bothAbstain },
                { label: 'Both no show', value: bigTwoAgreement.bothNoShow },
                { label: 'Did not agree', value: bigTwoAgreement.disagreed },
              ],
            } : null}
            bloc={blocAgreement.totalDivisions > 0 ? {
              agreePct: blocAgreement.agreePct,
              agreed: blocAgreement.agreed,
              totalDivisions: blocAgreement.totalDivisions - blocAgreement.noParticipation,
              items: [
                { label: 'Both Aye', value: blocAgreement.bothAye },
                { label: 'Both No', value: blocAgreement.bothNo },
                { label: 'Did not agree', value: blocAgreement.disagreed },
                { label: 'One bloc did not vote', value: blocAgreement.noParticipation },
              ],
            } : null}
            divisions={bigTwoAgreedDivisions}
            basePath={basePath}
          />

          <section className={styles.tile} aria-labelledby="cohesion-heading">
            <div className={styles.tileHead}>
              <span className={`${styles.iconTile} ${styles.tnPurple}`}><Users size={22} strokeWidth={2} aria-hidden="true" /></span>
              <div className={styles.tileTitles}>
                <h3 className={styles.tileTitle} id="cohesion-heading">Party cohesion</h3>
                <p className={styles.tileSub}>Share of votes where every party member who voted, voted the same way. Excludes the Speaker and Deputy Speakers, and parties with one MLA.</p>
              </div>
            </div>
            <PartyBars ranked wide rows={partyCohesion.map((r) => ({ party: r.party, value: r.cohesionPct, meta: `${r.memberCount} MLAs` }))} label="Party cohesion" />
            {rebelliousMla && (
              <div className={styles.rebel} role="group" aria-labelledby="rebel-heading">
                <span className={`${styles.iconTile} ${styles.tnCoral}`}><Flame size={22} strokeWidth={2} aria-hidden="true" /></span>
                <span className={styles.personPhoto}><MlaPhoto name={rebelliousMla.fullName} imgUrl={rebelliousMla.imgUrl ?? ''} size={128} decorative square personId={rebelliousMla.personId} /></span>
                <div className={styles.rebelInfo}>
                  <span className={styles.rebelLabel} id="rebel-heading">Most rebellious MLA</span>
                  <Link href={`${basePath}/assembly/mlas/${rebelliousMla.personId}`} className={styles.personName}>{formatMemberName(rebelliousMla.fullName)}</Link>
                </div>
                <span className="party-pill" data-party={abbreviateParty(rebelliousMla.party)}><PartyName party={rebelliousMla.party} /></span>
                <span className={styles.rebelStat}>{rebelliousMla.rebellionPct}% rebellion rate, {rebelliousMla.rebellionCount} votes against their party</span>
              </div>
            )}
          </section>

          {crossCommunity && (
            <section className={styles.tile} aria-labelledby="cc-heading">
              <div className={`${styles.tileHead} ${styles.agHead}`}>
                <span className={`${styles.iconTile} ${styles.tnAmber}`}><Handshake size={22} strokeWidth={2} aria-hidden="true" /></span>
                <div className={styles.tileTitles}>
                  <h3 className={styles.tileTitle} id="cc-heading">Strongest consensus</h3>
                  <p className={styles.tileSub}>The division where unionist, nationalist and other MLAs came closest to voting as one.</p>
                </div>
                {crossCommunityDivisionId && (
                  <Link href={`${basePath}/assembly/divisions/${crossCommunityDivisionId}`} className={`${styles.linkPill} ${styles.agAction} ${styles.agBtnTop}`}>View the division<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
                )}
              </div>
              <div className={styles.cc}>
                <div className={styles.ccTop}>
                  <span className={styles.dResult} data-tone={ccTone}>{ccPassed === null ? 'No result' : ccPassed ? 'Passed' : 'Failed'}</span>
                  <p className={styles.ccTitle}>{formatDivisionSubject(crossCommunity.title ?? crossCommunity.subject).title}</p>
                  <span className={styles.dMeta}>{formatDate(new Date(crossCommunity.divisionDate).toISOString())}</span>
                </div>
                <div className={styles.ccTotals}>
                  <span className={styles.ccTotal} data-vote="AYE"><b>{crossCommunity.totalAyes}</b>Ayes</span>
                  <span className={styles.ccTotal} data-vote="NO"><b>{crossCommunity.totalNoes}</b>Noes</span>
                </div>
                <ul className={styles.ccBlocs} aria-label="How each bloc voted">
                  {ccBlocs.map((r) => (
                    <li key={r.label} className={styles.ccBloc}>
                      <span className={styles.ccBlocName}>{r.label}</span>
                      <span className={styles.ccBar} aria-hidden="true">
                        {r.aye + r.no > 0 && <><i data-vote="AYE" style={{ flexGrow: r.aye }} /><i data-vote="NO" style={{ flexGrow: r.no }} /></>}
                      </span>
                      <span className={styles.ccBlocVotes}>{r.aye} Aye, {r.no} No</span>
                    </li>
                  ))}
                </ul>
              </div>
              {crossCommunityDivisionId && (
                <Link href={`${basePath}/assembly/divisions/${crossCommunityDivisionId}`} className={`${styles.linkPill} ${styles.agBtnBottom}`}>View the division<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  )

  const blocs = (
    <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="blocs-trend-heading">
      <div className="container">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Unionist and nationalist blocs</span>
          <h2 className={styles.h2} id="blocs-trend-heading">Bloc voting agreement</h2>
          <p className={styles.sectionSub}>How often unionist and nationalist MLAs voted the same way on the same division. Figures cover divisions where a formal vote was called.</p>
        </div>
        <BlocTrends data={crossCommunityTrends} />
      </div>
    </section>
  )

  return (
    <div className={styles.page}>
      <section className={`${styles.band} ${styles.bandPage}`} aria-labelledby="voting-title">
        <div className="container">
          <header className={styles.head}>
            <span className={styles.eyebrow}>Statistics</span>
            <h1 className={styles.h1} id="voting-title">Voting and attendance</h1>
            <p className={styles.headSub}>How MLAs and parties vote: attendance, party cohesion, rebellion rates and cross-community trends since {mandate.startLabel}.</p>
          </header>
          <ul className={`${styles.headline} ${styles.headline4}`} aria-label="Headline figures">
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnGreen}`}><Gauge size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Attendance</span></div>
              <span className={styles.hFigure}>{avgAttendance}%</span>
              <span className={styles.hSub}>average of {sittingAdjective(mandate)} MLAs, not counting the Speaker&apos;s time in office</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnTeal}`}><Handshake size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>SF and DUP</span></div>
              <span className={styles.hFigure}>{bigTwoAgreement.agreePct}%</span>
              <span className={styles.hSub}>of divisions, same position</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnIndigo}`}><Scale size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Blocs</span></div>
              <span className={styles.hFigure}>{blocAgreement.agreePct}%</span>
              <span className={styles.hSub}>unionist and nationalist agree</span>
            </li>
            <li className={styles.hItem}>
              <div className={styles.hHead}><span className={`${styles.iconTile} ${styles.tnPurple}`}><Users size={20} strokeWidth={2} aria-hidden="true" /></span><span className={styles.hLabel}>Most united party</span></div>
              <span className={styles.hFigure}>{mostCohesive ? `${mostCohesive.cohesionPct}%` : '-'}</span>
              <span className={styles.hSub}>{mostCohesive ? `of votes, ${mostCohesive.party === 'Independent' ? 'Independent' : abbreviateParty(mostCohesive.party)} MLAs all voted the same way` : 'No data'}</span>
            </li>
          </ul>
        </div>
      </section>
      <PhoneSections
        sections={[
          { key: 'attendance', label: 'Attendance', icon: 'calendar', meta: 'Rankings and parties', node: attendance },
          { key: 'parties', label: 'How parties vote', icon: 'users', meta: 'Cohesion and agreement', node: parties },
          { key: 'blocs', label: 'Bloc agreement', icon: 'scale', meta: 'Trends by month', node: blocs },
        ]}
      />
    </div>
  )
}
