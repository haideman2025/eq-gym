# Đồng bộ video khóa học từ Google Drive

App tự đọc thư mục Drive công khai, khớp **tên file → số buổi**, và phát bằng player Google Drive. Thả video mới vào folder là app tự cập nhật — không cần sửa code.

---

## Bước 1 — Đặt tên video theo số buổi
Trong folder Drive, đặt tên file chứa **số buổi** (0–29). App tự nhận diện các dạng:
- `0.mp4`, `17.mp4`, `29.mp4`
- `buoi 3.mp4`, `Buổi 17.mp4`, `bai5.mp4`
- (Ưu tiên chữ "buổi/bài + số"; nếu không có thì lấy số 1–2 chữ số trong tên.)

> Mỗi buổi 1 video. Nếu 1 folder chứa nhiều buổi (vd 0,17–29) thì mỗi file cứ có số buổi tương ứng là được.

## Bước 2 — Chia sẻ folder công khai
Với **mỗi** folder chứa video:
1. Chuột phải folder → **Chia sẻ** (Share)
2. Ở "Quyền truy cập chung" → chọn **Bất kỳ ai có đường liên kết** (Anyone with the link)
3. Vai trò: **Người xem** (Viewer) → **Xong**

> ⚠️ Video công khai = ai có link đều xem được (giống YouTube unlisted). Nội dung Premium sẽ không được bảo vệ tuyệt đối. Chấp nhận được để bắt đầu; muốn khóa chặt cần nền tảng video chuyên dụng.

## Bước 3 — Tạo Google API key (làm 1 lần, ~5 phút)
1. Vào **https://console.cloud.google.com/** → đăng nhập.
2. Trên cùng, tạo **New Project** (tên gì cũng được, vd "EQ GYM") → chọn project đó.
3. Menu trái → **APIs & Services → Library** → tìm **Google Drive API** → **Enable**.
4. **APIs & Services → Credentials → + Create credentials → API key**. Copy key (dạng `AIza...`).
5. Bấm vào key vừa tạo để **giới hạn** (quan trọng — chống người khác lạm dụng):
   - **Application restrictions** → **Websites** (HTTP referrers) → **Add**:
     - `https://haideman2025.github.io/*`
     - (và domain riêng nếu có, vd `https://eqgym.vn/*`)
   - **API restrictions** → **Restrict key** → chọn **Google Drive API** → **Save**.

> Key này nằm trong code client (công khai được) nhưng đã bị khóa chỉ chạy từ domain app của bạn + chỉ đọc Drive → an toàn.

## Bước 4 — Dán vào app
Mở `index.html`, tìm đầu phần `<script>`:
```js
const GDRIVE_API_KEY="";
const GDRIVE_FOLDERS=[];
```
Điền:
```js
const GDRIVE_API_KEY="AIza...";            // key vừa tạo
const GDRIVE_FOLDERS=[
  "1PAShczXIvE24i3w6PBCTwpCK0SiuY7_p",     // folder buổi 0,17-29
  "<ID_FOLDER_BUOI_1_16>"                   // thêm folder khác nếu có
];
```
> Lấy ID folder từ link: `drive.google.com/drive/folders/<ID>` → phần `<ID>`.

Save → commit & push (GitHub Pages tự deploy). Mở app: video hiện ngay trong bước Giới thiệu mỗi buổi.

---

## Cách hoạt động
- Khi mở app, nó gọi Drive API liệt kê video trong các folder → map `số buổi → file ID` → lưu cache (`eqgym_gdvideos`) → phát bằng `drive.google.com/file/d/<ID>/preview`.
- **Thêm/đổi video**: chỉ cần thả file (tên có số buổi) vào folder đã công khai → lần mở app sau tự cập nhật. Không đụng code.
- Thứ tự ưu tiên nguồn video mỗi buổi: **YouTube (`yt`)** → **Drive ID cố định (`gd`)** → **Drive auto-sync** → **mp4 nội bộ** → placeholder.

## Kiểm tra nhanh
- [ ] Chưa cấu hình → app chạy như thường (buổi chưa có video hiện placeholder).
- [ ] Điền key + folder → mở buổi có video trong folder → thấy player Drive phát được.
- [ ] Trang chủ: buổi có video hiện tag **▶ VIDEO**.
- [ ] Console không có lỗi 403 (nếu 403 → kiểm tra Drive API đã Enable + referrer đúng domain + folder đã public).

## Lưu ý về tải cao
Google Drive không phải CDN video. Khi **rất đông người xem cùng lúc**, Drive có thể tạm chặn ("can't view at this time"). Nếu app có nhiều học viên, cân nhắc chuyển sang **YouTube (unlisted)** — chỉ cần điền link vào trường `yt` trong `VIDEO_MAP`, app ưu tiên YouTube trước Drive.
