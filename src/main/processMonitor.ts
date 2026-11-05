import { execFile } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow, Notification } from 'electron'
import { getCommitmentPhrase } from '../shared/i18n'
import type { DashboardState, FocusSchedule, GameItem } from '../shared/types'
import {
  addUsageSeconds,
  getConfig,
  getFocusSchedules,
  getGames,
  getLimitSeconds,
  getTodayUsage,
  isValidExeName,
  toDateKey,
  translateMain
} from './store'

const TICK_INTERVAL_MS = 5000
const TICK_SECONDS = TICK_INTERVAL_MS / 1000
const TEMP_UNLOCK_MS = 5 * 60 * 1000
const NOTIFICATION_THROTTLE_MS = 15_000
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

// Không qua shell: exeName đến từ cấu hình người dùng, ghép vào chuỗi lệnh sẽ bị command injection.
const execFileAsync = promisify(execFile)
const EXEC_OPTIONS = { windowsHide: true, maxBuffer: MAX_OUTPUT_BYTES }

let runningGames: GameItem[] = []
let lastViolationNoticeAt = 0
let warnedDate = ''
const warnedMarks = new Set<number>() // Số giây còn lại của các mốc đã cảnh báo hôm nay
let isTicking = false
let tempUnlockedUntil: number | null = null // Chỉ ở bộ nhớ: khởi động lại app là khóa lại

async function listTaskNames(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV', '/NH'], EXEC_OPTIONS)
    return stdout.split(/\r?\n/).flatMap((line) => {
      const match = /^"([^"]+)"/.exec(line)
      return match ? [match[1]] : []
    })
  } catch (error) {
    console.error('tasklist thất bại:', error)
    return []
  }
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

function isTempUnlockActive(): boolean {
  return tempUnlockedUntil !== null && Date.now() <= tempUnlockedUntil
}

export function isSystemLocked(): boolean {
  const remainingSeconds = getLimitSeconds() - getTodayUsage().usedSeconds
  const isRestricted =
    isCurrentlyInFocusSchedule(getFocusSchedules()) ||
    remainingSeconds <= 0 ||
    runningGames.length > 0

  return isRestricted && !isTempUnlockActive()
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
    sessions,
    isLocked: isSystemLocked(),
    tempUnlockedUntil: isTempUnlockActive() ? tempUnlockedUntil : null
  }
}

export function verifyEmergencyUnlock(input: string): DashboardState {
  // NFC vì một số bộ gõ tiếng Việt sinh dấu rời, trông giống hệt nhưng khác mã ký tự.
  if (input.normalize('NFC') === getCommitmentPhrase(getConfig()).normalize('NFC')) {
    tempUnlockedUntil = Date.now() + TEMP_UNLOCK_MS
  }
  return getDashboardState()
}

export function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

async function enforceBlock(games: GameItem[], isFocus: boolean): Promise<void> {
  await Promise.all(games.map((game) => killProcess(game.exeName)))

  const now = Date.now()
  if (now - lastViolationNoticeAt < NOTIFICATION_THROTTLE_MS) return
  lastViolationNoticeAt = now

  const names = games.map((game) => game.name).join(', ')
  if (isFocus)
    notify(translateMain('noticeFocusTitle'), translateMain('noticeFocusBody', { names }))
  else
    notify(translateMain('noticeOutOfTimeTitle'), translateMain('noticeOutOfTimeBody', { names }))
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
  notify(
    translateMain('noticeWarningTitle'),
    translateMain('noticeWarningBody', { minutes: Math.ceil(remainingSeconds / 60) })
  )
}

async function tick(getWindow: () => BrowserWindow | null, onTick: () => void): Promise<void> {
  // tasklist có thể chậm hơn 5 giây khi máy bận, không để hai lượt chạy chồng lên nhau.
  if (isTicking) return
  isTicking = true

  try {
    const running = new Set((await listTaskNames()).map((name) => name.toLowerCase()))
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
    onTick()
  } catch (error) {
    console.error('Lượt kiểm tra thất bại:', error)
  } finally {
    isTicking = false
  }
}

export function startMonitor(getWindow: () => BrowserWindow | null, onTick: () => void): void {
  setInterval(() => void tick(getWindow, onTick), TICK_INTERVAL_MS)
}
