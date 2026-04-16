/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  const zoomRef = useRef<any>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const drawMap = useCallback(async () => {
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

      // Set up zoom (mobile only)
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 6])
        .translateExtent([
          [-width * 0.05, -height * 0.05],
          [width * 1.05, height * 1.05],
        ])
        .on('zoom', (event) => {
          const t = event.transform
          const x = t.k === 1 ? 0 : t.x
          const y = t.k === 1 ? 0 : t.y
          g.attr('transform', `translate(${x},${y}) scale(${t.k}) scale(1,${scaleY}) translate(0,${translateY})`)
          svg.select('.map-labels').attr('transform', `translate(${x},${y}) scale(${t.k})`)
        })

      zoomRef.current = zoom


      g.selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('d', pathGen as any)
        .attr('fill', (d: any) => {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          return dbName === selected ? '#1E3A5F' : '#b8c4d4'
        })
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('mouseover', function (event: MouseEvent, d: any) {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          if (dbName !== selected) {
            d3.select(this).attr('fill', '#7a9bbf')
            const rect = svgRef.current!.getBoundingClientRect()
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              name: dbName ?? d.properties?.PC_NAME,
            })
          }
        })
        .on('mousemove', function (event: MouseEvent, d: any) {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          if (dbName !== selected) {
            const rect = svgRef.current!.getBoundingClientRect()
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              name: dbName ?? d.properties?.PC_NAME,
            })
          }
        })
        .on('mouseout', function (_: MouseEvent, d: any) {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          if (dbName !== selected) {
            d3.select(this).attr('fill', '#b8c4d4')
          }
          setTooltip(null)
        })
        .on('click', (_: MouseEvent, d: any) => {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          if (dbName) {
            setTooltip(null)
            onSelect(dbName)
          }
        })


      const textG = svg.append('g')
        .attr('class', 'map-labels')
        .attr('pointer-events', 'none')

      textG.selectAll('text')
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
        .attr('fill', (d: any) => {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          return dbName === selected ? '#ffffff' : '#1E3A5F'
        })
        .text((d: any) => {
          const dbName = NAME_MAP[d.properties?.PC_NAME]
          if (!dbName) return ''
          const area = pathGen.area(d)
          if (area < 1200) return ''
          return dbName
        })

      setLoading(false)
    } catch (err) {
      console.error('Map failed to load:', err)
      setError(true)
      onError?.()
      setLoading(false)
    }
  }, [selected, onSelect, onError])

  useEffect(() => {
    drawMap()
  }, [drawMap])

  if (error) {
    return null
  }

  return (
    <div className={styles.wrap}>
      {loading && <div className={styles.loading}>Loading map…</div>}
      <svg
        ref={svgRef}
        viewBox="0 0 480 360"
        style={{ width: '100%', height: 'auto', display: loading ? 'none' : 'block', paddingBottom: '8px' }}
        aria-hidden="true"
        focusable="false"
      />
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  )
}
