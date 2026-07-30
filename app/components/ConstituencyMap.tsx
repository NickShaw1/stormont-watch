/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useRef, useState } from 'react'
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
}

/**
 * Build a single "seams drawn once" boundary overlay from independently-digitized
 * region polygons. Each region's ring is its own set of coordinates, so where two
 * constituencies share a border, both regions carry a slightly different copy of
 * that line — stroking every region individually double-draws (and visually
 * thickens) every shared edge. This walks every ring segment (post-projection, in
 * the same screen-space coordinates actually rendered), canonicalises each segment
 * by its rounded, order-independent endpoints, and buckets them into "outer"
 * (seen once) vs "shared" (seen twice) — each drawn as a single path afterwards.
 */
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

export default function ConstituencyMap({ selected, onSelect, onError }: ConstituencyMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathsRef = useRef<any>(null)
  const labelsRef = useRef<any>(null)
  const selectedRef = useRef<string | null>(selected)
  const onSelectRef = useRef(onSelect)
  const onErrorRef = useRef(onError)
  const drawnRef = useRef(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Keep callback refs in sync — never stale, never trigger redraws
  useEffect(() => { onSelectRef.current = onSelect })
  useEffect(() => { onErrorRef.current = onError })
  useEffect(() => { selectedRef.current = selected }, [selected])

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
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? 'var(--sw-map-selected)' : 'var(--sw-map-fill)')
          .attr('stroke', 'none')
          .attr('cursor', 'pointer')
          .on('mouseover', function (event: MouseEvent, d: any) {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName !== selectedRef.current) {
              d3.select(this).attr('fill', 'var(--sw-map-fill-hover)')
              const rect = svgRef.current!.getBoundingClientRect()
              setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, name: dbName ?? d.properties?.PC_NAME })
            }
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
            if (dbName !== selectedRef.current) d3.select(this).attr('fill', 'var(--sw-map-fill)')
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
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? '#ffffff' : 'var(--sw-map-label)')
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

  // Update fills/labels on selection change only — no redraw
  useEffect(() => {
    if (!pathsRef.current || !labelsRef.current) return
    pathsRef.current.attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selected ? 'var(--sw-map-selected)' : 'var(--sw-map-fill)')
    labelsRef.current.attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selected ? '#ffffff' : 'var(--sw-map-label)')
  }, [selected])

  if (error) return null

  return (
    <div className={styles.wrap}>
      {loading && <div className={styles.loading}>Loading map…</div>}
      <svg
        ref={svgRef}
        viewBox="0 0 480 360"
        style={{ width: '100%', height: '100%', maxHeight: '100%', display: loading ? 'none' : 'block' }}
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
