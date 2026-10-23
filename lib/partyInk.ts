function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

// White or near-black text, whichever contrasts more with the given #rrggbb colour.
export function inkFor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff'
  const l = luminance(hex)
  const withWhite = 1.05 / (l + 0.05)
  const withDark = (l + 0.05) / (0.0117 + 0.05)
  return withWhite >= withDark ? '#ffffff' : '#1a1d21'
}

// Background and text colours for a hero panel in a party colour; dark text colours stay as they are,
// light-text colours are deepened slightly so small white text keeps 4.5:1.
export function heroColours(hex: string): { bg: string; ink: string } {
  const ink = inkFor(hex)
  if (ink === '#ffffff' && /^#[0-9a-f]{6}$/i.test(hex)) {
    return { bg: `color-mix(in srgb, ${hex} 84%, #0b1118)`, ink }
  }
  return { bg: hex, ink }
}
