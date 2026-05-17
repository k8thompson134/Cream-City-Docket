import { useEffect } from 'react'

const BASE = 'Cream City Docket'
const DEFAULT_DESC = 'Milwaukee city government, made understandable. Track legislation and get free email alerts before the vote.'

function setMeta(selector: string, attr: string, content: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    const [key, val] = attr.split('=')
    el.setAttribute(key, val)
    document.head.appendChild(el)
  }
  el.content = content
}

export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${BASE}` : BASE
    const desc = description ?? DEFAULT_DESC

    document.title = fullTitle
    setMeta('meta[name="description"]', 'name=description', desc)
    setMeta('meta[property="og:title"]', 'property=og:title', fullTitle)
    setMeta('meta[property="og:description"]', 'property=og:description', desc)
    setMeta('meta[name="twitter:title"]', 'name=twitter:title', fullTitle)
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', desc)

    return () => {
      document.title = BASE
      setMeta('meta[name="description"]', 'name=description', DEFAULT_DESC)
      setMeta('meta[property="og:title"]', 'property=og:title', BASE)
      setMeta('meta[property="og:description"]', 'property=og:description', DEFAULT_DESC)
      setMeta('meta[name="twitter:title"]', 'name=twitter:title', BASE)
      setMeta('meta[name="twitter:description"]', 'name=twitter:description', DEFAULT_DESC)
    }
  }, [title, description])
}
