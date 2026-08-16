import { PDFDocument } from 'pdf-lib'
import type { SignatureArea } from '../types'

export interface ExportOptions {
  pdfFile: File
  /** Areas that have a non-null signatureImage. Areas without a signature
   *  are skipped — they shouldn't be embedded as empty boxes. */
  signedAreas: SignatureArea[]
}

/**
 * Loads the original PDF, draws every signed area's signature image onto its
 * respective page, and returns a new PDF blob. The original PDF file is never
 * modified.
 *
 * Coordinate conventions:
 *   - SignatureArea stores browser-space ratios (origin top-left)
 *   - PDF user space uses origin bottom-left
 *   - We convert at draw time.
 */
export async function exportSignedPdf({
  pdfFile,
  signedAreas,
}: ExportOptions): Promise<Blob> {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })

  // Group areas by page so we only do page.getSize() once per page.
  const byPage = new Map<number, SignatureArea[]>()
  for (const area of signedAreas) {
    if (!area.signatureImage) continue
    const list = byPage.get(area.page) ?? []
    list.push(area)
    byPage.set(area.page, list)
  }

  // Embed each unique signature once (the same dataURL can appear on multiple
  // areas — e.g. user signed one box then copied it via "重新签名" elsewhere).
  const embeddedCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>()
  for (const area of signedAreas) {
    if (!area.signatureImage || embeddedCache.has(area.signatureImage)) continue
    // pdf-lib expects the raw base64 portion only (no data:image/png;base64, prefix).
    const base64 = area.signatureImage.split(',')[1] ?? area.signatureImage
    const png = await pdfDoc.embedPng(base64)
    embeddedCache.set(area.signatureImage, png)
  }

  // Draw onto each page.
  for (const [pageNumber, areas] of byPage.entries()) {
    const page = pdfDoc.getPage(pageNumber - 1)
    const { width: pageWidth, height: pageHeight } = page.getSize()
    for (const area of areas) {
      const png = embeddedCache.get(area.signatureImage!)!
      // Browser → PDF coordinate conversion (origin flip).
      const drawX = area.x * pageWidth
      const drawW = area.w * pageWidth
      const drawH = area.h * pageHeight
      const drawY = pageHeight - (area.y + area.h) * pageHeight
      page.drawImage(png, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      })
    }
  }

  const bytes = await pdfDoc.save()
  // Copy into a plain ArrayBuffer so the Blob constructor accepts it across TS targets.
  const buffer = bytes.slice().buffer
  return new Blob([buffer], { type: 'application/pdf' })
}

/** Trigger a download for the given blob with a sensible default filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function deriveExportFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${stem}-signed.pdf`
}