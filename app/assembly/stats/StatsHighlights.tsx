'use client'

import { useEffect, useState } from 'react'
import { Vote, Handshake, Users2, Scale, Mic2, PoundSterling, CheckCircle2, Shuffle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './stats.module.css'
import PartyName from '@/components/PartyName'

type FactColor = 'amber' | 'green' | 'coral' | 'purple' | 'teal' | 'pink' | 'orange' | 'indigo' | 'blue'

interface Fact {
  number: number | string
  text: React.ReactNode
  icon: LucideIcon
  color: FactColor
}

interface Props {
  overallPassRate: number
  overallAgreementRate: number
  averageAttendance: number
  sittingAdjective: string
  bigTwoAgreePct: number
  topSfAlignedParty: { party: string; sfAgreePct: number } | null
  topDupAlignedParty: { party: string; dupAgreePct: number } | null
  mostCohesiveParty: { party: string; cohesionPct: number } | null
  topSittings: { fullName: string; sittings: number } | null
  highestExpenseClaim: { fullName: string; total: number; period: string | null } | null
}

function gbpShort(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `£${Math.round(v / 1_000).toLocaleString('en-GB')}k`
  return `£${Math.round(v).toLocaleString('en-GB')}`
}

export default function StatsHighlights({
  overallPassRate,
  overallAgreementRate,
  averageAttendance,
  sittingAdjective,
  bigTwoAgreePct,
  topSfAlignedParty,
  topDupAlignedParty,
  mostCohesiveParty,
  topSittings,
  highestExpenseClaim,
}: Props) {
  const facts: Fact[] = [
    {
      number: `${overallPassRate}%`,
      text: 'of divisions held this mandate passed.',
      icon: CheckCircle2,
      color: 'pink',
    },
    {
      number: `${overallAgreementRate}%`,
      text: 'of divisions where both blocs voted saw a majority of unionist-designated and nationalist-designated MLAs vote the same way.',
      icon: Scale,
      color: 'blue',
    },
    {
      number: `${averageAttendance}%`,
      text: `average voting attendance across ${sittingAdjective} MLAs this mandate.`,
      icon: Users2,
      color: 'amber',
    },
    {
      number: `${bigTwoAgreePct}%`,
      text: 'of divisions saw Sinn Féin and the DUP vote the same way this mandate.',
      icon: Handshake,
      color: 'teal',
    },
  ]

  if (topSfAlignedParty) {
    facts.push({
      number: `${topSfAlignedParty.sfAgreePct}%`,
      text: <>of divisions saw <PartyName party={topSfAlignedParty.party} /> vote the same way as Sinn Féin, closer than any other smaller party.</>,
      icon: Vote,
      color: 'coral',
    })
  }

  if (topDupAlignedParty) {
    facts.push({
      number: `${topDupAlignedParty.dupAgreePct}%`,
      text: <>of divisions saw <PartyName party={topDupAlignedParty.party} /> vote the same way as the DUP, closer than any other smaller party.</>,
      icon: Vote,
      color: 'indigo',
    })
  }

  if (mostCohesiveParty) {
    facts.push({
      number: `${mostCohesiveParty.cohesionPct}%`,
      text: <>of the time, every voting member of <PartyName party={mostCohesiveParty.party} /> votes the same way: the most cohesive party this mandate.</>,
      icon: Scale,
      color: 'purple',
    })
  }

  if (topSittings) {
    facts.push({
      number: topSittings.sittings.toLocaleString('en-GB'),
      text: `plenary sittings spoken in by ${topSittings.fullName} this mandate: the most of any MLA.`,
      icon: Mic2,
      color: 'green',
    })
  }

  if (highestExpenseClaim) {
    facts.push({
      number: gbpShort(highestExpenseClaim.total),
      text: `claimed in office expenses by ${highestExpenseClaim.fullName}${highestExpenseClaim.period ? ` in ${highestExpenseClaim.period}` : ''}: the highest of any MLA.`,
      icon: PoundSterling,
      color: 'orange',
    })
  }

  const [factIndex, setFactIndex] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [swapping, setSwapping] = useState(false)

  useEffect(() => {
    setFactIndex(Math.floor(Math.random() * facts.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function shuffle() {
    setSpinning(true)
    setSwapping(true)
    setTimeout(() => {
      setFactIndex(prev => {
        if (facts.length < 2) return prev
        let next = Math.floor(Math.random() * facts.length)
        while (next === prev) next = Math.floor(Math.random() * facts.length)
        return next
      })
      setSwapping(false)
    }, 150)
    setTimeout(() => setSpinning(false), 500)
  }

  const FACT_COLOR_CLASS: Record<FactColor, string> = {
    amber: styles.amber,
    green: styles.green,
    coral: styles.coral,
    purple: styles.purple,
    teal: styles.teal,
    pink: styles.pink,
    orange: styles.orange,
    indigo: styles.indigo,
    blue: styles.blue,
  }

  if (facts.length === 0) return null

  const fact = facts[factIndex] ?? facts[0]
  const FactIcon = fact.icon
  const colorClass = FACT_COLOR_CLASS[fact.color]

  return (
    <div className={styles.striking}>
      <FactIcon className={`${styles.strikingIcon} ${colorClass}${swapping ? ` ${styles.strikingSwapping}` : ''}`} size={28} strokeWidth={1.75} aria-hidden="true" />
      <div className={`${styles.strikingNumber}${swapping ? ` ${styles.strikingSwapping}` : ''}`}>{fact.number}</div>
      <div className={`${styles.strikingText}${swapping ? ` ${styles.strikingSwapping}` : ''}`}>{fact.text}</div>
      <button
        type="button"
        className={`${styles.strikingShuffle}${spinning ? ` ${styles.strikingShuffleSpin}` : ''}`}
        onClick={shuffle}
        aria-label="Show another highlight"
        title="Show another highlight"
      >
        <Shuffle size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
