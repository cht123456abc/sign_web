import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { AppState, SignatureArea, ToastMessage } from '../types'

const TOAST_DURATION_MS = 3000

interface AppContextValue extends AppState {
  setPdfFile: (file: File | null) => void
  setPdfDoc: (doc: PDFDocumentProxy | null, numPages: number) => void
  setCurrentPage: (page: number) => void

  setSignatureArea: (area: SignatureArea | null) => void
  setIsAreaSelected: (selected: boolean) => void
  updateSignatureArea: (patch: Partial<SignatureArea>) => void
  clearSignatureArea: () => void

  setSignatureImage: (dataUrl: string | null) => void

  openSignatureModal: () => void
  closeSignatureModal: () => void

  showToast: (text: string, kind?: ToastMessage['kind']) => void
  resetAll: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const initialState: AppState = {
  pdfFile: null,
  pdfDoc: null,
  numPages: 0,
  currentPage: 1,

  signatureArea: null,
  isAreaSelected: false,

  signatureImage: null,

  signatureModalOpen: false,

  toast: null,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const setPdfFile = useCallback((file: File | null) => {
    setState((s) => ({
      ...s,
      pdfFile: file,
      // Reset downstream state when a new PDF is uploaded.
      signatureArea: null,
      isAreaSelected: false,
      signatureImage: null,
    }))
  }, [])

  const setPdfDoc = useCallback((doc: PDFDocumentProxy | null, numPages: number) => {
    setState((s) => ({ ...s, pdfDoc: doc, numPages, currentPage: 1 }))
  }, [])

  const setCurrentPage = useCallback((page: number) => {
    setState((s) => ({ ...s, currentPage: page }))
  }, [])

  const setSignatureArea = useCallback((area: SignatureArea | null) => {
    setState((s) => ({ ...s, signatureArea: area }))
  }, [])

  const setIsAreaSelected = useCallback((selected: boolean) => {
    setState((s) => ({ ...s, isAreaSelected: selected }))
  }, [])

  const updateSignatureArea = useCallback((patch: Partial<SignatureArea>) => {
    setState((s) => {
      if (!s.signatureArea) return s
      return { ...s, signatureArea: { ...s.signatureArea, ...patch } }
    })
  }, [])

  const clearSignatureArea = useCallback(() => {
    setState((s) => ({
      ...s,
      signatureArea: null,
      isAreaSelected: false,
      signatureImage: null,
    }))
  }, [])

  const setSignatureImage = useCallback((dataUrl: string | null) => {
    setState((s) => ({ ...s, signatureImage: dataUrl }))
  }, [])

  const openSignatureModal = useCallback(() => {
    setState((s) => ({ ...s, signatureModalOpen: true }))
  }, [])

  const closeSignatureModal = useCallback(() => {
    setState((s) => ({ ...s, signatureModalOpen: false }))
  }, [])

  const showToast = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setState((s) => ({ ...s, toast: { id, text, kind } }))
    window.setTimeout(() => {
      setState((s) => (s.toast?.id === id ? { ...s, toast: null } : s))
    }, TOAST_DURATION_MS)
  }, [])

  const resetAll = useCallback(() => {
    setState(initialState)
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      setPdfFile,
      setPdfDoc,
      setCurrentPage,
      setSignatureArea,
      setIsAreaSelected,
      updateSignatureArea,
      clearSignatureArea,
      setSignatureImage,
      openSignatureModal,
      closeSignatureModal,
      showToast,
      resetAll,
    }),
    [
      state,
      setPdfFile,
      setPdfDoc,
      setCurrentPage,
      setSignatureArea,
      setIsAreaSelected,
      updateSignatureArea,
      clearSignatureArea,
      setSignatureImage,
      openSignatureModal,
      closeSignatureModal,
      showToast,
      resetAll,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}