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
}

export default function RotatingFact({
  familyEmployed,
  fundedVisits,
  outsideEmployment,
  giftsHospitality,
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
