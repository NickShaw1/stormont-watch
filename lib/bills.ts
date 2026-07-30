/**
 * Determine whether a division passed based on the Outcome field.
 * The API returns free-text outcomes; we look for common patterns.
 */
export function isPassed(outcome: string | null | undefined): boolean | null {
  if (!outcome) return null
  const lower = outcome.toLowerCase()
  if (lower.includes('carried') || lower.includes('passed') || lower.includes('agreed')) return true
  if (
    lower.includes('failed') ||
    lower.includes('rejected') ||
    lower.includes('not carried') ||
    lower.includes('negatived') ||
    lower.includes('fell')
  ) return false
  return null
}

/**
 * Whether a shared party-pair vote matched the division's actual outcome.
 * A motion passing always means the Ayes carried it; failing always means the
 * Noes prevailed. Abstain/No Show can never "match" since neither side won.
 */
export function matchedOutcome(sharedVote: 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW', outcome: string | null): boolean {
  const passed = isPassed(outcome)
  if (passed === null) return false
  if (sharedVote === 'ABSTAINED' || sharedVote === 'NO_SHOW') return false
  return passed ? sharedVote === 'AYE' : sharedVote === 'NO'
}
