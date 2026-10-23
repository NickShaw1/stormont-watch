import type { Metadata } from 'next'
import { PenLine, Copyright, ShieldAlert } from 'lucide-react'
import LegalPage from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for Stormont Watch.',
  alternates: { canonical: 'https://www.stormontwatch.com/terms' },
  openGraph: { title: 'Terms of Use - Stormont Watch', description: 'Terms of use for Stormont Watch.' },
  robots: { index: false },
}

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Last updated: April 2026"
      title="Terms of Use"
      intro="The terms that apply to your use of the Stormont Watch website."
      sections={[
        {
          id: 'corrections',
          label: 'Report an error',
          title: 'Corrections policy',
          Icon: PenLine,
          children: (
            <p>
              We aim to ensure all information is accurate and up to date. If you believe any
              information is incorrect, please contact us at{' '}
              <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>. We will
              investigate and, where appropriate, correct or remove the information promptly.
            </p>
          ),
        },
        {
          id: 'copyright',
          label: 'Content ownership',
          title: 'Copyright',
          Icon: Copyright,
          children: (
            <>
              <p>
                Original editorial content on this site is copyright Stormont Watch. Voting data
                reproduced from the NI Assembly Open Data API is subject to the Assembly&apos;s
                own open data licence.
              </p>
              <p>
                Parliamentary copyright images are reproduced with the permission of the Northern Ireland Assembly Commission.
              </p>
            </>
          ),
        },
        {
          id: 'warranty',
          label: 'Disclaimer',
          title: 'No warranty',
          Icon: ShieldAlert,
          children: (
            <p>
              This site is provided &quot;as is&quot;, without warranty of any kind. We do not
              guarantee that the information is complete, current or error-free.
            </p>
          ),
        },
      ]}
    />
  )
}
