import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * SignatureArea stores position as ratios (0-1) relative to the rendered PDF page.
 * This keeps coordinates stable across re-renders and DPI changes.
 * Coordinates use the browser convention (origin top-left); we flip Y at export time.
 *
 * Each area owns its own signature image — supporting multiple signed boxes per
 * page, each signed independently.
 */
export interface SignatureArea {
  id: string // unique stable identifier
  page: number // 1-indexed
  x: number // 0-1 ratio from left
  y: number // 0-1 ratio from top
  w: number // 0-1 ratio of width
  h: number // 0-1 ratio of height
  signatureImage: string | null // base64 PNG dataURL for this area
}

export interface AppState {
  pdfFile: File | null
  pdfDoc: PDFDocumentProxy | null
  numPages: number
  currentPage: number // 1-indexed

  signatureAreas: SignatureArea[]
  selectedAreaId: string | null

  signatureModalOpen: boolean
  /** Which area is currently being signed in the modal. */
  signingAreaId: string | null

  // Toast
  toast: ToastMessage | null
}

export interface ToastMessage {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

/** Payload for creating a new area (id and signatureImage are assigned by the store). */
export interface NewSignatureArea {
  page: number
  x: number
  y: number
  w: number
  h: number
}