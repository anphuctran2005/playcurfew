import type { Translate } from './i18n'

/** Đồng hồ đếm ngược dạng mm:ss. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function formatDuration(totalSeconds: number, t: Translate): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return t('durationHours', { hours, minutes })
  if (minutes > 0) {
    return seconds > 0
      ? t('durationMinutesSeconds', { minutes, seconds })
      : t('durationMinutes', { minutes })
  }
  return t('durationSeconds', { seconds })
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/** Bỏ tiền tố mà Electron thêm vào lỗi ném từ ipcMain.handle. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
