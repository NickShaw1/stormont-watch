'use client'

import { useEffect, useState } from 'react'
import { Users, Plane, Briefcase, Gift, CalendarDays, Coins, Handshake, MessageCircleQuestion, Shuffle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { sittingAdjective } from '@/lib/constants/mandates'
import { useMandate } from '@/components/MandateContext'
import s from './facts.module.css'

type FactColor = 'amber' | 'green' | 'coral' | 'purple' | 'teal' | 'pink' | 'orange' | 'indigo'

interface Fact {
  number: number | string
  text: string
  icon: LucideIcon
  color: FactColor
}

interface FactsProps {
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

const COLOR_CLASS: Record<FactColor, string> = {
  amber: s.amber,
  green: s.green,
  coral: s.coral,
  purple: s.purple,
  teal: s.teal,
  pink: s.pink,
  orange: s.orange,
  indigo: s.indigo,
}

export default function Facts({
  familyEmployed,
  fundedVisits,
  outsideEmployment,
  giftsHospitality,
  sittingDays,
  overallAgreementRate,
  totalExpensesClaimed,
  totalQuestions,
}: FactsProps) {
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
      text: `of votes in the Assembly since ${mandate.start.slice(0, 4)} where both blocs took part saw unionist and nationalist MLAs vote the same way, for or against.`,
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
  const [shuffled, setShuffled] = useState(false)

  useEffect(() => {
    setFactIndex(Math.floor(Math.random() * facts.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function shuffle() {
    setShuffled(true)
    setSpinning(true)
    setSwapping(true)
    setTimeout(() => {
      setFactIndex((prev) => {
        if (facts.length < 2) return prev
        let next = Math.floor(Math.random() * facts.length)
        while (next === prev) next = Math.floor(Math.random() * facts.length)
        return next
      })
      setSwapping(false)
    }, 150)
    setTimeout(() => setSpinning(false), 500)
  }

  return (
    <div className={s.card}>
      <div className={s.stack}>
        {facts.map((fact, i) => {
          const FactIcon = fact.icon
          const active = i === factIndex
          const fade = active && swapping ? ` ${s.swapping}` : ''
          return (
            <div key={i} className={`${s.slide} ${COLOR_CLASS[fact.color]}${active ? ` ${s.slideActive}` : ''}`} aria-hidden={!active}>
              <span className={`${s.iconTile}${fade}`}>
                <FactIcon size={40} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <p className={`${s.sentence}${fade}`}>
                <span className={s.number}>{fact.number}</span>{' '}<span className={s.factText}>{fact.text}</span>
              </p>
            </div>
          )
        })}
      </div>
      <div className="sr-only" role="status">
        {shuffled && <>{facts[factIndex].number} {facts[factIndex].text}</>}
      </div>
      <button
        type="button"
        className={`${s.shuffle}${spinning ? ` ${s.spin}` : ''}`}
        onClick={shuffle}
        aria-label="Show another fact"
        title="Show another fact"
      >
        <Shuffle size={20} strokeWidth={2} aria-hidden="true" />
        <span className={s.shuffleLabel} aria-hidden="true">Another fact</span>
      </button>
    </div>
  )
}
