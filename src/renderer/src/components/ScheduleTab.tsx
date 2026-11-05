import { useEffect, useState } from 'react'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import type { AppConfig, FocusSchedule } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import LockNotice from './LockNotice'
import Toggle from './Toggle'
import { Card, PageHeader } from './ui'

const MAX_LIMIT_MINUTES = 1440
const SLIDER_MAX_MINUTES = 720
const SLIDER_STEP_MINUTES = 5

// Hiển thị từ T2 đến CN, giá trị theo Date.getDay() (0 là Chủ nhật).
const WEEK_DAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' }
]

interface QuotaFieldProps {
  label: string
  value: number
  onChange: (minutes: number) => void
}

function QuotaField({ label, value, onChange }: QuotaFieldProps): React.JSX.Element {
  const setClamped = (raw: string): void => {
    onChange(Math.min(Math.max(Math.floor(Number(raw)) || 0, 0), MAX_LIMIT_MINUTES))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={SLIDER_MAX_MINUTES}
          step={SLIDER_STEP_MINUTES}
          value={value}
          onChange={(e) => setClamped(e.target.value)}
          aria-label={label}
          className="min-w-0 flex-1 accent-emerald-500"
        />
        <input
          type="number"
          min={0}
          max={MAX_LIMIT_MINUTES}
          value={value}
          onChange={(e) => setClamped(e.target.value)}
          aria-label={`${label} (phút)`}
          className="field w-20 text-right"
        />
        <span className="text-sm text-slate-400">phút</span>
      </div>
    </div>
  )
}

interface DayPickerProps {
  days: number[]
  isDayDisabled?: (day: number) => boolean
  onToggle: (day: number) => void
}

function DayPicker({ days, isDayDisabled, onToggle }: DayPickerProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 gap-1">
      {WEEK_DAYS.map(({ value, label }) => {
        const isSelected = days.includes(value)
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            disabled={isDayDisabled?.(value)}
            onClick={() => onToggle(value)}
            className={`size-8 rounded-full text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? 'bg-sky-600 text-white'
                : 'bg-slate-700 text-slate-300 not-disabled:hover:bg-slate-600'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// Ô nhập chữ thay cho type="time": ô gốc hiện AM/PM theo cài đặt Windows, không khớp với 24 giờ.
function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
}

interface ScheduleTabProps {
  config: AppConfig
  isLocked: boolean
  onConfigChange: (config: AppConfig) => void
  onChanged: () => void
}

function ScheduleTab({
  config,
  isLocked,
  onConfigChange,
  onChanged
}: ScheduleTabProps): React.JSX.Element {
  const [weekdayLimit, setWeekdayLimit] = useState(config.weekdayLimitMinutes)
  const [weekendLimit, setWeekendLimit] = useState(config.weekendLimitMinutes)
  const [schedules, setSchedules] = useState<FocusSchedule[]>([])
  const [label, setLabel] = useState('')
  const [startTime, setStartTime] = useState('19:30')
  const [endTime, setEndTime] = useState('22:00')
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.getFocusSchedules().then(setSchedules)
  }, [])

  const isDirty =
    weekdayLimit !== config.weekdayLimitMinutes || weekendLimit !== config.weekendLimitMinutes
  const isIncrease =
    weekdayLimit > config.weekdayLimitMinutes || weekendLimit > config.weekendLimitMinutes
  const isIncreaseBlocked = isLocked && isIncrease

  const saveLimits = async (): Promise<void> => {
    try {
      onConfigChange(
        await window.api.updateConfig({
          weekdayLimitMinutes: weekdayLimit,
          weekendLimitMinutes: weekendLimit
        })
      )
      onChanged()
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const setLaunchAtStartup = async (launchAtStartup: boolean): Promise<void> => {
    try {
      onConfigChange(await window.api.updateConfig({ launchAtStartup }))
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action()
      setSchedules(await window.api.getFocusSchedules())
      onChanged()
      setError('')
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const addSchedule = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const isAdded = await run(() =>
      window.api.addFocusSchedule({
        label: label.trim(),
        startTime,
        endTime,
        daysOfWeek: days,
        isEnabled: true
      })
    )
    if (isAdded) setLabel('')
  }

  const canAdd =
    label.trim() !== '' &&
    days.length > 0 &&
    isValidTime(startTime) &&
    isValidTime(endTime) &&
    startTime !== endTime

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Giới hạn & Khung giờ Focus"
        subtitle="Đặt số phút chơi mỗi ngày và các khung giờ không được mở game."
      />

      {isLocked && (
        <LockNotice>
          Không thể đổi khởi động cùng Windows, tăng giới hạn phút, tắt, xóa hoặc bớt ngày của khung
          giờ Focus lúc này.
        </LockNotice>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Khởi động cùng Windows</h3>
          <p className="text-xs text-slate-400">Tự chạy ngầm dưới khay hệ thống khi bật máy.</p>
        </div>
        <Toggle
          checked={config.launchAtStartup}
          label="Khởi động cùng Windows"
          isLocked={isLocked}
          lockBothWays
          onChange={setLaunchAtStartup}
        />
      </section>

      <Card
        title="Giới hạn mỗi ngày"
        action={
          <div className="flex items-center gap-3">
            {isIncreaseBlocked && (
              <span className="text-xs text-red-300">
                Đang khóa: chỉ được giảm giới hạn, không được tăng.
              </span>
            )}
            <button
              type="button"
              disabled={!isDirty || isIncreaseBlocked}
              onClick={saveLimits}
              className="btn btn-primary"
            >
              {isIncreaseBlocked ? <Lock className="size-4" /> : <Save className="size-4" />}
              Lưu cấu hình
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-6 p-4">
          <QuotaField
            label="Giới hạn Ngày thường (Thứ 2 - Thứ 6)"
            value={weekdayLimit}
            onChange={setWeekdayLimit}
          />
          <QuotaField
            label="Giới hạn Cuối tuần (Thứ 7 - CN)"
            value={weekendLimit}
            onChange={setWeekendLimit}
          />
        </div>
      </Card>

      <Card title={`Khung giờ Focus (${schedules.length})`}>
        {schedules.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Chưa có khung giờ nào.</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{schedule.label}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {schedule.startTime} - {schedule.endTime}
                    {schedule.endTime < schedule.startTime && ' (hôm sau)'}
                  </p>
                </div>
                <DayPicker
                  days={schedule.daysOfWeek}
                  isDayDisabled={(day) =>
                    schedule.daysOfWeek.includes(day) &&
                    (isLocked || schedule.daysOfWeek.length === 1)
                  }
                  onToggle={(day) =>
                    run(() =>
                      window.api.updateFocusSchedule(schedule.id, {
                        daysOfWeek: toggleDay(schedule.daysOfWeek, day)
                      })
                    )
                  }
                />
                <Toggle
                  checked={schedule.isEnabled}
                  label={`Bật ${schedule.label}`}
                  isLocked={isLocked}
                  onChange={(isEnabled) =>
                    run(() => window.api.updateFocusSchedule(schedule.id, { isEnabled }))
                  }
                />
                <button
                  type="button"
                  disabled={isLocked}
                  aria-label={`Xóa ${schedule.label}`}
                  title={isLocked ? 'Đang khóa: dùng "Mở khóa khẩn cấp" để xóa' : undefined}
                  onClick={() => run(() => window.api.removeFocusSchedule(schedule.id))}
                  className="btn-delete"
                >
                  {isLocked ? <Lock className="size-4" /> : <Trash2 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addSchedule} className="flex flex-col gap-3 border-t border-slate-700 p-4">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nhãn, ví dụ: Giờ học buổi tối"
              aria-label="Nhãn khung giờ"
              className="field min-w-0 flex-1"
            />
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="19:30"
              maxLength={5}
              aria-label="Giờ bắt đầu"
              aria-invalid={!isValidTime(startTime)}
              className="field w-20 text-center tabular-nums aria-invalid:border-red-500"
            />
            <span className="text-slate-400">-</span>
            <input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="22:00"
              maxLength={5}
              aria-label="Giờ kết thúc"
              aria-invalid={!isValidTime(endTime)}
              className="field w-20 text-center tabular-nums aria-invalid:border-red-500"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <DayPicker days={days} onToggle={(day) => setDays(toggleDay(days, day))} />
            <button type="submit" disabled={!canAdd} className="btn btn-primary">
              <Plus className="size-4" />
              Thêm khung giờ
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default ScheduleTab
