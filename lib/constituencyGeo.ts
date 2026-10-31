import { readFileSync } from 'fs'
import path from 'path'
import { constituencySlug } from '@/lib/utils/constituencySlug'

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

export interface GeoRegion {
  name: string
  slug: string
  d: string
}

export interface ConstituencyGeo {
  width: number
  height: number
  regions: GeoRegion[]
}

type Ring = [number, number][]
type Feature = { properties?: { PC_NAME?: string }; geometry: { type: string; coordinates: unknown } }

const WIDTH = 120
const HEIGHT = 100
const MARGIN = 3
const STRETCH = 1.6
const MIN_STEP = 0.45

function ringsOf(feature: Feature): Ring[] {
  const { type, coordinates } = feature.geometry
  const polygons = (type === 'MultiPolygon' ? coordinates : [coordinates]) as Ring[][]
  return polygons.flat()
}

export function loadConstituencyGeo(): ConstituencyGeo | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'public', 'data', 'ni-constituencies.geojson'), 'utf8')) as { features: Feature[] }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const feature of raw.features) {
      for (const ring of ringsOf(feature)) {
        for (const [lon, lat] of ring) {
          const y = -lat * STRETCH
          minX = Math.min(minX, lon)
          maxX = Math.max(maxX, lon)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
    }

    const scale = Math.min((WIDTH - 2 * MARGIN) / (maxX - minX), (HEIGHT - 2 * MARGIN) / (maxY - minY))
    const offsetX = (WIDTH - (maxX - minX) * scale) / 2
    const offsetY = (HEIGHT - (maxY - minY) * scale) / 2

    const regions: GeoRegion[] = []
    for (const feature of raw.features) {
      const name = NAME_MAP[feature.properties?.PC_NAME ?? '']
      if (!name) continue
      let d = ''
      for (const ring of ringsOf(feature)) {
        let lastX = Infinity
        let lastY = Infinity
        const points: string[] = []
        for (const [lon, lat] of ring) {
          const x = offsetX + (lon - minX) * scale
          const y = offsetY + (-lat * STRETCH - minY) * scale
          if (Math.hypot(x - lastX, y - lastY) < MIN_STEP) continue
          lastX = x
          lastY = y
          points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
        }
        if (points.length > 2) d += `M${points.join('L')}Z`
      }
      regions.push({ name, slug: constituencySlug(name), d })
    }

    return { width: WIDTH, height: HEIGHT, regions }
  } catch {
    return null
  }
}
