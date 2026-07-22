'use client'

import React from 'react'
import Link from 'next/link'
import { partyBorderColor, abbreviateParty } from '@/lib/format'
import type { PartyStats } from '@/lib/db/queries'
import { useMandate } from '@/components/MandateContext'
import styles from './parties.module.css'

const PARTY_DESCRIPTIONS: Record<string, string> = {
  'Sinn Féin': 'Irish republican and democratic socialist party.',
  'Democratic Unionist Party': 'Ulster unionist and social conservative party.',
  'Alliance Party': 'Cross-community liberal and progressive party.',
  'Ulster Unionist Party': 'Ulster unionist and liberal conservative party.',
  'Social Democratic and Labour Party': 'Irish nationalist and social democratic party.',
  'People Before Profit Alliance': 'Left-wing socialist and anti-austerity party.',
  'Traditional Unionist Voice': 'Traditional unionist party.',
  'Independent': 'Independent MLA not affiliated with any registered political party.',
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

interface Props {
  parties: PartyStats[]
}

export default function PartiesClient({ parties }: Props) {
  const { basePath } = useMandate()
  return (
    <ul className={styles.grid} role="list">
      {parties.map((party) => {
        const borderColor = partyBorderColor(party.party)
        const description = PARTY_DESCRIPTIONS[party.party] ?? ''

        return (
          <li key={party.slug}>
          <Link
            href={`${basePath}/assembly/parties/${party.slug}`}
            className={styles.card}
          >
            <div className={styles.cardBody}>
              <div className={styles.cardTop}>
                <span className={styles.partyNameWrap}>
                  <span className={styles.partySwatch} style={{ background: borderColor }} aria-hidden="true" />
                  <span className={styles.partyName}>
                    <span className={styles.partyNameFull}>{party.party}</span>
                    <span className={styles.partyNameShort}>{abbreviateParty(party.party)}</span>
                  </span>
                </span>
                <span className={styles.viewLink}>View party ↗</span>
              </div>
              <span className={styles.mlaCount}>{party.mlaCount} {party.mlaCount === 1 ? 'MLA' : 'MLAs'}</span>
              {description && <span className={styles.description}>{description}</span>}
            </div>
          </Link>
          </li>
        )
      })}
    </ul>
  )
}
