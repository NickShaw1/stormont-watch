export const SEAL_POINTS = Array.from({ length: 48 }, (_, i) => {
  const angle = (i / 48) * Math.PI * 2 - Math.PI / 2
  const radius = i % 2 === 0 ? 96 : 87
  return `${(100 + radius * Math.cos(angle)).toFixed(1)},${(100 + radius * Math.sin(angle)).toFixed(1)}`
}).join(' ')
