import { useCallback, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

const ACCEPT = 'application/pdf,.pdf'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB

export function PdfUploader() {
  const { setPdfFile, showToast } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return
      const isPdf =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      if (!isPdf) {
        showToast('请上传 PDF 文件', 'error')
        return
      }
      if (file.size > MAX_BYTES) {
        showToast('文件超过 50MB，可能影响性能', 'info')
      }
      setPdfFile(file)
    },
    [setPdfFile, showToast]
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null)
    e.target.value = '' // allow re-uploading the same file
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div
        className={`w-full max-w-md rounded-2xl border-2 border-dashed bg-white p-10 text-center shadow-sm transition-colors ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="mb-3 text-5xl">📄</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">PDF 签名</h1>
        <p className="mb-6 text-sm text-gray-500">
          上传 PDF 文件，在预览页面上拖动创建签名区，点击进入签名模式。
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-primary-600 px-5 py-3 text-white shadow-sm transition active:scale-95 hover:bg-primary-700"
        >
          选择 PDF 文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onChange}
        />
        <p className="mt-4 text-xs text-gray-400">或将文件拖拽到此处</p>
      </div>
    </div>
  )
}