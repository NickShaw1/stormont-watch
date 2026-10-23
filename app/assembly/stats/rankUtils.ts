export function rankRows<T>(rows: T[], getValue: (r: T) => number): (T & { rank: string })[] {
  const values = rows.map(getValue)
  return rows.map((r, i) => {
    const v = values[i]
    const rank = values.filter((x) => x > v).length + 1
    const tied = values.some((x, j) => j !== i && x === v)
    return { ...r, rank: tied ? `=${rank}` : String(rank) }
  })
}

export function serviceLabel(mandateStart: string | null, mandateEnd: string | null): string {
  if (!mandateStart) return '-'
  const start = new Date(mandateStart)
  const end = mandateEnd ? new Date(mandateEnd) : new Date()
  const total = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  const years = Math.floor(total / 12)
  const months = total % 12
  if (years === 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}
