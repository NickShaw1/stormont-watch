import type { MetadataRoute } from 'next'
import { getAllDivisionsFromDb, getAllMembers, getAllBills } from '@/lib/db/queries'

export const runtime = 'edge'

const BASE = 'https://www.stormontwatch.com'

const billSlug = (billId: string) =>
  billId.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')

const STATIC_URLS: MetadataRoute.Sitemap = [
  { url: BASE, changeFrequency: 'daily', priority: 1.0 },
  { url: `${BASE}/assembly/votes`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE}/assembly/mlas`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE}/assembly/bills`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE}/assembly/structure`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE}/assembly/stats`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE}/assembly/expenses`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE}/assembly/legislation-guide`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE}/assembly/former-mlas`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [rows, members, bills] = await Promise.all([
      getAllDivisionsFromDb(),
      getAllMembers(),
      getAllBills(),
    ])

    const voteUrls: MetadataRoute.Sitemap = bills.map((bill) => ({
      url: `${BASE}/assembly/bills/${billSlug(bill.bill_id)}`,
      lastModified: new Date(bill.latest_date),
      changeFrequency: 'monthly',
      priority: 0.7,
    }))

    const divisionUrls: MetadataRoute.Sitemap = rows.map((d) => ({
      url: `${BASE}/assembly/divisions/${d.documentId}`,
      lastModified: d.divisionDate,
      changeFrequency: 'never',
      priority: 0.5,
    }))

    const mlaUrls: MetadataRoute.Sitemap = members.map((m) => ({
      url: `${BASE}/assembly/mlas/${m.personId}`,
      lastModified: m.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }))

    return [...STATIC_URLS, ...voteUrls, ...divisionUrls, ...mlaUrls]
  } catch {
    return STATIC_URLS
  }
}
