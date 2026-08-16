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

/** Whether the dataURL has any non-transparent pixels (i.e. user actually drew something). */
export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const { width, height } = canvas
  // Sample the center region only for performance.
  const sampleW = Math.min(width, 200)
  const sampleH = Math.min(height, 200)
  const x0 = Math.floor((width - sampleW) / 2)
  const y0 = Math.floor((height - sampleH) / 2)
  const data = ctx.getImageData(x0, y0, sampleW, sampleH).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false
  }
  return true
}