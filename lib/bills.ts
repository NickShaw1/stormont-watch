// Determines pass/fail from the API's free-text Outcome field.
export function isPassed(outcome: string | null | undefined): boolean | null {
  if (!outcome) return null
  const lower = outcome.toLowerCase()
  // "not carried" must be checked before "carried" or it gets shadowed.
  if (
    lower.includes('not carried') ||
    lower.includes('failed') ||
    lower.includes('rejected') ||
    lower.includes('negatived') ||
    lower.includes('fell')
  ) return false
  if (lower.includes('carried') || lower.includes('passed') || lower.includes('agreed')) return true
  return null
}

// A pass means Ayes won, a fail means Noes won; Abstain/No Show never match.
export function matchedOutcome(sharedVote: 'AYE' | 'NO' | 'ABSTAINED' | 'NO_SHOW', outcome: string | null): boolean {
  const passed = isPassed(outcome)
  if (passed === null) return false
  if (sharedVote === 'ABSTAINED' || sharedVote === 'NO_SHOW') return false
  return passed ? sharedVote === 'AYE' : sharedVote === 'NO'
}
