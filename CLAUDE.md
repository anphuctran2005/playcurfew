# CLAUDE.md - Quy chuẩn phát triển dự án PlayCurfew Desktop

## 1. Tổng quan công nghệ (Tech Stack)

- **Framework:** `electron-vite` (Template `react-ts`)
- **Giao diện (Renderer):** React 18+, TypeScript, Tailwind CSS, `lucide-react` (icons)
- **Hệ thống (Main Process):** Node.js (trong Electron), `child_process` (chạy lệnh Windows `tasklist` và `taskkill`), `electron.Tray`, `electron.Notification`
- **Lưu trữ dữ liệu (Database):** `electron-store` (lưu file JSON cấu hình và lịch sử cục bộ tại `%APPDATA%` để tránh lỗi biên dịch C++ của `better-sqlite3` trên Windows)

## 2. Các lệnh thường dùng

- Cài đặt thư viện: `npm install`
- Chạy môi trường Dev: `npm run dev`
- Kiểm tra lỗi TypeScript: `npm run typecheck`
- Đóng gói file .exe cho Windows: `npm run build:win`

## 3. Kiến trúc và Quy tắc bảo mật (Bắt buộc tuân thủ)

Dự án chia làm 3 tầng tách biệt trong thư mục `src/`:

1. **`src/main/` (Main Process):**
   - Chứa toàn bộ logic hệ thống: Quét tiến trình Windows (`processMonitor.ts`), lưu trữ dữ liệu (`store.ts`), quản lý khay hệ thống (`tray.ts`), và đếm giờ (`timerEngine.ts`).
   - Tuyệt đối không để logic đếm giờ bên phía React (Renderer) vì khi ẩn cửa sổ xuống System Tray, React có thể bị dừng hoặc đóng.
2. **`src/preload/` (Preload Script):**
   - Sử dụng `contextBridge.exposeInMainWorld('api', ...)` để mở các hàm giao tiếp IPC an toàn.
   - Bật `contextIsolation: true` và `nodeIntegration: false`.
3. **`src/renderer/` (Renderer Process - Giao diện React):**
   - Chỉ đảm nhận việc hiển thị trạng thái và gửi lệnh cấu hình xuống Main Process thông qua `window.api`.
   - Giao diện thiết kế theo phong cách Dark Mode tối giản, dễ nhìn.

## 4. Quy tắc viết code cho Claude

- Luôn định nghĩa đầy đủ kiểu dữ liệu (TypeScript Interfaces) trong file dùng chung `src/shared/types.ts` trước khi viết logic.
- Mọi lệnh gọi `tasklist` và `taskkill` trên Windows phải bọc trong `try/catch` để tránh làm crash ứng dụng khi gặp tiến trình yêu cầu quyền Administrator.
- Không tự ý thêm các thư viện UI nặng nề (như MUI hay Antd), chỉ dùng Tailwind CSS thuần.

## 5. Ghi chú vận hành

### Lệnh

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

### Kiến trúc Main - Preload - Renderer

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

#### Main process

| File | Vai trò |
| --- | --- |
| `store.ts` | Đọc ghi dữ liệu qua `electron-store`, dữ liệu mặc định, reset usage theo ngày |
| `processMonitor.ts` | Quét tiến trình, tắt game, vòng lặp 5 giây, thông báo, gửi `on-tick-update` |
| `ipcHandlers.ts` | Đăng ký toàn bộ kênh `ipcMain.handle` |
| `appScanner.ts` | Quét ứng dụng đang mở kèm icon, chọn file `.exe` hoặc `.lnk` |
| `overlayWindow.ts` | Cửa sổ cảnh báo đè lên game, HTML nhúng dạng `data:` URL kèm âm thanh |
| `tray.ts` | Icon khay hệ thống, menu chuột phải cập nhật mỗi 5 giây |
| `autoStartAdmin.ts` | Tạo, xóa task `PlayCurfewAutoStart` trong Task Scheduler |
| `index.ts` | Single instance, thu xuống khay khi đóng, auto-start, cờ `--hidden` |

`tray.ts` import `processMonitor.ts`, nên chiều ngược lại đi qua callback của `startMonitor` để tránh vòng import.

`close` luôn bị chặn trừ khi `isQuitting`. `session-end` phải bật cờ này, nếu không Windows sẽ báo app cản việc tắt máy.

Auto-start chỉ tạo task khi `app.isPackaged`, nên bật ở `npm run dev` chỉ lưu `config.launchAtStartup`. Không dùng `setLoginItemSettings`: Windows bỏ qua mục khởi động của exe `requireAdministrator`. Task tạo từ XML vì `schtasks /Create` mặc định không chạy khi dùng pin.

Bản đóng gói có manifest `requireAdministrator`, nên chạy từ phiên không Admin sẽ lỗi 740 hoặc hỏi UAC. Muốn test tự động thì build bản riêng: `npx electron-builder --dir -c.win.requestedExecutionLevel=asInvoker`.

Overlay phải giữ `focusable: false` và `showInactive()`: game mất focus có thể thu nhỏ hoặc văng. Dùng `setAlwaysOnTop` nên chỉ đè được game borderless, không đè được exclusive fullscreen. Tên game đưa vào trang dạng JSON rồi gán `textContent`, không ghép vào HTML. Giọng đọc chỉ chạy khi Windows có giọng đúng ngôn ngữ.

Logic đếm giờ chỉ nằm ở main, không đặt trong React. Vòng lặp chỉ gọi `tasklist`; `getRunningGuiApps()` khởi động PowerShell nên chỉ dùng khi mở bảng chọn, không gọi theo chu kỳ.

#### Renderer

| File | Vai trò |
| --- | --- |
| `App.tsx` | State tổng, tính `isLocked`, `tempUnlockedUntil` |
| `components/ui.tsx` | `PageHeader`, `Card` dùng chung. Nút và ô nhập là class `.btn-*`, `.field` trong `assets/main.css` |
| `components/Sidebar.tsx` | Điều hướng tab, trạng thái khóa, đếm ngược mở khóa tạm thời |
| `components/DashboardTab.tsx` | Vòng tiến độ, badge trạng thái, lịch sử phiên chơi |
| `components/BlacklistTab.tsx` | Danh sách game kèm icon |
| `components/AppPickerModal.tsx` | Chọn nhiều ứng dụng đang mở, chọn file, nhập tay |
| `components/ScheduleTab.tsx` | Giới hạn phút, khung giờ Focus |
| `components/EmergencyUnlockModal.tsx` | Gõ lại câu cam kết để mở khóa 5 phút |

`isSystemLocked()` ở `processMonitor.ts` là nguồn trạng thái khóa duy nhất, renderer nhận qua `DashboardState`. IPC ghi cấu hình chưa kiểm tra khóa, chỉ UI và nút Thoát trong Tray chặn. `tempUnlockedUntil` chỉ nằm trong bộ nhớ main: tải lại trang vẫn còn, khởi động lại app là khóa lại.

#### Logo và ảnh tài liệu

- Nguồn logo là `src/renderer/src/assets/logo.svg`. Sửa xong chạy `npm run icons` để tạo lại `build/icon.*` và `resources/icon.png`.
- `README.md` là bản tiếng Anh gốc, `README.vi.md` là bản tiếng Việt. Sửa một bản thì sửa cả bản kia.
- Ảnh trong README nằm ở `docs/images/en/` và `docs/images/vi/`, chụp từ app thật với dữ liệu mẫu. Không chụp danh sách quét cửa sổ vì lộ cửa sổ đang mở trên máy.
- electron-builder đóng gói mọi file trừ khi loại trừ. Thêm thư mục mới ở gốc repo thì phải thêm vào `files` trong `electron-builder.yml`.

### Ngôn ngữ và giao diện

- Mọi chữ hiển thị nằm trong `src/shared/i18n.ts`, dùng chung cho main và renderer. Thêm chữ mới thì thêm vào cả `vi` và `en`. Renderer dùng `useT()`, main dùng `translateMain()`.
- Câu cam kết mặc định đổi theo ngôn ngữ qua `getCommitmentPhrase()`. Câu người dùng tự đặt thì giữ nguyên, và main xác minh theo đúng câu đang hiển thị.
- Nền sáng đảo thang `slate` bằng biến CSS trong `assets/main.css`. Chữ đặt trên nền `slate` phải dùng `text-slate-*`, không dùng `text-white`.
- Nền tùy biến có thể sáng hay tối bất kỳ, nên chữ nằm trực tiếp trên nền phải có lớp nền `bg-slate-800`.
- `getConfig()` gộp với `DEFAULT_CONFIG`: electron-store không điền trường mới vào `config` đã lưu.

### Thêm một lệnh IPC

1. `src/main/ipcHandlers.ts`: đăng ký `ipcMain.handle('kenh', handler)`.
2. `src/preload/index.ts`: thêm hàm vào object `api`, gọi `ipcRenderer.invoke('kenh', ...)`.
3. `src/shared/types.ts`: khai báo hàm trong `WindowApi`.
4. Renderer: gọi `window.api.tenHam()`.

Template còn phơi `window.electron` (gồm `ipcRenderer` thô) cho renderer. Code mới dùng `window.api` với hàm cụ thể, không để renderer tự gửi kênh tùy ý.

### Quy ước

#### Lưu trữ

- Dữ liệu dùng `electron-store`, file `config.json` trong `app.getPath('userData')` (`%APPDATA%\playcurfew`). Thư mục này lấy theo tên app, nên đổi `name` trong `package.json` sẽ làm mất dữ liệu cũ.
- `electron-store` là ESM-only còn main bundle là CJS. Nó phải nằm trong `externalizeDeps.exclude` ở `electron.vite.config.ts` để được bundle; bỏ đi thì `npm run typecheck` vẫn đạt nhưng có thể lỗi lúc chạy.
- Ngày `YYYY-MM-DD` tính theo giờ máy bằng `toDateKey()`, không dùng `toISOString()`.

#### Gọi lệnh Windows

- Dùng `execFile` với mảng tham số, không ghép chuỗi qua shell, và bọc `try/catch`.
- `schtasks` cũng dùng `execFile`: đường dẫn exe có dấu cách, ghép chuỗi qua shell dễ sai dấu ngoặc kép.
- `exeName` phải qua `isValidExeName()`: `taskkill /F /IM "*"` sẽ tắt mọi tiến trình.
- `taskkill /IM` tắt mọi tiến trình cùng tên. Khi test, dùng bản copy của một file exe với tên riêng, không dùng app có thể đang mở dữ liệu chưa lưu.

#### better-sqlite3

Đã cài nhưng chưa dùng, lưu trữ hiện tại là `electron-store`.

- Chỉ import trong main process. Renderer truy cập dữ liệu qua IPC.
- API đồng bộ, nên truy vấn chậm sẽ chặn main process.
- Đặt file DB trong `app.getPath('userData')`, không đặt cạnh app vì thư mục cài có thể chỉ đọc.
- Bản 13 dùng N-API và kèm sẵn `prebuilds/*.node`, cùng một binary chạy được trên cả Node và Electron. Không cần `electron-rebuild`.
- npm báo chặn install script `node-gyp rebuild` của gói này: bỏ qua, không cần `npm install-scripts approve`. `binding.gyp` không compile gì khi đã có prebuild cho máy đang chạy.
- `postinstall` vẫn gọi `electron-builder install-app-deps`. Bước này chỉ để lại thư mục `build/` không chứa `.node`, nên không ảnh hưởng tới binary đang dùng.

#### Tailwind CSS

- Dùng bản 4 qua plugin `@tailwindcss/vite`, không có `tailwind.config`. File vào là `src/renderer/src/assets/main.css`.
- CSS tự viết nên đặt trong `@layer`. Style ngoài layer luôn thắng utility của Tailwind, ví dụ `* { margin: 0 }` sẽ vô hiệu hóa `m-4`.

#### Tài nguyên ngoài

CSP nằm trong `src/renderer/index.html` và chỉ cho phép `'self'`. Muốn nạp script, ảnh hay kết nối ra ngoài thì phải sửa CSP.

### Giá trị mẫu cần thay trước khi phát hành

- `electron-builder.yml`: `publish.url`
