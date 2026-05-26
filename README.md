# Sổ Thu Chi Mobile

App React Native chạy trên Expo SDK 54, dựng lại từ bộ giao diện premium dark mode trong workspace này.

## Tính năng

- Tổng quan số dư, thu nhập, chi tiêu
- Lịch giao dịch theo ngày
- Thêm, sửa, xóa giao dịch
- Báo cáo theo tháng và theo danh mục
- Quản lý danh mục thu/chi
- Đồng bộ avatar/header/theme giữa các màn
- Khóa ứng dụng bằng mã PIN 4 số mỗi lần mở lại app
- Nhập và xuất dữ liệu CSV
- Đính kèm ảnh hóa đơn từ thư viện ảnh

## Chạy trên Expo Go

Yêu cầu:

- Expo Go client `54.0.8`
- Node.js 20+ hoặc mới hơn

Lệnh:

```bash
npm install
npm start
```

Sau đó quét QR bằng Expo Go trên điện thoại.

## Kiểm tra

```bash
npm run typecheck
npx expo-doctor
```
