'use client'

import { usePathname } from 'next/navigation'

// Browsing an archived mandate keeps every link inside /archive/<id>.
export function useArchiveBase() {
  const pathname = usePathname()
  const match = pathname.match(/^\/archive\/([^/]+)/)
  const archiveId = match ? match[1] : null
  const basePath = archiveId ? `/archive/${archiveId}` : ''
  return { pathname, archiveId, basePath, homeHref: basePath || '/' }
}
