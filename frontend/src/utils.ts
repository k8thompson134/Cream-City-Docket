export const STATUS_COLORS: Record<string, string> = {
  'Passed': '#12284B',
  'In Committee': '#1a4d7a',
  'In Commission': '#1a4d7a',
  'In Council': '#0a3d6b',
  'In Council-Adoption': '#0a3d6b',
  'In Council-Passage': '#0a3d6b',
  'In Council-Confirmation': '#0a3d6b',
  'In Council-Approval': '#0a3d6b',
  'Placed On File': '#444',
  'Dead': '#5a1a1a',
  'Introduced': '#2a5a2a',
}

export function statusColor(status: string) {
  return STATUS_COLORS[status] ?? '#444'
}

export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function cleanSummary(text: string | null): string | null {
  if (!text) return null
  const cleaned = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
  return cleaned || null
}

const LOW_CONFIDENCE_PHRASES = [
  'not included in the text provided',
  'cannot be described',
  'the text provided',
  'full impact cannot',
  'specific details of what',
  'limited bill text',
  'no text was provided',
  'text is not available',
  'bill text is not',
]

export function isLowConfidenceSummary(text: string | null): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return LOW_CONFIDENCE_PHRASES.some(phrase => lower.includes(phrase))
}

const AVATAR_COLORS = [
  '#1a4d7a', '#2a5a2a', '#5a1a1a', '#3d1a6b', '#6b3d1a',
  '#1a5a5a', '#1a3d6b', '#6b1a4a', '#2a4a1a', '#4a3d1a',
]

export function alderInitials(name: string): string {
  const clean = name.replace(/^ald\.\s*/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function alderAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
