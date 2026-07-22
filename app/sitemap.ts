import type { MetadataRoute } from 'next'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { divisions, members, bills } from '@/lib/db/schema'
import { CURRENT_MANDATE, ARCHIVED_MANDATES } from '@/lib/constants/mandates'

/** Section landing pages, listed for the current mandate (bare) and each archive. */
const SECTION_PATHS = [
  '/assembly/votes', '/assembly/mlas', '/assembly/bills', '/assembly/parties',
  '/assembly/structure', '/assembly/stats', '/assembly/stats/spending',
  '/assembly/stats/activity', '/assembly/stats/voting', '/assembly/salaries',
  '/assembly/overall-cost', '/assembly/expenses', '/assembly/questions',
  '/assembly/sittings', '/assembly/topics', '/assembly/former-mlas',
]

const BASE = 'https://www.stormontwatch.com'

const billSlug = (billId: string) =>
  billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')

const STATIC_URLS: MetadataRoute.Sitemap = [
  { url: BASE, changeFrequency: 'daily', priority: 1.0 },
  { url: `${BASE}/assembly/votes`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE}/assembly/mlas`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE}/assembly/bills`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE}/assembly/parties`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE}/assembly/structure`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE}/assembly/stats`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/assembly/stats/spending`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE}/assembly/stats/activity`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE}/assembly/stats/voting`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE}/assembly/salaries`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/assembly/overall-cost`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/assembly/expenses`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/assembly/questions`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/assembly/sittings`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/assembly/topics`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/assembly/legislation-guide`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE}/assembly/former-mlas`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [divisionRows, memberRows, billRows, partyRows] = await Promise.all([
      db.select({ documentId: divisions.documentId, divisionDate: divisions.divisionDate }).from(divisions).where(eq(divisions.mandate, CURRENT_MANDATE.id)),
      db.select({ personId: members.personId, updatedAt: members.updatedAt }).from(members).where(and(eq(members.isCurrent, true), eq(members.mandate, CURRENT_MANDATE.id))),
      db.select({ billId: bills.billId, latestDate: bills.latestDate }).from(bills).where(eq(bills.mandate, CURRENT_MANDATE.id)),
      db.selectDistinct({ party: members.party }).from(members).where(eq(members.isCurrent, true)),
    ])

    const partySlug = (party: string) =>
      party.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const voteUrls: MetadataRoute.Sitemap = billRows.map((bill) => ({
      url: `${BASE}/assembly/bills/${billSlug(bill.billId)}`,
      lastModified: bill.latestDate ?? undefined,
      changeFrequency: 'monthly',
      priority: 0.7,
    }))

    const divisionUrls: MetadataRoute.Sitemap = divisionRows.map((d) => ({
      url: `${BASE}/assembly/divisions/${d.documentId}`,
      lastModified: d.divisionDate ?? undefined,
      changeFrequency: 'never',
      priority: 0.5,
    }))

    const mlaUrls: MetadataRoute.Sitemap = memberRows.map((m) => ({
      url: `${BASE}/assembly/mlas/${m.personId}`,
      lastModified: m.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    const partyUrls: MetadataRoute.Sitemap = partyRows.map((p) => ({
      url: `${BASE}/assembly/parties/${partySlug(p.party ?? '')}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    // Archive landing pages for each past mandate (kept crawlable so old-mandate
    // content stays indexed once it moves under /archive/<id>).
    const archiveUrls: MetadataRoute.Sitemap = ARCHIVED_MANDATES.flatMap((m) =>
      SECTION_PATHS.map((p) => ({
        url: `${BASE}/archive/${m.id}${p}`,
        changeFrequency: 'yearly' as const,
        priority: 0.3,
      }))
    )

    return [...STATIC_URLS, ...voteUrls, ...divisionUrls, ...mlaUrls, ...partyUrls, ...archiveUrls]
  } catch {
    return STATIC_URLS
  }
}
