/**
 * EQ GYM — App backend (Google Apps Script Web App)
 * Quản trị: cấp mã đăng nhập, proxy Gemini (ẩn key dùng chung),
 *           tích điểm từng thành viên, bảng thi đua (leaderboard).
 *
 * TRIỂN KHAI (xem SETUP-APP-BACKEND.md):
 *   1) script.google.com -> New project -> dán toàn bộ file này.
 *   2) Điền GEMINI_API_KEY + ADMIN_SECRET trong CONFIG.
 *   3) Deploy -> New deployment -> Web app (Execute as: Me, Access: Anyone).
 *      -> copy URL, dán vào APP_BACKEND trong index.html.
 *   (SHEET_ID để trống -> tự tạo sheet "EQ GYM - Members".)
 */

var CONFIG = {
  GEMINI_API_KEY: '',   // key Gemini dùng chung (ẩn phía server) — dạng "AIza..."
  ADMIN_SECRET:   '',   // mã đăng nhập của quản trị viên — đặt 1 chuỗi khó đoán
  SHEET_ID:       '',   // (tuỳ chọn) id Google Sheet lưu thành viên — trống = tự tạo
  GEMINI_MODEL:   'gemini-2.0-flash'
};

var SHEET_NAME = 'EQ GYM - Members';
var HEADERS = ['Mã', 'Tên', 'Điểm', 'Vai trò', 'Tạo lúc', 'Hoạt động gần nhất'];
var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm (I,L,O,0,1)

function doPost(e) {
  var out;
  try {
    var d = JSON.parse(e.postData.contents);
    switch (d.action) {
      case 'login':       out = apiLogin(d); break;
      case 'ai':          out = apiAI(d); break;
      case 'sync':        out = apiSync(d); break;
      case 'leaderboard': out = apiLeaderboard(d); break;
      case 'createCode':  out = apiCreateCode(d); break;
      case 'listMembers': out = apiListMembers(d); break;
      default:            out = { ok: false, error: 'action?' };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('EQ GYM app backend — OK');
}

/* ===== Đăng nhập bằng mã ===== */
function apiLogin(d) {
  var code = String(d.code || '').trim();
  if (!code) return { ok: false, error: 'Thiếu mã' };
  if (CONFIG.ADMIN_SECRET && code === CONFIG.ADMIN_SECRET) {
    return { ok: true, role: 'admin', name: 'Quản trị viên', points: 0 };
  }
  var m = findMember(code);
  if (!m) return { ok: false, error: 'Mã không đúng hoặc chưa được cấp' };
  touch(m.row);
  return { ok: true, role: 'member', name: m.name, points: m.points };
}

/* ===== Proxy Gemini (ẩn key) ===== */
function apiAI(d) {
  if (!isAuthorized(d.code)) return { ok: false, error: 'unauthorized' };
  if (!CONFIG.GEMINI_API_KEY) return { ok: false, error: 'Server chưa cấu hình Gemini key' };
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL +
            ':generateContent?key=' + encodeURIComponent(CONFIG.GEMINI_API_KEY);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(d.body || {}), muteHttpExceptions: true
  });
  var txt = res.getContentText();
  var json; try { json = JSON.parse(txt); } catch (e) { json = { error: 'bad gemini response' }; }
  return { ok: true, gemini: json };
}

/* ===== Đồng bộ điểm ===== */
function apiSync(d) {
  var m = findMember(d.code);
  if (!m) return { ok: false, error: 'unauthorized' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) {}
  try {
    var pts = Math.max(m.points, Math.floor(Number(d.points) || 0));
    sheet().getRange(m.row, 3).setValue(pts);
    sheet().getRange(m.row, 6).setValue(now());
    return { ok: true, points: pts };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ===== Bảng thi đua ===== */
function apiLeaderboard(d) {
  if (!isAuthorized(d.code)) return { ok: false, error: 'unauthorized' };
  var rows = members();
  rows.sort(function (a, b) { return b.points - a.points; });
  var top = rows.slice(0, 50).map(function (r, i) { return { rank: i + 1, name: r.name, points: r.points }; });
  var me = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].code === String(d.code || '').trim()) { me = { rank: i + 1, name: rows[i].name, points: rows[i].points }; break; }
  }
  return { ok: true, top: top, me: me, total: rows.length };
}

/* ===== Admin: tạo mã ===== */
function apiCreateCode(d) {
  if (!CONFIG.ADMIN_SECRET || d.admin !== CONFIG.ADMIN_SECRET) return { ok: false, error: 'Chỉ admin' };
  var name = String(d.name || '').trim();
  if (!name) return { ok: false, error: 'Thiếu tên khách' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) {}
  try {
    var code;
    do { code = genCode(); } while (findMember(code));
    sheet().appendRow([code, name, 0, 'member', now(), '']);
    return { ok: true, code: code, name: name };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ===== Admin: danh sách thành viên ===== */
function apiListMembers(d) {
  if (!CONFIG.ADMIN_SECRET || d.admin !== CONFIG.ADMIN_SECRET) return { ok: false, error: 'Chỉ admin' };
  var rows = members();
  rows.sort(function (a, b) { return b.points - a.points; });
  return { ok: true, members: rows.map(function (r) { return { code: r.code, name: r.name, points: r.points, last: r.last }; }) };
}

/* ===== Sheet helpers ===== */
function sheet() {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.SHEET_ID || props.getProperty('MEMBERS_SHEET_ID');
  var ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) {} }
  if (!ss) { ss = SpreadsheetApp.create(SHEET_NAME); props.setProperty('MEMBERS_SHEET_ID', ss.getId()); }
  var sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}
function members() {
  var sh = sheet(), last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 6).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    if (!v[0]) continue;
    out.push({ row: i + 2, code: String(v[0]).trim(), name: v[1], points: Math.floor(Number(v[2]) || 0), role: v[3], last: v[5] });
  }
  return out;
}
function findMember(code) {
  code = String(code || '').trim();
  if (!code) return null;
  var all = members();
  for (var i = 0; i < all.length; i++) if (all[i].code === code) return all[i];
  return null;
}
function isAuthorized(code) {
  code = String(code || '').trim();
  if (!code) return false;
  if (CONFIG.ADMIN_SECRET && code === CONFIG.ADMIN_SECRET) return true;
  return !!findMember(code);
}
function touch(row) { try { sheet().getRange(row, 6).setValue(now()); } catch (e) {} }
function genCode() {
  var s = 'EQ';
  for (var i = 0; i < 5; i++) s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  return s;
}
function now() { return Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm'); }

/* Chạy tay 1 lần để tạo sheet + cấp quyền */
function setup() {
  var sh = sheet();
  Logger.log('Members sheet: ' + sh.getParent().getUrl());
}
