/**
 * EQ GYM 03 — Backend cho trang đăng ký (Google Apps Script Web App)
 * Nhận đăng ký + ảnh bằng chứng CK từ dangky/index.html
 *   → lưu Google Sheet + Google Drive (bằng chứng CK)
 *   → gửi thông báo về nhóm Telegram
 *
 * CÁCH DÙNG (chi tiết ở SETUP-BACKEND.md):
 *   1) script.google.com → New project → dán toàn bộ file này.
 *   2) Điền 4 giá trị trong CONFIG bên dưới.
 *   3) Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      → copy URL, dán vào biến BACKEND trong dangky/index.html.
 */

var CONFIG = {
  TELEGRAM_BOT_TOKEN: '',   // token từ @BotFather, dạng "123456789:AA...."
  TELEGRAM_CHAT_ID:   '',   // id nhóm Telegram, dạng "-1001234567890" (xem hướng dẫn)
  DRIVE_FOLDER_ID:    '',   // id thư mục Drive lưu ảnh bằng chứng CK (lấy từ URL thư mục)
  SHEET_ID:           ''    // id Google Sheet log đăng ký (tạo sheet trống, lấy id từ URL)
};

function doPost(e) {
  var out = { ok: false };
  try {
    var d = JSON.parse(e.postData.contents);
    out = (d.type === 'proof') ? handleProof(d) : handleLead(d);
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('EQ GYM 03 landing backend — OK');
}

/* ===== Đăng ký mới ===== */
function handleLead(d) {
  logRow(['ĐĂNG KÝ', now(), d.name || '', d.phone || '', d.doituong || '', d.addr || '', '']);
  tgText(
    '🟢 <b>ĐĂNG KÝ MỚI — EQ GYM 03</b>\n' +
    '👤 ' + esc(d.name) + '\n' +
    '📞 ' + esc(d.phone) + '\n' +
    '🎯 ' + esc(d.doituong) + '\n' +
    '📦 ' + esc(d.addr) + '\n' +
    '🕒 ' + now()
  );
  return { ok: true };
}

/* ===== Bằng chứng chuyển khoản ===== */
function handleProof(d) {
  var link = '';
  if (d.image && CONFIG.DRIVE_FOLDER_ID) {
    var parts = String(d.image).split(',');
    var meta = parts[0] || '';
    var b64 = parts.length > 1 ? parts[1] : parts[0];
    var mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
    var ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
    var bytes = Utilities.base64Decode(b64);
    var fname = 'CK_' + String(d.phone || 'na').replace(/\D/g, '') + '_' + stamp() + '.' + ext;
    var blob = Utilities.newBlob(bytes, mime, fname);
    var file = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID).createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    link = file.getUrl();
    logRow(['BẰNG CHỨNG CK', now(), d.name || '', d.phone || '', '', '', link]);
    tgPhoto(blob,
      '💸 <b>BẰNG CHỨNG CHUYỂN KHOẢN</b>\n' +
      '👤 ' + esc(d.name) + '\n' +
      '📞 ' + esc(d.phone) + '\n' +
      '📝 ' + esc(d.ck) + '\n' +
      '🔗 ' + link
    );
  } else {
    tgText('💸 Khách báo đã CK (không kèm ảnh)\n👤 ' + esc(d.name) + '\n📞 ' + esc(d.phone));
  }
  return { ok: true, link: link };
}

/* ===== Google Sheet ===== */
function logRow(row) {
  if (!CONFIG.SHEET_ID) return;
  try {
    var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Loại', 'Thời gian', 'Họ tên', 'SĐT', 'Đối tượng', 'Địa chỉ', 'Link bằng chứng']);
    }
    sh.appendRow(row);
  } catch (e) {}
}

/* ===== Telegram ===== */
function tgText(text) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'post',
      payload: { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: 'true' },
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function tgPhoto(blob, caption) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendPhoto', {
      method: 'post',
      payload: { chat_id: CONFIG.TELEGRAM_CHAT_ID, caption: caption, parse_mode: 'HTML', photo: blob },
      muteHttpExceptions: true
    });
  } catch (e) { tgText(caption); }
}

/* ===== Helpers ===== */
function now()   { return Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm'); }
function stamp() { return Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss'); }
function esc(s)  { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
