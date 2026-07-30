import type { ReactNode } from 'react'
import Link from 'next/link'
import { mandateById } from '@/lib/constants/mandates'
import { MandateProvider } from '@/components/MandateContext'

// One static folder per archived mandate; no [mandate] dynamic segment (Cloudflare adapter quirk).
const mandate = mandateById('2027-2032')!

export default function ArchiveLayout({ children }: { children: ReactNode }) {
  return (
    <MandateProvider mandate={mandate} basePath="/archive/2027-2032">
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
          View the current mandate
        </Link>
      </div>
      {children}
    </MandateProvider>
  )
}
