import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { getDivisionWithVotes, getHansardReportId } from '@/lib/db/queries'
import { createDb } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

const db = createDb()
import { isPassed } from '@/lib/bills'
import { formatDate, parseBillSlug, parseStageName } from '@/lib/format'
import { formatDivisionSubject } from '@/lib/utils/formatSubject'
import { formatTabledBy } from '@/lib/utils/formatNames'

function billSlug(billId: string): string {
  return billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
}

import RollCallClient from './RollCallClient'
import styles from './divisionDetail.module.css'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getDivisionWithVotes(params.id)
  if (!data) return { title: 'Division not found' }
  const stage = parseStageName(data.division.subject)
  const billSlug = parseBillSlug(data.division.subject)
  const billTitle = billSlug
    ? data.division.subject.match(/NIA\s+Bill\s+[\d]+\/[\d]+-[\d]+/i)?.[0] ?? data.division.subject
    : data.division.subject
  const pageTitle = billSlug ? `${stage}: ${billTitle}` : stage
  const date = formatDate(data.division.divisionDate?.toISOString())
  const outcome = data.division.outcome ?? 'unknown outcome'
  const description = `${pageTitle} — voted ${date}, ${outcome}. ${data.division.totalAyes ?? 0} ayes, ${data.division.totalNoes ?? 0} noes.`
  return {
    title: pageTitle,
    description,
    openGraph: {
      title: `${pageTitle} — Stormont Watch`,
      description,
    },
    alternates: { canonical: `https://stormontwatch.com/assembly/divisions/${params.id}` },
  }
}

export default async function DivisionDetailPage({ params }: Props) {
  const data = await getDivisionWithVotes(params.id)
  if (!data) notFound()

  const { division, votes } = data

  const documentId = params.id

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
  const votedTotal = totalAyes + totalNoes

  const ayePct = votedTotal > 0 ? Math.round((totalAyes / votedTotal) * 100) : 0
  const noePct = votedTotal > 0 ? Math.round((totalNoes / votedTotal) * 100) : 0

  const passed = isPassed(division.outcome)

  const hasDesignationBreakdown =
    (division.nationalistAyes ?? 0) + (division.unionistAyes ?? 0) +
    (division.nationalistNoes ?? 0) + (division.unionistNoes ?? 0) > 0

  const UNIONIST_PARTIES = new Set(['Democratic Unionist Party', 'Ulster Unionist Party', 'Traditional Unionist Voice'])
  const NATIONALIST_PARTIES = new Set(['Sinn Féin', 'Social Democratic and Labour Party'])

  const noShowByDesignation = {
    Unionist: noShows.filter((v) => UNIONIST_PARTIES.has(v.party ?? '')).length,
    Nationalist: noShows.filter((v) => NATIONALIST_PARTIES.has(v.party ?? '')).length,
    Other: noShows.filter((v) => !UNIONIST_PARTIES.has(v.party ?? '') && !NATIONALIST_PARTIES.has(v.party ?? '')).length,
  }

  const raw = division.title ?? division.subject
  const { title: displayTitle, subtitle } = formatDivisionSubject(raw)
  const tabledByClean = formatTabledBy(division.tabledBy)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: displayTitle,
    startDate: new Date(division.divisionDate).toISOString(),
    location: {
      '@type': 'Place',
      name: 'Northern Ireland Assembly',
      address: 'Parliament Buildings, Stormont, Belfast',
    },
    organizer: {
      '@type': 'GovernmentOrganization',
      name: 'Northern Ireland Assembly',
      url: 'https://www.niassembly.gov.uk',
    },
    url: `${siteUrl}/assembly/divisions/${params.id}`,
    description: `Division result: ${division.outcome ?? 'unknown'}. Ayes: ${division.totalAyes ?? 0}, Noes: ${division.totalNoes ?? 0}.`,
  }

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.divisionHeader}>
        <nav aria-label="Breadcrumb" className={`breadcrumb ${styles.breadcrumb}`}>
          <ol>
            {parentBill?.[0] ? (
              <>
                <li><Link href="/assembly/bills">Legislation</Link></li>
                <li><Link href={`/assembly/bills/${billSlug(billStage[0].billId ?? '')}`}>{parentBill[0].shortTitle}</Link></li>
                <li aria-current="page">{displayTitle}</li>
              </>
            ) : (
              <>
                <li><Link href="/assembly/votes">Votes</Link></li>
                <li aria-current="page">{displayTitle}</li>
              </>
            )}
          </ol>
        </nav>

        <h1 className={styles.title}>{displayTitle}</h1>
        {subtitle && (
          <span className={styles.subtitlePill}>{subtitle}</span>
        )}

        <div className={styles.pillsRow}>
          {passed === true && <span className={styles.pillPassed} role="status">Passed</span>}
          {passed === false && <span className={styles.pillFailed} role="status">Failed</span>}
          <span className={styles.dateText}>{formatDate(division.divisionDate.toISOString())}</span>
        </div>

        <div className={styles.metaStrip}>
          {division.divisionType && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Type</span>
              <span className={styles.metaValue}>{division.divisionType}</span>
            </div>
          )}
          {tabledByClean && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Tabled by</span>
              <span className={styles.metaValue}>{tabledByClean}</span>
            </div>
          )}
          {officialReportUrl && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Report</span>
              <span className={styles.metaValue}>
                <a href={officialReportUrl} target="_blank" rel="noopener noreferrer">
                  Official Report <span aria-hidden="true">↗</span>
                </a>
              </span>
            </div>
          )}
        </div>
      </header>

      {division.motionText && (() => {
        const isAmendment = /^leave out|^at end insert|^after .+ insert/i.test(
          division.motionText?.trim() ?? ''
        )
        return (
          <>
            <section className={styles.motionSection}>
              <h2 className={styles.subheading}>Motion text</h2>
              {isAmendment && (
                <p className={styles.amendmentNote}>
                  This amendment proposes changes to the original motion text.
                </p>
              )}
              <p className={styles.motionText}>{division.motionText}</p>
            </section>
            <hr className="section-rule" />
          </>
        )
      })()}

      <div className={styles.resultsRow}>
        {/* Vote counts + bar */}
        <section aria-labelledby="vote-counts-heading" className={styles.countsSection}>
          <h2 id="vote-counts-heading" className={styles.sectionTitle}>Vote Results</h2>

          <div className={styles.barWrap} role="img" aria-label={`${ayePct}% Ayes, ${noePct}% Noes`}>
            <div className={styles.barLabels}>
              <span className={styles.barLabelAye}>Aye</span>
              <span className={styles.barLabelNo}>No</span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barAye} style={{ width: `${ayePct}%` }}>
                {ayePct > 8 && <span className={styles.barPct}>{ayePct}%</span>}
              </div>
              <div className={styles.barNo} style={{ width: `${noePct}%` }}>
                {noePct > 8 && <span className={styles.barPct}>{noePct}%</span>}
              </div>
            </div>
          </div>

          <div className={styles.counts}>
            <div className={`${styles.countItem} ${styles.countItemAye}`}>
              <span className={`${styles.countNum} mono`}>{totalAyes}</span>
              <span className={styles.countLabel}>Ayes</span>
            </div>
            <div className={`${styles.countItem} ${styles.countItemNo}`}>
              <span className={`${styles.countNum} mono`}>{totalNoes}</span>
              <span className={styles.countLabel}>Noes</span>
            </div>
            <div className={`${styles.countItem} ${styles.countItemAbs}`}>
              <span className={`${styles.countNum} mono`}>{totalAbstain}</span>
              <span className={styles.countLabel}>Abstain</span>
            </div>
            <div className={`${styles.countItem} ${styles.countItemNs}`}>
              <span className={`${styles.countNum} mono`}>{totalNoShow}</span>
              <span className={styles.countLabel}>No Show</span>
            </div>
          </div>
        </section>

      </div>

      {hasDesignationBreakdown && <hr className="section-rule" />}
      {hasDesignationBreakdown && (
        <section aria-labelledby="designation-heading" className={styles.designationSection}>
          <h2 id="designation-heading" className={styles.sectionTitle}>
            <span className={styles.designationFull}>Designation breakdown</span>
            <span className={styles.designationShort}>Breakdown</span>
          </h2>
          <table className={styles.designationTable}>
            <thead>
              <tr>
                <th scope="col">Designation</th>
                <th scope="col">Ayes</th>
                <th scope="col">Noes</th>
                <th scope="col">
                  <span className={styles.noShowFull}>No Show</span>
                  <span className={styles.noShowShort}>Absent</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Unionist</td>
                <td className="mono">{division.unionistAyes ?? 0}</td>
                <td className="mono">{division.unionistNoes ?? 0}</td>
                <td className="mono">{noShowByDesignation.Unionist}</td>
              </tr>
              <tr>
                <td>Nationalist</td>
                <td className="mono">{division.nationalistAyes ?? 0}</td>
                <td className="mono">{division.nationalistNoes ?? 0}</td>
                <td className="mono">{noShowByDesignation.Nationalist}</td>
              </tr>
              <tr>
                <td>Other</td>
                <td className="mono">{division.otherAyes ?? 0}</td>
                <td className="mono">{division.otherNoes ?? 0}</td>
                <td className="mono">{noShowByDesignation.Other}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <hr className="section-rule" />

      <RollCallClient votes={votes} />
    </div>
  )
}
