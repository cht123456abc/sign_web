import { useEffect } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { useApp } from './context/AppContext'
import { PdfUploader } from './components/PdfUploader'
import { PdfViewer } from './components/PdfViewer'
import { PageNavigator } from './components/PageNavigator'
import { ExportButton } from './components/ExportButton'
import { SignatureModal } from './components/SignatureModal'
import { Toast } from './components/Toast'

export default function App() {
  const { pdfFile, setPdfDoc, showToast } = useApp()

  // Load PDF.js document whenever the file changes.
  useEffect(() => {
    if (!pdfFile) {
      setPdfDoc(null, 0)
      return
    }
    let cancelled = false
    let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null

    const load = async () => {
      try {
        const buffer = await pdfFile.arrayBuffer()
        if (cancelled) return
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
        const doc = await loadingTask.promise
        if (cancelled) return
        if (doc.numPages === 0) {
          showToast('PDF 至少需要一页', 'error')
          return
        }
        setPdfDoc(doc, doc.numPages)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'PDF 加载失败'
        // pdf.js throws InvalidPDFException for non-PDF / encrypted PDFs.
        if (/InvalidPDFException|password/i.test(msg)) {
          showToast('PDF 文件损坏或已加密', 'error')
        } else {
          showToast(`PDF 加载失败: ${msg}`, 'error')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (loadingTask) {
        try {
          const task = loadingTask as pdfjs.PDFDocumentLoadingTask & {
            destroy?: () => void
          }
          task.destroy?.()
        } catch {
          /* ignore */
        }
      }
    }
  }, [pdfFile, setPdfDoc, showToast])

  if (!pdfFile) {
    return (
      <>
        <PdfUploader />
        <Toast />
      </>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar — title + export */}
      <header
        className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 pb-2 pt-safe"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        <h1 className="text-base font-semibold text-gray-900">PDF 签名</h1>
        <ExportButton />
      </header>

      {/* PDF canvas + signature area overlay */}
      <PdfViewer />

      {/* Page navigator */}
      <div
        className="pb-safe"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0)' }}
      >
        <PageNavigator />
      </div>

      <SignatureModal />
      <Toast />
    </div>
  )
}