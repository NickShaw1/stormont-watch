import type { ReactNode } from 'react'
import Link from 'next/link'
import { mandateById } from '@/lib/constants/mandates'
import { MandateProvider } from '@/components/MandateContext'

// One static folder per archived mandate (see lib/constants/mandates.ts for how to add the
// next one, e.g. 2032-2037) — a plain static route, no [mandate] dynamic segment, since
// Cloudflare's next-on-pages adapter does not reliably recognise dynamic-segment routes as
// static even with generateStaticParams + dynamicParams = false.
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
          View the current mandate ↗
        </Link>
      </div>
      {children}
    </MandateProvider>
  )
}
