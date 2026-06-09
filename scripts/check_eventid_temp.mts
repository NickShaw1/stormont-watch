import { db } from '../lib/db/client'
import { sql } from 'drizzle-orm'
const rows = await db.execute(sql`
  SELECT d1.document_id, d1.title, d1.event_id, d1.outcome,
         d2.document_id as amend_doc_id, d2.title as amend_title, d2.event_id as amend_event_id
  FROM divisions d1
  JOIN divisions d2 ON d2.title LIKE d1.title || ' - Amendment %'
    AND d2.division_date::date = d1.division_date::date
  WHERE d1.outcome ILIKE '%as amended%'
  LIMIT 5
`)
console.log(JSON.stringify(rows.rows, null, 2))
process.exit(0)
