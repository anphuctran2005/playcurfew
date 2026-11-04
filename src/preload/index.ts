import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { DashboardState, WindowApi } from '../shared/types'

const api: WindowApi = {
  getDashboardState: () => ipcRenderer.invoke('get-dashboard-state'),
  getTodayUsage: () => ipcRenderer.invoke('get-today-usage'),
  getRunningProcesses: () => ipcRenderer.invoke('get-running-processes'),

  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (patch) => ipcRenderer.invoke('update-config', patch),

  getGames: () => ipcRenderer.invoke('get-games'),
  addGame: (game) => ipcRenderer.invoke('add-game', game),
  updateGame: (id, patch) => ipcRenderer.invoke('update-game', id, patch),
  removeGame: (id) => ipcRenderer.invoke('remove-game', id),

  getFocusSchedules: () => ipcRenderer.invoke('get-focus-schedules'),
  addFocusSchedule: (schedule) => ipcRenderer.invoke('add-focus-schedule', schedule),
  updateFocusSchedule: (id, patch) => ipcRenderer.invoke('update-focus-schedule', id, patch),
  removeFocusSchedule: (id) => ipcRenderer.invoke('remove-focus-schedule', id),

  onTickUpdate: (callback) => {
    const listener = (_: IpcRendererEvent, state: DashboardState): void => callback(state)
    ipcRenderer.on('on-tick-update', listener)
    return () => ipcRenderer.removeListener('on-tick-update', listener)
  }
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
