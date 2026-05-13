import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { desc, eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import { bills, billStages } from '../lib/db/schema'

const BASE = 'http://data.niassembly.gov.uk/plenary.asmx'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMotionBill(documentId: string) {
  const url = `${BASE}/GetMotionBill_JSON?documentId=${documentId}`
  const res = await fetch(url)
  const data = await res.json()
  return data?.MotionBill?.Bill ?? null
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set in .env.local')

  const sql = neon(url)
  const db = drizzle(sql, { schema })

  // Get all bills
  const allBills = await db.select({ billId: bills.billId, isAccelerated: bills.isAccelerated }).from(bills)
  console.log(`[backfill-accelerated] Found ${allBills.length} bills to check`)

  let updated = 0
  let unchanged = 0
  let errors = 0

  for (const bill of allBills) {
    // Get the most recent stage document for this bill
    const latestStage = await db.select({ documentId: billStages.documentId })
      .from(billStages)
      .where(eq(billStages.billId, bill.billId))
      .orderBy(desc(billStages.plenaryDate))
      .limit(1)

    if (latestStage.length === 0) {
      console.warn(`[backfill-accelerated] No stages found for ${bill.billId}`)
      continue
    }

    await sleep(200)

    try {
      const billData = await fetchMotionBill(latestStage[0].documentId)
      if (!billData) {
        console.warn(`[backfill-accelerated] No bill data for ${bill.billId} (documentId: ${latestStage[0].documentId})`)
        errors++
        continue
      }

      const isAccelerated = billData.IsAcceleratedPassage === 'true'

      if (isAccelerated !== bill.isAccelerated) {
        await db.update(bills)
          .set({ isAccelerated })
          .where(eq(bills.billId, bill.billId))
        console.log(`[backfill-accelerated] Updated ${bill.billId}: ${bill.isAccelerated} → ${isAccelerated}`)
        updated++
      } else {
        unchanged++
      }
    } catch (err) {
      console.error(`[backfill-accelerated] Error for ${bill.billId}:`, err)
      errors++
    }
  }

  console.log(`[backfill-accelerated] Done. Updated: ${updated}, Unchanged: ${unchanged}, Errors: ${errors}`)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
