import { useEffect, useState } from 'react'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import type { AppConfig, FocusSchedule } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import LockNotice from './LockNotice'
import Toggle from './Toggle'

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

const INPUT_CLASS =
  'rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-sky-500 focus:outline-none'

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
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">{label}</span>
        <span className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="number"
            min={0}
            max={MAX_LIMIT_MINUTES}
            value={value}
            onChange={(e) => setClamped(e.target.value)}
            aria-label={`${label} (phút)`}
            className={`${INPUT_CLASS} w-24 text-right`}
          />
          phút
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={SLIDER_MAX_MINUTES}
        step={SLIDER_STEP_MINUTES}
        value={value}
        onChange={(e) => setClamped(e.target.value)}
        aria-label={label}
        className="w-full accent-emerald-500"
      />
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
            className={`size-8 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
              isSelected
                ? 'bg-sky-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
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
    startTime !== '' &&
    endTime !== '' &&
    startTime !== endTime

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h2 className="text-xl font-semibold">Giới hạn & Khung giờ Focus</h2>

      {isLocked && (
        <LockNotice>
          Không thể tăng giới hạn phút, tắt, xóa hoặc bớt ngày của khung giờ Focus lúc này.
        </LockNotice>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-sm font-semibold">Giới hạn mỗi ngày</h3>
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!isDirty || isIncreaseBlocked}
            onClick={saveLimits}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {isIncreaseBlocked ? <Lock className="size-4" /> : <Save className="size-4" />}
            Lưu cấu hình
          </button>
          {isIncreaseBlocked && (
            <span className="text-sm text-red-300">
              Đang khóa: chỉ được giảm giới hạn, không được tăng.
            </span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800">
        <h3 className="border-b border-slate-700 px-4 py-3 text-sm font-semibold">
          Khung giờ Focus ({schedules.length})
        </h3>

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
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
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
              className={`${INPUT_CLASS} min-w-0 flex-1`}
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Giờ bắt đầu"
              className={INPUT_CLASS}
            />
            <span className="text-slate-400">-</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="Giờ kết thúc"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <DayPicker days={days} onToggle={(day) => setDays(toggleDay(days, day))} />
            <button
              type="submit"
              disabled={!canAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Plus className="size-4" />
              Thêm khung giờ
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ScheduleTab
