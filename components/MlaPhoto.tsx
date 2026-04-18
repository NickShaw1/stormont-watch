'use client'

import Image from 'next/image'
import { useState } from 'react'
import { formatMemberName, initials } from '@/lib/format'
import styles from './MlaPhoto.module.css'

interface Props {
  name: string
  imgUrl: string
  size: number
  borderColor?: string
  noOutline?: boolean
  decorative?: boolean
  square?: boolean
}

export default function MlaPhoto({ name, imgUrl, size, borderColor, noOutline, decorative, square }: Props) {
  const [error, setError] = useState(false)
  const showFallback = !imgUrl || error

  const fontSize = Math.round(size * 0.36)
  const showOutline = !noOutline && !!borderColor

  return (
    <span
      className={`${styles.wrap}${showFallback ? ` ${styles.wrapFallback}` : ''}`}
      style={{ width: size, height: size, minWidth: size, borderRadius: square ? 'var(--r-2)' : undefined, border: square ? 'none' : undefined, outline: showOutline ? `3px solid ${borderColor}` : undefined, outlineOffset: '2px' }}
    >
      {showFallback ? (
        <span
          className={styles.fallback}
          style={{ fontSize }}
          aria-label={decorative ? undefined : formatMemberName(name)}
          aria-hidden={decorative ? true : undefined}
          role={decorative ? 'presentation' : 'img'}
        >
          {initials(name)}
        </span>
      ) : (
        <Image
          src={imgUrl}
          alt={decorative ? '' : formatMemberName(name)}
          role={decorative ? 'presentation' : undefined}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className={styles.img}
          onError={() => setError(true)}
        />
      )}
    </span>
  )
}
