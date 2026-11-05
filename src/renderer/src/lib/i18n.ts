import { createContext, useContext } from 'react'
import { translate, type MessageKey, type MessageParams } from '../../../shared/i18n'
import type { Language } from '../../../shared/types'

export const LanguageContext = createContext<Language>('vi')

export type Translate = (key: MessageKey, params?: MessageParams) => string

export function useT(): Translate {
  const language = useContext(LanguageContext)
  return (key, params) => translate(language, key, params)
}

/** Giờ 24h ở cả hai ngôn ngữ: en-US sẽ hiện AM/PM. */
export function getLocale(language: Language): string {
  return language === 'vi' ? 'vi-VN' : 'en-GB'
}
