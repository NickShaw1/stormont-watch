import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { mandateById, CURRENT_MANDATE } from '@/lib/constants/mandates'
import { MandateProvider } from '@/components/MandateContext'

// Explicit prop type (not the Next-generated `LayoutProps`, which only exists after a build
// generates .next/types — CI runs `tsc` before the build, so the generated type isn't there).
export default async function ArchiveLayout({ children, params }: { children: ReactNode; params: Promise<{ mandate: string }> }) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  // Only non-current mandates are archives. Future mandates are prerendered (as sparse pages)
  // so the static build has assets for these routes, but hidden from the switcher + sitemap
  // (which use the begun-filtered ARCHIVED_MANDATES) so users don't navigate to them.
  if (!mandate || mandate.id === CURRENT_MANDATE.id) notFound()

  return (
    <MandateProvider mandate={mandate} basePath={`/archive/${id}`}>
      <div
        style={{
          background: '#475569',
          color: '#f8fafc',
          textAlign: 'center',
          padding: '0.6rem 1rem',
          fontSize: '0.9rem',
        }}
      >
        Archive: you are viewing the <strong>{mandate.label}</strong> mandate.{' '}
        <Link href="/" style={{ color: '#e2e8f0', textDecoration: 'underline' }}>
          View the current mandate ↗
        </Link>
      </div>
      {children}
    </MandateProvider>
  )
}
