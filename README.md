# PlayCurfew

PlayCurfew là ứng dụng desktop trên Windows giúp bạn tự kiểm soát thời gian chơi game. Ứng dụng đếm số phút chơi mỗi ngày, tự tắt game khi hết giờ hoặc khi đang trong khung giờ học, và làm cho việc nới lỏng các quy tắc đó trở nên khó hơn vào đúng lúc bạn dễ phá lệ nhất.

[![Tải về cho Windows](https://img.shields.io/badge/T%E1%BA%A3i%20v%E1%BB%81%20cho%20Windows-PlayCurfew--Setup.exe-2563eb?style=for-the-badge)](https://github.com/anphuctran2005/playcurfew/releases/latest/download/PlayCurfew-Setup.exe)

## Tính năng

- **Giới hạn giờ chơi mỗi ngày:** đặt riêng cho ngày thường (Thứ 2 - Thứ 6) và cuối tuần (Thứ 7 - CN).
- **Khung giờ Focus:** game trong danh sách sẽ bị tắt nếu mở trong giờ học, kể cả khung giờ vắt qua nửa đêm.
- **Theo dõi tự động:** cứ 5 giây quét tiến trình Windows một lần, cộng giờ chơi và tắt game khi vi phạm.
- **Cảnh báo:** thông báo khi còn 5 phút và 1 phút chơi.
- **Khóa cài đặt:** khi đang chơi, đang trong giờ Focus hoặc đã hết giờ, các thao tác nới lỏng quy tắc bị vô hiệu hóa.
- **Mở khóa khẩn cấp:** phải tự gõ lại một câu cam kết, không dán được, để mở khóa trong 5 phút.
- **Lịch sử:** xem các phiên chơi trong ngày với giờ bắt đầu và thời lượng.

## Yêu cầu

- Windows 10 hoặc Windows 11 (64-bit)
- Node.js 20.19+ hoặc 22.12+ (đã kiểm thử với Node 24) và npm, chỉ cần khi cài từ mã nguồn

## Cài đặt

### Dùng bộ cài

1. Bấm nút **Tải về cho Windows** ở đầu trang.
2. Chạy file `PlayCurfew-Setup.exe` vừa tải. Ứng dụng tự cài và mở lên, đồng thời tạo lối tắt trên Desktop.

Bộ cài chưa được ký số nên Windows có thể hiện cảnh báo SmartScreen. Bấm **More info** rồi **Run anyway** để tiếp tục.

### Cài từ mã nguồn

Tải dependency:

```bash
npm install
```

npm có thể báo chặn install script của `better-sqlite3`. Có thể bỏ qua cảnh báo này.

Chạy ở chế độ phát triển:

```bash
npm run dev
```

Tạo bộ cài cho Windows:

```bash
npm run build:win
```

Bộ cài nằm tại `dist/PlayCurfew-Setup.exe`.

## Hướng dẫn sử dụng

### Tổng quan

Vòng tròn cho biết số phút đã chơi trên giới hạn hôm nay:

| Màu | Ý nghĩa |
| --- | --- |
| Xanh lá | Đã dùng dưới 70% giới hạn |
| Vàng | Đã dùng từ 70% trở lên, hoặc còn dưới 15 phút |
| Đỏ | Đã hết giờ, hoặc đang trong giờ Focus |

Phía dưới là trạng thái hiện tại và bảng lịch sử phiên chơi hôm nay.

### Danh sách game

Có hai cách thêm game:

1. **Nhập tay:** điền tên hiển thị và tên file, ví dụ `masterduel.exe`.
2. **Quét ứng dụng đang mở:** mở game trước, bấm nút quét, chọn cửa sổ của game trong danh sách rồi bấm **Thêm**. Bạn có thể sửa lại tên hiển thị trước khi thêm.

Dùng công tắc để bật hoặc tắt theo dõi từng game.

> **Cẩn thận:** ứng dụng trong danh sách sẽ bị buộc tắt khi vi phạm, dữ liệu chưa lưu sẽ mất. Chỉ thêm game, không thêm trình duyệt, trình soạn thảo hay `explorer.exe`.

### Giới hạn & Focus

- **Giới hạn mỗi ngày:** kéo thanh trượt hoặc nhập số phút, rồi bấm **Lưu cấu hình**.
- **Khung giờ Focus:** nhập nhãn, giờ bắt đầu, giờ kết thúc, chọn các ngày trong tuần rồi bấm **Thêm khung giờ**. Giờ kết thúc nhỏ hơn giờ bắt đầu nghĩa là kết thúc vào hôm sau.

Khung giờ đã tạo có thể bật, tắt, thêm hoặc bớt ngày, và xóa. Để đổi giờ, hãy xóa rồi tạo khung giờ mới.

### Cơ chế khóa

Cài đặt tự khóa khi có một trong ba điều kiện: đang trong giờ Focus, đã hết giờ chơi hôm nay, hoặc đang có game được theo dõi chạy.

| Thao tác | Khi đang khóa |
| --- | --- |
| Thêm game, bật theo dõi | Được phép |
| Tắt theo dõi, xóa game | Bị khóa |
| Giảm giới hạn phút | Được phép |
| Tăng giới hạn phút | Bị khóa |
| Thêm khung giờ Focus, thêm ngày, bật khung giờ | Được phép |
| Tắt, xóa khung giờ Focus, bớt ngày | Bị khóa |

### Mở khóa khẩn cấp

1. Bấm **Mở khóa khẩn cấp** ở thanh bên. Nút này chỉ hiện khi đang khóa.
2. Gõ lại chính xác câu cam kết, gồm cả dấu câu và chữ hoa, chữ thường. Ký tự đúng hiện màu xanh, ký tự sai hiện nền đỏ.
3. Khi câu khớp hoàn toàn, bấm **Xác nhận Mở khóa (5 phút)**.

Thanh bên sẽ hiện đồng hồ đếm ngược. Hết 5 phút, cài đặt tự khóa lại. Mở khóa chỉ cho phép sửa cài đặt: game vẫn bị tắt nếu đang trong giờ Focus hoặc đã hết giờ.

## Dữ liệu

Toàn bộ dữ liệu lưu trên máy tại `%APPDATA%\playcurfew\config.json`, không gửi đi đâu. Số giờ chơi tự đặt lại khi sang ngày mới.

## Hạn chế hiện tại

- **Đóng cửa sổ là dừng theo dõi.** Chưa có chế độ chạy ngầm ở khay hệ thống, nên ứng dụng phải mở thì mới đếm giờ và tắt game.
- **Chưa khởi động cùng Windows.** Tùy chọn `launchAtStartup` có trong cấu hình nhưng chưa có tác dụng.
- **Khóa nằm ở giao diện.** Sửa trực tiếp `config.json` vẫn thay đổi được cài đặt. PlayCurfew là công cụ hỗ trợ kỷ luật, không phải biện pháp chống phá.
- **Game chạy quyền Administrator** có thể không tắt được nếu PlayCurfew chạy với quyền thường.

## Dành cho nhà phát triển

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy ứng dụng với HMR |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run lint` | Chạy ESLint |
| `npm run build` | Typecheck rồi bundle vào `out/` |
| `npm run build:unpack` | Đóng gói không cài đặt vào `dist/win-unpacked/` |
| `npm run build:win` | Tạo bộ cài Windows |

Mã nguồn gồm ba tầng trong `src/`, cùng phần kiểu dữ liệu dùng chung:

| Thư mục | Vai trò |
| --- | --- |
| `src/main/` | Quét tiến trình, đếm giờ, tắt game, lưu dữ liệu, xử lý IPC |
| `src/preload/` | Cầu nối `window.api` giữa main và renderer |
| `src/renderer/` | Giao diện React, Tailwind CSS |
| `src/shared/` | Kiểu dữ liệu dùng chung |

Đặc tả dữ liệu nằm trong [SPEC.md](SPEC.md), quy ước phát triển nằm trong [CLAUDE.md](CLAUDE.md).
