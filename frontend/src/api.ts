export interface Sponsor {
  id: number
  name: string
  district: string | null
}

export interface Bill {
  id: number
  legistar_matter_id: number
  legistar_guid: string
  file_number: string | null
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
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export function legistarUrl(_bill: { file_number: string | null }): string {
  return 'https://milwaukee.legistar.com/Legislation.aspx'
}

export async function fetchBills(params: {
  skip?: number
  limit?: number
  matter_type?: string
  status?: string
  tag?: string
  sponsored_by?: number
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

export async function fetchUpcoming(): Promise<Bill[]> {
  const res = await fetch(`${API_BASE}/api/upcoming`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export interface Alder {
  id: number
  legistar_person_id: number
  name: string
  district: string | null
  email: string | null
  phone: string | null
  photo_url: string | null
}

export interface VoteRecord {
  vote_value: string | null
  voted_at: string | null
  matter: Bill
}

export interface AlderDetail extends Alder {
  sponsored_bills: Bill[]
  vote_history: VoteRecord[]
}

export interface Subscription {
  email: string
  tags: string[]
  district: string | null
}

export async function fetchSubscription(token: string): Promise<Subscription> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function updateSubscription(token: string, data: { tags: string[]; district: string | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
}

export async function deleteSubscription(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions/${token}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
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

export async function subscribeToAlerts(data: {
  email: string
  tags: string[]
  district: string | null
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `API error ${res.status}`)
  }
}
