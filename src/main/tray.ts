import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getDashboardState, isSystemLocked } from './processMonitor'
import { translateMain } from './store'

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
  if (isFocusActive) return translateMain('trayFocus')
  if (remainingSeconds <= 0) return translateMain('trayOutOfTime')

  const minutes = Math.ceil(remainingSeconds / 60)
  return translateMain(runningGames.length > 0 ? 'trayPlaying' : 'trayRemaining', { minutes })
}

export function updateTrayMenu(): void {
  if (!tray) return

  const isLocked = isSystemLocked()
  tray.setToolTip(translateMain('trayTooltip'))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: getStatusLabel(), enabled: false },
      { label: translateMain('trayOpen'), click: showMainWindow },
      { type: 'separator' },
      {
        label: translateMain(isLocked ? 'trayQuitLocked' : 'trayQuit'),
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
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  updateTrayMenu()
}
