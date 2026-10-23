import type { Metadata } from 'next'
import { Database, Cookie, Share2, UserCheck, RefreshCw } from 'lucide-react'
import LegalPage from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Stormont Watch.',
  alternates: { canonical: 'https://www.stormontwatch.com/privacy' },
  openGraph: { title: 'Privacy Policy - Stormont Watch', description: 'Privacy policy for Stormont Watch.' },
  robots: { index: false },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Last updated: April 2026"
      title="Privacy Policy"
      intro="How Stormont Watch handles data from visitors to this site."
      sections={[
        {
          id: 'data',
          label: 'No tracking',
          title: 'What data we collect',
          Icon: Database,
          children: (
            <p>
              Stormont Watch does not collect any personal data from visitors. We do not use
              cookies, tracking scripts, analytics, or advertising technologies of any kind.
            </p>
          ),
        },
        {
          id: 'cookies',
          label: 'None set',
          title: 'Cookies',
          Icon: Cookie,
          children: <p>This site does not set any cookies.</p>,
        },
        {
          id: 'third-party',
          label: 'Hosting',
          title: 'Third-party services',
          Icon: Share2,
          children: (
            <p>
              Voting data is fetched from the NI Assembly Open Data API on the server. No
              third-party scripts are loaded in your browser. Visitor IP addresses may be
              processed by our hosting provider in the ordinary course of serving web pages;
              we do not have access to this data.
            </p>
          ),
        },
        {
          id: 'rights',
          label: 'Access and deletion',
          title: 'Your rights',
          Icon: UserCheck,
          children: (
            <p>
              Because we do not collect personal data, there is no personal data about you
              held by Stormont Watch for you to access, correct or delete. If you have any
              questions, contact us at{' '}
              <a href="mailto:hello@stormontwatch.com">hello@stormontwatch.com</a>.
            </p>
          ),
        },
        {
          id: 'changes',
          label: 'Updates',
          title: 'Changes to this policy',
          Icon: RefreshCw,
          children: (
            <p>
              We may update this policy from time to time. The date at the top of this page
              reflects when it was last revised.
            </p>
          ),
        },
      ]}
    />
  )
}
