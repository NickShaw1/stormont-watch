import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX, Home, Vote, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <div className="container">
      <header className="notFoundPageHeader">
        <span className="notFoundPageHeaderEyebrow">Error 404</span>
        <h1 className="notFoundPageHeaderTitle">
          <SearchX className="notFoundPageHeaderIcon" size={22} strokeWidth={1.75} aria-hidden="true" />
          Page not found
        </h1>
        <p className="notFoundLede">The page you are looking for does not exist or has been moved.</p>
      </header>

      <div className="notFoundPanel">
        <div className="notFoundCodePanel">
          <span className="notFoundCode" aria-hidden="true">404</span>
        </div>
        <div className="notFoundPanelBody">
          <h2 className="notFoundPanelHeading">Nothing here</h2>
          <p className="notFoundPanelText">
            Check the address, or use one of the links below to find your way back.
          </p>
        </div>
      </div>

      <div className="notFoundLinks">
        <Link href="/" className="notFoundLinkBtn notFoundLinkBtnPrimary">
          <Home size={16} strokeWidth={2} aria-hidden="true" />
          Go to homepage
        </Link>
        <Link href="/assembly/votes" className="notFoundLinkBtn">
          <Vote size={16} strokeWidth={2} aria-hidden="true" />
          Browse votes
        </Link>
        <Link href="/assembly/mlas" className="notFoundLinkBtn">
          <Users size={16} strokeWidth={2} aria-hidden="true" />
          Browse MLAs
        </Link>
      </div>
    </div>
  )
}
