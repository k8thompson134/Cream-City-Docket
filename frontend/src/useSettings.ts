import { useState, useCallback } from 'react'

export interface Settings {
  // AI
  showSummaries: boolean
  showConfidenceIndicator: boolean
  readingLevel: 'standard' | 'simple' | 'detailed'
  // Display
  showTooltips: boolean
  showFileNumbers: boolean
  compactFeed: boolean
  // Accessibility
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
  dyslexiaFont: boolean
}

const DEFAULTS: Settings = {
  showSummaries: true,
  showConfidenceIndicator: false,
  readingLevel: 'standard',
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

export function useSettings() {
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

  return { settings, update, reset }
}
