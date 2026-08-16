import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { deriveExportFilename, downloadBlob, exportSignedPdf } from '../utils/pdfExport'

export function ExportButton() {
  const { pdfFile, signatureAreas, showToast } = useApp()
  const [busy, setBusy] = useState(false)

  // Export is only enabled if there's at least one signed area.
  const signedAreas = useMemo(
    () => signatureAreas.filter((a) => a.signatureImage),
    [signatureAreas]
  )
  const disabled = !pdfFile || signedAreas.length === 0 || busy

  const onExport = async () => {
    if (!pdfFile || signedAreas.length === 0) return
    setBusy(true)
    try {
      const blob = await exportSignedPdf({
        pdfFile,
        signedAreas,
      })
      downloadBlob(blob, deriveExportFilename(pdfFile.name))
      showToast(
        signedAreas.length === 1
          ? '已导出签名后的 PDF'
          : `已导出 PDF（共 ${signedAreas.length} 个签名区）`,
        'success'
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导出失败'
      showToast(`导出失败: ${msg}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-95 hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {busy ? '导出中…' : '导出签名 PDF'}
    </button>
  )
}