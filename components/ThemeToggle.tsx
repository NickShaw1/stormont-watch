'use client'

import { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

type StoredTheme = 'light' | 'dark'

function readStoredTheme(): StoredTheme | null {
  const stored = window.localStorage.getItem('swTheme')
  return stored === 'light' || stored === 'dark' ? stored : null
}

/**
 * Manual override on top of prefers-color-scheme. Resolution order:
 * localStorage override -> system preference -> light. No SSR/hydration
 * state is involved — force-static pages have no server-rendered theme,
 * so this reads/writes purely client-side after mount.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<StoredTheme | null>(null)

  useEffect(() => {
    setTheme(readStoredTheme())
  }, [])

  function apply(next: StoredTheme | null) {
    if (next) {
      document.documentElement.dataset.theme = next
      window.localStorage.setItem('swTheme', next)
    } else {
      delete document.documentElement.dataset.theme
      window.localStorage.removeItem('swTheme')
    }
    setTheme(next)
  }

  function toggle() {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const current = theme ?? (systemDark ? 'dark' : 'light')
    apply(current === 'dark' ? 'light' : 'dark')
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className={`${styles.iconStack}${isDark ? ` ${styles.isDark}` : ''}`}>
        <svg className={styles.sunIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle className={styles.sunCore} cx="12" cy="12" r="4" />
          <path className={styles.sunRays} d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <svg className={styles.moonIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      </span>
    </button>
  )
}
