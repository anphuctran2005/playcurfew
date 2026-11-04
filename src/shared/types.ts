export interface GameItem {
  id: string
  name: string // Tên hiển thị (VD: "Yu-Gi-Oh! Master Duel")
  exeName: string // Tên file thực thi (VD: "masterduel.exe")
  isActive: boolean // Có đang bật theo dõi hay không
}

export interface FocusSchedule {
  id: string
  label: string // VD: "Giờ học buổi tối"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm". Nhỏ hơn startTime nghĩa là vắt qua nửa đêm
  daysOfWeek: number[] // 0 (Chủ nhật) -> 6 (Thứ bảy), tính theo ngày bắt đầu khung giờ
  isEnabled: boolean
}

export interface AppConfig {
  weekdayLimitMinutes: number // Giới hạn phút chơi từ Thứ 2 - Thứ 6
  weekendLimitMinutes: number // Giới hạn phút chơi Thứ 7 - CN
  warningMinutesLeft: number[] // Mốc cảnh báo trước khi tắt
  commitmentPhrase: string // Câu bắt buộc gõ khi muốn mở khóa khẩn cấp
  launchAtStartup: boolean // Khởi động cùng Windows
}

export interface SessionLog {
  gameName: string
  exeName: string
  startTime: string // ISO 8601
  durationSeconds: number
}

export interface DailyUsage {
  date: string // "YYYY-MM-DD" theo giờ máy
  usedSeconds: number // Tổng số giây đã chơi trong ngày
  sessions: SessionLog[]
}

export interface RunningProcess {
  pid: number
  exeName: string
  windowTitle: string // Rỗng nếu là tiến trình ngầm
}

export interface DashboardState {
  date: string
  usedSeconds: number
  limitSeconds: number
  remainingSeconds: number
  isFocusActive: boolean
  runningGames: GameItem[]
  sessions: SessionLog[]
}

export type NewGame = Omit<GameItem, 'id'>
export type NewFocusSchedule = Omit<FocusSchedule, 'id'>

/** API mà preload phơi bày cho renderer qua `window.api`. */
export interface WindowApi {
  getDashboardState: () => Promise<DashboardState>
  getTodayUsage: () => Promise<DailyUsage>
  getRunningProcesses: () => Promise<RunningProcess[]>

  getConfig: () => Promise<AppConfig>
  updateConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>

  getGames: () => Promise<GameItem[]>
  addGame: (game: NewGame) => Promise<GameItem>
  updateGame: (id: string, patch: Partial<NewGame>) => Promise<GameItem>
  removeGame: (id: string) => Promise<void>

  getFocusSchedules: () => Promise<FocusSchedule[]>
  addFocusSchedule: (schedule: NewFocusSchedule) => Promise<FocusSchedule>
  updateFocusSchedule: (id: string, patch: Partial<NewFocusSchedule>) => Promise<FocusSchedule>
  removeFocusSchedule: (id: string) => Promise<void>

  /** Trả về hàm hủy đăng ký. */
  onTickUpdate: (callback: (state: DashboardState) => void) => () => void
}
