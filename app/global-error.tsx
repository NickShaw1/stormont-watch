'use client'

import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
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
    <html lang="en-GB">
      <body>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--s-6)',
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              border: '1px solid var(--sw-border)',
              borderTop: '1px solid var(--sw-error)',
              background: 'color-mix(in srgb, var(--sw-error) 11%, var(--sw-surface))',
              padding: 'var(--s-6)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'var(--sw-fs-eyebrow)',
                fontWeight: 'var(--sw-fw-eyebrow)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--sw-eyebrow-tracking)',
                color: 'var(--sw-error)',
                marginBottom: '4px',
              }}
            >
              Application error
            </span>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 'var(--sw-fs-h2)',
                letterSpacing: '-0.015em',
                color: 'var(--sw-text-primary)',
                margin: '0 0 var(--s-3)',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: 'var(--sw-fs-body)',
                color: 'var(--sw-text-secondary)',
                lineHeight: 1.5,
                margin: '0 0 var(--s-5)',
              }}
            >
              The application failed to load. Try again, or reload the page.
            </p>
            <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  minHeight: '44px',
                  border: '1px solid var(--sw-accent)',
                  borderRadius: 'var(--sw-radius-sm)',
                  background: 'var(--sw-accent)',
                  color: '#ffffff',
                  fontSize: 'var(--sw-fs-body-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- root fallback renders outside the app tree, no router context */}
              <a
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  minHeight: '44px',
                  border: '1px solid var(--sw-border-strong)',
                  borderRadius: 'var(--sw-radius-sm)',
                  background: 'var(--sw-surface)',
                  color: 'var(--sw-text-secondary)',
                  fontSize: 'var(--sw-fs-body-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  textDecoration: 'none',
                }}
              >
                Go to homepage
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
