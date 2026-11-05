import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getDashboardState, isSystemLocked } from './processMonitor'

const TOOLTIP = 'PlayCurfew - Đang bảo vệ giờ học của bạn'
const ICON_SIZE = 32

// Giữ tham chiếu ở cấp module: Tray bị thu gom rác thì icon sẽ biến mất.
let tray: Tray | null = null
let getWindow: () => BrowserWindow | null = () => null

export function showMainWindow(): void {
  const window = getWindow()
  if (!window) return

  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function getStatusLabel(): string {
  const { isFocusActive, remainingSeconds, runningGames } = getDashboardState()
  if (isFocusActive) return '🔴 Đang khóa (Giờ Focus)'
  if (remainingSeconds <= 0) return '🔴 Đang khóa (Hết giờ)'

  const minutes = Math.ceil(remainingSeconds / 60)
  return runningGames.length > 0
    ? `🟡 Đang chơi - Còn lại: ${minutes} phút`
    : `🟢 Còn lại: ${minutes} phút`
}

export function updateTrayMenu(): void {
  if (!tray) return

  const isLocked = isSystemLocked()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: getStatusLabel(), enabled: false },
      { label: 'Mở bảng điều khiển', click: showMainWindow },
      { type: 'separator' },
      {
        label: isLocked ? '🔒 Thoát PlayCurfew (Đang khóa - Mở app để Unlock)' : 'Thoát PlayCurfew',
        enabled: !isLocked,
        // Menu cập nhật mỗi 5 giây nên có thể cũ: kiểm tra lại lúc bấm.
        click: () => {
          if (!isSystemLocked()) app.quit()
        }
      }
    ])
  )
}

export function createTray(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter

  const image = nativeImage.createFromPath(icon).resize({ width: ICON_SIZE, height: ICON_SIZE })
  tray = new Tray(image)
  tray.setToolTip(TOOLTIP)
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTrayMenu()
}
