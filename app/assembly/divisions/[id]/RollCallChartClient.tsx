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

    const partyCounts = new Map<string, number>()
    for (const v of votes) {
      const p = v.party ?? 'Independent'
      partyCounts.set(p, (partyCounts.get(p) ?? 0) + 1)
    }
    const parties = [...partyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p)

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

    const root = getComputedStyle(document.documentElement)
    const tickColor = root.getPropertyValue('--sw-text-tertiary').trim() || '#656b72'
    const gridColor = root.getPropertyValue('--sw-border').trim() || '#dcded9'

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
              grid: { color: gridColor },
              ticks: { font: { size: 11 }, precision: 0, color: tickColor },
            },
            y: {
              stacked: true,
              grid: { display: false },
              ticks: { font: { size: 12, weight: 'bold' }, color: tickColor },
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [votes])

  return (
    <div className={styles.rollCallChart}>
      <div className={styles.chartCanvasWrap}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
