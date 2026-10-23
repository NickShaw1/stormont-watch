'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, MapPin, X } from 'lucide-react'
import { abbreviateParty, formatConstituency } from '@/lib/format'
import { stripHonorifics } from '@/lib/utils/formatNames'
import { useMandate } from '@/components/MandateContext'
import styles from './finder.module.css'

const ConstituencyMap = dynamic(() => import('../ConstituencyMap'), { ssr: false })

type MLA = {
  personId: string
  fullName: string
  party: string
  imgUrl: string | null
}

const CONSTITUENCIES = [
  'East Antrim', 'East Belfast', 'East Londonderry',
  'Fermanagh and South Tyrone', 'Foyle', 'Lagan Valley',
  'Mid Ulster', 'Newry and Armagh', 'North Antrim',
  'North Belfast', 'North Down', 'South Antrim',
  'South Belfast', 'South Down', 'Strangford',
  'Upper Bann', 'West Belfast', 'West Tyrone',
]

export default function MlaFinder({ mlasByConstituency }: { mlasByConstituency: Record<string, MLA[]> }) {
  const { basePath } = useMandate()
  const [selected, setSelected] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)
  const mlas = selected ? mlasByConstituency[selected] ?? [] : []
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (previous.current === selected) return
    previous.current = selected
    titleRef.current?.focus({ preventScroll: true })
  }, [selected])

  useEffect(() => {
    if (!selected || !window.matchMedia('(max-width: 900px)').matches) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [selected])

  return (
    <div className={`${styles.finder} ${mapError ? styles.noMap : ''}`}>
      {!mapError && (
        <div className={styles.mapCard}>
          <ConstituencyMap selected={selected} onSelect={setSelected} onError={() => setMapError(true)} />
        </div>
      )}

      <div className={styles.panel} aria-live="polite" ref={panelRef}>
        {selected ? (
          <>
            <div className={styles.resultHead}>
              <div className={styles.top}>
                <span className={styles.headIcon}><MapPin size={24} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <span className={styles.kicker}>Your constituency</span>
                  <h3 className={styles.title} ref={titleRef} tabIndex={-1}>{selected}</h3>
                </div>
              </div>
              <button type="button" className={styles.changeBtn} onClick={() => setSelected(null)}>
                <X size={16} strokeWidth={2} aria-hidden="true" />
                Clear
              </button>
            </div>
            <ul className={styles.mlaList}>
              {mlas.map((mla) => (
                <li key={mla.personId}>
                  <Link href={`${basePath}/assembly/mlas/${mla.personId}`} className={styles.mla}>
                    <span className={styles.photo}>
                      {mla.imgUrl && (
                        <Image src={mla.imgUrl} alt={`Photo of ${stripHonorifics(mla.fullName)}`} fill sizes="56px" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
                      )}
                    </span>
                    <span className={styles.mlaInfo}>
                      <span className={styles.mlaName}>{stripHonorifics(mla.fullName)}</span>
                      <span className="party-pill" data-party={abbreviateParty(mla.party)}>{abbreviateParty(mla.party)}</span>
                    </span>
                    <ArrowRight className={styles.mlaArrow} size={18} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className={styles.top}>
              <span className={styles.headIcon}><MapPin size={24} strokeWidth={2} aria-hidden="true" /></span>
              <div>
                <span className={styles.kicker}>Choose your constituency</span>
                <h3 className={styles.title} ref={titleRef} tabIndex={-1}>Who represents you?</h3>
              </div>
            </div>
            <p className={styles.text}>Every constituency in Northern Ireland returns five MLAs. Select a region on the map, or pick yours from the list.</p>
            <ul className={styles.chips}>
              {CONSTITUENCIES.map((c) => (
                <li key={c}>
                  <button type="button" className={styles.chip} title={c} onClick={() => setSelected(c)}>
                    <span className={styles.chipText}>{formatConstituency(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
