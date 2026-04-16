'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import styles from './not-found.module.css'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module')
    ) {
      window.location.reload()
    }
  }, [error])

  return (
    <div className="container">
      <div className={styles.wrap}>
        <p className={styles.code} aria-hidden="true">500</p>
        <h1>Something went wrong</h1>
        <p className="text-secondary">
          An unexpected error occurred. Try again or return to the homepage.
        </p>
        <div className={styles.links}>
          <button onClick={reset} className={styles.resetBtn}>Try again</button>
          <Link href="/">Go to homepage</Link>
        </div>
      </div>
    </div>
  )
}
