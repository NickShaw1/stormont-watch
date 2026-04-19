'use client'
import { useEffect, useRef } from 'react'
import styles from './divisionDetail.module.css'

interface Props {
  unionistAyes: number
  unionistNoes: number
  unionistAbs: number
  nationalistAyes: number
  nationalistNoes: number
  nationalistAbs: number
  otherAyes: number
  otherNoes: number
  otherAbs: number
}

const U_COLOR = '#e67e22'
const N_COLOR = '#2e7d32'
const O_COLOR = '#9e9e9e'

export default function DesignationChartClient({
  unionistAyes, unionistNoes, unionistAbs,
  nationalistAyes, nationalistNoes, nationalistAbs,
  otherAyes, otherNoes, otherAbs,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    import('chart.js/auto').then(({ Chart }) => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: ['Aye', 'No', 'Abs'],
          datasets: [
            {
              label: 'Unionist',
              data: [unionistAyes, unionistNoes, unionistAbs],
              backgroundColor: U_COLOR,
            },
            {
              label: 'Nationalist',
              data: [nationalistAyes, nationalistNoes, nationalistAbs],
              backgroundColor: N_COLOR,
            },
            {
              label: 'Other',
              data: [otherAyes, otherNoes, otherAbs],
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
  }, [unionistAyes, unionistNoes, unionistAbs, nationalistAyes, nationalistNoes, nationalistAbs, otherAyes, otherNoes, otherAbs])

  return (
    <div className={styles.designationChart}>
      <canvas ref={canvasRef} />
    </div>
  )
}
