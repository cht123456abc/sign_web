import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  AppState,
  NewSignatureArea,
  SignatureArea,
  ToastMessage,
} from '../types'

const TOAST_DURATION_MS = 3000

interface AppContextValue extends AppState {
  setPdfFile: (file: File | null) => void
  setPdfDoc: (doc: PDFDocumentProxy | null, numPages: number) => void
  setCurrentPage: (page: number) => void

  /** Create a new area; returns the assigned id. */
  addSignatureArea: (area: NewSignatureArea) => string
  updateSignatureArea: (id: string, patch: Partial<Omit<SignatureArea, 'id'>>) => void
  deleteSignatureArea: (id: string) => void
  selectArea: (id: string | null) => void
  setAreaSignatureImage: (id: string, dataUrl: string | null) => void

  openSignatureModal: (areaId: string) => void
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

  signatureAreas: [],
  selectedAreaId: null,

  signatureModalOpen: false,
  signingAreaId: null,

  toast: null,
}

/** Generate a stable id for a new area. crypto.randomUUID is available in
 *  modern browsers and modern Node; fall back if needed. */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const setPdfFile = useCallback((file: File | null) => {
    setState((s) => ({
      ...s,
      pdfFile: file,
      // Reset downstream state when a new PDF is uploaded.
      signatureAreas: [],
      selectedAreaId: null,
      signingAreaId: null,
      signatureModalOpen: false,
    }))
  }, [])

  const setPdfDoc = useCallback((doc: PDFDocumentProxy | null, numPages: number) => {
    setState((s) => ({ ...s, pdfDoc: doc, numPages, currentPage: 1 }))
  }, [])

  const setCurrentPage = useCallback((page: number) => {
    setState((s) => ({ ...s, currentPage: page }))
  }, [])

  const addSignatureArea = useCallback((area: NewSignatureArea): string => {
    const id = newId()
    setState((s) => ({
      ...s,
      signatureAreas: [
        ...s.signatureAreas,
        { id, signatureImage: null, ...area },
      ],
      selectedAreaId: id,
    }))
    return id
  }, [])

  const updateSignatureArea = useCallback(
    (id: string, patch: Partial<Omit<SignatureArea, 'id'>>) => {
      setState((s) => ({
        ...s,
        signatureAreas: s.signatureAreas.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      }))
    },
    []
  )

  const deleteSignatureArea = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      signatureAreas: s.signatureAreas.filter((a) => a.id !== id),
      selectedAreaId: s.selectedAreaId === id ? null : s.selectedAreaId,
      signingAreaId: s.signingAreaId === id ? null : s.signingAreaId,
      signatureModalOpen: s.signingAreaId === id ? false : s.signatureModalOpen,
    }))
  }, [])

  const selectArea = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedAreaId: id }))
  }, [])

  const setAreaSignatureImage = useCallback(
    (id: string, dataUrl: string | null) => {
      setState((s) => ({
        ...s,
        signatureAreas: s.signatureAreas.map((a) =>
          a.id === id ? { ...a, signatureImage: dataUrl } : a
        ),
      }))
    },
    []
  )

  const openSignatureModal = useCallback((areaId: string) => {
    setState((s) => ({
      ...s,
      signatureModalOpen: true,
      signingAreaId: areaId,
    }))
  }, [])

  const closeSignatureModal = useCallback(() => {
    setState((s) => ({
      ...s,
      signatureModalOpen: false,
      signingAreaId: null,
    }))
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
      addSignatureArea,
      updateSignatureArea,
      deleteSignatureArea,
      selectArea,
      setAreaSignatureImage,
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
      addSignatureArea,
      updateSignatureArea,
      deleteSignatureArea,
      selectArea,
      setAreaSignatureImage,
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