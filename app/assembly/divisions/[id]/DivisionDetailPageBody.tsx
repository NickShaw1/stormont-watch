import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Vote, FileText, Users, Scale, CheckCircle2, XCircle, MinusCircle, UserX, Pencil, CalendarDays, User, Hash } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { getDivisionWithVotes, getHansardReportId, getAmendmentMotionTexts } from '@/lib/db/queries'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { isPassed } from '@/lib/bills'
import { formatDate } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatTabledBy } from '@/lib/utils/formatNames'
import type { Mandate } from '@/lib/constants/mandates'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

import RollCallClient from './RollCallClient'
import DesignationChartClient from './DesignationChartClient'
import PartyBreakdownClient from './PartyBreakdownClient'
import styles from './divisionDetail.module.css'

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
  // Mandate-scoped: a division from another mandate returns null and 404s here.
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

  // For non-amendment divisions, look for sibling amendment divisions that passed
  const amendmentTexts = !division.isMotionAmendment && division.title
    ? await getAmendmentMotionTexts(division.title, plenaryDateStr)
    : []

  const reportDocId = await getHansardReportId(plenaryDateStr)
  const officialReportUrl = reportDocId
    ? `https://aims.niassembly.gov.uk/officialreport/report.aspx?&eveDate=${plenaryDateStr.replace(/-/g, '/')}&docID=${reportDocId}`
    : null

  const ayes = votes.filter((v) => v.vote === 'AYE')
  const noes = votes.filter((v) => v.vote === 'NO')
  const abstains = votes.filter((v) => v.vote === 'ABSTAINED')
  const noShows = votes.filter((v) => v.vote === 'NO_SHOW')

  const totalAyes = division.totalAyes ?? ayes.length
  const totalNoes = division.totalNoes ?? noes.length
  const totalAbstain = division.totalAbstains ?? abstains.length
  const totalNoShow = noShows.length

  const passed = isPassed(division.outcome)

  const hasDesignationBreakdown =
    (division.nationalistAyes ?? 0) + (division.unionistAyes ?? 0) +
    (division.nationalistNoes ?? 0) + (division.unionistNoes ?? 0) > 0

  const noShowByDesignation = {
    Unionist: noShows.filter((v) => (v.memberDesignation ?? v.designation) === 'Unionist').length,
    Nationalist: noShows.filter((v) => (v.memberDesignation ?? v.designation) === 'Nationalist').length,
    Other: noShows.filter((v) => (v.memberDesignation ?? v.designation) === 'Other' || !(v.memberDesignation ?? v.designation)).length,
  }

  const abstainByDesignation = {
    Unionist: abstains.filter((v) => (v.memberDesignation ?? v.designation) === 'Unionist').length,
    Nationalist: abstains.filter((v) => (v.memberDesignation ?? v.designation) === 'Nationalist').length,
    Other: abstains.filter((v) => (v.memberDesignation ?? v.designation) === 'Other' || !(v.memberDesignation ?? v.designation)).length,
  }

  const hasDesignationNoShow = noShows.length > 0

  const raw = division.title ?? division.subject
  const { title: displayTitle, subtitle } = formatDivisionSubject(raw)
  const tabledByClean = formatTabledBy(division.tabledBy)

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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

  void mandate

  return (
    <div className="container">
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <header className={styles.divisionHeader}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            {parentBill?.[0] ? (
              <>
                <li><Link href={`${basePath}/assembly/bills`}>Legislation</Link></li>
                <li><Link href={`${basePath}/assembly/bills/${billSlug(billStage[0].billId ?? '')}`}>{parentBill[0].shortTitle}</Link></li>
                <li aria-current="page"><span>{displayTitle}</span></li>
              </>
            ) : (
              <>
                <li><Link href={`${basePath}/assembly/votes`}>Votes</Link></li>
                <li aria-current="page"><span>{displayTitle}</span></li>
              </>
            )}
          </ol>
        </nav>

        <div className={styles.titleCard}>
          <span className={styles.eyebrow}>
            <Vote className={styles.eyebrowIconMobile} size={14} strokeWidth={1.75} aria-hidden="true" />
            Votes
          </span>
          <h1 className={`${styles.title} ${subtitle ? styles.titleWithSub : ''}`}>
            <Vote className={`${styles.titleIcon} ${styles.titleIconDesktopOnly}`} size={29} strokeWidth={1.75} aria-hidden="true" />
            {displayTitle}
          </h1>

          {/* Mobile-only meta rows for Division/Amendment — icon+prose, matching
              the Date/Tabled by/Report treatment below, not chips. */}
          <div className={`${styles.metaStrip} ${styles.metaStripMobile}`}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>
                <Hash className={styles.metaLabelIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                Division
              </span>
              <span className={styles.metaValue}>{documentId}</span>
            </div>
            {subtitle && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>
                  <Pencil className={styles.metaLabelIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                  Amendment
                </span>
                <span className={styles.metaValue}>{subtitle}</span>
              </div>
            )}
          </div>

          {/* Date as a plain label/value line, matching Tabled by/Report. */}
          <div className={styles.metaStrip}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>
                <CalendarDays className={styles.metaLabelIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                Date
              </span>
              <span className={styles.metaValue}>{formatDate(division.divisionDate.toISOString())}</span>
            </div>
            {tabledByClean && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>
                  <User className={styles.metaLabelIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                  Tabled by
                </span>
                <span className={styles.metaValue}>{tabledByClean}</span>
              </div>
            )}
            {officialReportUrl && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>
                  <FileText className={styles.metaLabelIcon} size={14} strokeWidth={1.75} aria-hidden="true" />
                  Report
                </span>
                <span className={styles.metaValue}>
                  <a href={officialReportUrl} target="_blank" rel="noopener noreferrer">
                    Official Report
                  </a>
                </span>
              </div>
            )}
          </div>

          {/* Footer — identifying chips left (desktop only), cross-community/outcome
              chips right, matching Bills' .titleCardFoot exactly. */}
          <div className={styles.titleCardFoot}>
            <div className={`${styles.badgeRow} ${styles.idBadgeRowDesktop}`}>
              <span className={`${styles.chip} ${styles.chipNeutral}`}>Division {documentId}</span>
              {subtitle && <span className={`${styles.chip} ${styles.chipNeutral}`}>{subtitle}</span>}
            </div>
            <div className={`${styles.badgeRow} ${styles.statusBadgeRow}`}>
              {division.divisionType === 'Cross-Community' && (
                <span className={`${styles.chip} ${styles.chipCrossCommunity}`}>Cross-community</span>
              )}
              {passed === true && <span className={`${styles.chip} ${styles.chipPass}`}>Passed</span>}
              {passed === false && <span className={`${styles.chip} ${styles.chipFail}`}>Failed</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Motion text */}
      {division.motionText && (() => {
        const isMotionAmendment = division.isMotionAmendment === true
        return (
          <>
            <section className={`${styles.motionSection} ${styles.pageSection}`}>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>The vote</span>
                <h2 className={styles.sectionHeading}>
                  <FileText className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                  Motion text
                </h2>
              </div>
              {isMotionAmendment && division.parentMotionText ? (
                <div className={styles.motionColumns}>
                  <div className={`${styles.motionColumn} ${styles.motionColumnOriginal}`}>
                    <h3 className={styles.motionSubheading}>
                      <FileText className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      Original motion
                    </h3>
                    <p className={styles.motionText}>{division.parentMotionText}</p>
                  </div>
                  <div className={`${styles.motionColumn} ${styles.motionColumnAmended}`}>
                    <h3 className={styles.motionSubheading}>
                      <Pencil className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      Amendment text
                    </h3>
                    <p className={styles.motionText}>{division.motionText}</p>
                  </div>
                </div>
              ) : amendmentTexts.length > 0 ? (
                <div className={styles.motionColumns}>
                  <div className={`${styles.motionColumn} ${styles.motionColumnOriginal}`}>
                    <h3 className={styles.motionSubheading}>
                      <FileText className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      Original motion
                    </h3>
                    <p className={styles.motionText}>{division.motionText}</p>
                  </div>
                  <div className={`${styles.motionColumn} ${styles.motionColumnAmended}`}>
                    <h3 className={styles.motionSubheading}>
                      <Pencil className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      {amendmentTexts.length === 1 ? 'Amendment text (passed)' : 'Amendments passed'}
                    </h3>
                    {amendmentTexts.map((a) => (
                      <p key={a.title} className={styles.motionText}>{a.motion_text}</p>
                    ))}
                  </div>
                </div>
              ) : /as amended/i.test(division.outcome ?? '') && !isMotionAmendment ? (
                <div className={styles.motionColumns}>
                  <div className={`${styles.motionColumn} ${styles.motionColumnOriginal}`}>
                    <h3 className={styles.motionSubheading}>
                      <FileText className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      Original motion
                    </h3>
                    <p className={styles.motionText}>{division.motionText}</p>
                  </div>
                  <div className={`${styles.motionColumn} ${styles.motionColumnAmended}`}>
                    <h3 className={styles.motionSubheading}>
                      <Pencil className={styles.motionSubheadingIcon} size={13} strokeWidth={2} aria-hidden="true" />
                      Amendment text (passed)
                    </h3>
                    <p className={styles.amendmentNote}>
                      The amendment was agreed without a formal division. The amended text is not available in the current data -{' '}
                      {officialReportUrl
                        ? <a href={officialReportUrl} target="_blank" rel="noopener noreferrer">see the Official Report</a>
                        : 'see the Official Report'
                      }{' '}for the full text.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={styles.motionCard}>
                  {isMotionAmendment && (
                    <p className={styles.amendmentNote}>This amendment proposes changes to the original motion text.</p>
                  )}
                  <p className={styles.motionText}>{division.motionText}</p>
                </div>
              )}
            </section>
          </>
        )
      })()}

      {/* One card: big numbers first, one proportional bar for context. */}
      <section className={`${styles.resultsSection} ${styles.pageSection}`} aria-labelledby="vote-results-heading">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>The vote</span>
          <h2 id="vote-results-heading" className={styles.sectionHeading}>
            <Vote className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            Vote results
          </h2>
        </div>

        <div className={styles.resultsCard}>
          <div className={styles.counts}>
            <div className={`${styles.countItem} ${styles.countItemAye}`}>
              <div className={styles.countLabelRow}>
                <span className={styles.countLabel}>Ayes</span>
                <CheckCircle2 className={styles.countIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.countNum}>{totalAyes}</span>
            </div>
            <div className={`${styles.countItem} ${styles.countItemNo}`}>
              <div className={styles.countLabelRow}>
                <span className={styles.countLabel}>Noes</span>
                <XCircle className={styles.countIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.countNum}>{totalNoes}</span>
            </div>
            <div className={styles.countItem}>
              <div className={styles.countLabelRow}>
                <span className={styles.countLabel}>Abstain</span>
                <MinusCircle className={styles.countIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.countNum}>{totalAbstain}</span>
            </div>
            <div className={styles.countItem}>
              <div className={styles.countLabelRow}>
                <span className={styles.countLabel}>No Show</span>
                <UserX className={styles.countIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <span className={styles.countNum}>{totalNoShow}</span>
            </div>
          </div>

          {/* Matches the votes list page's .divBarTrack pattern. */}
          {(() => {
            const shareTotal = totalAyes + totalNoes + totalAbstain + totalNoShow
            const pct = (n: number) => shareTotal > 0 ? `${(n / shareTotal) * 100}%` : '0%'
            return (
              <div className={styles.resultsBarTrack} role="img" aria-label={`${totalAyes} Ayes, ${totalNoes} Noes, ${totalAbstain} Abstain, ${totalNoShow} No Show`}>
                {totalAyes > 0 && <span className={styles.resultsBarAye} style={{ width: pct(totalAyes) }} />}
                {totalNoes > 0 && <span className={styles.resultsBarNo} style={{ width: pct(totalNoes) }} />}
                {totalAbstain > 0 && <span className={styles.resultsBarAbs} style={{ width: pct(totalAbstain) }} />}
                {totalNoShow > 0 && <span className={styles.resultsBarNs} style={{ width: pct(totalNoShow) }} />}
              </div>
            )
          })()}
        </div>
      </section>

      {/* Party breakdown */}
      {votes.length > 0 && (
        <section className={styles.pageSection} aria-labelledby="party-breakdown-heading">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>The vote</span>
            <h2 id="party-breakdown-heading" className={styles.sectionHeading}>
              <Users className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
              Party breakdown
            </h2>
          </div>
          <PartyBreakdownClient votes={votes} />
        </section>
      )}

      {/* Designation breakdown */}
      {hasDesignationBreakdown && (
        <section className={`${styles.designationSection} ${styles.pageSection}`} aria-labelledby="designation-heading">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>The vote</span>
              <h2 id="designation-heading" className={styles.sectionHeading}>
                <Scale className={styles.sectionHeadingIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
                Designation breakdown
              </h2>
            </div>
            {(() => {
              const dataCols = 2 + (hasDesignationNoShow ? 1 : 0) + 1
              const gridColsStyle = { '--data-cols': dataCols } as React.CSSProperties
              const renderCell = (n: number) =>
                n === 0
                  ? <span className={styles.blocCellZero}>-</span>
                  : <span className={styles.blocCellValue}>{n}</span>
              return (
            <div className={styles.designationLayout}>
              <div className={`${styles.blocGrid} ${styles.blocGridPlain}`}>
                <div className={styles.blocHeaderRow} style={gridColsStyle}>
                  <span />
                  <span className={styles.blocColHead}>Aye</span>
                  <span className={styles.blocColHead}>No</span>
                  {hasDesignationNoShow && <span className={styles.blocColHead}>NS</span>}
                  <span className={styles.blocColHead}>Abs</span>
                </div>
                {[
                  { label: 'Unionist',    designation: 'unionist',    ayes: division.unionistAyes ?? 0,    noes: division.unionistNoes ?? 0,    ns: noShowByDesignation.Unionist,    abs: abstainByDesignation.Unionist },
                  { label: 'Nationalist', designation: 'nationalist', ayes: division.nationalistAyes ?? 0, noes: division.nationalistNoes ?? 0, ns: noShowByDesignation.Nationalist, abs: abstainByDesignation.Nationalist },
                  { label: 'Other',       designation: 'other',       ayes: division.otherAyes ?? 0,       noes: division.otherNoes ?? 0,       ns: noShowByDesignation.Other,       abs: abstainByDesignation.Other },
                ].map(({ label, designation, ayes, noes, ns, abs }) => (
                  <div key={label} className={styles.blocItem} style={gridColsStyle}>
                    <span className={styles.blocLabel}>
                      <span className="designation-pill" data-designation={designation}>{label}</span>
                    </span>
                    <span className={styles.blocCell}>{renderCell(ayes)}</span>
                    <span className={styles.blocCell}>{renderCell(noes)}</span>
                    {hasDesignationNoShow && <span className={styles.blocCell}>{renderCell(ns)}</span>}
                    <span className={styles.blocCell}>{renderCell(abs)}</span>
                    <b className={styles.blocValueDesktop}>
                      <span className={styles.blocAye}>{ayes} Aye</span>
                      {' · '}
                      <span className={styles.blocNo}>{noes} No</span>
                      {ns  > 0 && <><span className={styles.blocSep}> · </span><span className={styles.blocNs}>{ns} NS</span></>}
                      {abs > 0 && <><span className={styles.blocSep}> · </span><span className={styles.blocNs}>{abs} Abs</span></>}
                    </b>
                  </div>
                ))}
              </div>
              <div className={styles.designationSep} />
              <DesignationChartClient
                unionistAyes={division.unionistAyes ?? 0}
                unionistNoes={division.unionistNoes ?? 0}
                unionistNs={noShowByDesignation.Unionist}
                unionistAbs={abstainByDesignation.Unionist}
                nationalistAyes={division.nationalistAyes ?? 0}
                nationalistNoes={division.nationalistNoes ?? 0}
                nationalistNs={noShowByDesignation.Nationalist}
                nationalistAbs={abstainByDesignation.Nationalist}
                otherAyes={division.otherAyes ?? 0}
                otherNoes={division.otherNoes ?? 0}
                otherNs={noShowByDesignation.Other}
                otherAbs={abstainByDesignation.Other}
              />
            </div>
              )
            })()}
          </section>
      )}

      <div className={`${styles.pageSection} ${styles.sectionLast}`}>
        <RollCallClient votes={votes} />
      </div>
    </div>
  )
}
