export interface Sponsor {
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

export interface Alder {
  id: number
  legistar_person_id: number
  name: string
  district: string | null
  email: string | null
  phone: string | null
  active: boolean
}

export interface AlderDetail extends Alder {
  sponsored_bills: Bill[]
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export async function fetchBills(params: {
  skip?: number
  limit?: number
  matter_type?: string
  status?: string
  tag?: string
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

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch(`${API_BASE}/api/meta`)
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
