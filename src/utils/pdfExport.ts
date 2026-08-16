import { PDFDocument } from 'pdf-lib'
import type { SignatureArea } from '../types'

export interface ExportOptions {
  pdfFile: File
  signatureArea: SignatureArea
  signatureImagePng: string
}

/**
 * Loads the original PDF, draws the signature image onto the signature area's page,
 * and returns a new PDF blob. The original PDF file is never modified.
 *
 * Coordinate conventions:
 *   - signatureArea stores browser-space ratios (origin top-left)
 *   - PDF user space uses origin bottom-left
 *   - We convert at draw time.
 */
export async function exportSignedPdf({
  pdfFile,
  signatureArea,
  signatureImagePng,
}: ExportOptions): Promise<Blob> {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })

  // pdf-lib expects the raw base64 portion only (no data:image/png;base64, prefix).
  const base64 = signatureImagePng.split(',')[1] ?? signatureImagePng
  const pngImage = await pdfDoc.embedPng(base64)

  const pageIndex = signatureArea.page - 1
  const page = pdfDoc.getPage(pageIndex)
  const { width: pageWidth, height: pageHeight } = page.getSize()

  // Browser → PDF coordinate conversion (origin flip).
  const drawX = signatureArea.x * pageWidth
  const drawW = signatureArea.w * pageWidth
  const drawH = signatureArea.h * pageHeight
  const drawY = pageHeight - (signatureArea.y + signatureArea.h) * pageHeight

  page.drawImage(pngImage, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  })

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