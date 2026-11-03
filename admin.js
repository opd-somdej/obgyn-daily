/* admin.js — ตั้งค่าระบบ (ผู้ดูแลระบบ): หน่วยงานและคลินิก · รายการบันทึก · เจ้าหน้าที่ · ผู้ใช้ · ข้อมูลและการเชื่อมต่อ · ประวัติ */
'use strict';
var A = { tab: 'clinics', data: null, kind: 'proc' };
var ATABS = [['clinics', 'หน่วยงานและคลินิก', 'stetho'], ['items', 'รายการบันทึก', 'hand'], ['staff', 'เจ้าหน้าที่', 'users'], ['users', 'ผู้ใช้', 'user'], ['data', 'ข้อมูลและการเชื่อมต่อ', 'link'], ['audit', 'ประวัติการแก้ไข', 'note']];
PAGES.settings = function (r, el) {
  A.tab = ATABS.some(function (t) { return t[0] === r.a; }) ? r.a : 'clinics';
  document.title = 'ตั้งค่าระบบ · OB-GYN Daily';
  el.innerHTML = '<div class="page settings"><header class="ph"><div><h1>ตั้งค่าระบบ</h1><p class="muted">เฉพาะผู้ดูแลระบบ · การเปลี่ยนแปลงมีผลกับทุกคนทันทีหลังบันทึก</p></div></header>' +
    '<nav class="stabs" role="tablist">' + ATABS.map(function (t) { return '<a href="#/settings/' + t[0] + '" class="' + (t[0] === A.tab ? 'on' : '') + '">' + ic(t[2]) + '<span>' + t[1] + '</span></a>'; }).join('') + '</nav>' +
    '<div id="spane"><div class="sk sk-card"></div></div></div>';
  var p = $('#spane');
  var load = A.tab === 'users' || A.tab === 'data' ? api('getAdmin', {}).then(function (d) { A.data = d; }) : Promise.resolve();
  load.then(function () { ({ clinics: paneClinics, items: paneItems, staff: paneStaff, users: paneUsers, data: paneData, audit: paneAudit })[A.tab](p); })
    .catch(function (e) { p.innerHTML = '<div class="alert err">' + ic('alert') + '<span>' + esc(e.message) + '</span></div>'; });
};
function reboot() { return api('bootstrap', {}).then(function (b) { setBoot(b); S.days = {}; S.months = {}; }); }
function saveBtn(id, label) { return '<div class="save-row"><button class="btn primary" id="' + id + '">' + ic('check') + (label || 'บันทึกการเปลี่ยนแปลง') + '</button></div>'; }
function unitSel(val, all, cls) { return '<select class="' + (cls || '') + '">' + (all ? '<option value="">ทุกหน่วยงาน</option>' : '<option value="">— ไม่ระบุ —</option>') + S.boot.units.map(function (u) { return '<option value="' + u.id + '"' + (u.id === val ? ' selected' : '') + '>' + esc(u.short) + '</option>'; }).join('') + '</select>'; }
function moveRow(tr, d) { var sib = d < 0 ? tr.previousElementSibling : tr.nextElementSibling; if (!sib) return; if (d < 0) tr.parentNode.insertBefore(tr, sib); else tr.parentNode.insertBefore(sib, tr); }
function bindMove(root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-mv]'); if (b) moveRow(b.closest('tr'), +b.dataset.mv); var x = e.target.closest('[data-del]'); if (x) x.closest('tr').remove(); }); }
var MV = '<td class="mv"><button class="icon-btn sm" data-mv="-1" aria-label="เลื่อนขึ้น">' + ic('up') + '</button><button class="icon-btn sm" data-mv="1" aria-label="เลื่อนลง">' + ic('down') + '</button></td>';

/* ---------- หน่วยงานและคลินิก ---------- */
function paneClinics(p) {
  var b = S.boot;
  p.innerHTML = '<section class="card"><div class="card-h"><h2>หน่วยงาน</h2><span class="hint">แต่ละหน่วยมีใบรายงานของตัวเอง · ผู้บริหารดูรวมได้ที่หน้าภาพรวม</span></div>' +
    '<div class="tbl-wrap"><table class="tbl edit" id="tUnits"><thead><tr><th></th><th>ชื่อหน่วยงาน</th><th>ชื่อย่อ</th><th>หัวใบรายงาน</th><th>สี</th></tr></thead><tbody>' +
    b.units.map(function (u) { return '<tr data-id="' + u.id + '">' + MV + '<td><input data-f="name" value="' + esc(u.name) + '"></td><td><input data-f="short" value="' + esc(u.short) + '" class="w8"></td><td><input data-f="title" value="' + esc(u.title) + '"></td><td><input type="color" data-f="color" value="' + esc(u.color) + '"></td></tr>'; }).join('') +
    '</tbody></table></div><div class="pad-x"><button class="btn sm ghost" id="addUnit">' + ic('plus') + 'เพิ่มหน่วยงาน</button></div>' + saveBtn('saveUnits', 'บันทึกหน่วยงาน') + '</section>' +
    '<section class="card"><div class="card-h"><h2>คลินิก</h2><span class="hint">คลินิกใหม่จาก HIS เพิ่มเองอัตโนมัติ · ปิด = ไม่แสดงและไม่นับ</span></div>' +
    '<div class="tbl-wrap"><table class="tbl edit" id="tClin"><thead><tr><th></th><th>รหัส</th><th>ชื่อคลินิก</th><th>ชื่อย่อ</th><th>หน่วยงาน</th><th>หัวข้อคลินิกพิเศษ</th><th>แสดง/นับ</th></tr></thead><tbody>' +
    b.clinics.map(function (c) { return '<tr data-code="' + esc(c.code) + '">' + MV + '<td><code>' + esc(c.code) + '</code></td><td class="muted small">' + esc(c.name) + '</td><td><input data-f="short" value="' + esc(c.short) + '" class="w10"></td><td>' + unitSel(c.unit, false, 'u') + '</td><td><input data-f="special" value="' + esc(c.special) + '" placeholder="—" class="w12"></td><td><label class="sw"><input type="checkbox" data-f="show"' + (c.show ? ' checked' : '') + '><i></i></label></td></tr>'; }).join('') +
    '</tbody></table></div><div class="pad-x add-clin"><input id="ncCode" placeholder="รหัส เช่น GYOT" class="w10"><input id="ncName" placeholder="ชื่อคลินิก">' + unitSel('gyn', false, 'ncU') + '<button class="btn sm ghost" id="addClin">' + ic('plus') + 'เพิ่มคลินิกเอง</button></div>' + saveBtn('saveClin', 'บันทึกคลินิก') + '</section>';
  bindMove(p);
  $('#addUnit').onclick = function () { var tr = document.createElement('tr'); tr.dataset.id = ''; tr.innerHTML = MV + '<td><input data-f="name" placeholder="ชื่อหน่วยงาน"></td><td><input data-f="short" class="w8"></td><td><input data-f="title"></td><td><input type="color" data-f="color" value="#c2185b"></td>'; $('#tUnits tbody').appendChild(tr); };
  $('#saveUnits').onclick = function () {
    var btn = this, units = $$('#tUnits tbody tr').map(function (tr) { return { id: tr.dataset.id, name: $('[data-f=name]', tr).value, short: $('[data-f=short]', tr).value, title: $('[data-f=title]', tr).value, color: $('[data-f=color]', tr).value }; }).filter(function (u) { return u.name.trim(); });
    busy(btn, true); api('saveUnits', { units: units, _rid: rid() }).then(reboot).then(function () { busy(btn, false); toast('บันทึกหน่วยงานแล้ว', 'ok'); route(); }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
  };
  var collect = function () { return $$('#tClin tbody tr').map(function (tr) { return { code: tr.dataset.code, short: $('[data-f=short]', tr).value, unit: $('select.u', tr).value, special: $('[data-f=special]', tr).value, show: $('[data-f=show]', tr).checked }; }); };
  var send = function (btn, add) { busy(btn, true); api('saveClinics', { clinics: collect(), add: add || null, _rid: rid() }).then(reboot).then(function () { busy(btn, false); toast('บันทึกคลินิกแล้ว', 'ok'); route(); }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); }); };
  $('#saveClin').onclick = function () { send(this); };
  $('#addClin').onclick = function () { var code = $('#ncCode').value.trim(); if (!code) { toast('กรอกรหัสคลินิก', 'err'); return; } send(this, { code: code, name: $('#ncName').value, unit: $('select.ncU').value }); };
}

/* ---------- รายการบันทึก ---------- */
var KINDS = [['proc', 'หัตถการ'], ['extra', 'ยอดคีย์เพิ่ม'], ['kpi', 'ตัวชี้วัด'], ['case', 'ประเภทผู้ป่วยส่งต่อ']];
function paneItems(p) {
  var k = A.kind, list = S.boot.items.filter(function (x) { return x.kind === k; });
  var caseTypes = S.boot.items.filter(function (x) { return x.kind === 'case'; }).map(function (x) { return x.name; });
  var extraCols = k === 'kpi' ? '<th>ชนิด</th>' : k === 'extra' ? '<th>นับรวมยอด</th><th>หัวข้อคลินิกพิเศษ</th>' : k === 'proc' ? '<th>นับจากผู้ป่วยส่งต่อ</th>' : '';
  var row = function (x) {
    x = x || { id: '', name: '', unit: '', active: true, type: 'num', countIn: true, special: '', link: '' };
    var ex = k === 'kpi' ? '<td><select data-f="type"><option value="num"' + (x.type !== 'pct' ? ' selected' : '') + '>จำนวน</option><option value="pct"' + (x.type === 'pct' ? ' selected' : '') + '>ร้อยละ</option></select></td>'
      : k === 'extra' ? '<td><label class="sw"><input type="checkbox" data-f="countIn"' + (x.countIn ? ' checked' : '') + '><i></i></label></td><td><input data-f="special" value="' + esc(x.special) + '" placeholder="—" class="w12"></td>'
        : k === 'proc' ? '<td><select data-f="link"><option value="">—</option>' + caseTypes.map(function (t) { return '<option' + (t === x.link ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></td>' : '';
    return '<tr data-id="' + esc(x.id) + '">' + MV + '<td><input data-f="name" value="' + esc(x.name) + '" placeholder="ชื่อรายการ"></td><td>' + unitSel(x.unit, true, 'u') + '</td>' + ex + '<td><label class="sw"><input type="checkbox" data-f="active"' + (x.active ? ' checked' : '') + '><i></i></label></td><td>' + (x.id ? '' : '<button class="icon-btn sm" data-del aria-label="ลบ">' + ic('trash') + '</button>') + '</td></tr>';
  };
  p.innerHTML = '<div class="seg" id="kinds">' + KINDS.map(function (x) { return '<button data-k="' + x[0] + '" class="' + (x[0] === k ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<section class="card"><div class="card-h"><h2>' + esc(KINDS.filter(function (x) { return x[0] === k; })[0][1]) + '</h2><span class="hint">' +
    ({ proc: 'ใช้ชุดเดียวกันทั้งรายวันและรายเดือน · ปิดใช้แทนการลบ (ข้อมูลเก่ายังอยู่)', extra: 'ผู้ป่วยที่ไม่มีใน HIS ของคลินิก เช่น CH · Ward · LAB', kpi: 'ร้อยละ = รายเดือนแสดงค่าเฉลี่ย · จำนวน = รวม', 'case': 'ใช้ในรายชื่อผู้ป่วยส่งต่อ' })[k] + '</span></div>' +
    '<div class="tbl-wrap"><table class="tbl edit" id="tItems"><thead><tr><th></th><th>ชื่อ</th><th>หน่วยงาน</th>' + extraCols + '<th>ใช้งาน</th><th></th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>' +
    '<div class="pad-x"><button class="btn sm ghost" id="addItem">' + ic('plus') + 'เพิ่มรายการ</button></div>' + saveBtn('saveItems') + '</section>';
  bindMove(p);
  $$('#kinds button').forEach(function (b) { b.onclick = function () { A.kind = b.dataset.k; paneItems(p); }; });
  $('#addItem').onclick = function () { var t = document.createElement('tbody'); t.innerHTML = row(null); $('#tItems tbody').appendChild(t.firstChild); $('#tItems tbody tr:last-child input').focus(); };
  $('#saveItems').onclick = function () {
    var btn = this, items = $$('#tItems tbody tr').map(function (tr) {
      var g = function (f) { var e = $('[data-f="' + f + '"]', tr); return e ? (e.type === 'checkbox' ? e.checked : e.value) : undefined; };
      return { id: tr.dataset.id, name: g('name'), unit: $('select.u', tr).value, active: g('active'), type: g('type'), countIn: g('countIn'), special: g('special'), link: g('link'), custom: !tr.dataset.id };
    }).filter(function (x) { return x.name && x.name.trim(); });
    busy(btn, true); api('saveItems', { kind: k, items: items, _rid: rid() }).then(reboot).then(function () { busy(btn, false); toast('บันทึกแล้ว', 'ok'); paneItems(p); }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
  };
}

/* ---------- เจ้าหน้าที่ ---------- */
function paneStaff(p) {
  var pos = S.boot.positions;
  var row = function (s) { s = s || { id: '', name: '', pos: 'GN', unit: '', active: true }; return '<tr data-id="' + esc(s.id) + '">' + MV + '<td><input data-f="name" value="' + esc(s.name) + '" placeholder="ชื่อ-สกุล"></td><td><select data-f="pos">' + pos.map(function (x) { return '<option' + (x === s.pos ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td><td>' + unitSel(s.unit, true, 'u') + '</td><td><label class="sw"><input type="checkbox" data-f="active"' + (s.active ? ' checked' : '') + '><i></i></label></td><td>' + (s.id ? '' : '<button class="icon-btn sm" data-del aria-label="ลบ">' + ic('trash') + '</button>') + '</td></tr>'; };
  p.innerHTML = '<section class="card"><div class="card-h"><h2>เจ้าหน้าที่ประจำคลินิก</h2><span class="hint">พยาบาลแตะชื่อเพื่อเลือกผู้ขึ้นปฏิบัติงานแต่ละวัน · ปิดใช้เมื่อย้าย/ลาออก</span></div>' +
    '<div class="tbl-wrap"><table class="tbl edit" id="tStaff"><thead><tr><th></th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th>ใช้งาน</th><th></th></tr></thead><tbody>' + (S.boot.staff || []).map(row).join('') + '</tbody></table></div>' +
    '<div class="pad-x"><button class="btn sm ghost" id="addStf">' + ic('plus') + 'เพิ่มเจ้าหน้าที่</button><button class="btn sm ghost" id="pasteStf">' + ic('copy') + 'วางรายชื่อหลายคน</button></div>' + saveBtn('saveStf') + '</section>';
  bindMove(p);
  var add = function (s) { var t = document.createElement('tbody'); t.innerHTML = row(s); $('#tStaff tbody').appendChild(t.firstChild); };
  $('#addStf').onclick = function () { add(null); $('#tStaff tbody tr:last-child input').focus(); };
  $('#pasteStf').onclick = function () {
    var mo = modal({ title: 'วางรายชื่อหลายคน', body: '<p class="muted small">1 บรรทัดต่อ 1 คน · ใส่ตำแหน่งไว้หน้าชื่อได้ เช่น <code>GN ลลิตา ใจดี</code></p><label class="fld"><span>หน่วยงาน</span>' + unitSel('', true, 'pu') + '</label><textarea id="pasteTxt" rows="10"></textarea>', foot: '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="pOk">เพิ่มในตาราง</button>' });
    $('#pOk', mo).onclick = function () {
      var u = $('select.pu', mo).value;
      $('#pasteTxt', mo).value.split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) { var m = l.match(/^(GN|PN|NA)\s+(.+)$/i); add({ id: '', name: m ? m[2] : l, pos: m ? m[1].toUpperCase() : 'GN', unit: u, active: true }); });
      closeModal();
    };
  };
  $('#saveStf').onclick = function () {
    var btn = this, staff = $$('#tStaff tbody tr').map(function (tr) { return { id: tr.dataset.id, name: $('[data-f=name]', tr).value, pos: $('[data-f=pos]', tr).value, unit: $('select.u', tr).value, active: $('[data-f=active]', tr).checked }; }).filter(function (x) { return x.name.trim(); });
    busy(btn, true); api('saveStaffList', { staff: staff, _rid: rid() }).then(reboot).then(function () { busy(btn, false); toast('บันทึกรายชื่อเจ้าหน้าที่แล้ว', 'ok'); paneStaff(p); }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
  };
}

/* ---------- ผู้ใช้ ---------- */
var ROLES = [['admin', 'ผู้ดูแลระบบ'], ['nurse', 'พยาบาล (บันทึกได้)'], ['exec', 'ผู้บริหาร (ดูอย่างเดียว)']];
function paneUsers(p) {
  var us = A.data.users;
  p.innerHTML = '<section class="card"><div class="card-h"><h2>ผู้ใช้ระบบ <span class="cnt">' + us.filter(function (u) { return u.active; }).length + '</span></h2><button class="btn sm primary" id="addUser">' + ic('plus') + 'เพิ่มผู้ใช้</button></div>' +
    '<p class="muted small pad">เข้าสู่ระบบด้วยรหัสเจ้าหน้าที่ 7 หลัก + รหัสผ่าน HIS · ชื่อดึงจาก HIS ตอนเข้าใช้ครั้งแรก · หน่วยงานหลัก = หน่วยที่เปิดขึ้นก่อน</p>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>สิทธิ์</th><th>หน่วยงานหลัก</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>' +
    us.map(function (u) { return '<tr class="' + (u.active ? '' : 'off') + '"><td><code>' + esc(u.emp) + '</code></td><td>' + esc(u.name || '—') + (u.title ? '<small class="muted"> · ' + esc(u.title) + '</small>' : '') + '</td><td><span class="tag ' + u.role + '">' + esc((ROLES.filter(function (r) { return r[0] === u.role; })[0] || ['', u.role])[1]) + '</span>' + (u.active ? '' : ' <span class="tag">ปิดใช้</span>') + '</td><td>' + esc(u.units.map(function (x) { var un = unitById(x); return un ? un.short : x; }).join(', ') || '—') + '</td><td class="muted small">' + esc(u.lastLogin ? thTime(u.lastLogin) : 'ยังไม่เคย') + '</td><td><button class="icon-btn sm" data-u="' + esc(u.emp) + '" aria-label="แก้ไข">' + ic('edit') + '</button></td></tr>'; }).join('') +
    '</tbody></table></div></section>';
  $('#addUser').onclick = function () { userForm(null, p); };
  $$('[data-u]', p).forEach(function (b) { b.onclick = function () { userForm(us.filter(function (u) { return u.emp === b.dataset.u; })[0], p); }; });
}
function userForm(u, p) {
  var isNew = !u; u = u || { emp: '', name: '', role: 'nurse', units: [], active: true, title: '' };
  var mo = modal({ title: isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + u.emp, body:
    '<div class="form2"><label class="fld"><span>รหัสเจ้าหน้าที่ 7 หลัก</span><input id="uEmp" inputmode="numeric" maxlength="7" value="' + esc(u.emp) + '"' + (isNew ? '' : ' disabled') + '></label>' +
    '<label class="fld"><span>ชื่อ-สกุล (เว้นว่างได้ ระบบดึงจาก HIS)</span><input id="uName" value="' + esc(u.name) + '"></label>' +
    '<label class="fld"><span>ตำแหน่ง</span><input id="uTitle" value="' + esc(u.title || '') + '" placeholder="เช่น พยาบาลวิชาชีพ"></label>' +
    '<label class="fld"><span>สิทธิ์</span><select id="uRole">' + ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === u.role ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label>' +
    '<div class="fld span2"><span>หน่วยงานหลัก</span><div class="chips">' + S.boot.units.map(function (x) { return '<label class="chk"><input type="checkbox" value="' + x.id + '"' + (u.units.indexOf(x.id) >= 0 ? ' checked' : '') + '><span>' + esc(x.short) + '</span></label>'; }).join('') + '</div></div>' +
    '<label class="chk span2"><input type="checkbox" id="uAct"' + (u.active ? ' checked' : '') + '><span>เปิดใช้งาน (ปิด = เข้าระบบไม่ได้ทันที)</span></label></div>',
    foot: '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="uOk">บันทึก</button>' });
  $('#uOk', mo).onclick = function () {
    var btn = this;
    busy(btn, true);
    api('saveUser', { emp: $('#uEmp', mo).value, name: $('#uName', mo).value, title: $('#uTitle', mo).value, role: $('#uRole', mo).value, units: $$('.chips input:checked', mo).map(function (x) { return x.value; }), active: $('#uAct', mo).checked, _rid: rid() })
      .then(function () { return Promise.all([api('getAdmin', {}), reboot()]); }).then(function (r) { A.data = r[0]; closeModal(); toast('บันทึกผู้ใช้แล้ว', 'ok'); paneUsers(p); })
      .catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
  };
}

/* ---------- ข้อมูลและการเชื่อมต่อ ---------- */
function paneData(p) {
  var d = A.data, c = d.conn, bf = d.backfill, pct = bf.total ? Math.round(bf.done / bf.total * 100) : 0;
  var bfTxt = { running: 'กำลังดึง', done: 'เสร็จแล้ว', stopped: 'หยุดไว้', '': 'ยังไม่เริ่ม' }[bf.status] || bf.status;
  var hol = Object.keys(d.holidays || {}).sort().map(function (k) { return k + ' ' + (d.holidays[k][1] || ''); }).join('\n');
  p.innerHTML =
    '<section class="card"><div class="card-h"><h2>ยอดผู้ป่วยจาก HIS</h2></div><div class="pad">' +
    '<dl class="kv"><div><dt>ข้อมูลในระบบ</dt><dd>' + fmt(d.data.daysOk) + ' วัน' + (d.data.first ? ' (' + thDate(d.data.first, { short: true }) + ' – ' + thDate(d.data.last, { short: true }) + ')' : '') + (d.data.daysErr ? ' · <span class="neg">ดึงไม่สำเร็จ ' + d.data.daysErr + ' วัน</span>' : '') + '</dd></div>' +
    '<div><dt>ดึงยอดวันนี้ล่าสุด</dt><dd>' + esc(d.data.lastLive || '—') + '</dd></div><div><dt>ตรวจซ้ำกลางคืนล่าสุด</dt><dd>' + esc(d.data.lastNightly || '—') + '</dd></div>' +
    '<div><dt>ดึงย้อนหลัง</dt><dd><b>' + bfTxt + '</b>' + (bf.from ? ' · ' + thDate(bf.from, { short: true }) + ' – ' + thDate(bf.to, { short: true }) + ' · ' + bf.done + '/' + bf.total + ' วัน' : '') + (bf.lastRun ? '<br><small class="muted">รอบล่าสุด ' + esc(bf.lastRun) + '</small>' : '') + '</dd></div></dl>' +
    (bf.status === 'running' ? '<div class="prog"><i style="width:' + pct + '%"></i></div>' : '') +
    '<div class="row-acts"><label class="fld inl"><span>ตั้งแต่</span><input type="date" id="bfFrom" value="2023-10-01"></label><label class="fld inl"><span>ถึง</span><input type="date" id="bfTo" value="' + addDays(today(), -1) + '"></label>' +
    '<button class="btn ghost" id="bfFill">ดึงเฉพาะวันที่ยังไม่มี</button><button class="btn ghost" id="bfAll">ดึงใหม่ทั้งช่วง</button>' + (bf.status === 'running' ? '<button class="btn danger ghost" id="bfStop">หยุด</button>' : '') + '</div>' +
    '<p class="muted small">ระบบดึงย้อนหลังทุก 10 นาที (ใหม่ → เก่า) ประมาณ 70 วันต่อรอบ · "ดึงใหม่ทั้งช่วง" ใช้เมื่อ HIS แก้ยอดย้อนหลัง</p></div></section>' +
    '<section class="card"><div class="card-h"><h2>ทดสอบ API</h2></div><div class="pad"><div class="row-acts"><input type="date" id="tDate" value="' + today() + '"><button class="btn ghost" id="tApi">' + ic('refresh') + 'ทดสอบดึง</button><label class="chk sm"><input type="checkbox" id="tStore"><span>บันทึกผลลงระบบด้วย</span></label></div><div id="tRes"></div>' +
    '<label class="fld"><span>ลิงก์ API ({date} = วันที่ yyyyMMdd)</span><input id="apiUrl" value="' + esc(c.apiUrl) + '"></label>' +
    '<p class="muted small">ล็อกอิน HIS: ' + (c.hisReady ? '<span class="pos">เชื่อมแล้ว (HIS_API_TOKEN)</span>' : '<span class="neg">ยังไม่มี HIS_API_TOKEN</span>') + (c.setupPass ? ' · <span class="neg">ยังมี SETUP_PASS (ลบออกจาก Script Properties เมื่อเชื่อม HIS แล้ว)</span>' : '') + '</p></div></section>' +
    '<section class="card"><div class="card-h"><h2>การแสดงผล</h2></div><div class="pad">' +
    '<label class="fld"><span>การแบ่งสัปดาห์ในรายงานรายเดือน (ค่าเริ่มต้น)</span><select id="weekMode"><option value="block"' + (c.weekMode !== 'mon' ? ' selected' : '') + '>วันที่ 1–7, 8–14, 15–21, 22–28, 29–สิ้นเดือน (ตามแบบฟอร์มเดิม)</option><option value="mon"' + (c.weekMode === 'mon' ? ' selected' : '') + '>จันทร์–อาทิตย์</option></select></label>' +
    '<label class="fld"><span>ข้อความติดต่อผู้ดูแลระบบ</span><input id="contact" value="' + esc(c.contact) + '" placeholder="เช่น ติดต่อ … โทรภายใน …"></label>' +
    '<label class="fld"><span>วันหยุดนักขัตฤกษ์ (บรรทัดละวัน: ปปปป-ดด-วว ชื่อวันหยุด)</span><textarea id="hol" rows="5" placeholder="2026-12-07 ชดเชยวันพ่อแห่งชาติ">' + esc(hol) + '</textarea></label>' +
    saveBtn('saveConn') + (c.dbUrl ? '<p class="muted small">ฐานข้อมูล: <a href="' + esc(c.dbUrl) + '" target="_blank" rel="noopener">Google Sheet (ห้ามแชร์)</a></p>' : '') + '</div></section>';
  var bfGo = function (mode, btn) { busy(btn, true); api('startBackfill', { from: $('#bfFrom').value, to: $('#bfTo').value, mode: mode }).then(function () { return api('getAdmin', {}); }).then(function (x) { A.data = x; toast('เริ่มดึงข้อมูลแล้ว ระบบทำงานเบื้องหลังทุก 10 นาที', 'ok'); paneData(p); }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); }); };
  $('#bfFill').onclick = function () { bfGo('fill', this); };
  $('#bfAll').onclick = function () { var b = this; confirmBox('ดึงใหม่ทั้งช่วง', 'ยอดจาก HIS ของทุกวันในช่วงนี้จะถูกดึงใหม่ทับของเดิม (บันทึกของพยาบาลไม่เปลี่ยน)', 'ดึงใหม่').then(function (y) { if (y) bfGo('all', b); }); };
  if ($('#bfStop')) $('#bfStop').onclick = function () { var b = this; busy(b, true); api('stopBackfill', {}).then(function () { return api('getAdmin', {}); }).then(function (x) { A.data = x; paneData(p); }); };
  $('#tApi').onclick = function () {
    var b = this; busy(b, true, 'กำลังดึง…');
    api('testApi', { date: $('#tDate').value, store: $('#tStore').checked }).then(function (r) {
      busy(b, false);
      $('#tRes').innerHTML = r.ok ? '<div class="alert ok">' + ic('check') + '<span>สำเร็จ ' + thDate(r.date, { short: true }) + ' · ' + r.raw + ' แถว → ผู้ป่วย <b>' + r.total + '</b> ราย · ' + (r.ms / 1000).toFixed(1) + ' วินาที<br>' + Object.keys(r.clinics).map(function (k) { return k + ' ' + r.clinics[k]; }).join(' · ') + (r.stored ? '<br>บันทึกลงระบบแล้ว' : '') + '</span></div>' : '<div class="alert err">' + ic('alert') + '<span>ไม่สำเร็จ: ' + esc(r.reason) + '</span></div>';
      if (r.stored) { S.days = {}; S.months = {}; }
    }).catch(function (e) { busy(b, false); toast(e.message, 'err'); });
  };
  $('#saveConn').onclick = function () {
    var b = this, days = $('#hol').value.split(/\n/).map(function (l) { var m = l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/); return m ? { date: m[1], name: m[2] } : null; }).filter(Boolean);
    busy(b, true);
    api('saveConnection', { apiUrl: $('#apiUrl').value, weekMode: $('#weekMode').value, contact: $('#contact').value, _rid: rid() }).then(function () { return api('saveHolidays', { days: days, _rid: rid() }); })
      .then(reboot).then(function () { return api('getAdmin', {}); }).then(function (x) { A.data = x; busy(b, false); toast('บันทึกแล้ว', 'ok'); paneData(p); }).catch(function (e) { busy(b, false); toast(e.message, 'err'); });
  };
}

/* ---------- ประวัติการแก้ไข ---------- */
var ACT_TH = { LOGIN: 'เข้าสู่ระบบ', EDIT: 'แก้ไขรายงาน', REPORT: 'ส่งรายงาน', CASE_ADD: 'เพิ่มผู้ป่วยส่งต่อ', CASE_EDIT: 'แก้ผู้ป่วยส่งต่อ', CASE_DELETE: 'ลบผู้ป่วยส่งต่อ', SETTINGS: 'ตั้งค่า', USER_ADD: 'เพิ่มผู้ใช้', USER_EDIT: 'แก้ผู้ใช้', BACKFILL: 'ดึงย้อนหลัง' };
function paneAudit(p) {
  api('getAudit', {}).then(function (d) {
    p.innerHTML = '<section class="card"><div class="card-h"><h2>ประวัติการแก้ไข (400 รายการล่าสุด)</h2></div><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>วันที่รายงาน</th><th>ช่อง</th><th>จาก</th><th>เป็น</th></tr></thead><tbody>' +
      d.rows.map(function (r) { return '<tr><td class="nw">' + esc(thTime(r.at)) + '</td><td>' + esc(r.name || r.user) + '</td><td>' + esc(ACT_TH[r.action] || r.action) + '</td><td class="nw">' + esc(r.date ? thDate(r.date, { short: true }) : '') + '</td><td>' + esc(r.field) + '</td><td class="muted">' + esc(r.from) + '</td><td>' + esc(r.to) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }).catch(function (e) { p.innerHTML = '<div class="alert err">' + ic('alert') + '<span>' + esc(e.message) + '</span></div>'; });
}
