export function formatDivisionSubject(raw: string): {
  title: string
  subtitle: string | null
} {
  if (!raw) return { title: raw, subtitle: null }

  // Pattern 1 — newer format: "-#1 Main Title - Amendment 1: Motion Amendment 1 [Member]"
  const amendmentMatch = raw.match(/^-#\d+\s+(.+?)\s+-\s+(Amendment \d+):/i)
  if (amendmentMatch) {
    return {
      title: amendmentMatch[1].trim(),
      subtitle: amendmentMatch[2].trim(),
    }
  }

  // Pattern 2 — older format: "Amendment 12 - Consideration Stage: Bill Title (NIA Bill...) [Member]"
  const stageAmendmentMatch = raw.match(/^(Amendment \d+)\s+-\s+[^:]+:\s+(.+?)(?:\s+\(NIA Bill[^)]+\))?(?:\s+\[.+\])?$/)
  if (stageAmendmentMatch) {
    return {
      title: stageAmendmentMatch[2].trim(),
      subtitle: stageAmendmentMatch[1].trim(),
    }
  }

  // Pattern 3 — API title format: "Main Title - Amendment 1" (no prefix, no stage)
  const titleAmendmentMatch = raw.match(/^(.+?)\s+-\s+(Amendment \d+)$/)
  if (titleAmendmentMatch) {
    return {
      title: titleAmendmentMatch[1].trim(),
      subtitle: titleAmendmentMatch[2].trim(),
    }
  }

  // Pattern 4 — stage reading: "Second Stage: Bill Title (NIA Bill...)"
  const stageReadingMatch = raw.match(/^((?:First|Second|Committee|Consideration|Further Consideration|Final) Stage):\s+(.+?)(?:\s+\(NIA Bill[^)]*\))?(?:\s+\[.+\])?$/i)
  if (stageReadingMatch) {
    return {
      title: stageReadingMatch[2].trim(),
      subtitle: stageReadingMatch[1].trim(),
    }
  }

  // Clean member name suffix from main motions: "Title [Mr Member Name]"
  const memberMatch = raw.match(/^(.+?)\s+\[.+\]$/)
  if (memberMatch) {
    return {
      title: memberMatch[1].trim(),
      subtitle: null,
    }
  }

  return { title: raw, subtitle: null }
}
