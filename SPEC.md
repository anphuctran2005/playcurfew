# SPEC.md - Đặc tả kỹ thuật ứng dụng kiểm soát giờ chơi game (GameGuard)

## 1. Mục tiêu hệ thống

Ứng dụng chạy ngầm trên Windows 11 giúp kiểm soát thời gian chơi game mỗi ngày và khóa hoàn toàn việc mở game trong khung giờ học tập cố định (Focus Mode).

---

## 2. Cấu trúc dữ liệu (Data Schema)

Tạo file `src/shared/types.ts` và lưu trữ bằng `electron-store` với cấu trúc sau:

```typescript
export interface GameItem {
  id: string;
  name: string; // Tên hiển thị (VD: "Yu-Gi-Oh! Master Duel", "Delta Force")
  exeName: string; // Tên file thực thi (VD: "masterduel.exe", "DeltaForceClient-Win64-Shipping.exe")
  isActive: boolean; // Có đang bật theo dõi hay không
}

export interface FocusSchedule {
  id: string;
  label: string; // VD: "Giờ học buổi tối"
  startTime: string; // Định dạng "HH:mm" (VD: "19:30")
  endTime: string; // Định dạng "HH:mm" (VD: "22:00")
  daysOfWeek: number[]; // 0 (Chủ nhật) -> 6 (Thứ bảy)
  isEnabled: boolean;
}

export interface AppConfig {
  weekdayLimitMinutes: number; // Giới hạn phút chơi từ Thứ 2 - Thứ 6 (Mặc định: 60)
  weekendLimitMinutes: number; // Giới hạn phút chơi Thứ 7 - CN (Mặc định: 120)
  warningMinutesLeft: number[]; // Mốc cảnh báo trước khi tắt (Mặc định: [5, 1])
  commitmentPhrase: string; // Câu văn bản bắt buộc gõ khi muốn mở khóa khẩn cấp
  launchAtStartup: boolean; // Khởi động cùng Windows
}

export interface DailyUsage {
  date: string; // Định dạng "YYYY-MM-DD"
  usedSeconds: number; // Tổng số giây đã chơi trong ngày
  sessions: {
    gameName: string;
    exeName: string;
    startTime: string;
    durationSeconds: number;
  }[];
}
```
