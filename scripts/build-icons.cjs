// Tạo bộ icon từ logo SVG: `npm run icons`. Chạy bằng Electron để có sẵn Chromium dựng SVG,
// nên không cần thêm dependency xử lý ảnh.
const { app, BrowserWindow, nativeImage } = require('electron')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const ROOT = join(__dirname, '..')
const SOURCE_SIZE = 1024
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const ICNS_TYPES = [
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024]
]

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()

async function renderSource() {
  const svg = readFileSync(join(ROOT, 'src/renderer/src/assets/logo.svg'), 'utf8')
  const html = `<!doctype html><style>*{margin:0}body{background:transparent}svg{display:block;width:${SOURCE_SIZE}px;height:${SOURCE_SIZE}px}</style>${svg}`

  const window = new BrowserWindow({
    width: SOURCE_SIZE,
    height: SOURCE_SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await window.webContents.capturePage()
  window.destroy()
  return image
}

function pngAt(source, size) {
  return nativeImage
    .createFromBuffer(source.toPNG())
    .resize({ width: size, height: size, quality: 'best' })
    .toPNG()
}

function buildIco(source) {
  const images = ICO_SIZES.map((size) => ({ size, png: pngAt(source, size) }))
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    // 0 nghĩa là 256 trong định dạng ICO.
    header.writeUInt8(size % 256, entry)
    header.writeUInt8(size % 256, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => png)])
}

function buildIcns(source) {
  const chunks = ICNS_TYPES.map(([type, size]) => {
    const png = pngAt(source, size)
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

app.whenReady().then(async () => {
  try {
    const source = await renderSource()
    writeFileSync(join(ROOT, 'build/icon.png'), pngAt(source, 1024))
    writeFileSync(join(ROOT, 'resources/icon.png'), pngAt(source, 512))
    writeFileSync(join(ROOT, 'build/icon.ico'), buildIco(source))
    writeFileSync(join(ROOT, 'build/icon.icns'), buildIcns(source))
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
  app.quit()
})
