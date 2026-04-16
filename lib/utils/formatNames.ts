export function stripHonorifics(name: string): string {
  return name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Rev|Sir|Dame|Lord|Lady|Baroness|Baron)\s+/i, '')
    .trim()
}

export function formatTabledBy(tabledBy: string | null): string | null {
  if (!tabledBy) return null
  return tabledBy
    .split(', ')
    .map(stripHonorifics)
    .join(', ')
}
