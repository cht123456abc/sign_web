import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { useOrientation } from '../hooks/useOrientation'
import { canvasToPngDataUrl, isCanvasBlank } from '../utils/image'

interface Stroke {
  width: number
  points: Array<{ x: number; y: number; p: number }>
}

const PEN_COLOR = '#1a1a1a'

const PEN_WIDTHS = [
  { value: 2, label: '细' },
  { value: 4, label: '中' },
  { value: 7, label: '粗' },
] as const

export function SignatureModal() {
  const { signatureModalOpen, closeSignatureModal, setSignatureImage, showToast } =
    useApp()
  const { lockLandscape, unlock } = useOrientation()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [penWidth, setPenWidth] = useState<number>(4) // default medium
  const drawingRef = useRef<Stroke | null>(null)
  const dprRef = useRef(1)

  // Lock orientation and lock body scroll while modal is open.
  useEffect(() => {
    if (!signatureModalOpen) return

    document.documentElement.classList.add('body-locked')
    void lockLandscape()

    return () => {
      document.documentElement.classList.remove('body-locked')
      unlock()
    }
  }, [signatureModalOpen, lockLandscape, unlock])

  // Resize canvas to match its parent container's rendered size (not window
  // size — the canvas lives inside a flex-1 region between the top and bottom
  // bars). Observe the PARENT rather than the canvas itself: the canvas's
  // CSS size only changes when we explicitly set style.width, so a stale
  // initial measurement would otherwise stay forever. The parent is sized by
  // flex layout, which always settles to its final dimensions.
  useEffect(() => {
    if (!signatureModalOpen) return
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const sync = () => {
      const rect = parent.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr

      const cssW = Math.round(rect.width)
      const cssH = Math.round(rect.height)
      const targetW = Math.floor(cssW * dpr)
      const targetH = Math.floor(cssH * dpr)

      // Set BOTH the drawing buffer size (canvas.width/height) and the CSS
      // display size (style.width/height). Without style.width, the canvas's
      // intrinsic size (the drawing buffer) is used as its CSS size, which on
      // retina displays makes the canvas 2x too big.
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Clear the canvas (transparent — keep alpha=0 so the exported PNG
      // has no white background and the underlying PDF shows through).
      ctx.clearRect(0, 0, cssW, cssH)
      for (const s of strokes) drawStroke(ctx, s)
      // Also redraw the in-progress stroke (held only in drawingRef, not yet
      // committed to state) so a resize-triggered sync doesn't make it
      // flicker / disappear mid-gesture.
      const drawing = drawingRef.current
      if (drawing && drawing.points.length >= 2) {
        drawStroke(ctx, drawing)
      }
    }

    // Defer the first sync by one frame so flex layout has settled, and run
    // a second sync after a short delay in case orientation lock re-triggers
    // layout asynchronously.
    const raf1 = requestAnimationFrame(sync)
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(sync))
    const timeoutId = window.setTimeout(sync, 250)

    const ro = new ResizeObserver(sync)
    ro.observe(parent)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('resize', sync)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(timeoutId)
      ro.disconnect()
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('resize', sync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureModalOpen, strokes.length])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return
    ctx.strokeStyle = PEN_COLOR
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const first = stroke.points[0]
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i]
      ctx.lineTo(pt.x, pt.y)
    }
    ctx.stroke()
  }, [])

  /** Convert a pointer event to canvas-local CSS pixel coords. */
  const toCanvasLocal = (e: React.PointerEvent | PointerEvent): { x: number; y: number; p: number } => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    return {
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
      p: ('pressure' in e ? e.pressure : 0.5) || 0.5,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    const pt = toCanvasLocal(e)
    drawingRef.current = { width: penWidth, points: [pt] }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drawing = drawingRef.current
    if (!drawing) return
    const pt = toCanvasLocal(e)
    drawing.points.push(pt)

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    // Draw just the new segment for performance.
    if (drawing.points.length >= 2) {
      const a = drawing.points[drawing.points.length - 2]
      const b = drawing.points[drawing.points.length - 1]
      ctx.strokeStyle = PEN_COLOR
      ctx.lineWidth = drawing.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drawing = drawingRef.current
    if (!drawing) return
    drawingRef.current = null
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (drawing.points.length > 1) {
      setStrokes((prev) => [...prev, drawing])
    }
  }

  const onUndo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      const next = prev.slice(0, -1)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx || !canvas) return next
      const rect = canvas.getBoundingClientRect()
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
      for (const s of next) drawStroke(ctx, s)
      return next
    })
  }

  const onClear = () => {
    setStrokes([])
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)
  }

  const onClose = () => {
    closeSignatureModal()
    setStrokes([])
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect()
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)
    }
  }

  const onConfirm = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (isCanvasBlank(canvas)) {
      showToast('请先签名', 'error')
      return
    }
    try {
      const dataUrl = await canvasToPngDataUrl(canvas)
      setSignatureImage(dataUrl)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '签名保存失败'
      showToast(msg, 'error')
    }
  }

  if (!signatureModalOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      {/* Top bar — title + close + confirm */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 active:bg-gray-100"
        >
          取消
        </button>
        <div className="text-base font-semibold text-gray-900">签名</div>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition active:scale-95 hover:bg-primary-700"
        >
          确认
        </button>
      </div>

      {/* Canvas — fills the remaining viewport space between top/bottom bars. */}
      <div className="relative flex-1 bg-white">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {/* Bottom toolbar — pen width + undo/clear */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        {/* Pen width selector */}
        <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white p-1">
          {PEN_WIDTHS.map((opt) => {
            const active = penWidth === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPenWidth(opt.value)}
                aria-pressed={active}
                className={`flex h-8 w-10 items-center justify-center rounded text-xs font-medium transition active:scale-95 ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Undo / clear */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={strokes.length === 0}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={strokes.length === 0}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}