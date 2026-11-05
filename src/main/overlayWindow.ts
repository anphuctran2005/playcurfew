import { BrowserWindow, screen } from 'electron'
import type { Language } from '../shared/types'
import { getConfig, translateMain } from './store'

const OVERLAY_WIDTH = 420
const OVERLAY_HEIGHT = 95
const OVERLAY_TOP = 24
const WARNING_DURATION_MS = 10_000
const LAST_MINUTE = 1

const CALM_SOUND = { frequency: 880, count: 3, gapSeconds: 0.3 }
const URGENT_SOUND = { frequency: 1200, count: 6, gapSeconds: 0.15 }

interface OverlayContent {
  title: string
  subtitle: string
  speech: string
  language: Language
  isUrgent: boolean
  durationMs: number
  sound: typeof CALM_SOUND
  countdownSeconds?: number // Có giá trị thì `{seconds}` trong title được đếm ngược
}

const OVERLAY_STYLE = `
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; overflow: hidden; background: transparent; }
body { padding: 6px; font-family: 'Segoe UI', sans-serif; cursor: default; user-select: none; }
.card {
  --accent: #facc15;
  display: flex; flex-direction: column; justify-content: center; gap: 4px;
  height: 100%; padding: 8px 14px;
  border: 2px solid var(--accent); border-radius: 14px;
  background: rgba(15, 23, 42, 0.92); box-shadow: 0 0 6px var(--accent);
  color: #f8fafc;
}
.card.urgent { --accent: #ef4444; animation: flash 0.7s step-end infinite; }
p { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
#title { font-size: 15px; font-weight: 700; }
#subtitle { font-size: 12px; color: #cbd5e1; }
.track { height: 4px; margin-top: 2px; border-radius: 2px; background: rgba(148, 163, 184, 0.25); overflow: hidden; }
#bar { height: 100%; background: var(--accent); transform-origin: left; animation: drain linear forwards; }
@keyframes flash { 50% { border-color: rgba(239, 68, 68, 0.25); box-shadow: none; } }
@keyframes drain { to { transform: scaleX(0); } }
`

const OVERLAY_SCRIPT = `
const card = document.getElementById('card')
const title = document.getElementById('title')
const showSeconds = (seconds) => {
  title.textContent = data.title.replace('{seconds}', () => seconds)
}

card.classList.toggle('urgent', data.isUrgent)
document.getElementById('subtitle').textContent = data.subtitle
document.getElementById('bar').style.animationDuration = data.durationMs + 'ms'

if (data.countdownSeconds === undefined) {
  title.textContent = data.title
} else {
  const endsAt = Date.now() + data.countdownSeconds * 1000
  const update = () => showSeconds(Math.max(Math.ceil((endsAt - Date.now()) / 1000), 0))
  update()
  setInterval(update, 200)
}

const audio = new AudioContext()

function playBeeps() {
  const { frequency, count, gapSeconds } = data.sound
  const start = audio.currentTime + 0.05
  for (let i = 0; i < count; i++) {
    const at = start + i * gapSeconds
    const beepEnd = at + gapSeconds * 0.6
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'square'
    oscillator.frequency.value = frequency
    // Tăng giảm nhanh thay vì bật tắt đột ngột để không nghe tiếng "tách" trong tai nghe.
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01)
    gain.gain.setValueAtTime(0.3, beepEnd - 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, beepEnd)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(at)
    oscillator.stop(beepEnd)
  }
  return count * gapSeconds * 1000
}

// Chỉ đọc khi có giọng đúng ngôn ngữ: giọng tiếng Anh đọc tiếng Việt nghe không hiểu được.
function speak() {
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(data.language))
  if (!voice) return
  const utterance = new SpeechSynthesisUtterance(data.speech)
  utterance.voice = voice
  utterance.lang = voice.lang
  speechSynthesis.speak(utterance)
}

const beepsMs = playBeeps()
if (window.speechSynthesis) {
  setTimeout(() => {
    if (speechSynthesis.getVoices().length > 0) speak()
    else speechSynthesis.addEventListener('voiceschanged', speak, { once: true })
  }, beepsMs)
}
`

let activeOverlay: BrowserWindow | null = null
let closeTimer: NodeJS.Timeout | null = null

function closeOverlay(): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  if (activeOverlay && !activeOverlay.isDestroyed()) activeOverlay.destroy()
  activeOverlay = null
}

function buildHtml(content: OverlayContent): string {
  // Tên game có thể lấy từ tiêu đề cửa sổ, nên chỉ đưa vào trang dạng JSON rồi gán textContent.
  const data = JSON.stringify(content).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="${content.language}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>PlayCurfew</title>
<style>${OVERLAY_STYLE}</style>
</head>
<body>
<div id="card" class="card">
  <p id="title"></p>
  <p id="subtitle"></p>
  <div class="track"><div id="bar"></div></div>
</div>
<script>const data = ${data}
${OVERLAY_SCRIPT}</script>
</body>
</html>`
}

function openOverlay(content: OverlayContent): void {
  closeOverlay()

  const { width } = screen.getPrimaryDisplay().workAreaSize
  const overlayWin = new BrowserWindow({
    x: Math.round((width - OVERLAY_WIDTH) / 2),
    y: OVERLAY_TOP,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false, // Game mất focus sẽ tự thu nhỏ hoặc văng, như khi bị Alt-Tab
    skipTaskbar: true,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    }
  })

  activeOverlay = overlayWin
  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWin.setIgnoreMouseEvents(true)
  // Không chờ ready-to-show: thử trên Windows thì cửa sổ này không tự hiện theo sự kiện đó.
  overlayWin.showInactive()
  closeTimer = setTimeout(closeOverlay, content.durationMs)

  overlayWin
    .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildHtml(content)))
    .catch((error) => console.error('Không mở được overlay:', error))
}

export function showWarningOverlay(minutesLeft: number, gameName: string): void {
  const params = { minutes: minutesLeft, name: gameName }

  openOverlay({
    title: translateMain('overlayWarningTitle', params),
    subtitle: translateMain('overlayWarningHint'),
    speech: translateMain('overlayWarningSpeech', params),
    language: getConfig().language,
    isUrgent: minutesLeft <= LAST_MINUTE,
    durationMs: WARNING_DURATION_MS,
    sound: minutesLeft <= LAST_MINUTE ? URGENT_SOUND : CALM_SOUND
  })
}

export function showFinalCountdownOverlay(seconds: number, gameName: string): void {
  openOverlay({
    title: translateMain('overlayCountdownTitle', { seconds: '{seconds}', name: gameName }),
    subtitle: translateMain('overlayCountdownHint'),
    speech: translateMain('overlayCountdownSpeech', { seconds, name: gameName }),
    language: getConfig().language,
    isUrgent: true,
    durationMs: seconds * 1000,
    sound: URGENT_SOUND,
    countdownSeconds: seconds
  })
}
