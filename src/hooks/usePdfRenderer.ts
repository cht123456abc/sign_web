import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Configure the worker once at module load.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

interface UsePdfRendererArgs {
  pdfDoc: PDFDocumentProxy | null
  pageNumber: number // 1-indexed
  scale: number
  canvasRef: React.RefObject<HTMLCanvasElement>
}

interface UsePdfRendererResult {
  pageSize: { width: number; height: number } | null
  loading: boolean
  error: string | null
}

/**
 * Renders the given PDF page to the provided canvas. Tracks the rendered page
 * size in CSS pixels so signature-area coordinates can be mapped to PDF points
 * during export.
 */
export function usePdfRenderer({
  pdfDoc,
  pageNumber,
  scale,
  canvasRef,
}: UsePdfRendererArgs): UsePdfRendererResult {
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null)

  useEffect(() => {
    if (!pdfDoc) {
      setPageSize(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const doRender = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber)
        if (cancelled) return

        const viewport = page.getViewport({ scale })
        const cssWidth = viewport.width
        const cssHeight = viewport.height
        const dpr = window.devicePixelRatio || 1

        const canvas = canvasRef.current
        if (!canvas || cancelled) return

        canvas.width = Math.floor(cssWidth * dpr)
        canvas.height = Math.floor(cssHeight * dpr)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context unavailable')

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Cancel any in-flight render before starting a new one.
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel()
          } catch {
            /* ignore */
          }
          renderTaskRef.current = null
        }

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        })
        renderTaskRef.current = renderTask

        await renderTask.promise
        if (cancelled) return

        setPageSize({ width: cssWidth, height: cssHeight })
        setLoading(false)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'PDF 渲染失败'
        setError(msg)
        setLoading(false)
      }
    }

    doRender()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNumber, scale, canvasRef])

  return { pageSize, loading, error }
}