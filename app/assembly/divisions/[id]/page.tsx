import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { getDivisionWithVotes, getHansardReportId, getAllDivisionsFromDb } from '@/lib/db/queries'

export const revalidate = 86400

export async function generateStaticParams() {
  const divisions = await getAllDivisionsFromDb()
  return divisions.map(d => ({ id: d.documentId }))
}
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
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
  const billSlugStr = parseBillSlug(data.division.subject)
  const billTitle = billSlugStr
    ? data.division.subject.match(/NIA\s+Bill\s+[\d]+\/[\d]+-[\d]+/i)?.[0] ?? data.division.subject
    : data.division.subject
  const pageTitle = billSlugStr ? `${stage}: ${billTitle}` : stage
  const date = formatDate(data.division.divisionDate?.toISOString())
  const outcome = data.division.outcome ?? 'unknown outcome'
  const description = `${pageTitle} — voted ${date}, ${outcome}. ${data.division.totalAyes ?? 0} ayes, ${data.division.totalNoes ?? 0} noes.`
  return {
    title: pageTitle,
    description,
    openGraph: {
      title: `${pageTitle} — Stormont Watch`,
      description,
      images: [
        {
          url: `/assembly/divisions/${params.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${pageTitle} — Stormont Watch`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`/assembly/divisions/${params.id}/opengraph-image`],
    },
    alternates: { canonical: `https://www.stormontwatch.com/assembly/divisions/${params.id}` },
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
  const votedTotal = totalAyes + totalNoes + totalAbstain

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.stormontwatch.com'

  const breadcrumbItems = parentBill?.[0]
    ? [
        { '@type': 'ListItem', position: 1, name: 'Legislation', item: `${siteUrl}/assembly/bills` },
        { '@type': 'ListItem', position: 2, name: parentBill[0].shortTitle, item: `${siteUrl}/assembly/bills/${billStage[0]?.billId ?? ''}` },
        { '@type': 'ListItem', position: 3, name: displayTitle, item: `${siteUrl}/assembly/divisions/${params.id}` },
      ]
    : [
        { '@type': 'ListItem', position: 1, name: 'Votes', item: `${siteUrl}/assembly/votes` },
        { '@type': 'ListItem', position: 2, name: displayTitle, item: `${siteUrl}/assembly/divisions/${params.id}` },
      ]

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <header className={styles.divisionHeader}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ol>
            {parentBill?.[0] ? (
              <>
                <li><Link href="/assembly/bills">Legislation</Link></li>
                <li><Link href={`/assembly/bills/${billSlug(billStage[0].billId ?? '')}`}>{parentBill[0].shortTitle}</Link></li>
                <li aria-current="page"><span>{displayTitle}</span></li>
              </>
            ) : (
              <>
                <li><Link href="/assembly/votes">Votes</Link></li>
                <li aria-current="page"><span>{displayTitle}</span></li>
              </>
            )}
          </ol>
        </nav>

        {/* Tags */}
        <div className={styles.tags}>
          <span className="tag" style={{ fontFamily: 'var(--font-mono)' }}>DIVISION {documentId.toUpperCase()}</span>
          {passed === true && <span className="pill pass">Passed</span>}
          {passed === false && <span className="pill fail">Failed</span>}
          {division.divisionType === 'Cross-Community' && (
            <span className="tag" style={{ color: 'var(--ochre)', borderColor: 'var(--ochre)' }}>Cross-community</span>
          )}
          <span className="tag">{formatDate(division.divisionDate.toISOString())}</span>
        </div>

        {/* Title */}
        <h1 className={`${styles.title} ${subtitle ? styles.titleWithSub : ''}`}>{displayTitle}</h1>
        {subtitle && <span className={styles.subtitlePill}>{subtitle}</span>}

        {/* Meta strip */}
        {(tabledByClean || officialReportUrl) && (
          <div className={styles.metaStrip}>
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
        )}
      </header>

      {/* Motion text */}
      {division.motionText && (() => {
        const isAmendment = /^leave out|^at end insert|^after .+ insert/i.test(division.motionText?.trim() ?? '')
        return (
          <>
            <section className={styles.motionSection}>
              <h2 className={styles.sectionHeading}>Motion text</h2>
              {isAmendment && (
                <p className={styles.amendmentNote}>This amendment proposes changes to the original motion text.</p>
              )}
              <p className={styles.motionText}>{division.motionText}</p>
            </section>
            <hr className="section-rule" />
          </>
        )
      })()}

      {/* Vote results */}
      <section className={styles.resultsSection} aria-labelledby="vote-results-heading">
        <h2 id="vote-results-heading" className={styles.sectionHeading}>Vote results</h2>

        {/* Tally bars */}
        <div>
          {[
            { label: 'Aye', val: totalAyes, total: votedTotal, cls: 'Aye' },
            { label: 'No',  val: totalNoes, total: votedTotal, cls: 'No' },
            { label: 'Abs', val: totalAbstain, total: votedTotal, cls: 'Abs' },
          ].map(({ label, val, total, cls }) => (
            <div key={label} className={styles.tallyRow}>
              <span className={`${styles.tallyLabel} ${styles[`tallyLabel${cls}`]}`}>{label}</span>
              <div className={styles.tallyBar}>
                <div
                  className={`${styles.tallyBarFill} ${styles[`tallyBar${cls}`]}`}
                  style={{ width: total > 0 ? `${(val / total) * 100}%` : '0%' }}
                />
              </div>
              <span className={`${styles.tallyVal} ${styles[`tallyVal${cls}`]}`}>{val}</span>
            </div>
          ))}
        </div>

        {/* Count cards */}
        <div className={styles.counts}>
          <div className={`${styles.countItem} ${styles.countItemAye}`}>
            <span className={styles.countNum}>{totalAyes}</span>
            <span className={styles.countLabel}>Ayes</span>
          </div>
          <div className={`${styles.countItem} ${styles.countItemNo}`}>
            <span className={styles.countNum}>{totalNoes}</span>
            <span className={styles.countLabel}>Noes</span>
          </div>
          <div className={`${styles.countItem} ${styles.countItemAbs}`}>
            <span className={styles.countNum}>{totalAbstain}</span>
            <span className={styles.countLabel}>Abstain</span>
          </div>
          <div className={`${styles.countItem} ${styles.countItemNs}`}>
            <span className={styles.countNum}>{totalNoShow}</span>
            <span className={styles.countLabel}>No Show</span>
          </div>
        </div>
      </section>

      {/* Designation breakdown */}
      {hasDesignationBreakdown && (
        <>
          <hr className="section-rule" />
          <section className={styles.designationSection} aria-labelledby="designation-heading">
            <h2 id="designation-heading" className={styles.sectionHeading}>
              <span className={styles.designationFull}>Designation breakdown</span>
              <span className={styles.designationShort}>Breakdown</span>
            </h2>
            <div className={styles.blocGrid}>
              <div className={styles.blocHeaderRow}>
                <span />
                <span className={styles.blocColHead}>Aye</span>
                <span className={styles.blocColHead}>No</span>
                <span className={styles.blocColHead}>Abs</span>
              </div>
              {[
                { label: 'Unionist',    ayes: division.unionistAyes ?? 0,    noes: division.unionistNoes ?? 0,    ns: noShowByDesignation.Unionist },
                { label: 'Nationalist', ayes: division.nationalistAyes ?? 0, noes: division.nationalistNoes ?? 0, ns: noShowByDesignation.Nationalist },
                { label: 'Other',       ayes: division.otherAyes ?? 0,       noes: division.otherNoes ?? 0,       ns: noShowByDesignation.Other },
              ].map(({ label, ayes, noes, ns }) => (
                <div key={label} className={styles.blocItem}>
                  <span className={styles.blocLabel}>{label}</span>
                  <span className={styles.blocCell}>{ayes}</span>
                  <span className={styles.blocCell}>{noes}</span>
                  <span className={styles.blocCell}>{ns}</span>
                  <b className={styles.blocValueDesktop}>
                    <span className={styles.blocAye}>{ayes} Aye</span>
                    {' · '}
                    <span className={styles.blocNo}>{noes} No</span>
                    {ns > 0 && <><span className={styles.blocSep}> · </span><span className={styles.blocNs}>{ns} Abs</span></>}
                  </b>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <hr className="section-rule" />

      <RollCallClient votes={votes} />
    </div>
  )
}
