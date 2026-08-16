import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import type { SignatureArea as SignatureAreaType } from '../types'

interface Props {
  area: SignatureAreaType
  containerSize: { width: number; height: number }
}

type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null

interface DragState {
  mode: NonNullable<DragMode>
  startPointer: { x: number; y: number }
  startArea: SignatureAreaType
  containerRect: DOMRect
}

const MIN_SIZE_RATIO = 0.04 // ~4% of page min
const TOOLBAR_OFFSET_PX = 44 // distance from signature area top to toolbar bottom

/**
 * The signature area overlay. Renders the rectangle, handles drag/resize/delete,
 * and shows the captured signature image once present. The toolbar (Sign/Delete)
 * is rendered as a SIBLING of the area div — outside the area's pointer event
 * scope — so it can never interfere with drag/resize/sign interactions.
 */
export function SignatureArea({ area, containerSize }: Props) {
  const {
    updateSignatureArea,
    deleteSignatureArea,
    selectArea,
    selectedAreaId,
    openSignatureModal,
  } = useApp()

  const isAreaSelected = selectedAreaId === area.id
  const hasSignature = Boolean(area.signatureImage)

  const dragRef = useRef<DragState | null>(null)
  const [, forceUpdate] = useState(0)

  const containerWidth = containerSize.width
  const containerHeight = containerSize.height

  const pxX = area.x * containerWidth
  const pxY = area.y * containerHeight
  const pxW = area.w * containerWidth
  const pxH = area.h * containerHeight

  const beginDrag = useCallback(
    (e: React.PointerEvent, mode: NonNullable<DragMode>) => {
      e.stopPropagation()
      e.preventDefault()
      const containerEl = (e.currentTarget as HTMLElement).closest(
        '[data-pdf-container="true"]'
      ) as HTMLElement | null
      if (!containerEl) return
      const rect = containerEl.getBoundingClientRect()
      dragRef.current = {
        mode,
        startPointer: { x: e.clientX, y: e.clientY },
        startArea: { ...area },
        containerRect: rect,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      selectArea(area.id)
    },
    [area, selectArea]
  )

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startPointer.x
      const dy = e.clientY - drag.startPointer.y
      const containerW = drag.containerRect.width
      const containerH = drag.containerRect.height
      const start = drag.startArea
      const dxRatio = dx / containerW
      const dyRatio = dy / containerH

      let next: SignatureAreaType = { ...start }

      const applyResize = (nx: number, ny: number, nw: number, nh: number) => {
        const clampedX = Math.max(0, Math.min(nx, 1 - MIN_SIZE_RATIO))
        const clampedY = Math.max(0, Math.min(ny, 1 - MIN_SIZE_RATIO))
        const maxW = 1 - clampedX
        const maxH = 1 - clampedY
        const clampedW = Math.max(MIN_SIZE_RATIO, Math.min(nw, maxW))
        const clampedH = Math.max(MIN_SIZE_RATIO, Math.min(nh, maxH))
        next = { ...start, x: clampedX, y: clampedY, w: clampedW, h: clampedH }
      }

      switch (drag.mode) {
        case 'move': {
          next = {
            ...start,
            x: Math.max(0, Math.min(1 - start.w, start.x + dxRatio)),
            y: Math.max(0, Math.min(1 - start.h, start.y + dyRatio)),
          }
          break
        }
        case 'resize-se':
          applyResize(start.x, start.y, start.w + dxRatio, start.h + dyRatio)
          break
        case 'resize-sw':
          applyResize(start.x + dxRatio, start.y, start.w - dxRatio, start.h + dyRatio)
          break
        case 'resize-ne':
          applyResize(start.x, start.y + dyRatio, start.w + dxRatio, start.h - dyRatio)
          break
        case 'resize-nw':
          applyResize(start.x + dxRatio, start.y + dyRatio, start.w - dxRatio, start.h - dyRatio)
          break
      }

      updateSignatureArea(area.id, {
        x: next.x,
        y: next.y,
        w: next.w,
        h: next.h,
      })
      forceUpdate((n) => n + 1)
    },
    [area.id, updateSignatureArea]
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragRef.current = null
        selectArea(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectArea])

  const handleAreaPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    beginDrag(e, 'move')
  }

  const handleSignClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openSignatureModal(area.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSignatureArea(area.id)
  }

  const handleBase =
    'absolute h-1.5 w-1.5 rounded-sm border border-white bg-primary-600 shadow-sm'

  return (
    <>
      {/* The signature area itself. */}
      <div
        data-signature-area="true"
        data-area-id={area.id}
        className={`absolute touch-none ${
          isAreaSelected
            ? 'ring-[1.5px] ring-primary-500'
            : 'ring-[1px] ring-primary-400/60'
        }`}
        style={{
          left: pxX,
          top: pxY,
          width: pxW,
          height: pxH,
          background: hasSignature ? 'transparent' : 'rgba(37, 99, 235, 0.06)',
          cursor:
            dragRef.current?.mode === 'move' || !dragRef.current
              ? 'move'
              : 'default',
        }}
        onPointerDown={handleAreaPointerDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {hasSignature && area.signatureImage ? (
          <img
            src={area.signatureImage}
            alt="签名"
            className="pointer-events-none h-full w-full object-contain"
            draggable={false}
          />
        ) : null}

        {isAreaSelected && (
          <>
            {/* Resize handles — only the 4 corners, kept small (6px) and
                positioned fully outside the area so the area body stays a
                clean drag-to-move surface. Edge handles were removed: they
                ran along the entire side and made it too easy to resize
                when the user just wanted to move the box. */}
            {(
              [
                ['nw', 'left-0 top-0 -translate-x-full -translate-y-full cursor-nw-resize'],
                ['ne', 'right-0 top-0 translate-x-full -translate-y-full cursor-ne-resize'],
                ['sw', 'left-0 bottom-0 -translate-x-full translate-y-full cursor-sw-resize'],
                ['se', 'right-0 bottom-0 translate-x-full translate-y-full cursor-se-resize'],
              ] as const
            ).map(([pos, classes]) => (
              <div
                key={pos}
                data-handle="true"
                className={`${handleBase} ${classes}`}
                onPointerDown={(e) =>
                  beginDrag(e, `resize-${pos}` as NonNullable<DragMode>)
                }
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={(e) => e.stopPropagation()}
              />
            ))}
          </>
        )}
      </div>

      {/* Floating toolbar — sibling, NOT a child of the area. pointer-events-none
          on the wrapper means only the buttons themselves capture clicks; the
          rest of the toolbar bounding box is invisible to events so it can
          never block drag/resize. */}
      {isAreaSelected && (
        <div
          data-signature-toolbar="true"
          data-area-id={area.id}
          className="pointer-events-none absolute z-20 flex flex-row flex-nowrap items-center gap-1 whitespace-nowrap rounded-md bg-white/95 px-1 py-1 shadow ring-1 ring-gray-200 backdrop-blur"
          style={{
            left: pxX + pxW / 2,
            top: pxY - TOOLBAR_OFFSET_PX,
            transform: 'translateX(-50%)',
          }}
        >
          <button
            type="button"
            onClick={handleSignClick}
            className="pointer-events-auto inline-flex items-center justify-center rounded bg-primary-600 px-2.5 py-1 text-[11px] font-medium leading-none text-white transition active:scale-95 hover:bg-primary-700"
          >
            {hasSignature ? '重新签名' : '签名'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="pointer-events-auto inline-flex items-center justify-center rounded bg-red-50 px-2.5 py-1 text-[11px] font-medium leading-none text-red-700 transition active:scale-95 hover:bg-red-100"
          >
            删除
          </button>
        </div>
      )}
    </>
  )
}