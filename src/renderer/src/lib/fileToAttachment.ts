import type { PendingAttachment } from '../state/useAppStore'

export function fileToAttachment(file: File): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      resolve({ dataUrl, base64, mimeType: file.type || 'image/png' })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
