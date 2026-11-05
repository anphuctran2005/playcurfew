import { execFile } from 'child_process'
import { basename, extname } from 'path'
import { promisify } from 'util'
import { app, dialog, shell, type BrowserWindow } from 'electron'
import type { DiscoveredApp } from '../shared/types'
import { isValidExeName, translateMain } from './store'

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

// Đổi encoding để tiêu đề cửa sổ tiếng Việt không bị lỗi font.
const RUNNING_APPS_SCRIPT =
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8; ' +
  "Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.Path -ne $null } | " +
  'Select-Object Name, Path, MainWindowTitle, Description | ConvertTo-Json'

// Thành phần giao diện của Windows, chặn nhầm sẽ làm mất Taskbar hoặc bàn phím ảo.
const SYSTEM_PROCESSES = new Set([
  'explorer',
  'applicationframehost',
  'textinputhost',
  'systemsettings'
])

interface RunningWindow {
  Name: string
  Path: string
  MainWindowTitle: string
  Description: string | null
}

const execFileAsync = promisify(execFile)

async function getIconDataUrl(filePath: string): Promise<string | undefined> {
  try {
    // large là 48px trên Windows, normal chỉ 32px nên sẽ mờ trong lưới chọn ứng dụng.
    const icon = await app.getFileIcon(filePath, { size: 'large' })
    return icon.isEmpty() ? undefined : icon.toDataURL()
  } catch (error) {
    console.error(`Không lấy được icon của ${filePath}:`, error)
    return undefined
  }
}

async function listRunningWindows(): Promise<RunningWindow[]> {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', RUNNING_APPS_SCRIPT],
      { windowsHide: true, maxBuffer: MAX_OUTPUT_BYTES }
    )
    // ConvertTo-Json trả về object thay vì mảng khi chỉ có một cửa sổ.
    return stdout.trim() ? [JSON.parse(stdout)].flat() : []
  } catch (error) {
    console.error('Không lấy được danh sách ứng dụng đang mở:', error)
    return []
  }
}

/** Mỗi lần gọi khởi động một PowerShell, nên chỉ dùng khi người dùng mở bảng chọn. */
export async function getRunningGuiApps(): Promise<DiscoveredApp[]> {
  const ownPath = app.getPath('exe').toLowerCase()
  const byExe = new Map<string, RunningWindow>()

  for (const window of await listRunningWindows()) {
    const isExcluded =
      SYSTEM_PROCESSES.has(window.Name.toLowerCase()) || window.Path.toLowerCase() === ownPath
    if (!isExcluded) byExe.set(basename(window.Path).toLowerCase(), window)
  }

  const apps = await Promise.all(
    [...byExe.values()].map(async (window): Promise<DiscoveredApp> => ({
      name: window.MainWindowTitle || window.Description || window.Name,
      exeName: basename(window.Path),
      exePath: window.Path,
      iconDataUrl: await getIconDataUrl(window.Path),
      source: 'running'
    }))
  )
  return apps.sort((a, b) => a.name.localeCompare(b.name))
}

function resolveExePath(filePath: string): string {
  if (extname(filePath).toLowerCase() !== '.lnk') return filePath

  try {
    return shell.readShortcutLink(filePath).target
  } catch (error) {
    console.error(`Không đọc được shortcut ${filePath}:`, error)
    return ''
  }
}

export async function browseExecutableOrShortcut(
  window: BrowserWindow | null
): Promise<DiscoveredApp | null> {
  const options = {
    title: translateMain('browseDialogTitle'),
    defaultPath: app.getPath('desktop'),
    properties: ['openFile' as const, 'dontAddToRecent' as const],
    filters: [{ name: translateMain('browseFilter'), extensions: ['exe', 'lnk'] }]
  }
  const { canceled, filePaths } = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (canceled || filePaths.length === 0) return null

  const selected = filePaths[0]
  const exePath = resolveExePath(selected)
  // Shortcut có thể trỏ tới thư mục, tài liệu hoặc không có target.
  if (!isValidExeName(basename(exePath))) throw new Error(translateMain('browseInvalid'))

  return {
    // Tên shortcut thường dễ đọc hơn tên file exe.
    name: basename(selected, extname(selected)),
    exeName: basename(exePath),
    exePath,
    iconDataUrl: await getIconDataUrl(exePath),
    source: 'installed'
  }
}
