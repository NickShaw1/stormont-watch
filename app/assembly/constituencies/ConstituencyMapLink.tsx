'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { constituencySlug } from '@/lib/utils/constituencySlug'
import styles from './constituency.module.css'

const ConstituencyMap = dynamic(() => import('@/app/components/ConstituencyMap'), { ssr: false })

export default function ConstituencyMapLink({
  basePath,
  selected = null,
  locator = false,
  fills,
  labelColors,
  highlighted = null,
  onHover,
  onPick,
  interactive = true,
}: {
  basePath: string
  selected?: string | null
  locator?: boolean
  fills?: Record<string, string>
  labelColors?: Record<string, string>
  highlighted?: string | null
  onHover?: (name: string | null) => void
  onPick?: (name: string) => void
  interactive?: boolean
}) {
  const router = useRouter()
  const [mapError, setMapError] = useState(false)

  if (mapError) return null

  return (
    <div className={styles.mapBlock}>
      <div className={locator ? styles.locatorCard : styles.mapBare}>
        <ConstituencyMap
          selected={selected}
          fills={fills}
          labelColors={labelColors}
          highlighted={highlighted}
          onHover={onHover}
          interactive={interactive}
          onSelect={(name) => (onPick ? onPick(name) : router.push(`${basePath}/assembly/constituencies/${constituencySlug(name)}`))}
          onError={() => setMapError(true)}
        />
      </div>
    </div>
  )
}
