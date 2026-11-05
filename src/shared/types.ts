export interface GameItem {
  id: string
  name: string // Tên hiển thị (VD: "Yu-Gi-Oh! Master Duel")
  exeName: string // Tên file thực thi (VD: "masterduel.exe")
  isActive: boolean // Có đang bật theo dõi hay không
  iconDataUrl?: string // Icon thật của ứng dụng, dạng base64
}

export interface FocusSchedule {
  id: string
  label: string // VD: "Giờ học buổi tối"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm". Nhỏ hơn startTime nghĩa là vắt qua nửa đêm
  daysOfWeek: number[] // 0 (Chủ nhật) -> 6 (Thứ bảy), tính theo ngày bắt đầu khung giờ
  isEnabled: boolean
}

export type Language = 'vi' | 'en'
export type ThemeMode = 'dark' | 'light'

export interface AppConfig {
  weekdayLimitMinutes: number // Giới hạn phút chơi từ Thứ 2 - Thứ 6
  weekendLimitMinutes: number // Giới hạn phút chơi Thứ 7 - CN
  warningMinutesLeft: number[] // Mốc cảnh báo trước khi tắt
  commitmentPhrase: string // Câu bắt buộc gõ khi muốn mở khóa khẩn cấp
  launchAtStartup: boolean // Khởi động cùng Windows
  language: Language
  theme: ThemeMode
  backgroundColor: string | null // Mã màu hex, null là màu mặc định của theme
  backgroundImageFile: string | null // Tên file trong userData
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

export interface DiscoveredApp {
  name: string // Tên thân thiện: tiêu đề cửa sổ hoặc tên shortcut
  exeName: string // VD: "masterduel.exe"
  exePath: string // Đường dẫn đầy đủ để trích xuất icon
  iconDataUrl?: string // Icon dạng base64
  source: 'running' | 'installed'
}

export interface DashboardState {
  date: string
  usedSeconds: number
  limitSeconds: number
  remainingSeconds: number
  isFocusActive: boolean
  runningGames: GameItem[]
  sessions: SessionLog[]
  isLocked: boolean // Nguồn trạng thái khóa duy nhất, tính ở main
  tempUnlockedUntil: number | null // Timestamp hết mở khóa tạm thời, null nếu không mở khóa
}

export type NewGame = Omit<GameItem, 'id'>
export type NewFocusSchedule = Omit<FocusSchedule, 'id'>

/** API mà preload phơi bày cho renderer qua `window.api`. */
export interface WindowApi {
  getDashboardState: () => Promise<DashboardState>
  getTodayUsage: () => Promise<DailyUsage>
  scanRunningApps: () => Promise<DiscoveredApp[]>
  /** Trả về null nếu người dùng hủy hộp thoại. */
  browseAppFile: () => Promise<DiscoveredApp | null>

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

  /** Các hàm ảnh nền trả về data URL. `pick` trả về null nếu người dùng hủy. */
  getBackgroundImage: () => Promise<string | null>
  pickBackgroundImage: () => Promise<string | null>
  removeBackgroundImage: () => Promise<void>

  /** Đúng câu cam kết thì trạng thái trả về có `tempUnlockedUntil` khác null. */
  verifyEmergencyUnlock: (input: string) => Promise<DashboardState>

  /** Trả về hàm hủy đăng ký. */
  onTickUpdate: (callback: (state: DashboardState) => void) => () => void
}
