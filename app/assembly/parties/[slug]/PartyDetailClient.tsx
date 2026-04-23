'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import { partyBorderColor, abbreviateParty, formatMemberName, formatConstituency } from '@/lib/format'
import styles from './partyDetail.module.css'

const EXEC_ORDER: Record<string, number> = {
  'First Minister': 0,
  'deputy First Minister': 1,
  'junior Minister': 2,
}

type Minister = {
  personId: string
  fullName: string
  imgUrl: string | null
  roleTitle: string | null
  department: string | null
}

type Chair = {
  personId: string
  fullName: string
  imgUrl: string | null
  committeeName: string
}

type Mla = {
  personId: string
  fullName: string
  imgUrl: string | null
  constituency: string | null
  assemblyRole?: string | null
  assemblyRoleEnd?: string | null
}

interface Props {
  party: string
  mlas: Mla[]
  ministers: Minister[]
  chairs: Chair[]
  borderColor: string
}

const tabs = ['stats', 'expenses'] as const
type Tab = typeof tabs[number]

interface FullProps extends Props {
  description?: string
  wikiUrl?: string
  partyUrl?: string
  statsContent?: React.ReactNode
  expensesContent?: React.ReactNode
}

export default function PartyDetailClient({ party, mlas, ministers, chairs, borderColor, description, statsContent, expensesContent }: FullProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats')

  const execMinisters = ministers.filter((m) => m.department === 'The Executive Office')
  const deptMinisters = ministers.filter((m) => m.department !== 'The Executive Office')
  const sortedExec = [...execMinisters].sort(
    (a, b) => (EXEC_ORDER[a.roleTitle ?? ''] ?? 99) - (EXEC_ORDER[b.roleTitle ?? ''] ?? 99)
  )

  const abbr = abbreviateParty(party)

  return (
    <>
      {/* Description — always visible above tabs */}
      {description && (
        <div className={styles.descriptionBlock}>
          <p className={styles.description}>{description}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabSection}>
        <div className={styles.billTabs} role="tablist" aria-label="Party sections">
          {tabs.map((tab) => {
            const label = tab === 'stats' ? 'Assembly Stats' : 'Expenses'
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`tabpanel-${tab}`}
                id={`tab-${tab}`}
                className={`${styles.billTabBtn} ${activeTab === tab ? styles.billTabBtnActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div
          id="tabpanel-stats"
          role="tabpanel"
          aria-labelledby="tab-stats"
          hidden={activeTab !== 'stats'}
          className={styles.tabContent}
        >
          {statsContent ?? (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>Assembly stats coming soon.</p>
          )}
        </div>
        <div
          id="tabpanel-expenses"
          role="tabpanel"
          aria-labelledby="tab-expenses"
          hidden={activeTab !== 'expenses'}
          className={styles.tabContent}
        >
          {expensesContent ?? (
            <p style={{ color: 'var(--ink-3)', padding: '2rem 0' }}>No expenses data available.</p>
          )}
        </div>
      </div>

      <hr className="section-rule" />

      {/* Executive Office */}
      {sortedExec.length > 0 && (
        <section className={styles.section} aria-labelledby="exec-heading">
          <h2 id="exec-heading" className={styles.sectionHeading}>Executive Office</h2>
          <div className={styles.execTop}>
            {sortedExec.map((m) => (
              <Link
                key={m.personId}
                href={`/assembly/mlas/${m.personId}`}
                className={styles.execCard}
                style={{ '--party-c': partyBorderColor(party) } as React.CSSProperties}
              >
                <div className={styles.execPhoto}>
                  <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={72} decorative square />
                </div>
                <div className={styles.execInfo}>
                  <span className={styles.execMinistry}>
                    {m.roleTitle ? m.roleTitle.charAt(0).toUpperCase() + m.roleTitle.slice(1) : ''}
                  </span>
                  <span className={styles.execName}>{formatMemberName(m.fullName)}</span>
                  <span className="party-pill" data-party={abbr}>{abbr}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Ministers */}
      {deptMinisters.length > 0 && (
        <section className={styles.section} aria-labelledby="ministers-heading">
          <h2 id="ministers-heading" className={styles.sectionHeading}>Ministers</h2>
          <div className={styles.deptGrid}>
            {deptMinisters.map((m) => (
              <div key={m.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  <span className={styles.deptName}>{m.department ?? ''}</span>
                </div>
                <Link href={`/assembly/mlas/${m.personId}`} className={styles.deptItem}>
                  <div className={styles.deptPhoto}>
                    <MlaPhoto name={m.fullName} imgUrl={m.imgUrl ?? ''} size={56} decorative square />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Minister</span>
                    <span className={styles.deptMlaName}>{formatMemberName(m.fullName)}</span>
                    <span className="party-pill" data-party={abbr}>{abbr}</span>
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Committee Chairs */}
      {chairs.length > 0 && (
        <section className={styles.section} aria-labelledby="chairs-heading">
          <h2 id="chairs-heading" className={styles.sectionHeading}>Committee Chairs</h2>
          <div className={styles.deptGrid}>
            {chairs.map((c) => (
              <div key={c.personId} className={styles.deptBlock}>
                <div className={styles.deptBlockHead}>
                  <span className={styles.deptName}>{c.committeeName}</span>
                </div>
                <Link href={`/assembly/mlas/${c.personId}`} className={styles.deptItem}>
                  <div className={styles.deptPhoto}>
                    <MlaPhoto name={c.fullName} imgUrl={c.imgUrl ?? ''} size={56} decorative square />
                  </div>
                  <div className={styles.deptInfo}>
                    <span className={styles.deptLabel}>Chair</span>
                    <span className={styles.deptMlaName}>{formatMemberName(c.fullName)}</span>
                    <span className="party-pill" data-party={abbr}>{abbr}</span>
                  </div>
                  <span className={styles.deptArrow}>→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MLAs */}
      <section className={styles.section} aria-labelledby="mlas-heading">
        <h2 id="mlas-heading" className={styles.sectionHeading}>
          MLAs <span className={styles.mlaCount}>{mlas.length}</span>
        </h2>
        <ul className={styles.mlaGrid} role="list">
          {mlas.map((mla) => (
            <li key={mla.personId} className={styles.mlaCardWrapper}>
              <div className={styles.mlaCard} style={{ '--party-c': borderColor } as React.CSSProperties}>

                <div className={styles.mlaPhoto}>
                  <MlaPhoto name={mla.fullName} imgUrl={mla.imgUrl ?? ''} size={64} decorative square />
                </div>
                <Link
                  href={`/assembly/mlas/${mla.personId}`}
                  className={styles.mlaName}
                  aria-label={`View profile for ${formatMemberName(mla.fullName)}`}
                >
                  {formatMemberName(mla.fullName)}
                </Link>
                <span className={styles.mlaConstituency}>{formatConstituency(mla.constituency)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
