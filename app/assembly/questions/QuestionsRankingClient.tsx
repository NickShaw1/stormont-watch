'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MlaPhoto from '@/components/MlaPhoto'
import PartyName from '@/components/PartyName'
import { formatMemberName, abbreviateParty, formatConstituency } from '@/lib/format'
import styles from './questions.module.css'

interface QRow {
  personId: string
  fullName: string
  party: string | null
  constituency: string | null
  imgUrl: string | null
  count: number
}

interface Props {
  rows: QRow[]
}

const PAGE_SIZE = 25

export default function QuestionsRankingClient({ rows }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isMobile, setIsMobile] = useState(false)
  const firstNewRef = useRef<HTMLTableRowElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMobile(window.matchMedia('(max-width: 640px)').matches)
  }, [])

  const visible = isMobile ? rows : rows.slice(0, visibleCount)
  const hasMore = !isMobile && visibleCount < rows.length

  const handleLoadMore = useCallback(() => {
    setVisibleCount(c => c + 50)
    requestAnimationFrame(() => {
      if (firstNewRef.current) firstNewRef.current.focus()
    })
  }, [])

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="MLA questions ranked table">
          <colgroup>
            <col className={styles.colRank} />
            <col className={styles.colMla} />
            <col className={`${styles.colParty} ${styles.hideMobile}`} />
            <col className={`${styles.colConstituency} ${styles.hideMobile} ${styles.hideTablet}`} />
            <col className={styles.colQuestions} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.colRank}>#</th>
              <th scope="col">MLA</th>
              <th scope="col" className={styles.hideMobile}>Party</th>
              <th scope="col" className={`${styles.hideMobile} ${styles.hideTablet}`}>Constituency</th>
              <th scope="col"><span className={styles.colQuestionsDesktop}>Questions</span><span className={styles.colQuestionsMobile}>Qs</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const globalRank = i + 1
              const isFirstNew = i === visibleCount - PAGE_SIZE && i > 0
              const isTop = i === 0

              return (
                <tr
                  key={row.personId}
                  className={`${styles.tableRow} ${isTop ? styles.rowGold : ''}`}
                  ref={isFirstNew ? firstNewRef : undefined}
                  tabIndex={isFirstNew ? -1 : undefined}
                  onClick={() => router.push(`/assembly/mlas/${row.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={styles.tdRank} aria-label={`Rank ${globalRank}`}>{globalRank}</td>

                  <td>
                    <div className={styles.mlaCell}>
                      <span className={styles.photoDesktop}>
                        <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={36} decorative square />
                      </span>
                      <span className={styles.photoMobile}>
                        <MlaPhoto name={row.fullName} imgUrl={row.imgUrl ?? ''} size={50} decorative square />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          href={`/assembly/mlas/${row.personId}`}
                          className={styles.mlaName}
                          aria-label={`${formatMemberName(row.fullName)}${row.party ? `, ${row.party}` : ''}${row.constituency ? `, ${formatConstituency(row.constituency)}` : ''}`}
                        >
                          {formatMemberName(row.fullName)}
                        </Link>
                        {row.party && (
                          <span
                            className={`party-pill ${styles.mobilePill}`}
                            data-party={abbreviateParty(row.party)}
                          >
                            <PartyName party={row.party} />
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className={`${styles.tdParty} ${styles.hideMobile}`}>
                    {row.party && (
                      <span className="party-pill" data-party={abbreviateParty(row.party)}>
                        <PartyName party={row.party} />
                      </span>
                    )}
                  </td>

                  <td className={`${styles.tdConstituency} ${styles.hideMobile} ${styles.hideTablet}`}>
                    {row.constituency ? formatConstituency(row.constituency) : '—'}
                  </td>

                  <td className={styles.tdQuestions}>
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={handleLoadMore}
          aria-label="Load more MLAs"
        >
          Load more ({rows.length - visibleCount} remaining)
        </button>
      )}
    </>
  )
}
