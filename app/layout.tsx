import type { Metadata, Viewport } from 'next'
import { Outfit, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import SuspensionBanner from '@/components/SuspensionBanner'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Stormont Watch',
    template: '%s - Stormont Watch',
  },
  description: 'Every vote in the Northern Ireland Assembly since February 2024.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stormontwatch.com'),
  openGraph: {
    siteName: 'Stormont Watch',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Stormont Watch — Northern Ireland Assembly tracker',
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
      { url: '/icon0.svg', type: 'image/svg+xml' },
      { url: '/icon1.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png' }],
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    title: 'Stormont Watch',
  },
}

export const viewport: Viewport = {
  themeColor: '#203F59',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" className={`${outfit.variable} ${ibmPlexMono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ScrollToTop />
        <Nav />
        <SuspensionBanner />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
