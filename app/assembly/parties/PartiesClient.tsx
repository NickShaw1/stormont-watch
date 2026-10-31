'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { partyBorderColor, abbreviateParty, formatShare } from '@/lib/format'
import { inkFor } from '@/lib/partyInk'
import type { PartyStats } from '@/lib/db/queries'
import { useMandate } from '@/components/MandateContext'
import styles from './parties.module.css'

const PARTY_DESCRIPTIONS: Record<string, string> = {
  'Sinn Féin': 'Irish republican and democratic socialist party.',
  'Democratic Unionist Party': 'Ulster unionist and social conservative party.',
  'Alliance Party': 'Cross-community liberal and centrist party.',
  'Ulster Unionist Party': 'Ulster unionist and conservative party.',
  'Social Democratic and Labour Party': 'Irish nationalist and social democratic party.',
  'People Before Profit Alliance': 'Left-wing socialist and anti-austerity party.',
  'Traditional Unionist Voice': 'Traditional unionist party.',
  'Independent': 'Independent MLA not affiliated with any registered political party.',
}

const PARTY_DESCRIPTIONS_SHORT: Record<string, string> = {
  'Sinn Féin': 'Irish republican and democratic socialist party, founded in 1905.',
  'Democratic Unionist Party': 'Unionist and social conservative party, founded in 1971.',
  'Alliance Party': 'Cross-community liberal and centrist party, founded in 1970.',
  'Ulster Unionist Party': 'Unionist and conservative party that governed until direct rule.',
  'Social Democratic and Labour Party': 'Irish nationalist and social democratic party, founded in 1970.',
  'People Before Profit Alliance': 'Left-wing socialist and anti-austerity party across Ireland.',
  'Traditional Unionist Voice': 'Traditional unionist party in Northern Ireland, founded in 2007.',
  'Independent': 'Independent MLAs sit in the Assembly without a party designation.',
}

export const PARTY_URLS: Record<string, string> = {
  'Sinn Féin': 'https://sinnfein.ie/',
  'Democratic Unionist Party': 'https://mydup.com/',
  'Alliance Party': 'https://www.allianceparty.org/',
  'Ulster Unionist Party': 'https://www.uup.org/',
  'Social Democratic and Labour Party': 'https://www.sdlp.ie/',
  'People Before Profit Alliance': 'https://www.pbp.ie/',
  'Traditional Unionist Voice': 'https://www.tuv.org.uk/',
}

type Grade = 'good' | 'low' | 'poor'

const GRADE_TEXT: Record<Grade, string> = {
  good: 'at or above the Assembly average',
  low: 'below the Assembly average',
  poor: 'far below the Assembly average',
}

const GRADE_SHORT: Record<Grade, string> = {
  good: 'At or above average',
  low: 'Below average',
  poor: 'Far below average',
}

const RING_R = 34
const RING_C = 2 * Math.PI * RING_R

interface Props {
  parties: PartyStats[]
  attendance: Record<string, { pct: number; grade: Grade }>
  averageAttendance: number
}

export default function PartiesClient({ parties, attendance, averageAttendance }: Props) {
  const { basePath } = useMandate()
  const total = parties.reduce((sum, p) => sum + p.mlaCount, 0)

  return (
    <>
    <h2 className="sr-only">All parties</h2>
    <ul className={styles.grid}>
      {parties.map((party) => {
        const colour = partyBorderColor(party.party)
        const description = PARTY_DESCRIPTIONS[party.party] ?? ''
        const shortDescription = PARTY_DESCRIPTIONS_SHORT[party.party]
        const share = total > 0 ? (party.mlaCount / total) * 100 : 0
        const att = attendance[party.party]
        const shortName = party.party === 'Independent' ? party.party : abbreviateParty(party.party)

        return (
          <li key={party.slug} className={styles.card}>
            <div className={styles.block} style={{ background: colour, color: inkFor(colour) }} aria-hidden="true">
              <span className={styles.blockNum}>{party.mlaCount}</span>
            </div>
            <div className={styles.body}>
              <h3 className={styles.name}>
                <Link href={`${basePath}/assembly/parties/${party.slug}`} className={styles.link}>
                  <span className={styles.nameFull}>{party.party}</span>
                  <span className={styles.nameShort} aria-hidden="true">{shortName}</span>
                </Link>
              </h3>
              {description && (
                shortDescription ? (
                  <p className={styles.description}>
                    <span className={styles.descFull}>{description}</span>
                    <span className={styles.descShort}>{shortDescription}</span>
                  </p>
                ) : (
                  <p className={styles.description}>{description}</p>
                )
              )}
              <div className={styles.share}>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.fill} style={{ width: `${share}%`, background: colour }} />
                </span>
                <span className={styles.shareText}><span className={styles.shareCount}>{party.mlaCount} {party.mlaCount === 1 ? 'MLA' : 'MLAs'} · </span>{formatShare(party.mlaCount, total)}% of seats</span>
              </div>
            </div>
            {att && (
              <div className={styles.att} data-grade={att.grade}>
                <span className={styles.ring}>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <circle className={styles.ringTrack} cx="40" cy="40" r={RING_R} />
                    <circle
                      className={styles.ringValue}
                      cx="40"
                      cy="40"
                      r={RING_R}
                      strokeDasharray={RING_C}
                      strokeDashoffset={RING_C * (1 - att.pct / 100)}
                    />
                  </svg>
                  <span className={styles.ringNum} aria-hidden="true">{att.pct}<small>%</small></span>
                </span>
                <span className={styles.attText}>
                  <span className={styles.attLabel}>Division attendance</span>
                  <span className={styles.attGrade} aria-hidden="true">{GRADE_SHORT[att.grade]}</span>
                </span>
                <span className="sr-only">
                  Division attendance among current MLAs: {att.pct}%, {GRADE_TEXT[att.grade]} ({averageAttendance.toFixed(1)}%).
                </span>
              </div>
            )}
            <ArrowRight className={styles.arrow} size={20} strokeWidth={2} aria-hidden="true" />
          </li>
        )
      })}
    </ul>
    </>
  )
}
