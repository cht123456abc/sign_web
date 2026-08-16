import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * SignatureArea stores position as ratios (0-1) relative to the rendered PDF page.
 * This keeps coordinates stable across re-renders and DPI changes.
 * Coordinates use the browser convention (origin top-left); we flip Y at export time.
 */
export interface SignatureArea {
  page: number // 1-indexed
  x: number // 0-1 ratio from left
  y: number // 0-1 ratio from top
  w: number // 0-1 ratio of width
  h: number // 0-1 ratio of height
}

export interface AppState {
  pdfFile: File | null
  pdfDoc: PDFDocumentProxy | null
  numPages: number
  currentPage: number // 1-indexed

  signatureArea: SignatureArea | null
  isAreaSelected: boolean

  signatureImage: string | null // base64 PNG dataURL

  signatureModalOpen: boolean

  // Toast
  toast: ToastMessage | null
}

export interface ToastMessage {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

/** Action payload for setting the signature area. */
export interface DragCreateResult {
  page: number
  x: number
  y: number
  w: number
  h: number
}