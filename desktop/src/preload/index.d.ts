import { ElectronAPI } from '@electron-toolkit/preload'
import type { WindowApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: WindowApi
  }
}
