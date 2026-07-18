# 🏴‍☠️ EQ GYM — Hải Trình Cảm Xúc

App học tập 30 ngày luyện EQ theo phong cách hải trình One Piece: chinh phục đảo, tăng tiền truy nã Berry, thăng cấp từ Tân Binh đến Vua Hải Tặc EQ. Có video bài học, thực hành mỗi ngày và AI (Gemini) chấm điểm.

## 🚀 Deploy lên GitHub Pages (5 phút, không cần code)

1. Vào **github.com** → đăng nhập → bấm **New repository**
   - Repository name: `eq-gym` (tên gì cũng được)
   - Chọn **Public** → **Create repository**
2. Trong repo mới, bấm **uploading an existing file** (hoặc **Add file → Upload files**)
   - Kéo thả file **`index.html`** (và thư mục `videos/` nếu dùng MP4) vào
   - Bấm **Commit changes**
3. Vào **Settings → Pages** (menu bên trái)
   - Source: **Deploy from a branch**
   - Branch: **main** / thư mục **/ (root)** → **Save**
4. Đợi ~1 phút → app chạy tại: `https://<tên-github-của-bạn>.github.io/eq-gym/`

Mở link đó trên điện thoại → **Chia sẻ → Thêm vào màn hình chính** là dùng như app thật.

## 🎬 Gắn video cho từng bài

Mở `index.html`, tìm dòng `const VIDEO_MAP` (ngay đầu phần script). Mỗi bài 1 dòng:

```js
0:{yt:"https://youtu.be/xxxx", mp4:""},   // dán link YouTube
2:{yt:"", mp4:"videos/bai2.mp4"},          // hoặc file MP4 tự host
```

- **YouTube**: dán link dạng nào cũng được (youtu.be, watch?v=, shorts...)
- **MP4**: upload file vào thư mục `videos/` trong repo rồi ghi đường dẫn
  (lưu ý GitHub giới hạn file 100MB — video dài nên dùng YouTube)
- Để trống → app hiện placeholder "Video đang cập nhật"

## 🤖 Bật AI chấm điểm (Gemini — miễn phí)

1. Vào **aistudio.google.com/apikey** → **Create API key** (tài khoản Google thường là được)
2. Trong app, bấm nút **⚙️** → dán key → **Lưu**
3. Làm bài thực hành → bấm **"⚔️ Nộp bài cho Thuyền Trưởng AI"** → nhận điểm + nhận xét + Berry

Không có key vẫn dùng được — app tự chấm offline (thuật toán độ sâu cảm xúc).
Key chỉ lưu trong trình duyệt của người học, không gửi đi đâu ngoài Google.

## 💰 Hệ thống game

| Hành động | Thưởng |
|---|---|
| Chinh phục 1 đảo (hoàn thành bài) | +10.000.000 Berry |
| Nộp bài thực hành lần đầu | +5.000.000 Berry |
| Điểm AI | +100.000 Berry × điểm |
| Hoàn thành module | Huy hiệu 🧭 ⚔️ 👑 |
| Đủ 30 đảo | Danh hiệu **Vua Hải Tặc EQ** ☠️ |

Cấp bậc: Tân Binh Boong Tàu → Thuyền Viên → Hoa Tiêu → Thuyền Phó → Thuyền Trưởng → Tứ Hoàng Cảm Xúc → Vua Hải Tặc EQ

Tiến độ + nhật ký lưu tự động trên máy người học (localStorage), không cần server.
