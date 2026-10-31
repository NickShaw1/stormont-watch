/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useRef, useState } from 'react'
import { inkFor } from '@/lib/partyInk'
import styles from './ConstituencyMap.module.css'

const NAME_MAP: Record<string, string> = {
  'NORTH DOWN': 'North Down',
  'EAST ANTRIM': 'East Antrim',
  'EAST LONDONDERRY': 'East Londonderry',
  'FERMANAGH AND SOUTH TYRONE': 'Fermanagh and South Tyrone',
  'FOYLE': 'Foyle',
  'LAGAN VALLEY': 'Lagan Valley',
  'MID ULSTER': 'Mid Ulster',
  'NEWRY AND ARMAGH': 'Newry and Armagh',
  'NORTH ANTRIM': 'North Antrim',
  'SOUTH ANTRIM': 'South Antrim',
  'SOUTH DOWN': 'South Down',
  'STRANGFORD': 'Strangford',
  'UPPER BANN': 'Upper Bann',
  'WEST TYRONE': 'West Tyrone',
  'BELFAST EAST': 'East Belfast',
  'BELFAST NORTH': 'North Belfast',
  'BELFAST SOUTH': 'South Belfast',
  'BELFAST WEST': 'West Belfast',
}

interface ConstituencyMapProps {
  selected: string | null
  onSelect: (constituency: string) => void
  onError?: () => void
  fills?: Record<string, string>
  labelColors?: Record<string, string>
  highlighted?: string | null
  onHover?: (constituency: string | null) => void
  interactive?: boolean
}

// Dedupes shared-border segments so they aren't double-stroked between regions.
// Segments seen once are "outer" edges; seen twice are "shared" borders.
function buildBoundaryMesh(features: any[], pathGen: any) {
  const round = (n: number) => Math.round(n * 4) / 4 // quarter-pixel tolerance
  const segCount = new Map<string, { a: [number, number]; b: [number, number]; count: number }>()

  for (const feature of features) {
    const geom = feature.geometry
    const polygons = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]
    for (const polygon of polygons) {
      for (const ring of polygon) {
        const projected = ring.map((pt: [number, number]) => pathGen.projection()(pt))
        for (let i = 0; i < projected.length - 1; i++) {
          const a = projected[i]
          const b = projected[i + 1]
          if (!a || !b) continue
          const ax = round(a[0]), ay = round(a[1])
          const bx = round(b[0]), by = round(b[1])
          const key = ax < bx || (ax === bx && ay < by)
            ? `${ax},${ay}|${bx},${by}`
            : `${bx},${by}|${ax},${ay}`
          const existing = segCount.get(key)
          if (existing) existing.count++
          else segCount.set(key, { a: [ax, ay], b: [bx, by], count: 1 })
        }
      }
    }
  }

  let outerD = ''
  let sharedD = ''
  for (const { a, b, count } of segCount.values()) {
    const seg = `M${a[0]},${a[1]}L${b[0]},${b[1]}`
    if (count > 1) sharedD += seg
    else outerD += seg
  }
  return { outerD, sharedD }
}

function separateLabels(svg: SVGSVGElement) {
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>('.map-labels text')).filter((t) => t.textContent)
  try {
    for (let pass = 0; pass < 6; pass++) {
      let moved = false
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i].getBBox()
          const b = texts[j].getBBox()
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + 2
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
          if (overlapX > 0 && overlapY > 0) {
            const shift = overlapX / 2
            const [left, right] = a.x <= b.x ? [texts[i], texts[j]] : [texts[j], texts[i]]
            left.setAttribute('x', String(parseFloat(left.getAttribute('x') ?? '0') - shift))
            right.setAttribute('x', String(parseFloat(right.getAttribute('x') ?? '0') + shift))
            moved = true
          }
        }
      }
      if (!moved) return
    }
  } catch {
    return
  }
}

export default function ConstituencyMap({ selected, onSelect, onError, fills, labelColors, highlighted = null, onHover, interactive = true }: ConstituencyMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathsRef = useRef<any>(null)
  const labelsRef = useRef<any>(null)
  const selectedRef = useRef<string | null>(selected)
  const onSelectRef = useRef(onSelect)
  const onErrorRef = useRef(onError)
  const fillsRef = useRef(fills)
  const labelColorsRef = useRef(labelColors)
  const highlightedRef = useRef(highlighted)
  const onHoverRef = useRef(onHover)
  const drawnRef = useRef(false)

  const fillFor = (name: string | undefined) => (name && fillsRef.current?.[name]) || 'var(--sw-map-fill)'
  const labelFor = (name: string | undefined) => {
    const forced = name ? labelColorsRef.current?.[name] : undefined
    if (forced) return forced
    const fill = name ? fillsRef.current?.[name] : undefined
    return fill && /^#[0-9a-f]{6}$/i.test(fill) ? inkFor(fill) : 'var(--sw-map-label)'
  }
  const hoverFillFor = (name: string | undefined) => {
    const base = name ? fillsRef.current?.[name] : undefined
    return base ? `color-mix(in srgb, ${base} 78%, #000000)` : 'var(--sw-map-fill-hover)'
  }
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Keep callback refs in sync — never stale, never trigger redraws
  useEffect(() => { onSelectRef.current = onSelect })
  useEffect(() => { onErrorRef.current = onError })
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { fillsRef.current = fills }, [fills])
  useEffect(() => { labelColorsRef.current = labelColors }, [labelColors])
  useEffect(() => { highlightedRef.current = highlighted }, [highlighted])
  useEffect(() => { onHoverRef.current = onHover })

  // Draw once on mount only
  useEffect(() => {
    if (drawnRef.current) return
    drawnRef.current = true

    async function drawMap() {
      if (!svgRef.current) return
      try {
        const [d3, geojson] = await Promise.all([
          import('d3'),
          fetch('/data/ni-constituencies.geojson').then(r => r.json()),
        ])

        const svg = d3.select(svgRef.current)
        const width = 480
        const height = 360

        svgRef.current.setAttribute('viewBox', `0 0 ${width} ${height}`)

        const isMobile = window.matchMedia('(max-width: 640px)').matches
        const inset = isMobile ? 2 : 20
        const scaleY = 1.6
        const translateY = -(height * 0.18)

        const projection = d3.geoIdentity()
          .reflectY(true)
          .fitExtent([[inset, inset], [width - inset, height - inset]], geojson)
        const pathGen = d3.geoPath().projection(projection)

        svg.selectAll('g').remove()

        const g = svg.append('g')
          .attr('class', 'map-content')
          .attr('transform', `scale(1, ${scaleY}) translate(0, ${translateY})`)


        pathsRef.current = g.selectAll('path')
          .data(geojson.features)
          .enter()
          .append('path')
          .attr('d', pathGen as any)
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? 'var(--sw-map-selected)' : fillFor(NAME_MAP[d.properties?.PC_NAME]))
          .attr('stroke', 'none')
          .attr('cursor', 'pointer')
          .on('mouseover', function (event: MouseEvent, d: any) {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName !== selectedRef.current) {
              d3.select(this).attr('fill', hoverFillFor(dbName))
              const rect = svgRef.current!.getBoundingClientRect()
              setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, name: dbName ?? d.properties?.PC_NAME })
            }
            if (dbName) onHoverRef.current?.(dbName)
          })
          .on('mousemove', function (event: MouseEvent, d: any) {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName !== selectedRef.current) {
              const rect = svgRef.current!.getBoundingClientRect()
              setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, name: dbName ?? d.properties?.PC_NAME })
            }
          })
          .on('mouseout', function (_: MouseEvent, d: any) {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName !== selectedRef.current && dbName !== highlightedRef.current) d3.select(this).attr('fill', fillFor(dbName))
            setTooltip(null)
          })
          .on('click', (_: MouseEvent, d: any) => {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName) { setTooltip(null); onSelectRef.current(dbName) }
          })

        // Each shared edge between two regions drawn exactly once (see buildBoundaryMesh).
        const { outerD, sharedD } = buildBoundaryMesh(geojson.features, pathGen)
        g.append('path')
          .attr('class', 'map-boundary-outer')
          .attr('d', outerD)
          .attr('fill', 'none')
          .attr('stroke', 'var(--sw-map-stroke)')
          .attr('stroke-width', 0.4)
          .attr('stroke-linejoin', 'round')
          .attr('pointer-events', 'none')
        g.append('path')
          .attr('class', 'map-boundary-shared')
          .attr('d', sharedD)
          .attr('fill', 'none')
          .attr('stroke', 'var(--sw-map-stroke)')
          .attr('stroke-width', 0.4)
          .attr('stroke-linejoin', 'round')
          .attr('pointer-events', 'none')

        const textG = svg.append('g').attr('class', 'map-labels').attr('pointer-events', 'none')

        labelsRef.current = textG.selectAll('text')
          .data(geojson.features)
          .enter()
          .append('text')
          .attr('x', (d: any) => pathGen.centroid(d)[0])
          .attr('y', (d: any) => pathGen.centroid(d)[1] * scaleY + translateY * scaleY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('pointer-events', 'none')
          .attr('font-size', '8')
          .attr('font-family', 'var(--sw-font-family)')
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? '#ffffff' : labelFor(NAME_MAP[d.properties?.PC_NAME]))
          .text((d: any) => {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (!dbName) return ''
            return pathGen.area(d) < 1200 ? '' : dbName
          })

        setLoading(false)
      } catch (err) {
        console.error('Map failed to load:', err)
        setError(true)
        onErrorRef.current?.()
        setLoading(false)
      }
    }

    drawMap()
  }, []) // empty deps — truly runs once

  useEffect(() => {
    if (loading || error || !svgRef.current) return
    const svg = svgRef.current
    document.fonts.ready.then(() => requestAnimationFrame(() => separateLabels(svg)))
  }, [loading, error])

  // Update fills/labels on selection change only — no redraw
  useEffect(() => {
    if (!pathsRef.current || !labelsRef.current) return
    pathsRef.current.attr('fill', (d: any) => {
      const name = NAME_MAP[d.properties?.PC_NAME]
      if (name === selected) return 'var(--sw-map-selected)'
      return name === highlighted ? hoverFillFor(name) : fillFor(name)
    })
    labelsRef.current.attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selected ? '#ffffff' : labelFor(NAME_MAP[d.properties?.PC_NAME]))
  }, [selected, fills, labelColors, highlighted])

  if (error) return null

  return (
    <div className={styles.wrap}>
      {loading && <div className={styles.loading}>Loading map…</div>}
      <svg
        ref={svgRef}
        viewBox="0 0 480 360"
        style={{ width: '100%', height: '100%', maxHeight: '100%', display: loading ? 'none' : 'block', pointerEvents: interactive ? undefined : 'none' }}
        aria-hidden="true"
        focusable="false"
      />
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}>
          {tooltip.name}
        </div>
      )}
    </div>
  )
}
