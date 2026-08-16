import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { usePdfRenderer } from '../hooks/usePdfRenderer'
import { useDragCreate } from '../hooks/useDragCreate'
import { SignatureArea } from './SignatureArea'

const HORIZONTAL_PADDING = 32 // px — matches the p-4 wrapper (16 each side)

export function PdfViewer() {
  const {
    pdfDoc,
    currentPage,
    signatureAreas,
    addSignatureArea,
    selectedAreaId,
    selectArea,
    showToast,
  } = useApp()

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  const [createMode, setCreateMode] = useState(false)

  // Track the visible (scroll wrapper) width so the PDF can auto-fit to it.
  const [availableWidth, setAvailableWidth] = useState(0)
  useEffect(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    setAvailableWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setAvailableWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Look up the PDF page's intrinsic (scale=1) size.
  const [intrinsicSize, setIntrinsicSize] = useState<{
    width: number
    height: number
  } | null>(null)
  useEffect(() => {
    if (!pdfDoc) {
      setIntrinsicSize(null)
      return
    }
    let cancelled = false
    pdfDoc
      .getPage(currentPage)
      .then((page) => {
        if (cancelled) return
        const vp = page.getViewport({ scale: 1 })
        setIntrinsicSize({ width: vp.width, height: vp.height })
      })
      .catch(() => {
        if (cancelled) return
        setIntrinsicSize(null)
      })
    return () => {
      cancelled = true
    }
  }, [pdfDoc, currentPage])

  // Compute scale that fits the page width into the available width.
  const fitScale =
    intrinsicSize && availableWidth > 0
      ? Math.max(
          0.25,
          Math.min((availableWidth - HORIZONTAL_PADDING) / intrinsicSize.width, 3)
        )
      : 1

  const { pageSize, loading, error } = usePdfRenderer({
    pdfDoc,
    pageNumber: currentPage,
    scale: fitScale,
    canvasRef,
  })

  // All signature areas on the current page, rendered in declaration order.
  const areasOnPage = signatureAreas.filter((a) => a.page === currentPage)

  // Drag-to-create stays enabled whenever createMode is on, regardless of how
  // many areas already exist — that's the whole point of multi-area support.
  const { preview } = useDragCreate({
    enabled: Boolean(pdfDoc) && !error && createMode,
    containerRef: containerRef as React.RefObject<HTMLElement>,
    currentPage,
    onCreated: (area) => {
      addSignatureArea(area)
      setCreateMode(false)
    },
  })

  useEffect(() => {
    if (error) showToast(error, 'error')
  }, [error, showToast])

  useEffect(() => {
    setCreateMode(false)
    selectArea(null)
  }, [currentPage, selectArea])

  useEffect(() => {
    if (!createMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createMode])

  const onContainerPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null
    // Don't deselect when clicking on a signature area itself or its toolbar —
    // deselecting here would unmount the toolbar before the button's click
    // event can fire.
    if (target?.closest('[data-signature-area="true"]')) return
    if (target?.closest('[data-signature-toolbar="true"]')) return
    if (selectedAreaId) selectArea(null)
  }

  return (
    <div
      ref={scrollWrapperRef}
      className="relative flex-1 overflow-auto bg-gray-200"
    >
      {createMode && (
        <div className="pointer-events-none sticky top-0 z-10 mx-auto my-2 w-fit rounded-full bg-primary-600 px-4 py-1.5 text-sm text-white shadow-md">
          在 PDF 上拖动以创建签名区 · 点空白处取消
        </div>
      )}

      <div className="flex justify-center p-4">
        <div
          ref={containerRef}
          data-pdf-container="true"
          className={`relative select-none bg-white shadow-md ${
            createMode ? 'cursor-crosshair' : ''
          }`}
          style={{
            width: pageSize?.width ?? 'auto',
            height: pageSize?.height ?? 'auto',
            touchAction: createMode ? 'none' : 'pan-x pan-y pinch-zoom',
          }}
          onPointerDown={onContainerPointerDown}
        >
          <canvas
            ref={canvasRef}
            className="block"
            style={{ width: pageSize?.width, height: pageSize?.height }}
          />

          {preview && pageSize && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-primary-500 bg-primary-100/40"
              style={{
                left: preview.x,
                top: preview.y,
                width: preview.w,
                height: preview.h,
              }}
            />
          )}

          {/* Render every signature area that lives on this page. */}
          {pageSize &&
            areasOnPage.map((area) => (
              <SignatureArea key={area.id} area={area} containerSize={pageSize} />
            ))}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-gray-500">
              渲染中…
            </div>
          )}
        </div>
      </div>

      {/* "+ Add area" stays available even when areas already exist on this
          page — multi-area support is the whole point. Hide only during the
          active drag. */}
      <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
        <button
          type="button"
          onClick={() => setCreateMode((v) => !v)}
          className={`pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium shadow-lg transition active:scale-95 ${
            createMode
              ? 'bg-gray-700 text-white hover:bg-gray-800'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {createMode ? '取消创建' : '+ 添加签名区'}
        </button>
      </div>
    </div>
  )
}