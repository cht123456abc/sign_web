/**
 * Convert a canvas to a PNG dataURL. Falls back to blob→reader if toDataURL throws
 * (e.g. when canvas is tainted, though that shouldn't happen for our clean drawing).
 */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const dataUrl = canvas.toDataURL('image/png')
      if (dataUrl && dataUrl.length > 100) {
        resolve(dataUrl)
        return
      }
    } catch {
      // fall through to blob fallback
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('canvas.toBlob returned null'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    }, 'image/png')
  })
}

/** Whether the canvas has any non-transparent pixels (i.e. user actually drew something). */
export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const { width, height } = canvas
  if (width === 0 || height === 0) return true
  // Scan the ENTIRE canvas — users can draw anywhere, including the
  // leftmost edge. A previous center-200x200 sampling optimization made
  // edge strokes silently fail the blank check.
  const data = ctx.getImageData(0, 0, width, height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false
  }
  return true
}