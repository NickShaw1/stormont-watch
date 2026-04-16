import type { Metadata } from 'next'
import Link from 'next/link'
import styles from './not-found.module.css'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="container">
      <div className={styles.wrap}>
        <p className={styles.code} aria-hidden="true">404</p>
        <h1>Page not found</h1>
        <p className="text-secondary">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className={styles.links}>
          <Link href="/">Go to homepage</Link>
          <Link href="/assembly/votes">Browse votes</Link>
          <Link href="/assembly/mlas">Browse MLAs</Link>
        </div>
      </div>
    </div>
  )
}
