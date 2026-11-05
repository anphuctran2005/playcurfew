import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { disableAdminAutoStart, enableAdminAutoStart, HIDDEN_FLAG } from './autoStartAdmin'
import { registerIpcHandlers } from './ipcHandlers'
import { notify, startMonitor } from './processMonitor'
import { getConfig, translateMain } from './store'
import { createTray, showMainWindow, updateTrayMenu } from './tray'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let hasShownTrayNotice = false

function applyAutoStartConfig(enabled: boolean): Promise<void> {
  return enabled ? enableAdminAutoStart() : disableAdminAutoStart()
}

function createWindow(): void {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow = window

  window.on('closed', () => {
    mainWindow = null
  })

  window.on('close', (event) => {
    if (isQuitting) return

    event.preventDefault()
    window.hide()

    if (!hasShownTrayNotice) {
      hasShownTrayNotice = true
      notify('PlayCurfew', translateMain('noticeTray'))
    }
  })

  // Windows đang tắt máy hoặc đăng xuất: chặn đóng ở đây sẽ làm app cản việc tắt máy.
  window.on('session-end', () => {
    isQuitting = true
  })

  window.on('ready-to-show', () => {
    if (!process.argv.includes(HIDDEN_FLAG)) window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function startApp(): void {
  app.on('second-instance', showMainWindow)

  app.on('before-quit', () => {
    isQuitting = true
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  void app.whenReady().then(onReady)
}

function onReady(): void {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.anphuc.playcurfew')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers(applyAutoStartConfig)
  createWindow()
  createTray(() => mainWindow)
  if (getConfig().launchAtStartup) void enableAdminAutoStart().catch(console.error)
  startMonitor(() => mainWindow, updateTrayMenu)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

if (app.requestSingleInstanceLock()) startApp()
else app.quit()

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
