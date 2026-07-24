# Bật hệ thống mã đăng nhập + Gemini ẩn + điểm + thi đua

App EQ GYM giờ hỗ trợ **chế độ thành viên**: người dùng cần **mã đăng nhập do admin cấp**,
Gemini key **dùng chung & ẩn phía server**, mỗi thành viên **tích điểm từ 0**, có **Đảo Thi Đua**
(bảng xếp hạng) giữa các thành viên.

Cần 1 backend (Google Apps Script) — làm 1 lần, ~15 phút. Y hệt cách bạn đã làm cho trang đăng ký.

> Khi `APP_BACKEND` còn trống → app chạy chế độ mở như cũ (không cần mã). Điền URL vào → bật chế độ thành viên.

---

## 1) Lấy Gemini API key (dùng chung cho cả lớp)
1. Vào **https://aistudio.google.com/apikey** → **Create API key** → copy (dạng `AIza...`).
   (Miễn phí; đây là key DUY NHẤT của bạn, sẽ giấu trong server — học viên không thấy.)

## 2) Tạo Apps Script backend
1. Vào **https://script.google.com** → **New project**.
2. Xoá code mẫu, dán **toàn bộ** file `app-backend.gs`.
3. Điền 2 giá trị trong `CONFIG` ở đầu:
   ```js
   var CONFIG = {
     GEMINI_API_KEY: 'AIza...(key bước 1)',
     ADMIN_SECRET:   'DatMotChuoiKhoDoan_Admin2026',  // đây là MÃ ĐĂNG NHẬP ADMIN của bạn
     SHEET_ID:       '',   // để trống -> tự tạo sheet "EQ GYM - Members"
     ...
   };
   ```
   - `ADMIN_SECRET` chính là **mã bạn dùng để đăng nhập với quyền admin** trong app (giữ bí mật).
4. **Ctrl+S**.

## 3) Deploy Web App
1. **Deploy → New deployment** → ⚙ → **Web app**.
2. **Execute as:** `Me` · **Who has access:** `Anyone`.
3. **Deploy** → cấp quyền (Authorize → Advanced → Go to project → Allow).
4. Copy **Web app URL** (`https://script.google.com/macros/s/AKfyc.../exec`).

## 4) Gắn URL vào app
1. Mở `index.html`, tìm dòng:
   ```js
   const APP_BACKEND="";
   ```
2. Dán URL vào giữa hai nháy → commit + push.

> Hoặc gửi URL cho Claude dán + deploy giúp.

---

## Dùng hằng ngày

**Cấp mã cho khách (admin):**
1. Mở app → **Tài khoản** → nhập **ADMIN_SECRET** ở màn đăng nhập → vào với quyền admin.
2. Vào **Tài khoản → 🛡️ Cấp mã học viên** → nhập tên khách → **Tạo mã** → copy mã gửi khách.
   (Mã tự lưu vào Google Sheet "EQ GYM - Members", điểm khởi tạo = 0.)

**Khách dùng:** mở app → nhập mã được cấp → luyện tập. Coach AI bật sẵn (không cần key riêng).
Điểm tích luỹ tự đồng bộ; xem thứ hạng ở tab **🏆 Thi đua**.

## Ghi chú
- Mọi lệnh gọi Gemini đi qua server → **key không bao giờ lộ** trong trình duyệt.
- Chỉ người có mã hợp lệ mới gọi được AI (chống lạm dụng).
- Điểm là nguồn thật ở server (Sheet), chống gian lận cơ bản (server lấy điểm cao nhất).
- Sửa code sau này: **Deploy → Manage deployments → Edit → New version** (giữ nguyên URL).
- Hạn mức: Apps Script ~20.000 lệnh/ngày, đủ cho vài chục–vài trăm học viên. Cần lớn hơn → chuyển Supabase.
