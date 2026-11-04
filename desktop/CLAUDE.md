# Desktop app (Electron)

GameGuard: app Windows kiểm soát giờ chơi game. Dùng electron-vite, React 19, TypeScript, Tailwind CSS 4, lucide-react và electron-store.

Đây là dự án npm độc lập với app web Cờ Tướng (Next.js) ở gốc repo: có `package.json`, `node_modules` và lockfile riêng. Mọi lệnh bên dưới chạy từ thư mục `desktop/`.

## Lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `npm install` | Cài dependency, tải Electron binary |
| `npm run dev` | Chạy app với HMR cho renderer; sửa main/preload thì tự build lại |
| `npm start` | Chạy thử bản build (`electron-vite preview`) |
| `npm run typecheck` | Kiểm tra type cả hai phía (`typecheck:node`, `typecheck:web`) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run build` | Typecheck rồi bundle vào `out/`, chưa đóng gói |
| `npm run build:unpack` | Đóng gói không cài đặt vào `dist/win-unpacked/` |
| `npm run build:win` / `build:mac` / `build:linux` | Tạo bộ cài vào `dist/` |

## Kiến trúc Main - Preload - Renderer

```
Renderer (React)  --window.api.*-->  Preload  --ipcRenderer.invoke-->  Main
  Chromium, không có Node            cầu nối        ipcMain.handle     Node đầy đủ
```

| Tiến trình | Thư mục | Chạy trong | Vai trò |
| --- | --- | --- | --- |
| Main | `src/main/` | Node.js | Vòng đời app, tạo `BrowserWindow`, truy cập file và SQLite, xử lý IPC. Mỗi app có một tiến trình main. |
| Preload | `src/preload/` | Context cô lập, nạp trước trang | Chỉ phơi bày API được chọn sang renderer qua `contextBridge`. |
| Renderer | `src/renderer/` | Chromium | Giao diện React. Không có `require` hay module Node (đã kiểm chứng). |

Kiểu dùng chung cho cả ba tầng nằm ở `src/shared/types.ts`, gồm cả `WindowApi` là hợp đồng của `window.api`.

Output nằm ở `out/main`, `out/preload`, `out/renderer`. Alias `@renderer/*` trỏ tới `src/renderer/src/*`.

### Main process

| File | Vai trò |
| --- | --- |
| `store.ts` | Đọc ghi dữ liệu qua `electron-store`, dữ liệu mặc định, reset usage theo ngày |
| `processMonitor.ts` | Quét tiến trình, tắt game, vòng lặp 5 giây, thông báo, gửi `on-tick-update` |
| `ipcHandlers.ts` | Đăng ký toàn bộ kênh `ipcMain.handle` |

Logic đếm giờ chỉ nằm ở main, không đặt trong React. Vòng lặp chỉ gọi `tasklist`; `getRunningProcesses()` khởi động PowerShell nên chỉ dùng khi UI cần, không gọi theo chu kỳ.

### Thêm một lệnh IPC

1. `src/main/ipcHandlers.ts`: đăng ký `ipcMain.handle('kenh', handler)`.
2. `src/preload/index.ts`: thêm hàm vào object `api`, gọi `ipcRenderer.invoke('kenh', ...)`.
3. `src/shared/types.ts`: khai báo hàm trong `WindowApi`.
4. Renderer: gọi `window.api.tenHam()`.

Template còn phơi `window.electron` (gồm `ipcRenderer` thô) cho renderer. Code mới dùng `window.api` với hàm cụ thể, không để renderer tự gửi kênh tùy ý.

## Quy ước

### Lưu trữ

- Dữ liệu dùng `electron-store`, file `config.json` trong `app.getPath('userData')`. Thư mục này lấy theo tên app, nên đổi `name` trong `package.json` sẽ làm mất dữ liệu cũ.
- `electron-store` là ESM-only còn main bundle là CJS. Nó phải nằm trong `externalizeDeps.exclude` ở `electron.vite.config.ts` để được bundle; bỏ đi thì `npm run typecheck` vẫn đạt nhưng có thể lỗi lúc chạy.
- Ngày `YYYY-MM-DD` tính theo giờ máy bằng `toDateKey()`, không dùng `toISOString()`.

### Gọi lệnh Windows

- Dùng `execFile` với mảng tham số, không ghép chuỗi qua shell, và bọc `try/catch`.
- `exeName` phải qua `isValidExeName()`: `taskkill /F /IM "*"` sẽ tắt mọi tiến trình.
- `taskkill /IM` tắt mọi tiến trình cùng tên. Khi test, dùng bản copy của một file exe với tên riêng, không dùng app có thể đang mở dữ liệu chưa lưu.

### better-sqlite3

Đã cài nhưng chưa dùng, lưu trữ hiện tại là `electron-store`.

- Chỉ import trong main process. Renderer truy cập dữ liệu qua IPC.
- API đồng bộ, nên truy vấn chậm sẽ chặn main process.
- Đặt file DB trong `app.getPath('userData')`, không đặt cạnh app vì thư mục cài có thể chỉ đọc.
- Bản 13 dùng N-API và kèm sẵn `prebuilds/*.node`, cùng một binary chạy được trên cả Node và Electron. Không cần `electron-rebuild`.
- npm báo chặn install script `node-gyp rebuild` của gói này: bỏ qua, không cần `npm install-scripts approve`. `binding.gyp` không compile gì khi đã có prebuild cho máy đang chạy.
- `postinstall` vẫn gọi `electron-builder install-app-deps`. Bước này chỉ để lại thư mục `build/` không chứa `.node`, nên không ảnh hưởng tới binary đang dùng.

### Tailwind CSS

- Dùng bản 4 qua plugin `@tailwindcss/vite`, không có `tailwind.config`. File vào là `src/renderer/src/assets/main.css`.
- `css.postcss` trong `electron.vite.config.ts` phải giữ nguyên. Thiếu nó, Vite sẽ nạp `postcss.config.mjs` của app Next ở gốc repo và build lỗi.
- CSS tự viết nên đặt trong `@layer`. Style ngoài layer luôn thắng utility của Tailwind, ví dụ `* { margin: 0 }` sẽ vô hiệu hóa `m-4`.

### Tài nguyên ngoài

CSP nằm trong `src/renderer/index.html` và chỉ cho phép `'self'`. Muốn nạp script, ảnh hay kết nối ra ngoài thì phải sửa CSP.

## Liên quan tới gốc repo

`tsconfig.json` và `eslint.config.mjs` ở gốc đã loại trừ `desktop/` để `next build` không typecheck code Electron. Giữ nguyên các mục loại trừ này.

## Giá trị mẫu cần thay trước khi phát hành

- `electron-builder.yml`: `appId`, `productName`, `publish.url`
- `package.json`: `name`, `description`, `author`, `homepage`
- `src/main/index.ts`: `setAppUserModelId('com.electron')`
