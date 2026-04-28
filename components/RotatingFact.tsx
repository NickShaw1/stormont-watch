'use client'

import { useEffect, useState } from 'react'
import styles from '../app/home.module.css'

interface Fact {
  number: number | string
  text: string
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
  const facts: Fact[] = [
    {
      number: familyEmployed,
      text: 'MLAs employ a family member on the public payroll through their Office Cost Expenditure. All declared in the Register of Interests.',
    },
    {
      number: fundedVisits,
      text: 'funded overseas visits have been declared by MLAs in the Register of Interests since 2022.',
    },
    {
      number: outsideEmployment,
      text: 'current MLAs have declared paid employment outside the Assembly in the Register of Interests.',
    },
    {
      number: giftsHospitality,
      text: 'gifts and hospitality declarations have been made by MLAs in the Register of Interests since 2022.',
    },
    {
      number: sittingDays,
      text: 'days the Assembly has sat since May 2022.',
    },
    {
      number: gbpShort(totalExpensesClaimed),
      text: 'claimed in MLA expenses since the start of the 2022–2027 mandate.',
    },
    {
      number: overallAgreementRate + '%',
      text: 'of votes in the Assembly since 2022 passed with cross-community support from both unionist and nationalist MLAs.',
    },
    {
      number: totalQuestions.toLocaleString('en-GB'),
      text: 'questions have been asked in the Assembly since May 2022.',
    },
  ]

  const [fact, setFact] = useState<Fact>(facts[0])

  useEffect(() => {
    setFact(facts[Math.floor(Math.random() * facts.length)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.striking}>
      <div className={styles.strikingNumber}>{fact.number}</div>
      <div className={styles.strikingText}>{fact.text}</div>
    </div>
  )
}
