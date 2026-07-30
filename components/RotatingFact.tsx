'use client'

import { useEffect, useState } from 'react'
import { Users, Plane, Briefcase, Gift, CalendarDays, Coins, Handshake, MessageCircleQuestion, Shuffle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from '../app/home.module.css'
import { sittingAdjective } from '@/lib/constants/mandates'
import { useMandate } from '@/components/MandateContext'

type FactColor = 'amber' | 'green' | 'coral' | 'purple' | 'teal' | 'pink' | 'orange' | 'indigo'

interface Fact {
  number: number | string
  text: string
  icon: LucideIcon
  color: FactColor
}

interface RotatingFactProps {
  familyEmployed: number
  fundedVisits: number
  outsideEmployment: number
  giftsHospitality: number
  sittingDays: number
  overallAgreementRate: number
  totalExpensesClaimed: number
  totalQuestions: number
}

function gbpShort(v: number): string {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `£${Math.round(v / 1_000)}k`
  return `£${Math.round(v).toLocaleString('en-GB')}`
}

export default function RotatingFact({
  familyEmployed,
  fundedVisits,
  outsideEmployment,
  giftsHospitality,
  sittingDays,
  overallAgreementRate,
  totalExpensesClaimed,
  totalQuestions,
}: RotatingFactProps) {
  const { mandate } = useMandate()
  const facts: Fact[] = [
    {
      number: familyEmployed,
      text: 'MLAs employ a family member on the public payroll through their Office Cost Expenditure. All declared in the Register of Interests.',
      icon: Users,
      color: 'amber',
    },
    {
      number: fundedVisits,
      text: `funded overseas visits have been declared by MLAs in the Register of Interests since ${mandate.start.slice(0, 4)}.`,
      icon: Plane,
      color: 'teal',
    },
    {
      number: outsideEmployment,
      text: `${sittingAdjective(mandate)} MLAs have declared paid employment outside the Assembly in the Register of Interests.`,
      icon: Briefcase,
      color: 'coral',
    },
    {
      number: giftsHospitality,
      text: `gifts and hospitality declarations have been made by MLAs in the Register of Interests since ${mandate.start.slice(0, 4)}.`,
      icon: Gift,
      color: 'pink',
    },
    {
      number: sittingDays,
      text: `days the Assembly has sat since ${mandate.startLabel}.`,
      icon: CalendarDays,
      color: 'indigo',
    },
    {
      number: gbpShort(totalExpensesClaimed),
      text: `claimed in MLA expenses since the start of the ${mandate.label} mandate.`,
      icon: Coins,
      color: 'orange',
    },
    {
      number: overallAgreementRate + '%',
      text: `of votes in the Assembly since ${mandate.start.slice(0, 4)} passed with cross-community support from both unionist and nationalist MLAs.`,
      icon: Handshake,
      color: 'green',
    },
    {
      number: totalQuestions.toLocaleString('en-GB'),
      text: `questions have been asked in the Assembly since ${mandate.startLabel}.`,
      icon: MessageCircleQuestion,
      color: 'purple',
    },
  ]

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
  }

  const fact = facts[factIndex]
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
        aria-label="Show another fact"
        title="Show another fact"
      >
        <Shuffle size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
