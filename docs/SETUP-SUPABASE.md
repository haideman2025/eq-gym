# Hướng dẫn bật Backend (Supabase) cho EQ GYM

App vẫn chạy bình thường ở **chế độ local** khi chưa cấu hình. Làm 5 bước dưới đây để bật **tài khoản, đồng bộ dữ liệu, và khóa Premium**.

---

## Bước 1 — Tạo project Supabase (miễn phí)

1. Vào **https://supabase.com** → đăng nhập (bằng GitHub cũng được) → **New project**.
2. Đặt tên (vd `eq-gym`), chọn region gần VN (Singapore), đặt **Database Password** (lưu lại).
3. Đợi ~1–2 phút cho project khởi tạo xong.

## Bước 2 — Tạo bảng + bảo mật (RLS)

1. Trong project, mở **SQL Editor** (menu trái) → **New query**.
2. Mở file `supabase/schema.sql` trong repo này, **copy toàn bộ** dán vào → bấm **Run**.
3. Thấy "Success" là xong — đã tạo các bảng `profiles, assessments, progress, practices, payments, book_claims` + RLS + trigger.

## Bước 3 — Bật đăng nhập

1. Menu trái → **Authentication** → **Providers**.
2. **Email**: bật (mặc định đã bật). Dùng magic link — người dùng nhập email, nhận link đăng nhập.
   - (Tuỳ chọn) Tắt "Confirm email" nếu muốn đăng nhập nhanh hơn khi test.
3. **Google** (tuỳ chọn, khuyến nghị): bật provider Google, dán Client ID/Secret (tạo ở Google Cloud Console → OAuth). Bỏ qua được nếu chỉ dùng email.
4. Menu **Authentication → URL Configuration**: thêm URL app của bạn vào **Redirect URLs**, ví dụ:
   - `https://haideman2025.github.io/eq-gym/`
   - (và URL domain riêng nếu có)

## Bước 4 — Lấy khóa & dán vào app

1. Menu trái → **Project Settings → API**.
2. Copy 2 giá trị:
   - **Project URL** (dạng `https://xxxx.supabase.co`)
   - **anon public** key (dạng `eyJ...`) — key này **công khai được**, an toàn nhờ RLS.
3. Mở `index.html`, tìm đầu phần `<script>`:
   ```js
   const SUPA_URL="";   // ← dán Project URL
   const SUPA_ANON="";  // ← dán anon public key
   ```
   Dán 2 giá trị vào giữa dấu ngoặc kép → **Save** → commit & push (GitHub Pages tự deploy).
4. Mở app: giờ nút **Tài khoản** cho đăng ký/đăng nhập; dữ liệu đồng bộ theo tài khoản; Đảo 1–29 khóa Premium.

> ⚠️ KHÔNG dán key **service_role** vào `index.html`. Key đó chỉ dùng ở Edge Function (đặt làm Secret), không bao giờ để lộ ra client.

## Bước 5 — Đặt bạn làm Admin (để duyệt thanh toán)

1. Đăng nhập app 1 lần bằng email của bạn (để tạo dòng trong `profiles`).
2. Vào Supabase → **SQL Editor** → chạy (thay email của bạn):
   ```sql
   update public.profiles set role = 'admin' where email = 'ban@email.com';
   ```
3. Mở lại app → **Tài khoản** → sẽ thấy nút **🛡️ Trang Admin duyệt thanh toán**.

---

## Bật thanh toán QR (Premium 999k)

1. Mở `index.html`, tìm:
   ```js
   const BANK={ bank_code:"", account_no:"", account_name:"" };
   ```
2. Điền thông tin tài khoản ngân hàng của bạn, ví dụ:
   ```js
   const BANK={ bank_code:"VCB", account_no:"0011000123456", account_name:"NGUYEN VAN A" };
   ```
   - `bank_code` theo chuẩn VietQR (VCB, TCB, MB, ACB, BIDV, VPB…). Xem danh sách tại https://www.vietqr.io/danh-sach-api/link-tao-ma-qr/.
3. Push → app hiện **mã QR VietQR** đúng số tiền + nội dung `EQGYM-xxxx` cho từng user.

**Luồng duyệt tay:**
- User bấm *Nâng cấp* → chuyển khoản theo QR (nội dung = mã của họ) → bấm *"Tôi đã chuyển khoản"* → tạo yêu cầu `pending`.
- Bạn (admin) mở **Trang Admin** → thấy danh sách → **Duyệt** → app tự set Premium +1 năm cho user đó.

*(Nâng cấp tương lai: tích hợp PayOS/SePay webhook để tự động kích hoạt, khỏi duyệt tay — sẽ bổ sung khi cần.)*

---

## AI dùng key chung của bạn (tuỳ chọn, Phase 2+)

Hiện tại AI chấm điểm dùng **key Gemini cá nhân** người dùng tự dán ở mục Tài khoản (miễn phí, không tốn của bạn). Nếu muốn Premium dùng AI mà không cần key riêng, sẽ tạo **Edge Function proxy** giữ key của bạn làm Secret + giới hạn tần suất. Bước này làm sau khi cần.

---

## Kiểm tra nhanh

- [ ] Chưa cấu hình → app chạy local, mọi thứ mở khóa (đúng như trước).
- [ ] Đã cấu hình → có nút Tài khoản, đăng nhập được, làm quiz xong báo cáo chi tiết cần đăng nhập.
- [ ] Đảo 1–29 khóa 🔒 với tài khoản chưa Premium, bấm vào hiện bảng nâng cấp.
- [ ] Admin duyệt payment → user thành Premium, mở khóa toàn bộ đảo.
