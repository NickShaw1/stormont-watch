'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function RouteAnnouncer() {
  const pathname = usePathname()
  const [announcement, setAnnouncement] = useState('')
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // Wait one tick for document.title to reflect the new route
    const id = setTimeout(() => {
      setAnnouncement(document.title || 'New page')
    }, 100)
    return () => clearTimeout(id)
  }, [pathname])

  return (
    <p
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </p>
  )
}
