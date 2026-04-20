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
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? '#0d9488' : '#cceae8')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('cursor', 'pointer')
          .on('mouseover', function (event: MouseEvent, d: any) {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName !== selectedRef.current) {
              d3.select(this).attr('fill', '#99c8c4')
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
            if (dbName !== selectedRef.current) d3.select(this).attr('fill', '#cceae8')
            setTooltip(null)
          })
          .on('click', (_: MouseEvent, d: any) => {
            const dbName = NAME_MAP[d.properties?.PC_NAME]
            if (dbName) { setTooltip(null); onSelectRef.current(dbName) }
          })

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
          .attr('font-family', 'system-ui, sans-serif')
          .attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selectedRef.current ? '#ffffff' : '#2d4a5a')
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
    pathsRef.current.attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selected ? '#0d9488' : '#cceae8')
    labelsRef.current.attr('fill', (d: any) => NAME_MAP[d.properties?.PC_NAME] === selected ? '#ffffff' : '#2d4a5a')
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
