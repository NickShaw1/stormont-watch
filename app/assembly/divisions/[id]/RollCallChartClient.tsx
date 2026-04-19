'use client'
import { useEffect, useRef } from 'react'
import { partyPillStyleSolid } from '@/lib/format'
import styles from './divisionDetail.module.css'

type Vote = {
  personId: string
  fullName: string
  party?: string | null
  vote: string
}

export default function RollCallChartClient({ votes }: { votes: Vote[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    const voteTypes: Array<{ key: string; label: string }> = [
      { key: 'AYE', label: 'Aye' },
      { key: 'NO', label: 'No' },
      { key: 'NO_SHOW', label: 'No Show' },
      { key: 'ABSTAINED', label: 'Abstain' },
    ]

    // Collect parties ordered by total vote count descending
    const partyCounts = new Map<string, number>()
    for (const v of votes) {
      const p = v.party ?? 'Independent'
      partyCounts.set(p, (partyCounts.get(p) ?? 0) + 1)
    }
    const parties = [...partyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p)

    // Only include vote categories that have at least one vote
    const activeVoteTypes = voteTypes.filter((vt) =>
      votes.some((v) => v.vote === vt.key)
    )

    const labels = activeVoteTypes.map((vt) => vt.label)

    const datasets = parties.map((party) => ({
      label: party,
      backgroundColor: partyPillStyleSolid(party).background,
      data: activeVoteTypes.map(
        (vt) => votes.filter((v) => (v.party ?? 'Independent') === party && v.vote === vt.key).length
      ),
    }))

    import('chart.js/auto').then(({ Chart }) => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => `${item.dataset.label}: ${item.raw}`,
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.06)' },
              ticks: { font: { size: 11 }, precision: 0 },
            },
            y: {
              stacked: true,
              grid: { display: false },
              ticks: { font: { size: 12, weight: 'bold' } },
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [votes])

  return (
    <div className={styles.rollCallChart}>
      <canvas ref={canvasRef} />
    </div>
  )
}
