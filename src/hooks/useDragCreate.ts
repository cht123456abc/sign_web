import { useCallback, useEffect, useRef, useState } from 'react'
import type { SignatureArea } from '../types'

interface UseDragCreateArgs {
  enabled: boolean
  containerRef: React.RefObject<HTMLElement>
  currentPage: number
  minSize?: number // minimum width/height in CSS pixels
  /** Existing area on this page; if set, the hook will not start a new drag. */
  existingArea: SignatureArea | null
  onCreated: (area: SignatureArea) => void
  onSelectExisting?: () => void
}

interface DragPreview {
  startX: number
  startY: number
  x: number
  y: number
  w: number
  h: number
}

const DEFAULT_MIN_SIZE = 24 // px

/**
 * Drag-to-create signature area on the parent container. Returns a preview rect
 * (in container-local CSS pixels) for live feedback while dragging.
 */
export function useDragCreate({
  enabled,
  containerRef,
  currentPage,
  minSize = DEFAULT_MIN_SIZE,
  existingArea,
  onCreated,
}: UseDragCreateArgs) {
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (!enabled) return
      const target = e.target as HTMLElement | null
      // Ignore drags that start on the signature area overlay itself
      // (those are handled by SignatureArea), or on its floating toolbar.
      if (
        target?.closest('[data-signature-area="true"]') ||
        target?.closest('[data-signature-toolbar="true"]')
      ) {
        return
      }
      // Only respond to primary pointer.
      if (!e.isPrimary) return

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      dragRef.current = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
      }
      setPreview({
        startX: dragRef.current.startX,
        startY: dragRef.current.startY,
        x: dragRef.current.startX,
        y: dragRef.current.startY,
        w: 0,
        h: 0,
      })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [enabled, containerRef]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const startX = dragRef.current.startX
      const startY = dragRef.current.startY
      const x = Math.max(0, Math.min(cx, startX))
      const y = Math.max(0, Math.min(cy, startY))
      const x2 = Math.max(cx, startX)
      const y2 = Math.max(cy, startY)
      const w = x2 - x
      const h = y2 - y
      setPreview({ startX, startY, x, y, w, h })
    },
    [containerRef]
  )

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return
      dragRef.current = null

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const p = preview
      if (!p || (p.w < minSize && p.h < minSize)) {
        // Too small — treat as a deselect/click on empty space.
        setPreview(null)
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }

      const cssW = rect.width
      const cssH = rect.height
      const area: SignatureArea = {
        page: currentPage,
        x: p.x / cssW,
        y: p.y / cssH,
        w: p.w / cssW,
        h: p.h / cssH,
      }
      setPreview(null)
      onCreated(area)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [containerRef, currentPage, minSize, onCreated, preview]
  )

  // Attach listeners to the container ref.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [containerRef, onPointerDown, onPointerMove, onPointerUp])

  // Allow callers to disable drag-create without remounting.
  // If an area already exists on the current page, disable creation.
  const effectiveEnabled =
    enabled && !(existingArea && existingArea.page === currentPage)

  return {
    preview,
    enabled: effectiveEnabled,
  }
}