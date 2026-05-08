import { useState, useCallback, useContext, createContext, createElement } from 'react'
import type { ReactNode } from 'react'

export interface Settings {
  showSummaries: boolean
  showConfidenceIndicator: boolean
  showTooltips: boolean
  showFileNumbers: boolean
  compactFeed: boolean
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
  dyslexiaFont: boolean
}

const DEFAULTS: Settings = {
  showSummaries: true,
  showConfidenceIndicator: false,
  showTooltips: true,
  showFileNumbers: true,
  compactFeed: false,
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  dyslexiaFont: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem('ccd-settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

interface SettingsCtxValue {
  settings: Settings
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void
}

const SettingsCtx = createContext<SettingsCtxValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('ccd-settings', JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem('ccd-settings')
    setSettings(DEFAULTS)
  }, [])

  return createElement(SettingsCtx.Provider, { value: { settings, update, reset } }, children)
}

export function useSettings() {
  const ctx = useContext(SettingsCtx)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
