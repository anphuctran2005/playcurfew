import { copyFile, readFile, rm, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import { app, BrowserWindow, dialog } from 'electron'
import { getConfig, translateMain, updateConfig } from './store'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function getImagePath(fileName: string): string {
  // basename: tên file đến từ config, không để nó trỏ ra ngoài userData.
  return join(app.getPath('userData'), basename(fileName))
}

/** CSP chỉ cho `self` và `data:`, và trang dev không đọc được file://, nên trả về data URL. */
export async function getBackgroundImage(): Promise<string | null> {
  const fileName = getConfig().backgroundImageFile
  if (!fileName) return null

  try {
    const data = await readFile(getImagePath(fileName))
    const mime = MIME_TYPES[extname(fileName).toLowerCase()]
    return `data:${mime};base64,${data.toString('base64')}`
  } catch (error) {
    console.error('Không đọc được ảnh nền:', error)
    return null
  }
}

export async function removeBackgroundImage(): Promise<void> {
  const fileName = getConfig().backgroundImageFile
  if (fileName) await rm(getImagePath(fileName), { force: true })
  updateConfig({ backgroundImageFile: null })
}

export async function pickBackgroundImage(window: BrowserWindow | null): Promise<string | null> {
  const options = {
    title: translateMain('imageDialogTitle'),
    properties: ['openFile' as const],
    filters: [{ name: translateMain('imageFilter'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  }
  const { canceled, filePaths } = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (canceled || filePaths.length === 0) return null

  const source = filePaths[0]
  const extension = extname(source).toLowerCase()
  if (!(extension in MIME_TYPES)) return null

  if ((await stat(source)).size > MAX_IMAGE_BYTES) throw new Error(translateMain('imageTooLarge'))

  await removeBackgroundImage()
  const fileName = `background${extension}`
  await copyFile(source, getImagePath(fileName))
  updateConfig({ backgroundImageFile: fileName })
  return getBackgroundImage()
}
