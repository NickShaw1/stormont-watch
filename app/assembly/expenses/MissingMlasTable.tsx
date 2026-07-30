'use client'

import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, formatConstituency } from '@/lib/format'
import { useMandate } from '@/components/MandateContext'
import styles from './expenses.module.css'

interface MissingMla {
  person_id: string
  full_name: string
  party: string | null
  constituency: string | null
  img_url: string | null
  mandate_start: string | null
}

function serviceLabel(mandateStart: string | null): string {
  if (!mandateStart) return '-'
  const start = new Date(mandateStart)
  const now = new Date()
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}

export default function MissingMlasTable({ missing }: { missing: MissingMla[] }) {
  const { basePath } = useMandate()

  return (
    <>
      <div className={styles.rankCardHead} aria-hidden="true">
        <span className={styles.rankCardHeadRank}>#</span>
        <span className={styles.rankCardHeadMain}>MLA</span>
        <span className={styles.rankCardHeadParty}>Party</span>
        <span className={styles.rankCardHeadConstituency}>Constituency</span>
        <span className={styles.rankCardHeadService} title="Years and months of service since mandate start">Service</span>
        <span className={styles.rankCardHeadValue}>Expenses</span>
      </div>

      <div className={styles.rankCardList} role="list" aria-label="MLAs with no expenses">
        {missing.map(mla => (
          <Link
            key={mla.person_id}
            href={`${basePath}/assembly/mlas/${mla.person_id}`}
            className={styles.rankCard}
            aria-label={`${formatMemberName(mla.full_name)}${mla.party ? `, ${mla.party}` : ''}${mla.constituency ? `, ${formatConstituency(mla.constituency)}` : ''}`}
          >
            <span className={styles.rankCardRank} aria-hidden="true">-</span>
            <div className={styles.rankCardMain}>
              <div className={styles.rankCardPhoto}>
                <MlaPhoto name={mla.full_name} imgUrl={mla.img_url ?? ''} size={44} decorative square personId={mla.person_id} />
              </div>
              <div className={styles.rankCardInfo}>
                <span className={styles.rankCardName}>{formatMemberName(mla.full_name)}</span>
                {mla.party && (
                  <span className={`party-pill ${styles.mobilePill}`} data-party={abbreviateParty(mla.party)}>
                    <PartyName party={mla.party} />
                  </span>
                )}
              </div>
            </div>

            <span className={styles.rankCardParty}>
              {mla.party && (
                <span className="party-pill" data-party={abbreviateParty(mla.party)}>
                  <PartyName party={mla.party} />
                </span>
              )}
            </span>

            <span className={styles.rankCardConstituency}>
              {mla.constituency ? formatConstituency(mla.constituency) : '-'}
            </span>

            <span className={styles.rankCardService}>
              {serviceLabel(mla.mandate_start)}
            </span>

            <span className={styles.rankCardValueCol}>
              <span className={styles.rankCardValue} style={{ color: 'var(--sw-text-secondary)', fontWeight: 400 }}>No data</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
