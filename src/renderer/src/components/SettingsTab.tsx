import { useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { AppConfig, Language, ThemeMode } from '../../../shared/types'
import { errorMessage } from '../lib/format'
import { useT } from '../lib/i18n'
import { Card, PageHeader } from './ui'

const COLOR_PRESETS = [
  '#0f172a',
  '#1e1b4b',
  '#134e4a',
  '#7f1d1d',
  '#f8fafc',
  '#fde68a',
  '#bfdbfe',
  '#fbcfe8'
]
const COLOR_PICKER_FALLBACK = '#0f172a'

interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-slate-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            option.value === value ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface SettingsTabProps {
  config: AppConfig
  backgroundImage: string | null
  onConfigChange: (config: AppConfig) => void
  onBackgroundImageChange: (image: string | null) => void
}

function SettingsTab({
  config,
  backgroundImage,
  onConfigChange,
  onBackgroundImageChange
}: SettingsTabProps): React.JSX.Element {
  const t = useT()
  const [error, setError] = useState('')

  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action()
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const update = (patch: Partial<AppConfig>): Promise<void> =>
    run(async () => onConfigChange(await window.api.updateConfig(patch)))

  const pickImage = (): Promise<void> =>
    run(async () => {
      const image = await window.api.pickBackgroundImage()
      if (image) onBackgroundImageChange(image)
    })

  const removeImage = (): Promise<void> =>
    run(async () => {
      await window.api.removeBackgroundImage()
      onBackgroundImageChange(null)
    })

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('tabSettings')} subtitle={t('settingsSubtitle')} />
      {error && <p className="page-error">{error}</p>}

      <Card
        title={t('languageLabel')}
        action={
          <Segmented<Language>
            label={t('languageLabel')}
            value={config.language}
            options={[
              { value: 'vi', label: 'Tiếng Việt' },
              { value: 'en', label: 'English' }
            ]}
            onChange={(language) => update({ language })}
          />
        }
      />

      <Card
        title={t('themeTitle')}
        action={
          <Segmented<ThemeMode>
            label={t('themeTitle')}
            value={config.theme}
            options={[
              { value: 'dark', label: t('themeDark') },
              { value: 'light', label: t('themeLight') }
            ]}
            onChange={(theme) => update({ theme })}
          />
        }
      />

      <Card
        title={t('colorTitle')}
        action={
          <button
            type="button"
            disabled={config.backgroundColor === null}
            onClick={() => update({ backgroundColor: null })}
            className="btn btn-secondary"
          >
            {t('colorReset')}
          </button>
        }
      >
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-slate-400">{t('colorHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={config.backgroundColor === color}
                onClick={() => update({ backgroundColor: color })}
                style={{ backgroundColor: color }}
                className={`size-9 rounded-full border-2 ${
                  config.backgroundColor === color ? 'border-sky-500' : 'border-slate-600'
                }`}
              />
            ))}
            <label className="btn btn-secondary ml-2 cursor-pointer">
              <input
                type="color"
                value={config.backgroundColor ?? COLOR_PICKER_FALLBACK}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                aria-label={t('colorCustom')}
                className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              {t('colorCustom')}
            </label>
          </div>
        </div>
      </Card>

      <Card
        title={t('imageTitle')}
        action={
          <div className="flex gap-2">
            {backgroundImage && (
              <button type="button" onClick={removeImage} className="btn btn-secondary">
                <Trash2 className="size-4" />
                {t('imageRemove')}
              </button>
            )}
            <button type="button" onClick={pickImage} className="btn btn-primary">
              <ImagePlus className="size-4" />
              {t('imageChoose')}
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-4 p-4">
          {backgroundImage && (
            <img
              src={backgroundImage}
              alt={t('imagePreview')}
              className="h-16 w-28 shrink-0 rounded-lg object-cover"
            />
          )}
          <p className="text-sm text-slate-400">{t('imageHint')}</p>
        </div>
      </Card>
    </div>
  )
}

export default SettingsTab
