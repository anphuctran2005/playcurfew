import { execFile } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow, Notification } from 'electron'
import type { DashboardState, FocusSchedule, GameItem, RunningProcess } from '../shared/types'
import {
  addUsageSeconds,
  getConfig,
  getFocusSchedules,
  getGames,
  getLimitSeconds,
  getTodayUsage,
  isValidExeName,
  toDateKey
} from './store'

const TICK_INTERVAL_MS = 5000
const TICK_SECONDS = TICK_INTERVAL_MS / 1000
const NOTIFICATION_THROTTLE_MS = 15_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

// Không qua shell: exeName đến từ cấu hình người dùng, ghép vào chuỗi lệnh sẽ bị command injection.
const execFileAsync = promisify(execFile)
const EXEC_OPTIONS = { windowsHide: true, maxBuffer: MAX_OUTPUT_BYTES }

// Đổi encoding để tiêu đề cửa sổ tiếng Việt không bị lỗi font.
const WINDOW_LIST_SCRIPT =
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8; ' +
  "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | " +
  'Select-Object Id, Name, MainWindowTitle | ConvertTo-Json'

let runningGames: GameItem[] = []
let lastViolationNoticeAt = 0
let warnedDate = ''
const warnedMarks = new Set<number>() // Số giây còn lại của các mốc đã cảnh báo hôm nay
let isTicking = false

async function listTasks(): Promise<Omit<RunningProcess, 'windowTitle'>[]> {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], EXEC_OPTIONS)
    return stdout.split(/\r?\n/).flatMap((line) => {
      const match = /^"([^"]+)","(\d+)"/.exec(line)
      return match ? [{ exeName: match[1], pid: Number(match[2]) }] : []
    })
  } catch (error) {
    console.error('tasklist thất bại:', error)
    return []
  }
}

async function listWindowTitles(): Promise<Map<number, string>> {
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOW_LIST_SCRIPT],
      EXEC_OPTIONS
    )
    if (!stdout.trim()) return new Map()

    // ConvertTo-Json trả về object thay vì mảng khi chỉ có một cửa sổ.
    const windows: { Id: number; MainWindowTitle: string }[] = [JSON.parse(stdout)].flat()
    return new Map(windows.map((w) => [w.Id, w.MainWindowTitle]))
  } catch (error) {
    console.error('Không lấy được danh sách cửa sổ:', error)
    return new Map()
  }
}

/** Mỗi lần gọi khởi động một PowerShell, nên vòng lặp 5 giây chỉ dùng listTasks(). */
export async function getRunningProcesses(): Promise<RunningProcess[]> {
  const [tasks, titles] = await Promise.all([listTasks(), listWindowTitles()])
  return tasks.map((task) => ({ ...task, windowTitle: titles.get(task.pid) ?? '' }))
}

export async function killProcess(exeName: string): Promise<boolean> {
  if (!isValidExeName(exeName)) return false

  try {
    await execFileAsync('taskkill', ['/F', '/IM', exeName, '/T'], EXEC_OPTIONS)
    return true
  } catch (error) {
    // Thường do tiến trình cần quyền Administrator hoặc vừa tự thoát.
    console.error(`Không tắt được ${exeName}:`, error)
    return false
  }
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function isCurrentlyInFocusSchedule(
  schedules: FocusSchedule[],
  now: Date = new Date()
): boolean {
  const today = now.getDay()
  const yesterday = (today + 6) % 7
  const current = now.getHours() * 60 + now.getMinutes()

  return schedules.some((schedule) => {
    if (!schedule.isEnabled) return false

    const start = toMinutes(schedule.startTime)
    const end = toMinutes(schedule.endTime)

    if (start <= end) {
      return schedule.daysOfWeek.includes(today) && current >= start && current < end
    }

    // Vắt qua nửa đêm: phần sau 00:00 thuộc về khung giờ bắt đầu từ hôm qua.
    return (
      (schedule.daysOfWeek.includes(today) && current >= start) ||
      (schedule.daysOfWeek.includes(yesterday) && current < end)
    )
  })
}

export function getDashboardState(): DashboardState {
  const { date, usedSeconds, sessions } = getTodayUsage()
  const limitSeconds = getLimitSeconds()

  return {
    date,
    usedSeconds,
    limitSeconds,
    remainingSeconds: Math.max(limitSeconds - usedSeconds, 0),
    isFocusActive: isCurrentlyInFocusSchedule(getFocusSchedules()),
    runningGames,
    sessions
  }
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

async function enforceBlock(games: GameItem[], isFocus: boolean): Promise<void> {
  await Promise.all(games.map((game) => killProcess(game.exeName)))

  const now = Date.now()
  if (now - lastViolationNoticeAt < NOTIFICATION_THROTTLE_MS) return
  lastViolationNoticeAt = now

  const names = games.map((game) => game.name).join(', ')
  if (isFocus) notify('Đang trong giờ Focus', `Đã tắt ${names}. Quay lại việc học nhé!`)
  else notify('Đã hết giờ chơi hôm nay', `Đã tắt ${names}.`)
}

function checkWarnings(remainingSeconds: number): void {
  const today = toDateKey()
  if (warnedDate !== today) {
    warnedDate = today
    warnedMarks.clear()
  }

  if (remainingSeconds <= 0) return

  const crossed = getConfig()
    .warningMinutesLeft.map((minutes) => minutes * 60)
    .filter((mark) => remainingSeconds <= mark && !warnedMarks.has(mark))
  if (crossed.length === 0) return

  // Mở app khi đã vượt nhiều mốc thì chỉ báo một lần, nhưng vẫn đánh dấu đủ các mốc.
  crossed.forEach((mark) => warnedMarks.add(mark))
  notify('Sắp hết giờ chơi', `Còn khoảng ${Math.ceil(remainingSeconds / 60)} phút chơi hôm nay.`)
}

async function tick(getWindow: () => BrowserWindow | null): Promise<void> {
  // tasklist có thể chậm hơn 5 giây khi máy bận, không để hai lượt chạy chồng lên nhau.
  if (isTicking) return
  isTicking = true

  try {
    const running = new Set((await listTasks()).map((task) => task.exeName.toLowerCase()))
    runningGames = getGames().filter(
      (game) => game.isActive && running.has(game.exeName.toLowerCase())
    )

    if (runningGames.length > 0) {
      const isFocus = isCurrentlyInFocusSchedule(getFocusSchedules())
      const limitSeconds = getLimitSeconds()

      if (isFocus || getTodayUsage().usedSeconds >= limitSeconds) {
        await enforceBlock(runningGames, isFocus)
      } else {
        // Hai game mở cùng lúc vẫn chỉ tính 5 giây thực, ghi vào phiên của game đầu tiên.
        const { usedSeconds } = addUsageSeconds(runningGames[0], TICK_SECONDS)
        checkWarnings(limitSeconds - usedSeconds)
      }
    }

    const window = getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send('on-tick-update', getDashboardState())
    }
  } catch (error) {
    console.error('Lượt kiểm tra thất bại:', error)
  } finally {
    isTicking = false
  }
}

export function startMonitor(getWindow: () => BrowserWindow | null): void {
  setInterval(() => void tick(getWindow), TICK_INTERVAL_MS)
}
