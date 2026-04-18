import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import SuspensionBanner from '@/components/SuspensionBanner'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import RouteAnnouncer from '@/components/RouteAnnouncer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-stack',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Stormont Watch',
    template: '%s - Stormont Watch',
  },
  description: 'Stormont Watch tracks every vote, bill and MLA expense in the Northern Ireland Assembly. Independent, plain-language accountability since the 2022 mandate.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stormontwatch.com'),
  openGraph: {
    title: 'Stormont Watch',
    description: 'Stormont Watch tracks every vote, bill and MLA expense in the Northern Ireland Assembly. Independent, plain-language accountability since the 2022 mandate.',
    siteName: 'Stormont Watch',
    type: 'website',
    images: [
      {
        url: 'https://www.stormontwatch.com/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Stormont Watch — NI Assembly Transparency',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@stormontwatch',
    images: ['/opengraph-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png?v=2', type: 'image/png', sizes: '96x96' },
      { url: '/favicon.ico?v=2' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest?v=2',
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: 'Mz_H-i_CpmLwYrn3nyQWY9CYy7-fraVhGMrY-DGRaSw',
  },
}

export const viewport: Viewport = {
  themeColor: '#fafafa',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <RouteAnnouncer />
        <ScrollToTop />
        <Nav />
        <SuspensionBanner />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
