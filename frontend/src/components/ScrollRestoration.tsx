import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"

/**
 * Production-quality scroll restoration.
 *
 * - New navigation (push): scroll to top.
 * - Back/forward (popstate via location key reuse): restore previous position.
 * - Initial page load: browser handles natively (no interference).
 * - Component re-renders: no scroll changes.
 */
export default function ScrollRestoration() {
  const location = useLocation()
  const seenKeys = useRef(new Set<string>())
  const savedScroll = useRef<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    const key = location.key

    if (seenKeys.current.has(key)) {
      // Returning to a previously visited location (back/forward).
      const saved = savedScroll.current[key]
      if (saved) {
        requestAnimationFrame(() => {
          window.scrollTo(saved.x, saved.y)
        })
      }
    } else {
      // Fresh navigation — scroll to top.
      window.scrollTo(0, 0)
    }

    seenKeys.current.add(key)

    // Save current scroll position for this location so we can restore it later.
    savedScroll.current[key] = {
      x: window.scrollX || 0,
      y: window.scrollY || 0,
    }
  }, [location.key])

  return null
}
