import './load-env'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as schema from '../lib/db/schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

const XLSX_PATH = 'C:/Users/conta/Desktop/book 3.xlsx'

// Direct person_id overrides for names that can't be matched via name logic
const PERSON_ID_OVERRIDES: Record<string, string> = {
  'Elliott, Tom': '128',
  'Little Pengelly, Mary': '5333',
  'Murphy Áine': '7425',
  'Erskine Deborah': '7534',
  'Ni Chuilin, Caral': '215',
}

const MANUAL_OVERRIDES: Record<string, string> = {
  // Accent mismatches
  'Ennis, Sinead': 'Ennis, Sinéad',
  'Flynn, Orlaithi': 'Flynn, Órlaithí',
  'Murphy, Áine': 'Murphy, Áine',
  'Tennyson, Eoin': 'Tennyson, Eóin',
  // Surname variations
  'Nichol, Kate': 'Nicholl, Kate',
  'Fleming-Archibald, Caoimhe': 'Archibald, Caoimhe',
  // Skip
  'Total': '__SKIP__',
}

const SHEET_CONFIG: Record<string, {
  financialYear: string
  period: string
  nameCol: number
  keyCol: number
  dataStartRow: number
}> = {
  '2024-2025': {
    financialYear: '2024-2025',
    period: 'April 2024 - March 2025',
    nameCol: 1,
    keyCol: 0,
    dataStartRow: 3,
  },
  '2023-2024': {
    financialYear: '2023-2024',
    period: 'April 2023 - March 2024',
    nameCol: 1,
    keyCol: 0,
    dataStartRow: 7,
  },
  '2022-2023': {
    financialYear: '2022-2023',
    period: 'May 2022 - March 2023',
    nameCol: 0,
    keyCol: 1,
    dataStartRow: 8,
  },
}

function dbNameToSpreadsheetKey(fullName: string): string {
  const stripped = fullName
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Lord|Rev|Sir)\s+/i, '')
    .replace(/\s+(OBE|MBE|CBE|QC|KC|MC)$/i, '')
    .trim()

  const parts = stripped.split(/\s+/)
  if (parts.length < 2) return stripped

  const lastName = parts[parts.length - 1]
  const firstName = parts.slice(0, -1).join(' ')
  return `${lastName}, ${firstName}`
}

function numericVal(raw: unknown): string {
  if (raw === '' || raw === null || raw === undefined) return '0'
  const n = parseFloat(String(raw))
  return isNaN(n) ? '0' : n.toFixed(2)
}

type Db = ReturnType<typeof drizzle<typeof schema>>

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = neon(url)
  const db = drizzle(sql, { schema })

  console.log('Loading members from database...')
  const members = await db.select({
    personId: schema.members.personId,
    fullName: schema.members.fullName,
  }).from(schema.members)

  // Build map: spreadsheet key → personId
  const keyToPersonId = new Map<string, string>()
  for (const m of members) {
    const key = dbNameToSpreadsheetKey(m.fullName)
    keyToPersonId.set(key, m.personId)
  }
  console.log(`Built name map for ${keyToPersonId.size} members`)

  const buf = fs.readFileSync(XLSX_PATH)
  const wb = XLSX.read(buf)

  let totalUpserted = 0
  let totalUnmatched = 0

  for (const sheetName of wb.SheetNames) {
    const config = SHEET_CONFIG[sheetName]
    if (!config) {
      console.warn(`Unknown sheet "${sheetName}" — skipping`)
      continue
    }

    console.log(`\nProcessing sheet: ${sheetName}`)
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
    const dataRows = rows.slice(config.dataStartRow)

    let upserted = 0
    let unmatched = 0
    let skipped = 0

    for (const row of dataRows) {
      const r = row as any[]
      const rawName = r[config.nameCol]

      // Skip blank or numeric rows (headers/totals)
      if (!rawName || typeof rawName === 'number') { skipped++; continue }
      const name = String(rawName).trim()
      if (!name || !isNaN(Number(name))) { skipped++; continue }

      // 1. Check direct person_id overrides first
      let personId: string | undefined = PERSON_ID_OVERRIDES[name]

      if (!personId) {
        // 2. Apply name-level overrides then map lookup
        const override = MANUAL_OVERRIDES[name]
        if (override === '__SKIP__') { skipped++; continue }
        const lookupKey = override ?? name
        personId = keyToPersonId.get(lookupKey)
        if (!personId) {
          console.warn(`  UNMATCHED: "${name}"${override ? ` (override key: "${override}")` : ''}`)
          unmatched++
          continue
        }
      }

      const constituencyOffice = numericVal(r[2])
      const otherExpenses = numericVal(r[3])
      const allowances = numericVal(r[4])
      const staffCosts = numericVal(r[5])
      const total = numericVal(r[6])

      await db
        .insert(schema.expenses)
        .values({
          personId,
          financialYear: config.financialYear,
          period: config.period,
          constituencyOffice,
          otherExpenses,
          allowances,
          staffCosts,
          total,
          mandate: '2022-2027',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.expenses.personId, schema.expenses.financialYear],
          set: {
            period: config.period,
            constituencyOffice,
            otherExpenses,
            allowances,
            staffCosts,
            total,
            updatedAt: new Date(),
          },
        })
      upserted++
    }

    console.log(`  ${upserted} upserted, ${unmatched} unmatched, ${skipped} skipped`)
    totalUpserted += upserted
    totalUnmatched += unmatched
  }

  console.log(`\nDone — ${totalUpserted} total upserted, ${totalUnmatched} total unmatched`)
  process.exit(0)
}

main().catch(err => {
  console.error('Import failed:', err)
  process.exit(1)
})
