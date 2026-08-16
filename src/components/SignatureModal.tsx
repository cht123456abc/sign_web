import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SignaturePad from 'signature_pad'
import { useApp } from '../context/AppContext'
import { useOrientation } from '../hooks/useOrientation'

const PEN_WIDTH_MIN = 5
const PEN_WIDTH_MAX = 11
const PEN_WIDTH_STEP = 1
const PEN_COLOR = '#1a1a1a'

/**
 * Full-screen signature modal.
 *
 * Uses the szimek/signature_pad library which:
 *   - interpolates each stroke as a variable-width cubic Bézier curve
 *   - derives width from pen velocity: fast → thinner, slow → thicker
 *   - smooths width changes via velocityFilterWeight (EMA)
 *   - renders strokes as filled circles along the Bézier with varying radii
 *
 * We map our 5–11 px slider to `maxWidth` (full-width when slow) and
 * `maxWidth * 0.5` to `minWidth` (thinner when fast) for natural variation.
 *
 * Undo works by snapshotting `toData()` on every `beginStroke` and restoring
 * the previous snapshot via `fromData()` on undo.
 */
export function SignatureModal() {
  const {
    signatureModalOpen,
    closeSignatureModal,
    signingAreaId,
    setAreaSignatureImage,
    showToast,
  } = useApp()
  const { lockLandscape, unlock } = useOrientation()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const historyRef = useRef<string[]>([])
  const [penWidth, setPenWidth] = useState<number>(8)
  const [hasStrokes, setHasStrokes] = useState(false)

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

  // Instantiate SignaturePad when the modal opens. The instance is recreated
  // (not just reconfigured) on each open so it always attaches to a fresh
  // canvas with no stale state.
  useEffect(() => {
    if (!signatureModalOpen) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePad(canvas, {
      minWidth: penWidth * 0.5,
      maxWidth: penWidth,
      penColor: PEN_COLOR,
      velocityFilterWeight: 0.7,
      throttle: 16,
      minDistance: 0,
      backgroundColor: 'rgba(0,0,0,0)', // transparent so PDF shows through
    })
    padRef.current = pad
    historyRef.current = []
    setHasStrokes(false)

    // Snapshot the data BEFORE each stroke so undo can restore the state
    // immediately before that stroke was drawn.
    const onBeginStroke = () => {
      historyRef.current = [...historyRef.current, JSON.stringify(pad.toData())]
    }
    const onEndStroke = () => setHasStrokes(true)
    pad.addEventListener('beginStroke', onBeginStroke)
    pad.addEventListener('endStroke', onEndStroke)

    return () => {
      pad.removeEventListener('beginStroke', onBeginStroke)
      pad.removeEventListener('endStroke', onEndStroke)
      pad.off()
      padRef.current = null
    }
    // penWidth is intentionally NOT a dep — width updates are handled by the
    // dedicated effect below, and we don't want to recreate the pad on every
    // slider nudge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureModalOpen])

  // Live-update penWidth on slider changes without recreating the pad.
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    pad.minWidth = penWidth * 0.5
    pad.maxWidth = penWidth
  }, [penWidth])

  // Resize canvas to fill its parent container. Observe the PARENT (not the
  // canvas) so flex layout settles correctly. Preserve existing strokes
  // across resize via toData / fromData.
  useEffect(() => {
    if (!signatureModalOpen) return
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const rect = parent.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      // Save existing strokes before we touch the canvas dimensions (which
      // also clears it).
      const data = padRef.current?.toData()

      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(rect.height * ratio)
      canvas.style.width = `${Math.round(rect.width)}px`
      canvas.style.height = `${Math.round(rect.height)}px`

      const ctx = canvas.getContext('2d')
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)

      // Restore the strokes into the freshly-sized canvas.
      if (data && padRef.current) {
        padRef.current.fromData(data)
      }
    }

    const raf1 = requestAnimationFrame(resize)
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(resize))
    const timeoutId = window.setTimeout(resize, 250)

    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    window.addEventListener('orientationchange', resize)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(timeoutId)
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
      window.removeEventListener('resize', resize)
    }
  }, [signatureModalOpen])

  const onUndo = () => {
    const pad = padRef.current
    if (!pad) return
    const history = historyRef.current
    if (history.length === 0) return
    const prevData = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    pad.fromData(JSON.parse(prevData))
    setHasStrokes(!pad.isEmpty())
  }

  const onClear = () => {
    padRef.current?.clear()
    historyRef.current = []
    setHasStrokes(false)
  }

  const onClose = () => {
    closeSignatureModal()
  }

  const onConfirm = () => {
    const pad = padRef.current
    if (!pad || !signingAreaId) return
    if (pad.isEmpty()) {
      showToast('请先签名', 'error')
      return
    }
    try {
      const dataUrl = pad.toDataURL('image/png')
      setAreaSignatureImage(signingAreaId, dataUrl)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '签名保存失败'
      showToast(msg, 'error')
    }
  }

  // Filled portion of the pen-width slider track (0–100%).
  const fillPercent =
    ((penWidth - PEN_WIDTH_MIN) / (PEN_WIDTH_MAX - PEN_WIDTH_MIN)) * 100

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

      {/* Canvas — fills the remaining viewport space between top/bottom bars.
          SignaturePad attaches its own pointer listeners, so no React handlers
          are needed here. */}
      <div className="relative flex-1 bg-white">
        <canvas ref={canvasRef} className="absolute inset-0 block" />
      </div>

      {/* Bottom toolbar — pen width + undo/clear */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        {/* Pen width slider — drag to choose a stroke width from {PEN_WIDTH_MIN}
            to {PEN_WIDTH_MAX} in {PEN_WIDTH_STEP}-pixel steps. SignaturePad
            will modulate between minWidth (= penWidth * 0.5) and maxWidth
            (= penWidth) based on pen velocity. */}
        <div className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-3 shadow-sm">
          <span className="select-none text-[11px] font-medium uppercase tracking-wide text-gray-400">
            细
          </span>

          <input
            type="range"
            min={PEN_WIDTH_MIN}
            max={PEN_WIDTH_MAX}
            step={PEN_WIDTH_STEP}
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            aria-label="笔触粗细"
            className="pen-width-slider h-3 w-32 shrink-0 cursor-pointer touch-none"
            style={{
              background: `linear-gradient(to right,
                rgb(37 99 235) 0%,
                rgb(37 99 235) ${fillPercent}%,
                rgb(229 231 235) ${fillPercent}%,
                rgb(229 231 235) 100%)`,
            }}
          />

          <span className="select-none text-[11px] font-medium uppercase tracking-wide text-gray-400">
            粗
          </span>
        </div>

        {/* Undo / clear */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!hasStrokes}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasStrokes}
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