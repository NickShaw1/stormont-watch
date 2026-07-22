import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, isNotNull, like } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import * as fs from 'fs'
import * as path from 'path'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'mla-images')

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log(`Created directory: ${OUTPUT_DIR}`)
  }

  const members = await db
    .select({ personId: schema.members.personId, imgUrl: schema.members.imgUrl })
    .from(schema.members)
    .where(isNotNull(schema.members.imgUrl))

  const toDownload = members.filter(
    (m) => m.imgUrl && m.imgUrl.startsWith('http')
  )

  console.log(`Found ${toDownload.length} members with remote images to download.`)

  let success = 0
  let failure = 0

  for (const member of toDownload) {
    const { personId, imgUrl } = member
    const destPath = path.join(OUTPUT_DIR, `${personId}.jpg`)
    const localUrl = `/mla-images/${personId}.jpg`

    try {
      const res = await fetch(imgUrl!)
      if (!res.ok) {
        console.warn(`⚠ [${personId}] HTTP ${res.status} — skipping ${imgUrl}`)
        failure++
      } else {
        const buffer = Buffer.from(await res.arrayBuffer())
        fs.writeFileSync(destPath, buffer)
        await db
          .update(schema.people)
          .set({ imgUrl: localUrl })
          .where(eq(schema.people.personId, personId))
        console.log(`✓ [${personId}] saved and updated → ${localUrl}`)
        success++
      }
    } catch (err) {
      console.warn(`⚠ [${personId}] fetch error — skipping ${imgUrl}:`, err)
      failure++
    }

    await sleep(100)
  }

  console.log(`\nDone. ${success} downloaded, ${failure} failed.`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
