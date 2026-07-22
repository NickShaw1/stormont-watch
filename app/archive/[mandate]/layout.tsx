import Link from 'next/link'
import { notFound } from 'next/navigation'
import { mandateById, CURRENT_MANDATE, mandateHasBegun } from '@/lib/constants/mandates'
import { MandateProvider } from '@/components/MandateContext'

export default async function ArchiveLayout({ children, params }: LayoutProps<'/archive/[mandate]'>) {
  const { mandate: id } = await params
  const mandate = mandateById(id)
  // Archives are non-current mandates that have already begun. A future mandate (present in
  // config ahead of the transition) 404s here so it can't be reached by direct URL.
  if (!mandate || mandate.id === CURRENT_MANDATE.id || !mandateHasBegun(mandate)) notFound()

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
