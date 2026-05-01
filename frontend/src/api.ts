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
}

export async function fetchBills(params: {
  skip?: number
  limit?: number
  matter_type?: string
  status?: string
}): Promise<BillsResponse> {
  const url = new URL('/api/bills', window.location.origin)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchBill(id: number): Promise<BillDetail> {
  const res = await fetch(`/api/bills/${id}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export async function fetchMeta(): Promise<Meta> {
  const res = await fetch('/api/meta')
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}
