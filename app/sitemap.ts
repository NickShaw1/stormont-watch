import type { MetadataRoute } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { divisions, members, bills } from '@/lib/db/schema'

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
  { url: `${BASE}/assembly/legislation-guide`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE}/assembly/former-mlas`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [divisionRows, memberRows, billRows, partyRows] = await Promise.all([
      db.select({ documentId: divisions.documentId, divisionDate: divisions.divisionDate }).from(divisions),
      db.select({ personId: members.personId, updatedAt: members.updatedAt }).from(members).where(eq(members.isCurrent, true)),
      db.select({ billId: bills.billId, latestDate: bills.latestDate }).from(bills),
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

    return [...STATIC_URLS, ...voteUrls, ...divisionUrls, ...mlaUrls, ...partyUrls]
  } catch {
    return STATIC_URLS
  }
}
