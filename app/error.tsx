'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'
import ErrorPageShell, { errorButtonClass } from './components/ErrorPageShell'

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
    <ErrorPageShell
      code="500"
      title="Something went wrong"
      message="An unexpected error stopped this page from loading. Try again, or head back to the homepage."
      Icon={AlertTriangle}
      isError
      actions={
        <>
          <button type="button" onClick={reset} className={errorButtonClass.primary}>
            <RotateCw size={18} strokeWidth={2} aria-hidden="true" />
            Try again
          </button>
          <Link href="/" className={errorButtonClass.ghost}>
            <Home size={18} strokeWidth={2} aria-hidden="true" />
            Go to homepage
          </Link>
        </>
      }
    />
  )
}
