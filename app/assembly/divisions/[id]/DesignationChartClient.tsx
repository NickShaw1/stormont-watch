'use client'
import { useEffect, useRef } from 'react'
import styles from './divisionDetail.module.css'

interface Props {
  unionistAyes: number
  unionistNoes: number
  unionistNs: number
  unionistAbs: number
  nationalistAyes: number
  nationalistNoes: number
  nationalistNs: number
  nationalistAbs: number
  otherAyes: number
  otherNoes: number
  otherNs: number
  otherAbs: number
}

const U_COLOR = '#e67e22'
const N_COLOR = '#2e7d32'
const O_COLOR = '#9e9e9e'

export default function DesignationChartClient({
  unionistAyes, unionistNoes, unionistNs, unionistAbs,
  nationalistAyes, nationalistNoes, nationalistNs, nationalistAbs,
  otherAyes, otherNoes, otherNs, otherAbs,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasNoShow = unionistNs + nationalistNs + otherNs > 0
    const hasAbstain = unionistAbs + nationalistAbs + otherAbs > 0

    const labels = ['Aye', 'No']
    if (hasNoShow) labels.push('No Show')
    if (hasAbstain) labels.push('Abstain')

    import('chart.js/auto').then(({ Chart }) => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Unionist',
              data: [unionistAyes, unionistNoes, ...(hasNoShow ? [unionistNs] : []), ...(hasAbstain ? [unionistAbs] : [])],
              backgroundColor: U_COLOR,
            },
            {
              label: 'Nationalist',
              data: [nationalistAyes, nationalistNoes, ...(hasNoShow ? [nationalistNs] : []), ...(hasAbstain ? [nationalistAbs] : [])],
              backgroundColor: N_COLOR,
            },
            {
              label: 'Other',
              data: [otherAyes, otherNoes, ...(hasNoShow ? [otherNs] : []), ...(hasAbstain ? [otherAbs] : [])],
              backgroundColor: O_COLOR,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 11 }, boxWidth: 12, padding: 12 },
            },
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
  }, [unionistAyes, unionistNoes, unionistNs, unionistAbs, nationalistAyes, nationalistNoes, nationalistNs, nationalistAbs, otherAyes, otherNoes, otherNs, otherAbs])

  return (
    <div className={styles.designationChart}>
      <canvas ref={canvasRef} />
    </div>
  )
}
