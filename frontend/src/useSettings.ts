import { useState, useCallback } from 'react'

export interface Settings {
  showSummaries: boolean
  compactFeed: boolean
  showFileNumbers: boolean
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
}

const DEFAULTS: Settings = {
  showSummaries: true,
  compactFeed: false,
  showFileNumbers: true,
  highContrast: false,
  largeText: false,
  reduceMotion: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem('ccd-settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback((key: keyof Settings, value: boolean) => {
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

  return { settings, update, reset }
}
