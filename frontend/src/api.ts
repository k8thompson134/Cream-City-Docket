export interface Sponsor {
  id: number
  name: string
  district: string | null
  email: string | null
  phone: string | null
}

export interface Bill {
  id: number
  legistar_matter_id: number
  legistar_guid: string
  file_number: string | null
  legistar_web_url: string | null
  title: string
  matter_type: string
  matter_status: string
  body_name: string | null
  intro_date: string | null
  agenda_date: string | null
  passed_date: string | null
  sponsors: Sponsor[]
  summary: string | null
  tags: string[]
}

export interface BillDetail extends Bill {
  history: { action_name: string; action_date: string | null; result: string | null }[]
  mayor_actions: { action_type: string; action_date: string | null }[]
  substitute_summary: string | null
}

export interface BillsResponse {
  total: number
  skip: number
  limit: number
  items: Bill[]
}

export interface Meta {
  matter_types: string[]
  statuses: string[]
  tags: string[]
  last_synced: string | null
}

export interface Alder {
  id: number
  legistar_person_id: number
  name: string
  district: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
  active: boolean
  recent_bills: number
  recent_votes: number
}

export interface VoteRecord {
  vote_value: string | null
  voted_at: string | null
  matter: Bill
}

export interface OfficeRecord {
  body_name: string | null
  title: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
}

export interface ElectionRecord {
  year: number
  election_type: 'primary' | 'general'
  result: 'won' | 'lost'
  vote_pct: number | null
  opponent_count: number
  was_uncontested: boolean
  notes: string | null
}

export interface AlderDetail extends Alder {
  sponsored_bills: Bill[]
  vote_history: VoteRecord[]
  tag_ranks: Record<string, { rank: number; total: number }>
  council_terms: OfficeRecord[]
  committee_roles: OfficeRecord[]
  election_records: ElectionRecord[]
  focus_summary: string | null
  website: string | null
  twitter: string | null
  facebook: string | null
}

export interface BillVote {
  alder_id: number | null
  alder_name: string
  alder_district: string | null
  vote_value: string | null
  voted_at: string | null
  event_body_name: string | null
  event_date: string | null
}

export interface MayorActionRecord {
  action_type: string
  action_date: string | null
  matter: Bill
}

export interface MayorProfile {
  name: string
  title: string
  photo_url: string | null
  bio: string
  address: string
  phone: string
  hours: string
  twitter: string | null
  facebook: string | null
  stats: { signed: number; vetoed: number; lapsed: number; published: number }
  actions: MayorActionRecord[]
}

export interface Subscription {
  email: string
  tags: string[]
  district: string | null
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export function legistarUrl(bill: Pick<Bill, 'legistar_web_url' | 'file_number'>): string {
  if (bill.legistar_web_url) return bill.legistar_web_url
  return 'https://milwaukee.legistar.com/Legislation.aspx'
}

export async function fetchBills(params: {
  skip?: number
  limit?: number
  matter_type?: string
  status?: string
  tag?: string
  sponsored_by?: number
  legislative_only?: boolean
  sort?: string
  search?: string
}): Promise<BillsResponse> {
  const url = new URL(`${API_BASE}/api/bills`, window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchBill(id: number): Promise<BillDetail> {
  const res = await fetch(`${API_BASE}/api/bills/${id}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchBillVotes(id: number): Promise<BillVote[]> {
  const res = await fetch(`${API_BASE}/api/bills/${id}/votes`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchUpcoming(): Promise<Bill[]> {
  const res = await fetch(`${API_BASE}/api/upcoming`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchMayor(): Promise<MayorProfile> {
  const res = await fetch(`${API_BASE}/api/mayor`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchAlders(): Promise<Alder[]> {
  const res = await fetch(`${API_BASE}/api/alders`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchAlder(id: number): Promise<AlderDetail> {
  const res = await fetch(`${API_BASE}/api/alders/${id}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function subscribeToAlerts(body: { email: string; tags: string[]; district: string | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `API error ${res.status}`)
  }
}

export async function fetchSubscription(token: string): Promise<Subscription> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function updateSubscription(token: string, body: { tags: string[]; district: string | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `API error ${res.status}`)
  }
}

export async function deleteSubscription(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
}
