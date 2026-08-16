import { useCallback, useEffect, useRef } from 'react'

interface UseOrientationResult {
  lockLandscape: () => Promise<void>
  unlock: () => void
  isLandscape: boolean
}

/** Local helper because not all TS lib targets include ScreenOrientation.lock(). */
function getOrientation(): ScreenOrientation | undefined {
  if (typeof screen === 'undefined') return undefined
  return (screen as Screen & { orientation?: ScreenOrientation }).orientation
}

/**
 * Wraps the Screen Orientation API with iOS Safari fallbacks.
 *
 * - Android Chrome / desktop: `screen.orientation.lock('landscape')` works directly.
 * - iOS Safari: lock() requires user gesture + fullscreen. We try lock first,
 *   then requestFullscreen as a fallback. If neither works, callers should rely
 *   on the CSS orientation media query.
 */
export function useOrientation(): UseOrientationResult {
  const isLandscape = useCurrentOrientation()
  const fullscreenActiveRef = useRef(false)

  const lockLandscape = useCallback(async () => {
    const orientation = getOrientation()
    try {
      if (orientation) {
        await (
          orientation as ScreenOrientation & {
            lock?: (o: 'landscape' | 'portrait' | 'any') => Promise<void>
          }
        ).lock?.('landscape')
        return
      }
    } catch {
      // fall through
    }

    // iOS Safari: try fullscreen as a precondition.
    const root = document.documentElement
    if (root.requestFullscreen) {
      try {
        await root.requestFullscreen()
        fullscreenActiveRef.current = true
        // Try lock again after entering fullscreen.
        try {
          await (
            orientation as ScreenOrientation & {
              lock(o: 'landscape' | 'portrait' | 'any'): Promise<void>
            }
          )?.lock?.('landscape')
        } catch {
          /* swallow */
        }
      } catch {
        /* swallow — caller will rely on CSS orientation media query */
      }
    }
  }, [])

  const unlock = useCallback(() => {
    const orientation = getOrientation()
    try {
      ;(
        orientation as ScreenOrientation & { unlock?: () => void }
      )?.unlock?.()
    } catch {
      /* ignore */
    }
    if (fullscreenActiveRef.current && document.fullscreenElement) {
      document
        .exitFullscreen()
        .catch(() => {
          /* ignore */
        })
        .finally(() => {
          fullscreenActiveRef.current = false
        })
    }
  }, [])

  // Auto-unlock on unmount.
  useEffect(() => {
    return () => {
      unlock()
    }
  }, [unlock])

  return { lockLandscape, unlock, isLandscape }
}

function useCurrentOrientation(): boolean {
  if (typeof window === 'undefined') return false
  const mql = window.matchMedia('(orientation: landscape)')
  return mql.matches
}