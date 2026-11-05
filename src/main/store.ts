import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { translate, type MessageKey, type MessageParams } from '../shared/i18n'
import type {
  AppConfig,
  DailyUsage,
  FocusSchedule,
  GameItem,
  NewFocusSchedule,
  NewGame
} from '../shared/types'

interface StoreSchema {
  config: AppConfig
  games: GameItem[]
  focusSchedules: FocusSchedule[]
  dailyUsage: DailyUsage
}

// Khoảng lặng lớn hơn mức này giữa hai lần cộng giờ được tính là phiên chơi mới.
const SESSION_GAP_MS = 15_000

// Chặn đường dẫn và ký tự đại diện: taskkill /IM "*" sẽ tắt mọi tiến trình.
const EXE_NAME_PATTERN = /^[^\\/:*?"<>|]+\.exe$/i

export function isValidExeName(exeName: string): boolean {
  return EXE_NAME_PATTERN.test(exeName)
}

/** Theo giờ máy. Không dùng toISOString() vì đó là UTC, sẽ sang ngày lúc 7 giờ sáng ở VN. */
export function toDateKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const LEGACY_COMMITMENT_PHRASE = 'Tôi hiểu rằng tôi đang phá vỡ cam kết học tập của chính mình'
const DEFAULT_COMMITMENT_PHRASE = translate('vi', 'commitmentPhrase')

const DEFAULT_CONFIG: AppConfig = {
  weekdayLimitMinutes: 60,
  weekendLimitMinutes: 120,
  warningMinutesLeft: [5, 1],
  commitmentPhrase: DEFAULT_COMMITMENT_PHRASE,
  launchAtStartup: false,
  language: 'vi',
  theme: 'dark',
  backgroundColor: null,
  backgroundImageFile: null
}

function emptyUsage(): DailyUsage {
  return { date: toDateKey(), usedSeconds: 0, sessions: [] }
}

const store = new Store<StoreSchema>({
  defaults: {
    config: DEFAULT_CONFIG,
    games: [
      {
        id: 'default-master-duel',
        name: 'Yu-Gi-Oh! Master Duel',
        exeName: 'masterduel.exe',
        isActive: true
      },
      {
        id: 'default-delta-force',
        name: 'Delta Force',
        exeName: 'DeltaForceClient-Win64-Shipping.exe',
        isActive: true
      }
    ],
    focusSchedules: [
      {
        id: 'default-evening-study',
        label: 'Giờ học buổi tối',
        startTime: '19:30',
        endTime: '22:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        isEnabled: true
      }
    ],
    dailyUsage: emptyUsage()
  }
})

// electron-store chỉ điền key còn thiếu, nên config đã lưu sẽ giữ câu mặc định cũ nếu không đổi ở đây.
if (store.get('config').commitmentPhrase === LEGACY_COMMITMENT_PHRASE) {
  store.set('config.commitmentPhrase', DEFAULT_COMMITMENT_PHRASE)
}

export function getConfig(): AppConfig {
  // electron-store chỉ điền key còn thiếu ở cấp ngoài: config cũ sẽ thiếu các trường mới.
  return { ...DEFAULT_CONFIG, ...store.get('config') }
}

export function translateMain(key: MessageKey, params?: MessageParams): string {
  return translate(getConfig().language, key, params)
}

export function updateConfig(patch: Partial<AppConfig>): AppConfig {
  const config = { ...getConfig(), ...patch }
  store.set('config', config)
  return config
}

export function getLimitSeconds(now: Date = new Date()): number {
  const { weekdayLimitMinutes, weekendLimitMinutes } = getConfig()
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  return (isWeekend ? weekendLimitMinutes : weekdayLimitMinutes) * 60
}

export function getTodayUsage(): DailyUsage {
  const usage = store.get('dailyUsage')
  if (usage.date === toDateKey()) return usage

  const fresh = emptyUsage()
  store.set('dailyUsage', fresh)
  return fresh
}

export function addUsageSeconds(game: GameItem, seconds: number): DailyUsage {
  const usage = getTodayUsage()
  usage.usedSeconds += seconds

  const now = Date.now()
  const last = usage.sessions.at(-1)
  const lastEndedAt = last ? Date.parse(last.startTime) + last.durationSeconds * 1000 : 0
  if (last?.exeName === game.exeName && now - lastEndedAt <= SESSION_GAP_MS) {
    last.durationSeconds += seconds
  } else {
    usage.sessions.push({
      gameName: game.name,
      exeName: game.exeName,
      startTime: new Date(now - seconds * 1000).toISOString(),
      durationSeconds: seconds
    })
  }

  store.set('dailyUsage', usage)
  return usage
}

export function getGames(): GameItem[] {
  return store.get('games')
}

export function addGame(game: NewGame): GameItem {
  if (!isValidExeName(game.exeName))
    throw new Error(translateMain('errorInvalidExe', { exe: game.exeName }))

  const games = getGames()
  const existing = games.find((g) => g.exeName.toLowerCase() === game.exeName.toLowerCase())
  if (existing) return existing

  const created = { ...game, id: randomUUID() }
  store.set('games', [...games, created])
  return created
}

export function updateGame(id: string, patch: Partial<NewGame>): GameItem {
  if (patch.exeName !== undefined && !isValidExeName(patch.exeName)) {
    throw new Error(translateMain('errorInvalidExe', { exe: patch.exeName }))
  }

  const games = getGames()
  const game = games.find((g) => g.id === id)
  if (!game) throw new Error(translateMain('errorGameNotFound', { id }))

  const updated = { ...game, ...patch, id }
  store.set(
    'games',
    games.map((g) => (g.id === id ? updated : g))
  )
  return updated
}

export function removeGame(id: string): void {
  store.set(
    'games',
    getGames().filter((g) => g.id !== id)
  )
}

export function getFocusSchedules(): FocusSchedule[] {
  return store.get('focusSchedules')
}

export function addFocusSchedule(schedule: NewFocusSchedule): FocusSchedule {
  const created = { ...schedule, id: randomUUID() }
  store.set('focusSchedules', [...getFocusSchedules(), created])
  return created
}

export function updateFocusSchedule(id: string, patch: Partial<NewFocusSchedule>): FocusSchedule {
  const schedules = getFocusSchedules()
  const schedule = schedules.find((s) => s.id === id)
  if (!schedule) throw new Error(translateMain('errorScheduleNotFound', { id }))

  const updated = { ...schedule, ...patch, id }
  store.set(
    'focusSchedules',
    schedules.map((s) => (s.id === id ? updated : s))
  )
  return updated
}

export function removeFocusSchedule(id: string): void {
  store.set(
    'focusSchedules',
    getFocusSchedules().filter((s) => s.id !== id)
  )
}
