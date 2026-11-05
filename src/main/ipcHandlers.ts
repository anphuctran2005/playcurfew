import { BrowserWindow, ipcMain } from 'electron'
import type { AppConfig, NewFocusSchedule, NewGame } from '../shared/types'
import { getBackgroundImage, pickBackgroundImage, removeBackgroundImage } from './background'
import { getDashboardState, getRunningProcesses, verifyEmergencyUnlock } from './processMonitor'
import {
  addFocusSchedule,
  addGame,
  getConfig,
  getFocusSchedules,
  getGames,
  getTodayUsage,
  removeFocusSchedule,
  removeGame,
  updateConfig,
  updateFocusSchedule,
  updateGame
} from './store'
import { updateTrayMenu } from './tray'

export function registerIpcHandlers(applyAutoStart: (enabled: boolean) => Promise<void>): void {
  ipcMain.handle('get-dashboard-state', () => getDashboardState())
  ipcMain.handle('get-today-usage', () => getTodayUsage())
  ipcMain.handle('get-running-processes', () => getRunningProcesses())

  ipcMain.handle('get-config', () => getConfig())
  ipcMain.handle('update-config', async (_, patch: Partial<AppConfig>) => {
    // Áp dụng trước khi lưu: lỗi thì công tắc giữ nguyên, không báo bật khi chưa có task.
    if (patch.launchAtStartup !== undefined) await applyAutoStart(patch.launchAtStartup)
    const config = updateConfig(patch)
    updateTrayMenu()
    return config
  })

  ipcMain.handle('get-background-image', () => getBackgroundImage())
  ipcMain.handle('pick-background-image', (event) =>
    pickBackgroundImage(BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle('remove-background-image', () => removeBackgroundImage())

  ipcMain.handle('get-games', () => getGames())
  ipcMain.handle('add-game', (_, game: NewGame) => addGame(game))
  ipcMain.handle('update-game', (_, id: string, patch: Partial<NewGame>) => updateGame(id, patch))
  ipcMain.handle('remove-game', (_, id: string) => removeGame(id))

  ipcMain.handle('get-focus-schedules', () => getFocusSchedules())
  ipcMain.handle('add-focus-schedule', (_, schedule: NewFocusSchedule) =>
    addFocusSchedule(schedule)
  )
  ipcMain.handle('update-focus-schedule', (_, id: string, patch: Partial<NewFocusSchedule>) =>
    updateFocusSchedule(id, patch)
  )
  ipcMain.handle('remove-focus-schedule', (_, id: string) => removeFocusSchedule(id))

  ipcMain.handle('verify-emergency-unlock', (_, input: string) => {
    const state = verifyEmergencyUnlock(input)
    updateTrayMenu()
    return state
  })
}
