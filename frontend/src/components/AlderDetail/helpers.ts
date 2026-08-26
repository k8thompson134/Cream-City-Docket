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

export function formatName(raw: string) {
  return raw
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function districtLabel(d: string | null): string | null {
  if (!d || !/^\d+$/.test(d)) return null
  const n = parseInt(d)
  const suffix =
    n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix} Aldermanic District`
}

export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function cleanSummary(text: string | null) {
  if (!text) return null
  const cleaned = text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join(' ')
    .trim()
  return cleaned || null
}

const YEA_VALUES = new Set(['yea', 'aye', 'yes'])
const NAY_VALUES = new Set(['nay', 'no'])

export const isYeaValue = (v: string | null) => ['yea', 'aye', 'yes'].includes((v ?? '').toLowerCase())
export const isNayValue = (v: string | null) => ['nay', 'no'].includes((v ?? '').toLowerCase())

export function voteChipClass(value: string | null) {
  const v = (value ?? '').toLowerCase()
  if (YEA_VALUES.has(v)) return 'vote-chip vote-chip--yea'
  if (NAY_VALUES.has(v)) return 'vote-chip vote-chip--nay'
  return 'vote-chip vote-chip--abstain'
}

export function voteCardClass(value: string | null) {
  const v = (value ?? '').toLowerCase()
  if (YEA_VALUES.has(v)) return 'alder-vote-card alder-vote-card--yea'
  if (NAY_VALUES.has(v)) return 'alder-vote-card alder-vote-card--nay'
  return 'alder-vote-card alder-vote-card--abstain'
}

export function rankLabel(rank: number, total: number): string {
  if (rank === 1) return total > 1 ? 'Most of any alder' : ''
  const suffix = rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  return `${rank}${suffix} of ${total}`
}

export function formatRoleDate(start: string | null, end: string | null, isCurrent: boolean) {
  const s = start ? new Date(start).getFullYear() : '?'
  if (isCurrent) return `${s} – present`
  const e = end ? new Date(end).getFullYear() : '?'
  return `${s} – ${e}`
}
