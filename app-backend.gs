/**
 * EQ GYM — Backend HỢP NHẤT (Google Apps Script Web App)
 * Một backend lo tất cả:
 *   • Đăng ký từ landing + upload bằng chứng CK -> TỰ TẠO MÃ học viên + báo Telegram + lưu Drive
 *   • Đăng nhập bằng mã · proxy Gemini (ẩn key dùng chung) · tích điểm · Đảo Thi Đua
 *   • Admin: quản trị TOÀN BỘ tài khoản (khoá/mở/xoá/reset) + NHẬT KÝ hoạt động
 *
 * TRIỂN KHAI: script.google.com -> dán file này -> điền CONFIG -> Deploy Web app
 *   (Execute as: Me, Access: Anyone). Dán URL vào APP_BACKEND (index.html) + BACKEND (dangky/index.html).
 *   Sửa sau: Deploy -> Manage deployments -> Edit -> New version (GIỮ URL).
 */

var CONFIG = {
  GEMINI_API_KEY:     '',   // key Gemini dùng chung (ẩn) — "AIza..."
  ADMIN_SECRET:       '',   // mã đăng nhập admin — chuỗi khó đoán
  TELEGRAM_BOT_TOKEN: '',   // báo Telegram (từ @BotFather)
  TELEGRAM_CHAT_ID:   '',   // id nhóm Telegram (số âm)
  DRIVE_FOLDER_ID:    '',   // thư mục Drive lưu ảnh CK — trống = tự tạo
  SHEET_ID:           '',   // Google Sheet dữ liệu — trống = tự tạo
  GEMINI_MODEL:       'gemini-2.0-flash'
};

var MEMBERS = 'Members';
var ACTIVITY = 'Activity';
var FOLDER_NAME = 'EQ GYM - Bang chung CK';
var SHEET_NAME = 'EQ GYM - He thong';
var M_HEAD = ['Mã', 'Tên', 'SĐT', 'Điểm', 'Vai trò', 'Trạng thái', 'Tạo lúc', 'HĐ gần nhất', 'Địa chỉ', 'Link CK'];
var A_HEAD = ['Thời gian', 'Mã', 'Tên', 'Sự kiện', 'Chi tiết'];
var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function doPost(e) {
  var out;
  try {
    var d = JSON.parse(e.postData.contents);
    var a = d.action || d.type;
    switch (a) {
      case 'login':        out = apiLogin(d); break;
      case 'ai':           out = apiAI(d); break;
      case 'sync':         out = apiSync(d); break;
      case 'event':        out = apiEvent(d); break;
      case 'leaderboard':  out = apiLeaderboard(d); break;
      case 'lead':         out = apiLead(d); break;
      case 'proof':        out = apiProof(d); break;
      case 'createCode':   out = apiCreateCode(d); break;
      case 'listMembers':  out = apiListMembers(d); break;
      case 'setStatus':    out = apiSetStatus(d); break;
      case 'deleteMember': out = apiDeleteMember(d); break;
      case 'resetPoints':  out = apiResetPoints(d); break;
      case 'activity':     out = apiActivity(d); break;
      default:             out = { ok: false, error: 'action?' };
    }
  } catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return ContentService.createTextOutput('EQ GYM backend hợp nhất — OK'); }

/* ================= THÀNH VIÊN / APP ================= */
function apiLogin(d) {
  var code = norm(d.code);
  if (!code) return { ok: false, error: 'Thiếu mã' };
  if (isAdminCode(code)) { logAct(code, 'Admin', 'login', ''); return { ok: true, role: 'admin', name: 'Quản trị viên', points: 0 }; }
  var m = findByCode(code);
  if (!m) return { ok: false, error: 'Mã không đúng hoặc chưa được cấp' };
  if (m.status === 'blocked') return { ok: false, error: 'Tài khoản đã bị tạm khoá. Liên hệ admin.' };
  touch(m.row); logAct(code, m.name, 'login', '');
  return { ok: true, role: 'member', name: m.name, points: m.points };
}
function apiAI(d) {
  if (!authorized(d.code)) return { ok: false, error: 'unauthorized' };
  if (!CONFIG.GEMINI_API_KEY) return { ok: false, error: 'Server chưa cấu hình Gemini key' };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(CONFIG.GEMINI_API_KEY);
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(d.body || {}), muteHttpExceptions: true });
  var json; try { json = JSON.parse(res.getContentText()); } catch (e) { json = { error: 'bad gemini response' }; }
  return { ok: true, gemini: json };
}
function apiSync(d) {
  var m = findByCode(d.code); if (!m) return { ok: false, error: 'unauthorized' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) {}
  try {
    var pts = Math.max(m.points, Math.floor(Number(d.points) || 0));
    sh(MEMBERS).getRange(m.row, 4).setValue(pts);
    sh(MEMBERS).getRange(m.row, 8).setValue(now());
    return { ok: true, points: pts };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function apiEvent(d) {
  var m = findByCode(d.code); if (!m) return { ok: false };
  logAct(m.code, m.name, String(d.event || 'event'), String(d.detail || ''));
  return { ok: true };
}
function apiLeaderboard(d) {
  if (!authorized(d.code)) return { ok: false, error: 'unauthorized' };
  var rows = members().filter(function (r) { return r.status !== 'blocked'; });
  rows.sort(function (a, b) { return b.points - a.points; });
  var top = rows.slice(0, 50).map(function (r, i) { return { rank: i + 1, name: r.name, points: r.points }; });
  var me = null, code = norm(d.code);
  for (var i = 0; i < rows.length; i++) if (rows[i].code === code) { me = { rank: i + 1, name: rows[i].name, points: rows[i].points }; break; }
  return { ok: true, top: top, me: me, total: rows.length };
}

/* ================= ĐĂNG KÝ TỪ LANDING ================= */
function apiLead(d) {
  tg('🟢 <b>ĐĂNG KÝ MỚI — EQ GYM</b>\n👤 ' + esc(d.name) + '\n📞 ' + esc(d.phone) + '\n🎯 ' + esc(d.doituong) + '\n📦 ' + esc(d.addr) + '\n🕒 ' + now());
  logAct('', d.name || '', 'register', (d.phone || '') + ' · ' + (d.doituong || ''));
  return { ok: true };
}
function apiProof(d) {
  var phone = String(d.phone || '').replace(/\D/g, '');
  var link = '';
  if (d.image) {
    try {
      var parts = String(d.image).split(','), meta = parts[0] || '', b64 = parts.length > 1 ? parts[1] : parts[0];
      var mime = (meta.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
      var ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
      var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, 'CK_' + phone + '_' + stamp() + '.' + ext);
      var file = folder().createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      link = file.getUrl();
    } catch (e) {}
  }
  // tạo hoặc lấy mã theo SĐT (chống trùng khi upload nhiều lần)
  var lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) {}
  var m, created = false;
  try {
    m = findByPhone(phone);
    if (!m) {
      var code; do { code = genCode(); } while (findByCode(code));
      sh(MEMBERS).appendRow([code, d.name || '', "'" + phone, 0, 'member', 'active', now(), '', d.addr || '', link]);
      m = { code: code, name: d.name || '' }; created = true;
      logAct(code, d.name || '', 'code-issued', 'Tự cấp sau khi upload CK');
    } else if (link) {
      sh(MEMBERS).getRange(m.row, 10).setValue(link);
    }
  } finally { try { lock.releaseLock(); } catch (e) {} }
  var cap = (created ? '🆕 ' : '🔁 ') + '<b>BẰNG CHỨNG CK + MÃ HỌC VIÊN</b>\n👤 ' + esc(d.name) + '\n📞 ' + esc(d.phone) +
            '\n🔑 <b>' + esc(m.code) + '</b>' + (link ? '\n🔗 ' + link : '');
  if (d.image && link) tgPhotoUrl(link, cap); else tg(cap);
  return { ok: true, code: m.code, name: m.name, created: created };
}

/* ================= ADMIN ================= */
function apiCreateCode(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var name = String(d.name || '').trim(); if (!name) return { ok: false, error: 'Thiếu tên' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) {}
  try {
    var code; do { code = genCode(); } while (findByCode(code));
    sh(MEMBERS).appendRow([code, name, "'" + String(d.phone || '').replace(/\D/g, ''), 0, 'member', 'active', now(), '', d.addr || '', '']);
    logAct(code, name, 'code-issued', 'Admin tạo tay');
    return { ok: true, code: code, name: name };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function apiListMembers(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var rows = members(); rows.sort(function (a, b) { return b.points - a.points; });
  return { ok: true, members: rows.map(function (r) { return { code: r.code, name: r.name, phone: r.phone, points: r.points, status: r.status, created: r.created, last: r.last }; }) };
}
function apiSetStatus(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var m = findByCode(d.code); if (!m) return { ok: false, error: 'Không thấy mã' };
  sh(MEMBERS).getRange(m.row, 6).setValue(d.status === 'blocked' ? 'blocked' : 'active');
  logAct(m.code, m.name, d.status === 'blocked' ? 'blocked' : 'unblocked', 'bởi admin');
  return { ok: true };
}
function apiDeleteMember(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var m = findByCode(d.code); if (!m) return { ok: false, error: 'Không thấy mã' };
  sh(MEMBERS).deleteRow(m.row);
  logAct(m.code, m.name, 'deleted', 'bởi admin');
  return { ok: true };
}
function apiResetPoints(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var m = findByCode(d.code); if (!m) return { ok: false, error: 'Không thấy mã' };
  sh(MEMBERS).getRange(m.row, 4).setValue(0);
  logAct(m.code, m.name, 'reset-points', 'bởi admin');
  return { ok: true };
}
function apiActivity(d) {
  if (!isAdmin(d.admin)) return { ok: false, error: 'Chỉ admin' };
  var s = sh(ACTIVITY), last = s.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  var lim = Math.min(120, last - 1);
  var vals = s.getRange(last - lim + 1, 1, lim, 5).getValues();
  var items = vals.map(function (v) { return { time: v[0], code: v[1], name: v[2], event: v[3], detail: v[4] }; }).reverse();
  return { ok: true, items: items };
}

/* ================= SHEET / DRIVE / TELEGRAM ================= */
function ss() {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.SHEET_ID || props.getProperty('SYS_SHEET_ID'), s;
  if (id) { try { s = SpreadsheetApp.openById(id); } catch (e) {} }
  if (!s) { s = SpreadsheetApp.create(SHEET_NAME); props.setProperty('SYS_SHEET_ID', s.getId()); }
  return s;
}
function sh(name) {
  var s = ss(), t = s.getSheetByName(name);
  if (!t) { t = s.getSheets()[0].getLastRow() === 0 && s.getSheets()[0].getLastColumn() <= 1 ? s.getSheets()[0].setName(name) || s.getSheetByName(name) : s.insertSheet(name); }
  var head = name === MEMBERS ? M_HEAD : A_HEAD;
  var first = t.getRange(1, 1, 1, head.length).getValues()[0];
  if (String(first[0]) !== head[0]) t.getRange(1, 1, 1, head.length).setValues([head]);
  if (name === MEMBERS) t.getRange('C:C').setNumberFormat('@');
  return t;
}
function members() {
  var t = sh(MEMBERS), last = t.getLastRow(); if (last < 2) return [];
  var v = t.getRange(2, 1, last - 1, 10).getValues(), out = [];
  for (var i = 0; i < v.length; i++) { if (!v[i][0]) continue;
    out.push({ row: i + 2, code: norm(v[i][0]), name: v[i][1], phone: String(v[i][2] || '').replace(/^'/, ''), points: Math.floor(Number(v[i][3]) || 0), role: v[i][4], status: v[i][5] || 'active', created: v[i][6], last: v[i][7] }); }
  return out;
}
function findByCode(c) { c = norm(c); if (!c) return null; var a = members(); for (var i = 0; i < a.length; i++) if (a[i].code === c) return a[i]; return null; }
function findByPhone(p) { p = String(p || '').replace(/\D/g, ''); if (!p) return null; var a = members(); for (var i = 0; i < a.length; i++) if (a[i].phone.replace(/\D/g, '') === p) return a[i]; return null; }
function isAdmin(c) { return !!CONFIG.ADMIN_SECRET && norm(c) === norm(CONFIG.ADMIN_SECRET); }
function isAdminCode(c) { return isAdmin(c); }
function authorized(c) { if (isAdmin(c)) return true; var m = findByCode(c); return !!(m && m.status !== 'blocked'); }
function touch(row) { try { sh(MEMBERS).getRange(row, 8).setValue(now()); } catch (e) {} }
function logAct(code, name, event, detail) { try { sh(ACTIVITY).appendRow([now(), code || '', name || '', event, detail || '']); } catch (e) {} }
function folder() {
  var props = PropertiesService.getScriptProperties(), id = CONFIG.DRIVE_FOLDER_ID || props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(FOLDER_NAME), f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId()); return f;
}
function tg(text) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  try { UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'post', payload: { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML', disable_web_page_preview: 'true' }, muteHttpExceptions: true }); } catch (e) {}
}
function tgPhotoUrl(url, caption) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
  try {
    var m = String(url).match(/\/d\/([^\/]+)/), direct = m ? ('https://drive.google.com/uc?export=download&id=' + m[1]) : url;
    var blob = UrlFetchApp.fetch(direct, { muteHttpExceptions: true }).getBlob();
    UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendPhoto', { method: 'post', payload: { chat_id: CONFIG.TELEGRAM_CHAT_ID, caption: caption, parse_mode: 'HTML', photo: blob }, muteHttpExceptions: true });
  } catch (e) { tg(caption); }
}
function genCode() { var s = 'EQ'; for (var i = 0; i < 5; i++) s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length)); return s; }
function norm(s) { return String(s == null ? '' : s).trim().toUpperCase(); }
function now() { return Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm'); }
function stamp() { return Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd_HHmmss'); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function setup() { sh(MEMBERS); sh(ACTIVITY); Logger.log('Sheet: ' + ss().getUrl()); }
