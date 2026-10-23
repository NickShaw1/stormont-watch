import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchX, Home, ArrowRight } from 'lucide-react'
import ErrorPageShell, { errorButtonClass } from './components/ErrorPageShell'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <ErrorPageShell
      code="404"
      title="Page not found"
      message="The page you are looking for does not exist or has been moved. Check the address, or pick a section below."
      Icon={SearchX}
      actions={
        <>
          <Link href="/" className={errorButtonClass.primary}>
            <Home size={18} strokeWidth={2} aria-hidden="true" />
            Go to homepage
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link href="/assembly/mlas" className={errorButtonClass.ghost}>
            Browse MLAs
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </Link>
        </>
      }
    />
  )
}
