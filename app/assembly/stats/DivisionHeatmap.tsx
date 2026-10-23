import styles from './statsKit.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function DivisionHeatmap({ rows }: { rows: { month: string; total_divisions: number }[] }) {
  const parsed = rows.map((r) => ({ date: new Date(r.month), value: Number(r.total_divisions) }))
  const years = [...new Set(parsed.map((r) => r.date.getFullYear()))].sort()
  const grid: Record<number, Record<number, number>> = {}
  for (const r of parsed) (grid[r.date.getFullYear()] ??= {})[r.date.getMonth()] = r.value
  const max = Math.max(1, ...parsed.map((r) => r.value))
  const now = new Date()

  const cell = (y: number, i: number) => {
    const key = `${y}-${i}`
    const v = grid[y]?.[i]
    const future = y > now.getFullYear() || (y === now.getFullYear() && i > now.getMonth())
    const current = y === now.getFullYear() && i === now.getMonth()
    if (future) return <td key={key} className={styles.heatEmpty} />
    if (v === undefined || v === 0) return <td key={key} className={styles.heatNone} data-current={current ? '' : undefined}>{current ? 0 : ''}</td>
    const k = v / max
    return (
      <td key={key} className={styles.heatCell} data-current={current ? '' : undefined} style={{ ['--k' as string]: `${Math.round(12 + 88 * k)}%` }} title={`${MONTHS[i]} ${y}: ${v}`}>{v}</td>
    )
  }

  return (
    <>
      <table className={`${styles.heat} ${styles.heatWide}`}>
        <caption className="sr-only">Divisions held each month, by year</caption>
        <thead>
          <tr>
            <td />
            {MONTHS.map((m) => <th key={m} scope="col">{m}</th>)}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <th scope="row">{y}</th>
              {MONTHS.map((_, i) => cell(y, i))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className={`${styles.heat} ${styles.heatTall}`}>
        <caption className="sr-only">Divisions held each month, by month</caption>
        <thead>
          <tr>
            <td />
            {years.map((y) => <th key={y} scope="col">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((m, i) => (
            <tr key={m}>
              <th scope="row">{m}</th>
              {years.map((y) => cell(y, i))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
