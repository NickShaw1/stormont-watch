export type ImpactLevel = 'none' | 'low' | 'medium' | 'high'

export interface BillSummary {
  billSlug: string
  summary: string
  impact: {
    fiscal: ImpactLevel
    rights: ImpactLevel
    publicServices: ImpactLevel
    crossCommunity: ImpactLevel
    environment: ImpactLevel
  }
}

/**
 * Load a bill summary by slug. Returns null if the file does not exist.
 * Imported as a module — not from the filesystem — so it works in both
 * development and production builds.
 */
export async function getBillSummary(slug: string): Promise<BillSummary | null> {
  try {
    // Dynamic import allows tree-shaking; Next.js bundles content/ at build time.
    const mod = await import(`../content/summaries/${slug}.json`)
    return mod.default as BillSummary
  } catch {
    return null
  }
}
