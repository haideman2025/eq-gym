# EQ GYM — Thương mại hóa: Backend, Tài khoản, Khảo sát EQ & Premium

**Ngày:** 2026-07-18
**Trạng thái:** Đã duyệt kiến trúc & lộ trình — chờ review spec để bắt đầu Phase 1

## 1. Mục tiêu

Chuyển EQ GYM từ app tĩnh (single-file `index.html` trên GitHub Pages, lưu localStorage) thành sản phẩm SaaS thương mại:

- Nhiều người dùng đăng ký, dữ liệu lưu **theo tài khoản** (không còn phụ thuộc trình duyệt/thiết bị).
- **Trắc nghiệm khảo sát EQ** ngay khi vào app → nhận điểm EQ.
- Freemium:
  - **Khách**: làm trắc nghiệm → xem điểm tổng cơ bản + học miễn phí **Cảng Xuất Phát (Đảo 0)**.
  - **Tài khoản miễn phí**: nhận **báo cáo EQ chi tiết** (4 trụ + điểm mạnh/yếu + lộ trình), lưu vĩnh viễn.
  - **Premium 999k/năm**: mở khóa 30 đảo học + luyện + AI chấm; cộng đồng EQ GYM; tặng sách EQ Workbook (50 người đầu).

## 2. Quyết định đã chốt

| Vấn đề | Lựa chọn |
|---|---|
| Backend | **Supabase** (Postgres + Auth + RLS + Storage + Edge Functions) |
| Thanh toán | **QR chuyển khoản + duyệt tay** (MVP); nâng cấp PayOS/SePay tự động ở phase sau |
| Bộ đề EQ | **Tự thiết kế**, 24 câu Likert map thẳng 4 trụ cột |
| Triển khai | **Theo giai đoạn**, Phase 1 (MVP) trước |
| Frontend | Giữ app hiện tại, host GitHub Pages; gọi Supabase qua JS SDK từ trình duyệt |

## 3. Kiến trúc

```
[ Frontend tĩnh (app hải trình) ]  --Supabase JS SDK-->  [ Supabase ]
                                                          ├─ Auth (email + Google)
                                                          ├─ Postgres + RLS
                                                          ├─ Storage (ảnh minh chứng CK)
                                                          └─ Edge Functions (proxy Gemini, admin ops)
```

- Frontend không cần server riêng — Supabase gọi thẳng từ browser bằng **anon key** (công khai, an toàn nhờ RLS).
- `service_role` key CHỈ dùng trong Edge Functions (đặt làm secret), không bao giờ lộ ra client.
- Toàn bộ tính năng hiện có (30 đảo, khung 4 trụ, Phòng Tập, Trợ lý AI, Hồ Sơ EQ radar) **giữ nguyên**; chỉ thay lớp lưu trữ localStorage → account và thêm màn khảo sát/đăng nhập/cổng Premium.

## 4. Mô hình dữ liệu (Postgres)

Tất cả bảng bật RLS: user chỉ đọc/ghi bản ghi có `user_id = auth.uid()`; admin có policy riêng đọc `payments`, `book_claims`.

### 4.1 `profiles`
- `id uuid PK` = `auth.users.id`
- `email text`
- `display_name text`
- `premium_until timestamptz null` — Premium còn hạn nếu `> now()`
- `role text default 'user'` — `'user'` | `'admin'`
- `pay_code text` — mã ghi chú CK cố định của user (vd `EQGYM-A1B2`)
- `created_at timestamptz default now()`

### 4.2 `assessments`
- `id uuid PK`
- `user_id uuid null` — null nếu khách vãng lai (lưu tạm client + gắn khi đăng nhập)
- `answers jsonb` — `{ "q1":4, "q2":2, ... }`
- `scores jsonb` — `{ aware, real, choice, empath, total }` (mỗi trụ 0–100)
- `band text` — xếp hạng EQ
- `created_at timestamptz default now()`

### 4.3 `progress` (1 dòng / user)
- `user_id uuid PK`
- `done int[]` · `bounty bigint` · `streak int` · `last_date date` · `graded jsonb` · `scen jsonb`
- `updated_at`

### 4.4 `practices`
- `id uuid PK` · `user_id uuid` · `lesson_n int`
- `scenario text` · `answer text` · `dims jsonb` · `score int` · `feedback text` · `tip text` · `by text`
- `created_at timestamptz default now()`

### 4.5 `chat_messages` (tùy chọn, có thể để phase sau)
- `id` · `user_id` · `role ('user'|'model')` · `text` · `created_at`

### 4.6 `payments`
- `id uuid PK` · `user_id uuid` · `amount int default 999000` · `code text`
- `proof_url text` — ảnh minh chứng trong Storage
- `status text default 'pending'` — `pending` | `approved` | `rejected`
- `note text` · `created_at` · `approved_by uuid null` · `approved_at timestamptz null`

### 4.7 `book_claims` (Phase 3)
- `id` · `user_id` · `full_name` · `phone` · `address` · `seq int` (thứ tự, chốt ≤ 50) · `status` · `created_at`
- Suất sách: đếm `book_claims` đã duyệt; khóa khi đạt 50.

## 5. Phân quyền & gating

| Màn/chức năng | Khách | Free account | Premium |
|---|---|---|---|
| Trắc nghiệm EQ + điểm tổng | ✅ | ✅ | ✅ |
| Báo cáo EQ chi tiết (4 trụ, lộ trình) | ❌ | ✅ | ✅ |
| Đảo 0 — Cảng Xuất Phát | ✅ | ✅ | ✅ |
| Đảo 1–29: học/luyện/AI chấm | ❌ | ❌ (thấy, có khóa + CTA) | ✅ |
| Trợ lý AI đầy đủ | ❌ | giới hạn | ✅ |
| Cộng đồng + Sách | ❌ | ❌ | ✅ (sách: 50 đầu) |

Gating thực thi 2 lớp: (a) UI ẩn/khóa; (b) RLS + kiểm tra `premium_until` phía Edge Function cho các thao tác tốn AI/ghi.

## 6. Luồng thanh toán (MVP duyệt tay)

1. User bấm "Nâng cấp Premium 999k" → app hiện **QR VietQR** (dựng từ số TK + tên + ngân hàng + số tiền + `pay_code`).
2. User chuyển khoản với nội dung = `pay_code`, tải ảnh minh chứng → tạo `payments` (status `pending`).
3. Admin mở **màn Admin** (chỉ role=admin): danh sách pending + ảnh → **Duyệt/Từ chối**.
4. Duyệt → Edge Function set `profiles.premium_until = now() + 1 year`, `payments.status='approved'`; nếu còn suất → tạo `book_claims`.
5. *(Phase sau)* PayOS/SePay webhook tự động đối soát theo `pay_code` → tự kích hoạt, bỏ bước duyệt tay.

## 7. Bộ trắc nghiệm EQ (24 câu, thang Likert 1–5)

Thang: 1 = Hoàn toàn không đúng với tôi … 5 = Hoàn toàn đúng với tôi.
6 câu / trụ. Câu có `(R)` = **đảo điểm** (điểm = 6 − trả lời).

**Trụ A — Nhận thức cảm xúc (aware)**
1. Tôi thường nhận ra chính xác mình đang cảm thấy gì ngay khi cảm xúc xuất hiện.
2. Tôi hiểu điều gì (sự kiện, suy nghĩ) đã kích hoạt cảm xúc của mình.
3. Tôi biết những tình huống dễ khiến mình phản ứng mạnh.
4. Tôi nhận ra các mô thức phản ứng lặp đi lặp lại của bản thân.
5. (R) Tôi thường bị cảm xúc cuốn đi mà không hiểu vì sao.
6. Tôi ý thức rõ giá trị và điều thật sự quan trọng với mình.

**Trụ B — Chân thật & Hiện diện (real)**
7. Tôi dám thừa nhận cả những cảm xúc khó chịu của mình thay vì chối bỏ.
8. Tôi ở lại với cảm xúc thật của mình thay vì lảng tránh (ăn, lướt điện thoại, bận rộn…).
9. (R) Tôi hay giả vờ ổn dù bên trong không ổn.
10. Tôi trung thực với chính mình về điểm yếu và sai lầm.
11. Tôi có thể mô tả trải nghiệm của mình một cách cụ thể, chân thực.
12. (R) Tôi thường tránh nghĩ sâu về những chuyện làm mình tổn thương.

**Trụ C — Làm chủ & Lựa chọn (choice)**
13. Khi tức giận hay lo lắng, tôi có cách làm dịu bản thân trước khi hành động.
14. Tôi chọn cách phản ứng một cách có ý thức thay vì phản xạ theo thói quen.
15. (R) Tôi hay nói/làm điều mình hối tiếc khi cảm xúc dâng cao.
16. Tôi giữ được bình tĩnh dưới áp lực.
17. Khi gặp thất bại, tôi đứng dậy và tìm bước tiếp theo thay vì bỏ cuộc.
18. (R) Cảm xúc thường quyết định thay tôi trong những lúc quan trọng.

**Trụ D — Thấu cảm & Kết nối (empath)**
19. Tôi nhận ra cảm xúc và nhu cầu của người khác qua lời nói, nét mặt, giọng điệu.
20. Tôi lắng nghe để hiểu, thay vì vội đưa lời khuyên hay phán xét.
21. Tôi biết đặt ranh giới mà vẫn tôn trọng người khác.
22. Tôi chủ động sửa chữa khi làm tổn thương ai đó.
23. (R) Tôi khó đặt mình vào vị trí người khác.
24. Tôi áp dụng được hiểu biết về cảm xúc vào các mối quan hệ hằng ngày.

### 7.1 Tính điểm
- Điểm trụ (raw) = tổng 6 câu (câu R đảo trước) → 6..30.
- Chuẩn hóa 0–100: `round((raw − 6) / 24 × 100)`.
- Tổng EQ = trung bình 4 trụ (0–100).
- Xếp hạng (band) theo tổng EQ:
  - 0–39: **Tân Binh Cảm Xúc** — nền tảng EQ đang chờ được rèn.
  - 40–59: **Thủy Thủ Tập Sự** — đã có ý thức, cần luyện đều.
  - 60–79: **Hoa Tiêu Cảm Xúc** — nền EQ tốt, tinh chỉnh để vững.
  - 80–100: **Thuyền Trưởng Cảm Xúc** — EQ mạnh, giữ phong độ & lan tỏa.
- **Miễn phí (khách):** tổng EQ + band + 1 câu tóm tắt.
- **Báo cáo chi tiết (cần đăng nhập free):** điểm 4 trụ + radar, trụ mạnh nhất/yếu nhất, 2–3 gợi ý luyện tập, đề xuất đảo nên bắt đầu theo trụ yếu.

## 8. AI cho bản thương mại

- Chuyển từ "user tự dán Gemini key" sang **Edge Function proxy** dùng key server của chủ app (đặt secret trong Supabase), có **giới hạn tần suất** theo user.
- Chỉ Premium (hoặc quota free giới hạn) mới gọi được proxy; kiểm tra `premium_until` trong function.
- Giữ tùy chọn key cá nhân làm dự phòng/nâng cao.

## 9. Di trú dữ liệu

Khi user đăng nhập lần đầu và máy có dữ liệu localStorage (`eqgym_op_v1`): đọc `S` → đẩy `progress` + `practices` (+ `scen`, `chat`) lên account (một lần, đánh dấu đã migrate). Sau đó account là nguồn sự thật; localStorage chỉ là cache.

## 10. Lộ trình

### Phase 1 — Nền tảng + Khảo sát + Tài khoản (free tier)
- Tạo project Supabase; schema + RLS + Auth (email OTP/password + Google).
- Màn **Trắc nghiệm EQ** (24 câu) + chấm điểm + màn kết quả cơ bản (khách).
- Đăng ký/đăng nhập; **báo cáo EQ chi tiết** gated sau tài khoản free; lưu `assessments`.
- Di trú localStorage → account; đồng bộ `progress`/`practices`.
- Đảo 0 free; Đảo 1–29 hiển thị có khóa + CTA "Nâng cấp Premium".
- Deploy.

### Phase 2 — Premium + Thanh toán + Gating + AI proxy
- `premium_until`; khóa học/luyện/AI sau Premium.
- Luồng QR VietQR + Storage minh chứng + **màn Admin** duyệt.
- Edge Function proxy Gemini (rate-limit theo user).

### Phase 3 — Cộng đồng + Tặng sách
- Link/không gian cộng đồng gated Premium (bắt đầu bằng link nhóm gated — đơn giản nhất).
- `book_claims`: đếm 50 suất, thu địa chỉ, danh sách giao cho admin.

## 11. Phần cần chủ app cung cấp (ngoài phạm vi code)

- **Project Supabase**: Project URL + anon key (công khai) để nhúng; `service_role` giữ bí mật (mình set làm secret function).
- **Thông tin ngân hàng**: số TK, tên chủ TK, ngân hàng (để dựng VietQR).
- Đăng ký merchant (nếu lên PayOS/SePay ở phase sau), pháp lý/thuế/giao sách — chủ app sở hữu.

## 12. Ngoài phạm vi (YAGNI ở MVP)

- Tự động đối soát thanh toán (để Phase sau).
- App di động native (vẫn là web app / PWA).
- Cộng đồng in-app phức tạp (dùng link nhóm trước).
- Gia hạn/hoàn tiền tự động, hóa đơn điện tử (xử lý tay giai đoạn đầu).
