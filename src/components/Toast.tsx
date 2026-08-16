import { useApp } from '../context/AppContext'

const KIND_STYLES: Record<'info' | 'error' | 'success', string> = {
  info: 'bg-gray-900 text-white',
  error: 'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
}

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2 transform rounded-lg px-4 py-2.5 text-sm shadow-lg transition-opacity ${KIND_STYLES[toast.kind]}`}
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  )
}