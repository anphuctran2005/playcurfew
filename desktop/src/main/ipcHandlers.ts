import { ipcMain } from 'electron'
import type { AppConfig, NewFocusSchedule, NewGame } from '../shared/types'
import { getDashboardState, getRunningProcesses } from './processMonitor'
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

export function registerIpcHandlers(): void {
  ipcMain.handle('get-dashboard-state', () => getDashboardState())
  ipcMain.handle('get-today-usage', () => getTodayUsage())
  ipcMain.handle('get-running-processes', () => getRunningProcesses())

  ipcMain.handle('get-config', () => getConfig())
  ipcMain.handle('update-config', (_, patch: Partial<AppConfig>) => updateConfig(patch))

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
}
