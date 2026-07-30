'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'

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
      <header className="notFoundPageHeader notFoundPageHeaderError">
        <span className="notFoundPageHeaderEyebrow notFoundPageHeaderEyebrowError">Error 500</span>
        <h1 className="notFoundPageHeaderTitle">
          <AlertTriangle className="notFoundPageHeaderIcon notFoundPageHeaderIconError" size={22} strokeWidth={1.75} aria-hidden="true" />
          Something went wrong
        </h1>
        <p className="notFoundLede">An unexpected error occurred. Try again, or head back to the homepage.</p>
      </header>

      <div className="notFoundPanel">
        <div className="notFoundCodePanel notFoundCodePanelError">
          <span className="notFoundCode" aria-hidden="true">500</span>
        </div>
        <div className="notFoundPanelBody">
          <h2 className="notFoundPanelHeading">Unexpected error</h2>
          <p className="notFoundPanelText">
            Something went wrong loading this page.
          </p>
        </div>
      </div>

      <div className="notFoundLinks">
        <button onClick={reset} className="notFoundResetBtn notFoundLinkBtnPrimary">
          <RotateCw size={16} strokeWidth={2} aria-hidden="true" />
          Try again
        </button>
        <Link href="/" className="notFoundLinkBtn">
          <Home size={16} strokeWidth={2} aria-hidden="true" />
          Go to homepage
        </Link>
      </div>
    </div>
  )
}
