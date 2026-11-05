import { useEffect, useState } from 'react'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import type { AppConfig, FocusSchedule } from '../../../shared/types'
import type { MessageKey } from '../../../shared/i18n'
import { errorMessage } from '../lib/format'
import { useT } from '../lib/i18n'
import LockNotice from './LockNotice'
import Toggle from './Toggle'
import { Card, PageHeader } from './ui'

const MAX_LIMIT_MINUTES = 1440
const SLIDER_MAX_MINUTES = 720
const SLIDER_STEP_MINUTES = 5

// Hiển thị từ T2 đến CN, giá trị theo Date.getDay() (0 là Chủ nhật).
const WEEK_DAYS: { value: number; labelKey: MessageKey }[] = [
  { value: 1, labelKey: 'dayMon' },
  { value: 2, labelKey: 'dayTue' },
  { value: 3, labelKey: 'dayWed' },
  { value: 4, labelKey: 'dayThu' },
  { value: 5, labelKey: 'dayFri' },
  { value: 6, labelKey: 'daySat' },
  { value: 0, labelKey: 'daySun' }
]

interface QuotaFieldProps {
  label: string
  value: number
  onChange: (minutes: number) => void
}

function QuotaField({ label, value, onChange }: QuotaFieldProps): React.JSX.Element {
  const t = useT()
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
          aria-label={t('minutesAria', { label })}
          className="field w-20 text-right"
        />
        <span className="text-sm text-slate-400">{t('minutesUnit')}</span>
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
  const t = useT()

  return (
    <div className="flex shrink-0 gap-1">
      {WEEK_DAYS.map(({ value, labelKey }) => {
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
            {t(labelKey)}
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
  const t = useT()
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

  const testOverlay = async (): Promise<void> => {
    try {
      await window.api.testWarningOverlay()
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
      <PageHeader title={t('scheduleTitle')} subtitle={t('scheduleSubtitle')} />

      {isLocked && <LockNotice>{t('scheduleLocked')}</LockNotice>}
      {error && <p className="page-error">{error}</p>}

      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t('autoStartTitle')}</h3>
          <p className="text-xs text-slate-400">{t('autoStartHint')}</p>
        </div>
        <Toggle
          checked={config.launchAtStartup}
          label={t('autoStartTitle')}
          isLocked={isLocked}
          lockBothWays
          onChange={setLaunchAtStartup}
        />
      </section>

      <section className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{t('overlayTitle')}</h3>
          <p className="text-xs text-slate-400">{t('overlayHint')}</p>
        </div>
        <button type="button" onClick={testOverlay} className="btn btn-secondary shrink-0">
          {t('overlayTestButton')}
        </button>
      </section>

      <Card
        title={t('limitsTitle')}
        action={
          <div className="flex items-center gap-3">
            {isIncreaseBlocked && (
              <span className="text-xs text-red-300">{t('limitsIncreaseBlocked')}</span>
            )}
            <button
              type="button"
              disabled={!isDirty || isIncreaseBlocked}
              onClick={saveLimits}
              className="btn btn-primary"
            >
              {isIncreaseBlocked ? <Lock className="size-4" /> : <Save className="size-4" />}
              {t('limitsSave')}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-6 p-4">
          <QuotaField label={t('limitWeekday')} value={weekdayLimit} onChange={setWeekdayLimit} />
          <QuotaField label={t('limitWeekend')} value={weekendLimit} onChange={setWeekendLimit} />
        </div>
      </Card>

      <Card title={t('focusTitle', { count: schedules.length })}>
        {schedules.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">{t('focusEmpty')}</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{schedule.label}</p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {schedule.startTime} - {schedule.endTime}
                    {schedule.endTime < schedule.startTime && t('focusNextDay')}
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
                  label={t('focusEnable', { name: schedule.label })}
                  isLocked={isLocked}
                  onChange={(isEnabled) =>
                    run(() => window.api.updateFocusSchedule(schedule.id, { isEnabled }))
                  }
                />
                <button
                  type="button"
                  disabled={isLocked}
                  aria-label={t('deleteItem', { name: schedule.label })}
                  title={isLocked ? t('deleteLockedTitle') : undefined}
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
              placeholder={t('focusLabelPlaceholder')}
              aria-label={t('focusLabelAria')}
              className="field min-w-0 flex-1"
            />
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="19:30"
              maxLength={5}
              aria-label={t('focusStart')}
              aria-invalid={!isValidTime(startTime)}
              className="field w-20 text-center tabular-nums aria-invalid:border-red-500"
            />
            <span className="text-slate-400">-</span>
            <input
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="22:00"
              maxLength={5}
              aria-label={t('focusEnd')}
              aria-invalid={!isValidTime(endTime)}
              className="field w-20 text-center tabular-nums aria-invalid:border-red-500"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <DayPicker days={days} onToggle={(day) => setDays(toggleDay(days, day))} />
            <button type="submit" disabled={!canAdd} className="btn btn-primary">
              <Plus className="size-4" />
              {t('focusAdd')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default ScheduleTab
