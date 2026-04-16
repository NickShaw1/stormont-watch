import styles from './SuspensionBanner.module.css'
import { formatDate } from '@/lib/format'

export default function SuspensionBanner() {
  const suspended = process.env.ASSEMBLY_SUSPENDED === 'true'
  if (!suspended) return null

  const lastSittingRaw = process.env.ASSEMBLY_LAST_SITTING_DATE ?? ''
  const returnDateRaw = process.env.ASSEMBLY_RETURN_DATE ?? ''

  const lastSitting = lastSittingRaw ? formatDate(lastSittingRaw) : null
  const returnDate = returnDateRaw ? formatDate(returnDateRaw) : null

  let daysSuspended: number | null = null
  if (lastSittingRaw) {
    const diff = Date.now() - new Date(lastSittingRaw).getTime()
    daysSuspended = Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <aside role="note" aria-label="Assembly suspension notice" className={styles.banner}>
      <div className={`container ${styles.inner}`}>
        <strong>The Assembly is currently suspended.</strong>
        {lastSitting && (
          <span>This record reflects the last sitting on {lastSitting}.</span>
        )}
        {daysSuspended !== null && !returnDate && (
          <span>Suspended for {daysSuspended} {daysSuspended === 1 ? 'day' : 'days'}.</span>
        )}
        {returnDate && (
          <span>The Assembly returned on {returnDate}.</span>
        )}
      </div>
    </aside>
  )
}
