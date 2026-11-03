/* app.js — แกนของหน้าเว็บ OB-GYN Daily: เรียกหลังบ้าน · ล็อกอิน · โครงหน้า · เส้นทาง (#/…) · ตัวช่วยทั่วไป
 * หน้าอื่นอยู่ใน daily.js (รายงานประจำวัน + ส่งรายงาน) · monthly.js (รายเดือน + ภาพรวม) · admin.js (ตั้งค่า) */
'use strict';
var FRONT = window.FRONT_BUILD || 'dev';
var S = { token: '', boot: null, page: '', days: {}, months: {}, pending: {}, saving: false, online: true };
var $ = function (sel, el) { return (el || document).querySelector(sel); };
var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

/* ---------- ที่เก็บในเครื่อง (ปลอดภัยเมื่อเบราว์เซอร์ปิดไว้) ---------- */
function lsGet(k, d) { try { var v = localStorage.getItem('obd:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem('obd:' + k, JSON.stringify(v)); } catch (e) { } }
function lsDel(k) { try { localStorage.removeItem('obd:' + k); } catch (e) { } }

/* ---------- เรียกหลังบ้าน ---------- */
var RID = 0;
function rid() { return Date.now().toString(36) + '-' + (++RID) + '-' + Math.random().toString(36).slice(2, 7); }
function api(action, payload, opt) {
  opt = opt || {};
  var body = { action: action, token: S.token, payload: payload || {} };
  var run = function () {
    if (window.DEMO_RPC) return new Promise(function (res) { setTimeout(function () { res(window.DEMO_RPC(action, S.token, JSON.parse(JSON.stringify(payload || {})))); }, 120); });
    if (!window.API_URL) return Promise.reject(new Error('ยังไม่ได้ใส่ลิงก์ระบบหลังบ้านใน config.js'));
    return fetch(window.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  };
  var tries = 0;
  var go = function () {
    return run().catch(function (e) {
      if (++tries < (opt.retry == null ? 2 : opt.retry + 1)) return new Promise(function (res) { setTimeout(res, 900 * tries); }).then(go);
      throw new Error(/Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง' : e.message);
    });
  };
  return go().then(function (r) {
    S.online = true;
    if (!r || !r.ok) {
      var err = r && r.error || 'เกิดข้อผิดพลาด';
      if (err === 'SESSION_EXPIRED') { logout(true); throw new Error('หมดเวลาการเข้าใช้ กรุณาเข้าสู่ระบบใหม่'); }
      throw new Error(err);
    }
    return r.data;
  });
}

/* ---------- ตัวช่วยทั่วไป ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n) { n = +n || 0; return n.toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
function nz(n) { return n ? fmt(n) : ''; }
function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
var TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var TH_DS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
function ip(iso) { var p = String(iso).split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }
function dow(iso) { var p = ip(iso); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
function addDays(iso, n) { var p = ip(iso), d = new Date(Date.UTC(p.y, p.m - 1, p.d + n)); return d.toISOString().slice(0, 10); }
function ymAdd(ym, k) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
function daysIn(ym) { return new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(); }
function thDate(iso, o) { o = o || {}; var p = ip(iso); return (o.wd ? TH_D[dow(iso)] + ' ' : '') + p.d + ' ' + (o.short ? TH_MS[p.m - 1] + ' ' + String(p.y + 543).slice(-2) : TH_M[p.m - 1] + ' ' + (p.y + 543)); }
function thMonth(ym, short) { return (short ? TH_MS : TH_M)[+ym.slice(5, 7) - 1] + ' ' + (short ? String(+ym.slice(0, 4) + 543).slice(-2) : (+ym.slice(0, 4) + 543)); }
function thTime(stamp) { if (!stamp) return ''; var p = String(stamp).split(' '); return (p[0] === today() ? 'วันนี้ ' : thDate(p[0], { short: true }) + ' ') + (p[1] || '').slice(0, 5) + ' น.'; }
function today() { return (S.boot && S.boot.today) || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
function userName(emp) { return (S.boot && S.boot.users && S.boot.users[emp]) || emp || ''; }
function canEdit() { return S.boot && (S.boot.me.role === 'admin' || S.boot.me.role === 'nurse'); }
function isAdmin() { return S.boot && S.boot.me.role === 'admin'; }
function unitById(id) { return (S.boot.units || []).filter(function (u) { return u.id === id; })[0] || null; }
function myUnits() { var u = S.boot.units, mine = S.boot.me.units || []; return mine.length ? u.filter(function (x) { return mine.indexOf(x.id) >= 0; }).concat(u.filter(function (x) { return mine.indexOf(x.id) < 0; })) : u; }

/* ---------- ไอคอน ---------- */
var IC = {
  day: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 9h18"/><path d="M8 13h3v3H8z"/>',
  month: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 9h18M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', down: '<path d="m6 9 6 6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M1 21a8 8 0 0 1 16 0M17 4a4 4 0 0 1 0 8M23 21a7 7 0 0 0-4-6.3"/>',
  stetho: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>', gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  excel: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 12l6 6M14 12l-6 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  wand: '<path d="m15 4 5 5M3 21l12-12M14 3l1-1M21 10l1-1M18 2v2M22 6h-2"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'
};
function ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || '') + '</svg>'; }

/* ---------- ข้อความแจ้ง / หน้าต่าง ---------- */
function toast(msg, kind, ms) {
  var box = $('#toasts') || (function () { var d = document.createElement('div'); d.id = 'toasts'; d.setAttribute('role', 'status'); document.body.appendChild(d); return d; })();
  var t = document.createElement('div'); t.className = 'toast ' + (kind || '');
  t.innerHTML = ic(kind === 'err' ? 'alert' : kind === 'ok' ? 'check' : 'info') + '<span>' + esc(msg) + '</span>';
  box.appendChild(t);
  setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || (kind === 'err' ? 6000 : 3200));
}
function modal(o) {
  closeModal();
  var bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = '<div class="modal ' + (o.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
    '<div class="modal-h"><h3>' + esc(o.title) + '</h3><button class="icon-btn" data-x aria-label="ปิด">' + ic('x') + '</button></div>' +
    '<div class="modal-b">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-f">' + o.foot + '</div>' : '') + '</div>';
  document.body.appendChild(bg);
  document.body.classList.add('no-scroll');
  bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) closeModal(); });
  var f = bg.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea'); if (f && !o.noFocus && window.innerWidth > 700) setTimeout(function () { f.focus(); }, 60);
  if (o.onOpen) o.onOpen(bg.querySelector('.modal'));
  return bg.querySelector('.modal');
}
function closeModal() { var m = $('#modal'); if (m) m.remove(); document.body.classList.remove('no-scroll'); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#modal')) closeModal(); });
function confirmBox(title, text, okText, danger) {
  return new Promise(function (res) {
    var m = modal({ title: title, cls: 'sm', body: '<p class="lead">' + text + '</p>', foot: '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-ok>' + esc(okText || 'ตกลง') + '</button>' });
    m.querySelector('[data-ok]').onclick = function () { closeModal(); res(true); };
    $('#modal').addEventListener('click', function (e) { if (e.target.closest('[data-x]') || e.target.id === 'modal') res(false); });
  });
}
function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.classList.add('busy'); btn.innerHTML = '<span class="spin"></span>' + (text ? '<span>' + esc(text) + '</span>' : btn.dataset.html); }
  else { btn.disabled = false; btn.classList.remove('busy'); if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

/* ---------- ธีม ---------- */
function theme() { return lsGet('theme', ''); }
function applyTheme() { var t = theme(); if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
function toggleTheme() {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!theme() && matchMedia('(prefers-color-scheme: dark)').matches);
  lsSet('theme', dark ? 'light' : 'dark'); applyTheme(); renderShell();
}
applyTheme();

/* ---------- ล็อกอิน ---------- */
function deviceUA() { return navigator.userAgent.slice(0, 200); }
function renderLogin(msg) {
  document.title = 'เข้าสู่ระบบ · OB-GYN Daily';
  var app = $('#app'), last = lsGet('lastEmp', '');
  app.innerHTML =
    '<main class="login">' +
    '<section class="login-art" aria-hidden="true"><div class="login-art-in">' +
    '<img class="login-icon" src="icon.svg" alt="" width="96" height="96">' +
    '<h1>OB-GYN Daily</h1><p>รายงานประจำวัน<br>คลินิกสูติ-นรีเวชกรรม ชั้น 6</p>' +
    '<ul class="login-points"><li>' + ic('stetho') + 'ยอดผู้ป่วยรายแพทย์จากระบบ HIS อัตโนมัติ</li><li>' + ic('hand') + 'บันทึกหัตถการ ตัวชี้วัด และเจ้าหน้าที่ในหน้าเดียว</li><li>' + ic('share') + 'ส่งรายงานเป็นภาพเข้าไลน์ได้จากทุกอุปกรณ์</li></ul>' +
    '</div></section>' +
    '<section class="login-form-wrap"><form class="login-form" autocomplete="on">' +
    '<div class="login-org"><img src="logo-hospital.png" alt="" width="40" height="40"><div><b>โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา</b><span>สภากาชาดไทย</span></div></div>' +
    '<h2>เข้าสู่ระบบ</h2><p class="muted">ใช้รหัสเจ้าหน้าที่และรหัสผ่านเดียวกับระบบ HIS</p>' +
    (msg ? '<div class="alert err" role="alert">' + ic('alert') + '<span>' + esc(msg) + '</span></div>' : '') +
    '<label class="fld"><span>รหัสเจ้าหน้าที่ 7 หลัก</span><input id="emp" name="username" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="username" required value="' + esc(last) + '" placeholder="เช่น 5412072"></label>' +
    '<label class="fld"><span>รหัสผ่าน HIS</span><div class="pw"><input id="pass" name="password" type="password" autocomplete="current-password" required><button type="button" class="icon-btn" id="eye" aria-label="แสดงรหัสผ่าน">' + ic('eye') + '</button></div></label>' +
    '<label class="chk"><input type="checkbox" id="remember" ' + (lsGet('remember', true) ? 'checked' : '') + '><span>จำการเข้าสู่ระบบในเครื่องนี้ 30 วัน</span></label>' +
    '<button class="btn primary lg block" id="go" type="submit">เข้าสู่ระบบ</button>' +
    (window.DEMO_RPC ? '<div class="alert demo">' + ic('info') + '<span>หน้าทดลองใช้ (ข้อมูลยอดจริง ส.ค.–พ.ย. 69 · บันทึกไม่ถูกส่งไปไหน) · รหัส <b>5412072</b> หรือ <b>5660101</b> · รหัสผ่าน <b>demo1234</b></span></div>' : '') +
    '<p class="fine">ระบบจะไม่เก็บรหัสผ่าน HIS ของท่าน · ' + esc(window.APP_CONTACT || 'ติดต่อผู้ดูแลระบบหากยังไม่มีสิทธิ์เข้าใช้') + '</p>' +
    '</form></section></main>';
  $('#eye').onclick = function () { var p = $('#pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
  (last ? $('#pass') : $('#emp')).focus();
  $('.login-form').onsubmit = function (e) {
    e.preventDefault();
    var emp = $('#emp').value.replace(/\D/g, ''), pass = $('#pass').value, rem = $('#remember').checked, btn = $('#go');
    if (emp.length !== 7) { toast('กรุณากรอกรหัสเจ้าหน้าที่ 7 หลัก', 'err'); return; }
    busy(btn, true, 'กำลังตรวจสอบกับระบบ HIS…');
    var first = routeInfo().page === 'day' ? routeInfo().date || null : null;
    api('login', { emp: emp, pass: pass, remember: rem, ua: deviceUA(), withBoot: true, first: { date: first || null } }, { retry: 0 }).then(function (d) {
      lsSet('lastEmp', emp); lsSet('remember', rem);
      S.token = d.token; if (rem) lsSet('token', d.token); else { lsDel('token'); try { sessionStorage.setItem('obd:token', d.token); } catch (e) { } }
      setBoot(d.boot);
      if (d.first) S.days[d.first.date] = d.first;
      route();
    }).catch(function (e) { busy(btn, false); renderLogin(e.message); $('#emp').value = emp; });
  };
}
function setBoot(b) { S.boot = b; lsSet('boot:' + b.me.user, b); lsSet('bootUser', b.me.user); }
function logout(expired) {
  if (!expired && S.token) api('ping', {}).catch(function () { });
  S.token = ''; S.boot = null; S.days = {}; S.months = {}; lsDel('token'); try { sessionStorage.removeItem('obd:token'); } catch (e) { }
  renderLogin(expired ? 'หมดเวลาการเข้าใช้ กรุณาเข้าสู่ระบบใหม่' : '');
}

/* ---------- เส้นทาง ---------- */
function routeInfo() {
  var h = (location.hash || '').replace(/^#\/?/, '').split('/');
  return { page: h[0] || 'day', a: h[1] || '', b: h[2] || '', date: /^\d{4}-\d{2}-\d{2}$/.test(h[1]) ? h[1] : '' };
}
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
var PAGES = {};
function route() {
  if (!S.token || !S.boot) { renderLogin(); return; }
  var r = routeInfo();
  if (r.page === 'settings' && !isAdmin()) r.page = 'day';
  S.page = r.page;
  renderShell();
  var fn = PAGES[r.page] || PAGES.day;
  window.scrollTo(0, 0);
  fn(r, $('#main'));
}
window.addEventListener('hashchange', route);

/* ---------- โครงหน้า ---------- */
var NAV = [
  { id: 'day', label: 'รายงานประจำวัน', short: 'ประจำวัน', icon: 'day' },
  { id: 'month', label: 'รายงานรายเดือน', short: 'รายเดือน', icon: 'month' },
  { id: 'overview', label: 'ภาพรวม', short: 'ภาพรวม', icon: 'chart' },
  { id: 'settings', label: 'ตั้งค่าระบบ', short: 'ตั้งค่า', icon: 'settings', admin: true },
  { id: 'help', label: 'วิธีใช้', short: 'วิธีใช้', icon: 'help' }
];
function renderShell() {
  var b = S.boot, app = $('#app');
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!theme() && matchMedia('(prefers-color-scheme: dark)').matches);
  var items = NAV.filter(function (n) { return !n.admin || isAdmin(); });
  var navHtml = function (cls) {
    return items.map(function (n) { return '<a href="#/' + n.id + '" class="' + cls + (S.page === n.id ? ' on' : '') + '"' + (S.page === n.id ? ' aria-current="page"' : '') + '>' + ic(n.icon) + '<span>' + (cls === 'tab' ? n.short : n.label) + '</span></a>'; }).join('');
  };
  if (!$('#main')) {
    app.innerHTML =
      '<div class="shell">' +
      '<aside class="side"><div class="brand"><img src="icon.svg" alt="" width="40" height="40"><div><b>OB-GYN Daily</b><span>คลินิกสูติ-นรีเวช ชั้น 6</span></div></div>' +
      '<nav class="nav" id="nav" aria-label="เมนูหลัก"></nav>' +
      '<div class="side-foot" id="sidefoot"></div></aside>' +
      '<div class="main-wrap"><header class="mtop"><img src="icon.svg" alt="" width="30" height="30"><b>OB-GYN Daily</b><span class="sp"></span><button class="icon-btn" id="mtheme" aria-label="สลับโหมดสว่าง/มืด"></button><button class="icon-btn" id="mme" aria-label="บัญชีของฉัน">' + ic('user') + '</button></header>' +
      '<main id="main" tabindex="-1"></main></div>' +
      '<nav class="tabbar" id="tabbar" aria-label="เมนูหลัก"></nav></div>';
    $('#mme').onclick = accountMenu;
    $('#mtheme').onclick = toggleTheme;
  }
  $('#nav').innerHTML = navHtml('nv');
  $('#tabbar').innerHTML = navHtml('tab');
  $('#mtheme').innerHTML = ic(isDark ? 'sun' : 'moon');
  $('#sidefoot').innerHTML =
    '<button class="me" id="me"><span class="av">' + esc((b.me.name || b.me.user).replace(/^(นาง|นาย|นางสาว)\s*/, '').charAt(0)) + '</span><span class="me-t"><b>' + esc(b.me.name || b.me.user) + '</b><small>' + esc(b.me.roleTh) + '</small></span></button>' +
    '<div class="side-acts"><button class="icon-btn" id="theme" aria-label="สลับโหมดสว่าง/มืด" title="สลับโหมดสว่าง/มืด">' + ic(isDark ? 'sun' : 'moon') + '</button><button class="icon-btn" id="out" aria-label="ออกจากระบบ" title="ออกจากระบบ">' + ic('logout') + '</button></div>';
  $('#me').onclick = accountMenu; $('#theme').onclick = toggleTheme;
  $('#out').onclick = function () { confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบในเครื่องนี้ใช่ไหม', 'ออกจากระบบ').then(function (y) { if (y) logout(); }); };
}
function accountMenu() {
  var b = S.boot;
  modal({ title: 'บัญชีของฉัน', cls: 'sm', body:
    '<div class="acct"><span class="av lg">' + esc((b.me.name || b.me.user).replace(/^(นาง|นาย|นางสาว)\s*/, '').charAt(0)) + '</span><div><b>' + esc(b.me.name || '-') + '</b><div class="muted">รหัส ' + esc(b.me.user) + ' · ' + esc(b.me.roleTh) + '</div></div></div>' +
    '<p class="muted small">' + esc(b.app.short) + ' รุ่น ' + esc(b.app.build) + ' (' + esc(b.app.buildTh) + ') · หน้าเว็บ ' + esc(FRONT) + '</p>',
    foot: '<button class="btn ghost" id="th2">' + ic('moon') + 'สลับโหมดสว่าง/มืด</button><button class="btn danger" id="out2">' + ic('logout') + 'ออกจากระบบ</button>' });
  $('#th2').onclick = function () { closeModal(); toggleTheme(); };
  $('#out2').onclick = function () { closeModal(); logout(); };
}

/* ---------- วิธีใช้ ---------- */
PAGES.help = function (r, el) {
  var b = S.boot;
  document.title = 'วิธีใช้ · OB-GYN Daily';
  el.innerHTML = '<div class="page narrow"><header class="ph"><div><h1>วิธีใช้งาน</h1><p class="muted">' + esc(b.app.name) + ' · ' + esc(b.app.clinic) + '</p></div></header>' +
    '<section class="card prose">' +
    '<h2>ทุกวัน · 5 ขั้น</h2><ol class="steps">' +
    '<li><b>เปิด "รายงานประจำวัน"</b> เลือกหน่วยงาน (นรีเวช / ฝากครรภ์-สูติ) ยอดผู้ป่วยรายแพทย์มาจากระบบ HIS เอง ดึงใหม่ทุก 30 นาที กด <i>ดึงยอดล่าสุด</i> เมื่อต้องการทันที</li>' +
    '<li><b>แยกเช้า/บ่าย</b> ใส่เฉพาะยอด <i>บ่าย</i> ของแพทย์แต่ละคน ระบบคำนวณยอดเช้าให้ (ยอดรวมจึงตรงกับ HIS เสมอ) · ผู้ป่วย "ไม่ระบุแพทย์" กด <i>ระบุแพทย์</i> เพื่อย้ายให้แพทย์ที่ตรวจจริง</li>' +
    '<li><b>คีย์ยอดเพิ่ม</b> เช่น CH · Ward · LAB และ <b>หัตถการ</b> แยกเช้า/บ่าย · ตัวชี้วัด · ปัญหาที่พบ</li>' +
    '<li><b>เจ้าหน้าที่</b> แตะชื่อเพื่อเลือกผู้ขึ้นปฏิบัติงาน แตะซ้ำเพื่อเปลี่ยนเวร ช/บ → ช → บ · <b>ผู้ป่วยส่งต่อ</b> เพิ่มรายชื่อ (ชื่อ HN อายุ Dx Ward)</li>' +
    '<li><b>ส่งรายงาน</b> เลือกภาพสรุป/ใบรายงานเต็ม/ข้อความ แล้วกดแชร์เข้าไลน์ หรือพิมพ์ A4</li></ol>' +
    '<p class="muted">ทุกช่องบันทึกเองอัตโนมัติ (มุมขวาบนบอกสถานะ) · แก้ย้อนหลังได้ทุกวัน มีประวัติการแก้ไข</p>' +
    '<h2>รายงานรายเดือน</h2><p>สรุปเป็นสัปดาห์ที่ 1–5 ตามแบบฟอร์มเดิม ใช้รายการหัตถการชุดเดียวกับรายวัน ปฏิทินด้านบนบอกวันที่ยังไม่บันทึก · ส่งออก Excel หรือพิมพ์ได้</p>' +
    '<h2>ส่งภาพเข้าไลน์</h2><ul><li><b>มือถือ:</b> กด <i>แชร์ภาพ</i> แล้วเลือก LINE</li><li><b>เปิดลิงก์จากในไลน์:</b> แตะค้างที่ภาพแล้วเลือกบันทึก/ส่งต่อ หรือกด <i>เปิดในเบราว์เซอร์</i></li><li><b>คอมพิวเตอร์:</b> กด <i>คัดลอกภาพ</i> แล้ววาง (Ctrl+V) ในแชต LINE</li></ul>' +
    '<h2>ความเป็นส่วนตัว</h2><p>ระบบไม่เก็บ HN/ชื่อผู้ป่วยจาก HIS เก็บเฉพาะยอดรวม · รายชื่อผู้ป่วยส่งต่อเห็นเฉพาะผู้ที่ล็อกอิน (ผู้บริหารเห็นแบบปิดบางส่วน) · ภาพ/ข้อความที่แชร์ไม่แสดงชื่อผู้ป่วยเว้นแต่ติ๊กเลือก</p>' +
    '<p class="muted small">' + esc(b.texts.contact || '') + ' · รุ่น ' + esc(b.app.build) + '</p></section></div>';
};

/* ---------- เริ่มต้น ---------- */
function start() {
  var tk = lsGet('token', '') || (function () { try { return sessionStorage.getItem('obd:token') || ''; } catch (e) { return ''; } })();
  if (!tk) { renderLogin(); return; }
  S.token = tk;
  var cached = lsGet('boot:' + lsGet('bootUser', ''), null);
  if (cached) { S.boot = cached; route(); }
  else $('#app').innerHTML = '<div class="boot-load"><img src="icon.svg" alt="" width="72" height="72"><span class="spin"></span></div>';
  api('bootstrap', {}).then(function (b) {
    var first = !S.boot; setBoot(b);
    if (first || b.app.build !== cached.app.build || b.today !== cached.today) route(); else renderShell();
  }).catch(function (e) { if (!S.boot) renderLogin(e.message); else toast(e.message, 'err'); });
}
window.addEventListener('beforeunload', function (e) { if (Object.keys(S.pending).length || S.saving) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('DOMContentLoaded', start);
