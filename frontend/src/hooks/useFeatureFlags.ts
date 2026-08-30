import { useEffect, useState, useCallback } from "react"
import { fetchPublicConfig } from "../services/api"

interface FeatureFlagState {
  enabled: Record<string, boolean>
  loaded: boolean
  error: boolean
}

const EMPTY: FeatureFlagState = { enabled: {}, loaded: false, error: false }

/**
 * Loads public-safe feature flags once per session and exposes
 * isEnabled(key) for the UI. Falls back to enabled when the config endpoint
 * is unavailable so pages remain usable in degraded mode.
 */
export function useFeatureFlags() {
  const [state, setState] = useState<FeatureFlagState>(EMPTY)

  useEffect(() => {
    let cancelled = false
    fetchPublicConfig()
      .then((config) => {
        if (cancelled) return
        const enabled: Record<string, boolean> = {}
        for (const flag of config.flags || []) {
          enabled[flag.key] = flag.is_enabled
        }
        setState({ enabled, loaded: true, error: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ enabled: {}, loaded: true, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isEnabled = useCallback(
    (key: string): boolean => {
      if (!state.loaded) return true
      return state.enabled[key] ?? true
    },
    [state.loaded, state.enabled]
  )

  return {
    isEnabled,
    loaded: state.loaded,
    error: state.error,
  }
}