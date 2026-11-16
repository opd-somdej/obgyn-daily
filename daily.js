/* daily.js — หน้ารายงานประจำวัน (บันทึกอัตโนมัติทีละช่อง) + ผู้ป่วยส่งต่อ + ระบุแพทย์ + ส่งรายงาน (ภาพ/ใบ A4/ข้อความ) */
'use strict';
var D = { date: '', unit: '', m: null, loading: false };

/* ---------- โหลดข้อมูลวัน ---------- */
function dayKey(date) { return date; }
function loadDay(date, opt) {
  opt = opt || {};
  return api(opt.refresh ? 'refreshDay' : 'getDay', { date: date, force: !!opt.force }).then(function (d) {
    d._at = Date.now();
    var keep = S.days[date];
    // เก็บค่าที่ยังรอบันทึกไว้ (ไม่ให้ข้อมูลเซิร์ฟเวอร์ทับสิ่งที่กำลังพิมพ์)
    Object.keys(S.pending).forEach(function (k) {
      var p = k.split('|'); if (p[0] !== date) return;
      var e = d.entries[p[1]] || (d.entries[p[1]] = { data: {} });
      Object.keys(S.pending[k]).forEach(function (path) { applyLocal(e.data, path, S.pending[k][path]); });
    });
    S.days[date] = d;
    if (keep && keep._msgShown) d._msgShown = true;
    return d;
  });
}
function staleApi(d) {
  if (!d || d.date !== d.today) return false;
  var at = d.api && d.api.at; if (!at) return true;
  var p = at.split(/[- :]/).map(Number), t = Date.UTC(p[0], p[1] - 1, p[2], p[3] - 7, p[4]);
  return Date.now() - t > 25 * 60000;
}

PAGES.day = function (r, el) {
  var date = r.date || today();
  if (date > today()) date = today();
  var units = myUnits(), unit = r.b && unitById(r.b) ? r.b : (lsGet('unit', '') && unitById(lsGet('unit', '')) ? lsGet('unit', '') : units[0].id);
  D.date = date; D.unit = unit; lsSet('unit', unit);
  document.title = 'รายงานประจำวัน ' + thDate(date, { short: true }) + ' · OB-GYN Daily';
  var cached = S.days[date];
  if (cached) renderDay(el); else el.innerHTML = daySkeleton();
  if (!cached || Date.now() - (cached._at || 0) > 60000) {
    loadDay(date).then(function (d) {
      if (D.date !== date || S.page !== 'day') return;
      renderDay(el);
      if (staleApi(d)) refreshApi(false);
    }).catch(function (e) { if (!cached) el.innerHTML = errorBox(e.message, 'location.reload()'); else toast(e.message, 'err'); });
  } else if (staleApi(cached)) refreshApi(false);
};
function daySkeleton() {
  return '<div class="page day"><div class="sk sk-head"></div><div class="sk sk-tally"></div><div class="day-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div>';
}
function errorBox(msg, retry) {
  return '<div class="page"><div class="empty err">' + ic('alert') + '<h2>โหลดข้อมูลไม่สำเร็จ</h2><p>' + esc(msg) + '</p><button class="btn primary" onclick="' + retry + '">' + ic('refresh') + 'ลองอีกครั้ง</button></div></div>';
}
function refreshApi(manual) {
  var btn = $('#btnRefresh'), date = D.date;
  busy(btn, true, 'กำลังดึงยอด…');
  setApiState('กำลังดึงยอดจาก HIS…', 'wait');
  loadDay(date, { refresh: true, force: manual }).then(function (d) {
    busy(btn, false);
    if (D.date !== date || S.page !== 'day') return;
    renderDay($('#main'));
    if (manual && d.message) toast(d.message, /ไม่สำเร็จ/.test(d.message) ? 'err' : 'ok');
  }).catch(function (e) { busy(btn, false); setApiState('ดึงยอดไม่สำเร็จ', 'err'); if (manual) toast(e.message, 'err'); });
}
function setApiState(t, k) { var s = $('#apiState'); if (s) { s.className = 'api-state ' + (k || ''); s.innerHTML = (k === 'wait' ? '<span class="spin sm"></span>' : '') + esc(t); } }

/* ---------- วาดหน้า ---------- */
function renderDay(el) {
  var d = S.days[D.date]; if (!d) return;
  var keepNew = $('#newProc') ? { v: $('#newProc').value, f: document.activeElement === $('#newProc') } : null;   // ไม่ให้ข้อความที่กำลังพิมพ์หายเมื่อยอดอัปเดต
  var m = D.m = computeDay(d, D.unit), u = m.unit, ro = !canEdit();
  var isToday = D.date === today(), units = myUnits();
  var apiTxt = d.api && d.api.status === 'ok' ? 'ยอดจาก HIS อัปเดต ' + thTime(d.api.at) : d.api && /^error/.test(d.api.status) ? 'ดึงยอดไม่สำเร็จ · ' + d.api.status.replace(/^error:/, '') : 'ยังไม่มียอดจาก HIS';
  var dayTag = d.holiday ? '<span class="tag hol">' + esc(d.holiday) + '</span>' : d.dayType === 'S' ? '<span class="tag we">วันหยุดสุดสัปดาห์</span>' : '';
  var rep = m.entry && m.entry.reportedAt ? '<span class="chip ok">' + ic('check') + 'ส่งรายงานแล้ว ' + esc(thTime(m.entry.reportedAt).replace(/^วันนี้ /, '')) + '</span>' : (m.filled ? '<span class="chip">' + ic('edit') + 'บันทึกแล้ว ยังไม่ส่งรายงาน</span>' : '<span class="chip warn">' + ic('note') + 'ยังไม่ได้บันทึก</span>');
  el.innerHTML =
    '<div class="page day" style="--unit:' + esc(u.color) + '">' +
    '<header class="day-head">' +
    '<div class="dh-date">' +
    '<button class="icon-btn" id="prevD" aria-label="วันก่อนหน้า">' + ic('left') + '</button>' +
    '<label class="dh-pick" title="เลือกวันที่"><span class="dh-wd">' + TH_D[dow(D.date)] + (isToday ? ' · วันนี้' : '') + '</span><span class="dh-d">' + thDate(D.date) + '</span>' +
    '<input type="date" id="pickD" value="' + D.date + '" max="' + today() + '" aria-label="เลือกวันที่"></label>' +
    '<button class="icon-btn" id="nextD" aria-label="วันถัดไป" ' + (isToday ? 'disabled' : '') + '>' + ic('right') + '</button>' +
    (isToday ? '' : '<button class="btn ghost sm" id="toToday">วันนี้</button>') + dayTag + '</div>' +
    (units.length > 1 ? '<div class="seg" role="tablist" aria-label="หน่วยงาน">' + units.map(function (x) { return '<button role="tab" data-unit="' + x.id + '" class="' + (x.id === D.unit ? 'on' : '') + '" aria-selected="' + (x.id === D.unit) + '" style="--c:' + esc(x.color) + '">' + esc(x.short) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="dh-acts"><span class="save-state" id="saveState" aria-live="polite"></span>' +
    '<button class="btn ghost" id="btnRefresh">' + ic('refresh') + '<span>ดึงยอดล่าสุด</span></button>' +
    '<button class="btn primary" id="btnShare">' + ic('send') + '<span>ส่งรายงาน</span></button></div>' +
    '</header>' +
    tallyHtml(m, apiTxt, rep) +
    (m.hidden ? '<div class="note-bar">' + ic('info') + '<span>คลินิกที่ปิดการแสดงไว้ (ไม่นับ): ' + Object.keys(m.hiddenList).map(function (k) { return esc(k) + ' ' + m.hiddenList[k]; }).join(' · ') + '</span></div>' : '') +
    (ro ? '<div class="note-bar">' + ic('info') + '<span>บัญชีผู้บริหาร ดูข้อมูลได้อย่างเดียว</span></div>' : '') +
    '<div class="day-grid">' +
    '<div class="col">' + doctorsHtml(m, ro) + extrasHtml(m, ro) + specialsHtml(m) + casesHtml(m, ro) + '</div>' +
    '<div class="col">' + procsHtml(m, ro) + kpisHtml(m, ro) + staffHtml(m, ro) + notesHtml(m, ro) + '</div>' +
    '</div>' +
    '<p class="foot-meta">' + (m.entry && m.entry.updatedAt ? 'แก้ไขล่าสุด ' + esc(thTime(m.entry.updatedAt)) + ' โดย ' + esc(userName(m.entry.updatedBy)) : 'ยังไม่มีการบันทึกของวันนี้') + '</p>' +
    '</div>';
  bindDay(el);
  paintSave();
  if (keepNew && keepNew.v && $('#newProc')) { $('#newProc').value = keepNew.v; if (keepNew.f) $('#newProc').focus(); }
}
function tallyHtml(m, apiTxt, rep) {
  var pAm = m.total ? Math.round(m.am / m.total * 100) : 0;
  return '<section class="tally" aria-label="สรุปยอดผู้ป่วย">' +
    '<div class="t-main"><span class="t-lbl">ผู้ป่วยทั้งหมด · ' + esc(m.unit.name) + '</span><span class="t-num" data-b="total">' + fmt(m.total) + '</span><span class="t-unit">ราย</span></div>' +
    '<div class="t-split"><div class="split-bar" role="img" aria-label="เช้า ' + m.am + ' บ่าย ' + m.pm + '"><span class="sb-am" data-b="amBar" style="width:' + pAm + '%"></span></div>' +
    '<div class="split-lg"><span><i class="dot am"></i>เช้า <b data-b="am">' + fmt(m.am) + '</b></span><span><i class="dot pm"></i>บ่าย <b data-b="pm">' + fmt(m.pm) + '</b></span></div></div>' +
    '<dl class="t-stats"><div><dt>แพทย์</dt><dd>' + m.docCount + ' คน</dd></div><div><dt>จาก HIS</dt><dd>' + fmt(m.apiTotal) + '</dd></div><div><dt>คีย์เพิ่ม</dt><dd data-b="extra">' + fmt(m.total - m.apiTotal) + '</dd></div>' +
    (m.unknownLeft ? '<div class="warn"><dt>ไม่ระบุแพทย์</dt><dd>' + m.unknownLeft + '</dd></div>' : '') + '</dl>' +
    '<div class="t-foot"><span class="api-state" id="apiState">' + esc(apiTxt) + '</span>' + rep + '</div>' +
    '</section>';
}
function numIn(path, val, opt) {
  opt = opt || {};
  return '<input class="ni' + (opt.cls ? ' ' + opt.cls : '') + '" inputmode="' + (opt.dec ? 'decimal' : 'numeric') + '" autocomplete="off" data-path="' + esc(path) + '" value="' + (val === 0 || val === '' || val == null ? '' : esc(val)) + '"' +
    (opt.max != null ? ' data-max="' + opt.max + '"' : '') + (opt.ro ? ' disabled' : '') + ' aria-label="' + esc(opt.label || '') + '" placeholder="' + esc(opt.ph == null ? '0' : opt.ph) + '">';
}
function doctorsHtml(m, ro) {
  var body = m.clinics.length ? m.clinics.map(function (c) {
    return '<tbody class="cg"><tr class="cg-h"><th colspan="4"><span class="cg-name">' + esc(c.short) + '</span>' + (c.special ? '<span class="tag sp">' + esc(c.special) + '</span>' : '') + (c.isNew ? '<span class="tag new">คลินิกใหม่</span>' : '') + '<span class="cg-code">' + esc(c.code) + '</span><span class="cg-tot">' + fmt(c.total) + '</span></th></tr>' +
      c.rows.map(function (r) {
        return '<tr class="' + (r.unknown ? 'unk' : '') + (r.total <= 0 ? ' zero' : '') + '"><td><div class="doc">' + (r.unknown ? '<span class="unk-n">ไม่ระบุแพทย์</span>' + (r.gave ? '<small>ย้ายแล้ว ' + r.gave + '</small>' : '') + (r.total > 0 && !ro ? '<button class="btn xs" data-assign="' + esc(c.code) + '">' + ic('wand') + 'ระบุแพทย์</button>' : '') : esc(r.name) + (r.got ? '<small class="got">+' + r.got + ' จากไม่ระบุ</small>' : '')) + '</div></td>' +
          '<td class="n tot">' + fmt(r.total) + '</td><td class="n am" data-am="' + esc(r.key) + '">' + fmt(r.am) + '</td>' +
          '<td class="n">' + (r.total > 0 ? numIn('pm.' + r.key, r.pm, { max: r.total, ro: ro, label: 'ยอดบ่าย ' + r.name }) : '') + '</td></tr>';
      }).join('') + '</tbody>';
  }).join('') : '<tbody><tr><td colspan="4" class="empty-row">' + (D.date === today() ? 'ยังไม่มีผู้ป่วยจาก HIS ของหน่วยนี้ · ระบบดึงยอดใหม่ทุก 30 นาที' : 'ไม่มีผู้ป่วยจาก HIS ในวันนี้') + '</td></tr></tbody>';
  return '<section class="card"><div class="card-h"><h2>' + ic('stetho') + 'ผู้ป่วยรายแพทย์</h2><span class="hint">ใส่เฉพาะยอด<b>บ่าย</b> ระบบคิดยอดเช้าให้</span></div>' +
    '<div class="tbl-wrap"><table class="tbl docs"><thead><tr><th>แพทย์</th><th class="n">รวม</th><th class="n">เช้า</th><th class="n">บ่าย</th></tr></thead>' + body + '</table></div></section>';
}
function extrasHtml(m, ro) {
  if (!m.extras.length) return '';
  return '<section class="card"><div class="card-h"><h2>' + ic('plus') + 'ยอดคีย์เพิ่ม</h2><span class="hint">ผู้ป่วยที่ไม่มีในระบบ HIS ของคลินิก</span></div>' +
    '<table class="tbl pairs"><thead><tr><th>รายการ</th><th class="n">เช้า</th><th class="n">บ่าย</th><th class="n">รวม</th></tr></thead><tbody>' +
    m.extras.map(function (x) { return '<tr><td>' + esc(x.name) + (x.countIn ? '' : ' <span class="tag">ไม่นับรวมยอด</span>') + '</td><td class="n">' + numIn('ex.' + x.id + '.0', x.am, { ro: ro, label: x.name + ' เช้า' }) + '</td><td class="n">' + numIn('ex.' + x.id + '.1', x.pm, { ro: ro, label: x.name + ' บ่าย' }) + '</td><td class="n tot" data-sum="ex.' + esc(x.id) + '">' + nz(x.total) + '</td></tr>'; }).join('') +
    '</tbody></table></section>';
}
function specialsHtml(m) {
  var sp = m.specials;
  return '<section class="card" id="secSpecial"><div class="card-h"><h2>' + ic('heart') + 'คลินิกพิเศษ</h2><span class="hint">คำนวณจากยอดคลินิก</span></div>' +
    (sp.length ? '<ul class="spec">' + sp.map(function (s) { return '<li class="' + (s.total ? '' : 'zero') + '"><span>' + esc(s.label) + (s.docs.length ? '<small>' + esc(s.docs.join(', ')) + '</small>' : '') + '</span><b>' + fmt(s.total) + '</b></li>'; }).join('') + '</ul>'
      : '<p class="muted small pad">ยังไม่ได้กำหนดคลินิกพิเศษของหน่วยนี้ (ตั้งค่า › หน่วยงานและคลินิก)</p>') + '</section>';
}
function procsHtml(m, ro) {
  var t = 0; m.procs.forEach(function (p) { t += p.total; });
  return '<section class="card"><div class="card-h"><h2>' + ic('hand') + 'หัตถการ</h2><span class="hint" data-b="procTot">รวม ' + fmt(t) + ' ครั้ง</span></div>' +
    '<table class="tbl pairs procs"><thead><tr><th>หัตถการ</th><th class="n">เช้า</th><th class="n">บ่าย</th></tr></thead><tbody>' +
    m.procs.map(function (p) {
      return '<tr class="' + (p.total ? 'has' : '') + (p.active ? '' : ' off') + '" data-proc="' + esc(p.id) + '"><td>' + esc(p.name) + (p.custom ? ' <span class="tag cu" title="เพิ่มจากหน้าบันทึก ใช้เฉพาะหน่วยงานนี้">เพิ่มเอง</span>' : '') + (p.linked ? '<small>นับจากรายชื่อผู้ป่วยส่งต่อ</small>' : '') + '</td>' +
        (p.linked ? '<td class="n tot">' + nz(p.am) + '</td><td class="n tot">' + nz(p.pm) + '</td>' :
          '<td class="n">' + numIn('pr.' + p.id + '.0', p.am, { ro: ro, label: p.name + ' เช้า' }) + '</td><td class="n">' + numIn('pr.' + p.id + '.1', p.pm, { ro: ro, label: p.name + ' บ่าย' }) + '</td>') + '</tr>';
    }).join('') + '</tbody></table>' +
    (ro ? '' : '<form class="add-item" id="addProc" autocomplete="off"><input type="text" id="newProc" maxlength="60" placeholder="เพิ่มหัตถการ เช่น ฉีดสี" aria-label="ชื่อหัตถการใหม่"><button class="btn ghost sm" type="submit">' + ic('plus') + '<span>เพิ่ม</span></button>' +
      '<small class="muted">รายการใหม่ใช้เฉพาะ' + esc(m.unit.short || m.unit.name) + ' · แอดมินแก้ชื่อ/ปิด/เรียงลำดับได้ที่ตั้งค่า</small></form>') +
    '</section>';
}
/** เพิ่มหัตถการจากหน้าบันทึก (พยาบาล/แอดมิน) → ใช้ได้ทันทีและทุกวันต่อไป เฉพาะหน่วยงานนี้ */
function addProc(form) {
  var inp = $('#newProc', form), name = inp.value.replace(/\s+/g, ' ').trim(), btn = $('button', form);
  if (name.length < 2) { toast('พิมพ์ชื่อหัตถการก่อนกดเพิ่ม', 'err'); inp.focus(); return; }
  busy(btn, true);
  flushSave().then(function () { return api('addItem', { kind: 'proc', unit: D.unit, name: name, _rid: rid() }); }).then(function (r) {
    var it = r.item, list = S.boot.items || (S.boot.items = []), i = -1;
    list.forEach(function (x, j) { if (x.id === it.id) i = j; });
    if (i >= 0) list[i] = it; else list.push(it);
    setBoot(S.boot); S.months = {};
    toast(r.existed ? (r.reopened ? 'เปิดใช้ "' + it.name + '" อีกครั้งแล้ว' : 'มี "' + it.name + '" อยู่แล้ว') : 'เพิ่ม "' + it.name + '" แล้ว', 'ok');
    inp.value = ''; renderDay($('#main'));
    var x = $('input[data-path="pr.' + it.id + '.0"]'); if (x) { x.closest('tr').classList.add('flash'); x.focus(); }
  }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
}
function kpisHtml(m, ro) {
  if (!m.kpis.length) return '';
  return '<section class="card"><div class="card-h"><h2>' + ic('gauge') + 'ตัวชี้วัด</h2></div><div class="kpis">' +
    m.kpis.map(function (k) { return '<label class="kpi"><span>' + esc(k.name.replace(/\s*\(%\)$/, '')) + '</span><span class="kpi-in">' + numIn('kp.' + k.id, k.value, { ro: ro, dec: k.type === 'pct', ph: '', label: k.name }) + (k.type === 'pct' ? '<i>%</i>' : '') + '</span></label>'; }).join('') +
    '</div></section>';
}
function staffHtml(m, ro) {
  var pos = S.boot.positions || ['GN', 'PN', 'NA'];
  var groups = pos.map(function (p) {
    var list = m.roster.filter(function (s) { return s.pos === p; });
    m.staffOn.forEach(function (x) { if (x.pos === p && !list.some(function (y) { return y.id === x.id; })) list.push(x); });
    var chips = list.map(function (s) {
      var on = m.selected[s.id];
      return '<button class="stf' + (on ? ' on' : '') + '" data-stf="' + esc(s.id) + '" ' + (ro ? 'disabled' : '') + ' aria-pressed="' + !!on + '"><span>' + esc(s.name) + '</span>' + (on ? '<b>' + esc(on.sh) + (on.note ? ' ' + esc(on.note) : '') + '</b>' : '') + '</button>';
    }).join('');
    return '<div class="stf-g"><div class="stf-h"><b>' + p + '</b><span class="stf-n">' + numIn('sn.' + p, m.sn[p] != null ? m.sn[p] : '', { ro: ro, dec: true, ph: fmt(m.staffCount[p] || 0), label: 'จำนวน ' + p, cls: 'sm' }) + '<small>คน</small></span></div>' +
      '<div class="stf-list">' + (chips || '<span class="muted small">ยังไม่มีรายชื่อ ' + p + ' (แอดมินเพิ่มที่ ตั้งค่า › เจ้าหน้าที่)</span>') + '</div></div>';
  }).join('');
  return '<section class="card"><div class="card-h"><h2>' + ic('users') + 'เจ้าหน้าที่ขึ้นปฏิบัติงาน</h2><span class="hint">แตะชื่อ: ช/บ → ช → บ → ไม่ขึ้น</span></div>' + groups +
    (!ro && m.staffOn.length ? '<div class="pad-x"><button class="btn xs ghost" id="stfNote">' + ic('edit') + 'ใส่เวลาเวร (เช่น ช 8-10)</button></div>' : '') + '</section>';
}
function notesHtml(m, ro) {
  return '<section class="card"><div class="card-h"><h2>' + ic('note') + 'ปัญหาที่พบ / หมายเหตุ</h2></div><div class="pad">' +
    '<label class="fld"><span>ปัญหาที่พบ</span><textarea data-path="prob" rows="3" ' + (ro ? 'disabled' : '') + ' placeholder="เช่น ผู้ป่วยมาก แพทย์มาตรวจช้า…">' + esc(m.prob) + '</textarea></label>' +
    '<label class="fld"><span>หมายเหตุ</span><textarea data-path="note" rows="2" ' + (ro ? 'disabled' : '') + '>' + esc(m.note) + '</textarea></label></div></section>';
}
function casesHtml(m, ro) {
  var list = m.cases.map(function (c) {
    return '<li class="case"><div class="case-top"><span class="tag ty">' + esc(c.type) + '</span><span class="tag">' + (c.period === 'pm' ? 'บ่าย' : 'เช้า') + '</span>' + (c.dest ? '<span class="case-dest">→ ' + esc(c.dest) + '</span>' : '') +
      (ro ? '' : '<span class="case-acts"><button class="icon-btn sm" data-case="' + esc(c.id) + '" aria-label="แก้ไข">' + ic('edit') + '</button></span>') + '</div>' +
      '<div class="case-name">' + esc(c.name || '-') + (c.hn ? ' <span class="muted">HN ' + esc(c.hn) + '</span>' : '') + (c.age ? ' <span class="muted">อายุ ' + esc(c.age) + '</span>' : '') + '</div>' +
      (c.dx || c.note ? '<div class="case-dx">' + esc(c.dx) + (c.note ? ' · ' + esc(c.note) : '') + '</div>' : '') + '</li>';
  }).join('');
  return '<section class="card"><div class="card-h"><h2>' + ic('send') + 'ผู้ป่วยส่งต่อ <span class="cnt">' + m.cases.length + '</span></h2>' + (ro ? '' : '<button class="btn sm" id="addCase">' + ic('plus') + 'เพิ่มรายชื่อ</button>') + '</div>' +
    (list ? '<ul class="cases">' + list + '</ul>' : '<p class="muted small pad">ยังไม่มีผู้ป่วยส่งต่อ (ส่ง Admit/Ward · ส่ง LAB · ส่ง Consult · ส่ง OR ด่วน)</p>') + '</section>';
}

/* ---------- การกระทำ ---------- */
function bindDay(el) {
  var nav = function (d) { go('#/day/' + d + '/' + D.unit); };
  $('#prevD').onclick = function () { nav(addDays(D.date, -1)); };
  $('#nextD').onclick = function () { if (D.date < today()) nav(addDays(D.date, 1)); };
  if ($('#toToday')) $('#toToday').onclick = function () { nav(today()); };
  $('#pickD').onchange = function () { if (this.value) nav(this.value > today() ? today() : this.value); };
  $$('[data-unit]', el).forEach(function (b) { b.onclick = function () { go('#/day/' + D.date + '/' + b.dataset.unit); }; });
  $('#btnRefresh').onclick = function () { refreshApi(true); };
  $('#btnShare').onclick = function () { flushSave().then(openShare); };
  el.addEventListener('input', onDayInput);
  el.addEventListener('change', function (e) { if (e.target.matches('[data-path]')) flushSave(); });
  el.addEventListener('focusin', function (e) { if (e.target.classList.contains('ni')) setTimeout(function () { try { e.target.select(); } catch (x) { } }, 0); });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('ni')) {   // Enter = ไปช่องถัดไป
      e.preventDefault(); var all = $$('input.ni:not([disabled])', el), i = all.indexOf(e.target); if (all[i + 1]) all[i + 1].focus(); else e.target.blur();
    }
  });
  $$('[data-assign]', el).forEach(function (b) { b.onclick = function () { openAssign(b.dataset.assign); }; });
  $$('[data-stf]', el).forEach(function (b) { b.onclick = function () { cycleStaff(b.dataset.stf); }; });
  if ($('#stfNote')) $('#stfNote').onclick = openStaffNote;
  if ($('#addCase')) $('#addCase').onclick = function () { openCase(null); };
  if ($('#addProc')) $('#addProc').onsubmit = function (e) { e.preventDefault(); addProc(this); };
  $$('[data-case]', el).forEach(function (b) { b.onclick = function () { openCase(b.dataset.case); }; });
}
function onDayInput(e) {
  var t = e.target; if (!t.matches('[data-path]')) return;
  var path = t.dataset.path, v = t.value;
  if (t.classList.contains('ni')) {
    var dec = t.inputMode === 'decimal';
    var clean = String(v).replace(dec ? /[^0-9.]/g : /[^0-9]/g, '');
    if (clean !== v) t.value = clean;
    v = clean;
    if (t.dataset.max != null && +v > +t.dataset.max) { t.classList.add('bad'); toast('ยอดบ่ายเกินยอดรวมของแพทย์ (' + t.dataset.max + ')', 'err'); v = t.dataset.max; t.value = v; setTimeout(function () { t.classList.remove('bad'); }, 1200); }
    if (/^pm\.|^ex\.|^pr\.|^kp\.|^sn\./.test(path) && !dec) v = v === '' ? 0 : +v;
  }
  queueSave(path, v);
  repaint();
}
/** ใส่ค่าในข้อมูลในเครื่อง (ตรรกะเดียวกับหลังบ้าน) */
function applyLocal(data, path, v) {
  var p = path.split('.'), top = p[0];
  if (top === 'prob' || top === 'note') { data[top] = v; return; }
  if (top === 'st') { data.st = v; return; }
  var m = data[top] || (data[top] = {});
  if (top === 'pm') { if (+v) m[p[1]] = +v; else delete m[p[1]]; }
  else if (top === 'asg') { var mm = m[p[1]] || (m[p[1]] = {}); if (+v) mm[p[2]] = +v; else delete mm[p[2]]; }
  else if (top === 'ex' || top === 'pr') { var pr = m[p[1]] || [0, 0]; pr[p[2] === '1' ? 1 : 0] = +v || 0; if (!pr[0] && !pr[1]) delete m[p[1]]; else m[p[1]] = pr; }
  else if (top === 'kp' || top === 'sn') { if (v === '' || v == null) delete m[p[1]]; else m[p[1]] = String(v); }
}
function curEntry() {
  var d = S.days[D.date]; var e = d.entries[D.unit] || (d.entries[D.unit] = { data: {} }); if (!e.data) e.data = {}; return e;
}
function queueSave(path, v) {
  var k = D.date + '|' + D.unit;
  (S.pending[k] || (S.pending[k] = {}))[path] = v;
  applyLocal(curEntry().data, path, v);
  paintSave();
  saveSoon();
}
var saveSoon = debounce(function () { flushSave(); }, 900);
var flushing = null;
function flushSave() {
  if (flushing) return flushing.then(function () { return Object.keys(S.pending).length ? flushSave() : null; });
  var keys = Object.keys(S.pending); if (!keys.length) return Promise.resolve();
  var k = keys[0], ch = S.pending[k], p = k.split('|');
  delete S.pending[k];
  S.saving = true; paintSave();
  var changes = Object.keys(ch).map(function (path) { return { path: path, value: ch[path] }; });
  flushing = api('saveEntry', { date: p[0], unit: p[1], changes: changes, _rid: rid() }).then(function (res) {
    var d = S.days[p[0]];
    if (d) {
      var e = d.entries[p[1]] || (d.entries[p[1]] = {});
      e.data = res.data; e.updatedAt = res.updatedAt; e.updatedBy = res.updatedBy;
      if (S.pending[k]) Object.keys(S.pending[k]).forEach(function (path) { applyLocal(e.data, path, S.pending[k][path]); });
    }
    delete S.months[p[0].slice(0, 7)];
    S.saving = false; S.saveErr = ''; S.lastSaved = Date.now(); flushing = null; paintSave();
    if (Object.keys(S.pending).length) return flushSave();
  }).catch(function (e) {
    var cur = S.pending[k] || {}; Object.keys(ch).forEach(function (path) { if (!(path in cur)) cur[path] = ch[path]; }); S.pending[k] = cur;
    S.saving = false; S.saveErr = e.message; flushing = null; paintSave();
    toast('บันทึกไม่สำเร็จ: ' + e.message, 'err');
    setTimeout(function () { if (Object.keys(S.pending).length && !flushing) flushSave(); }, 8000);
  });
  return flushing;
}
function paintSave() {
  var s = $('#saveState'); if (!s) return;
  var pend = Object.keys(S.pending).length;
  if (S.saving) s.innerHTML = '<span class="spin sm"></span>กำลังบันทึก…', s.className = 'save-state wait';
  else if (S.saveErr && pend) s.innerHTML = ic('alert') + 'ยังไม่ได้บันทึก · ลองใหม่อัตโนมัติ', s.className = 'save-state err';
  else if (pend) s.innerHTML = ic('edit') + 'กำลังแก้ไข…', s.className = 'save-state';
  else if (S.lastSaved) s.innerHTML = ic('check') + 'บันทึกแล้ว', s.className = 'save-state ok';
  else s.innerHTML = '', s.className = 'save-state';
}
/** อัปเดตตัวเลขที่คำนวณ (ไม่วาดใหม่ทั้งหน้า → ช่องที่กำลังพิมพ์ไม่หลุด) */
function repaint() {
  var m = D.m = computeDay(S.days[D.date], D.unit), el = $('#main');
  var set = function (b, v) { var x = $('[data-b="' + b + '"]', el); if (x) x.textContent = v; };
  set('total', fmt(m.total)); set('am', fmt(m.am)); set('pm', fmt(m.pm)); set('extra', fmt(m.total - m.apiTotal));
  var bar = $('[data-b="amBar"]', el); if (bar) bar.style.width = (m.total ? Math.round(m.am / m.total * 100) : 0) + '%';
  m.clinics.forEach(function (c) { c.rows.forEach(function (r) { var x = $('[data-am="' + r.key.replace(/"/g, '') + '"]', el); if (x) x.textContent = fmt(r.am); }); });
  m.extras.forEach(function (x) { var c = $('[data-sum="ex.' + x.id + '"]', el); if (c) c.textContent = nz(x.total); });
  var t = 0; m.procs.forEach(function (p) { t += p.total; }); set('procTot', 'รวม ' + fmt(t) + ' ครั้ง');
  $$('table.procs tbody tr', el).forEach(function (tr, i) { var p = m.procs[i]; if (p) tr.classList.toggle('has', p.total > 0); });
  var sp = $('#secSpecial'); if (sp) { var tmp = document.createElement('div'); tmp.innerHTML = specialsHtml(m); sp.replaceWith(tmp.firstChild); }
  $$('.stf-n input', el).forEach(function (inp) { var p = inp.dataset.path.split('.')[1]; inp.placeholder = fmt(m.staffCount[p] || 0); });
}

/* ---------- เจ้าหน้าที่ ---------- */
var SHIFT_CYCLE = ['ช/บ', 'ช', 'บ'];
function cycleStaff(id) {
  var e = curEntry(), st = (e.data.st || []).slice(), i = -1;
  st.forEach(function (x, j) { if (x.id === id) i = j; });
  if (i < 0) st.push({ id: id, sh: 'ช/บ' });
  else { var n = SHIFT_CYCLE.indexOf(st[i].sh) + 1; if (n >= SHIFT_CYCLE.length) st.splice(i, 1); else st[i] = { id: id, sh: SHIFT_CYCLE[n], note: st[i].note || '' }; }
  queueSave('st', st);
  renderDay($('#main'));
}
function openStaffNote() {
  var e = curEntry(), st = e.data.st || [];
  var rows = st.map(function (x, i) { var s = (S.boot.staff || []).filter(function (y) { return y.id === x.id; })[0]; return s ? '<label class="fld row"><span>' + esc(s.pos + ' · ' + s.name + ' (' + x.sh + ')') + '</span><input data-i="' + i + '" maxlength="20" value="' + esc(x.note || '') + '" placeholder="เช่น 8-10"></label>' : ''; }).join('');
  var mo = modal({ title: 'เวลาเวร (ถ้าไม่เต็มเวร)', cls: 'sm', body: rows, foot: '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="ok">บันทึก</button>' });
  $('#ok', mo).onclick = function () {
    var nst = st.map(function (x, i) { var inp = $('[data-i="' + i + '"]', mo); return { id: x.id, sh: x.sh, note: inp ? inp.value.trim() : x.note || '' }; });
    closeModal(); queueSave('st', nst); renderDay($('#main'));
  };
}

/* ---------- ระบุแพทย์ ---------- */
function openAssign(code) {
  var m = D.m, c = m.clinics.filter(function (x) { return x.code === code; })[0]; if (!c) return;
  var unk = c.rows.filter(function (r) { return r.unknown; })[0], api = unk ? unk.api : 0;
  var asg = ((curEntry().data.asg || {})[code]) || {};
  var dayDocs = doctorList(m).filter(function (x) { return !x.unknown; }).map(function (x) { return x.dct; });
  Object.keys(asg).forEach(function (k) { if (dayDocs.indexOf(k) < 0) dayDocs.push(k); });
  var row = function (dct) { return '<div class="asg-row"><span>' + esc(docName(dct)) + '</span>' + '<input class="ni" inputmode="numeric" data-d="' + esc(dct) + '" value="' + (asg[dct] || '') + '" placeholder="0" aria-label="จำนวนของ ' + esc(docName(dct)) + '"></div>'; };
  var others = Object.keys(S.boot.docs).filter(function (k) { return dayDocs.indexOf(k) < 0 && k !== UNKNOWN && !/ไม่ระบุ/.test(S.boot.docs[k][0]); })
    .sort(function (a, b) { return S.boot.docs[a][0].localeCompare(S.boot.docs[b][0], 'th'); });
  var mo = modal({ title: 'ระบุแพทย์ · ' + c.short, cls: 'sm', body:
    '<p class="lead">ผู้ป่วยไม่ระบุแพทย์จาก HIS <b>' + api + '</b> ราย · ใส่จำนวนให้แพทย์ที่ตรวจจริง</p>' +
    '<div class="asg" id="asgList">' + dayDocs.map(row).join('') + '</div>' +
    '<label class="fld"><span>เพิ่มแพทย์คนอื่น</span><select id="asgAdd"><option value="">— เลือกแพทย์ —</option>' + others.map(function (k) { return '<option value="' + esc(k) + '">' + esc(S.boot.docs[k][0]) + '</option>'; }).join('') + '</select></label>' +
    '<p class="muted small" id="asgLeft"></p>',
    foot: '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="ok">บันทึก</button>' });
  var calc = function () { var s = 0; $$('[data-d]', mo).forEach(function (i) { s += +i.value || 0; }); var l = api - s; $('#asgLeft', mo).innerHTML = l >= 0 ? 'เหลือไม่ระบุแพทย์ ' + l + ' ราย' : '<span class="neg">เกินจำนวนที่มี ' + (-l) + ' ราย</span>'; return l; };
  mo.addEventListener('input', function (e) { if (e.target.dataset.d != null) { e.target.value = e.target.value.replace(/\D/g, ''); calc(); } });
  $('#asgAdd', mo).onchange = function () { if (!this.value) return; var t = document.createElement('div'); t.innerHTML = row(this.value); $('#asgList', mo).appendChild(t.firstChild); this.remove(); };
  calc();
  $('#ok', mo).onclick = function () {
    if (calc() < 0) { toast('จำนวนที่ระบุเกินผู้ป่วยไม่ระบุแพทย์', 'err'); return; }
    $$('[data-d]', mo).forEach(function (i) { var v = +i.value || 0; if (v !== (+asg[i.dataset.d] || 0)) queueSave('asg.' + code + '.' + i.dataset.d, v); });
    closeModal(); renderDay($('#main')); flushSave();
  };
}

/* ---------- ผู้ป่วยส่งต่อ ---------- */
function caseTypes() { return (S.boot.items || []).filter(function (x) { return x.kind === 'case' && x.active && (!x.unit || x.unit === D.unit); }).map(function (x) { return x.name; }); }
function openCase(id) {
  var c = id ? D.m.cases.filter(function (x) { return x.id === id; })[0] : { type: caseTypes()[0], period: new Date().getHours() >= 12 ? 'pm' : 'am' };
  if (!c) return;
  var types = caseTypes(); if (c.type && types.indexOf(c.type) < 0) types.push(c.type);
  var mo = modal({ title: id ? 'แก้ไขผู้ป่วยส่งต่อ' : 'เพิ่มผู้ป่วยส่งต่อ', body:
    '<div class="form2">' +
    '<label class="fld"><span>ประเภท</span><select id="cType">' + types.map(function (t) { return '<option' + (t === c.type ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
    '<div class="fld"><span>ช่วงเวลา</span><div class="seg sm" id="cPer"><button type="button" data-p="am" class="' + (c.period !== 'pm' ? 'on' : '') + '">เช้า</button><button type="button" data-p="pm" class="' + (c.period === 'pm' ? 'on' : '') + '">บ่าย</button></div></div>' +
    '<label class="fld span2"><span>ชื่อ-สกุล</span><input id="cName" maxlength="80" value="' + esc(c.name || '') + '" autocomplete="off"></label>' +
    '<label class="fld"><span>HN</span><input id="cHn" maxlength="20" value="' + esc(c.hn || '') + '" autocomplete="off" placeholder="เช่น 69/27010"></label>' +
    '<label class="fld"><span>อายุ</span><input id="cAge" maxlength="12" inputmode="numeric" value="' + esc(c.age || '') + '"></label>' +
    '<label class="fld span2"><span>Dx</span><input id="cDx" maxlength="120" value="' + esc(c.dx || '') + '"></label>' +
    '<label class="fld"><span>ส่งไปที่ (Ward/หน่วยงาน)</span><input id="cDest" maxlength="60" value="' + esc(c.dest || '') + '"></label>' +
    '<label class="fld"><span>หมายเหตุ</span><input id="cNote" maxlength="200" value="' + esc(c.note || '') + '"></label>' +
    '</div>',
    foot: (id ? '<button class="btn danger ghost" id="cDel">' + ic('trash') + 'ลบ</button><span class="sp"></span>' : '') + '<button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" id="cOk">บันทึก</button>' });
  var per = c.period === 'pm' ? 'pm' : 'am';
  $$('#cPer button', mo).forEach(function (b) { b.onclick = function () { per = b.dataset.p; $$('#cPer button', mo).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  var send = function (payload, btn) {
    busy(btn, true);
    api('saveCase', Object.assign({ date: D.date, unit: D.unit, _rid: rid() }, payload)).then(function (r) {
      S.days[D.date].cases = r.cases; delete S.months[D.date.slice(0, 7)]; closeModal(); renderDay($('#main')); toast(payload.remove ? 'ลบรายการแล้ว' : 'บันทึกผู้ป่วยส่งต่อแล้ว', 'ok');
    }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
  };
  $('#cOk', mo).onclick = function () {
    send({ id: id || '', type: $('#cType', mo).value, period: per, name: $('#cName', mo).value, hn: $('#cHn', mo).value, age: $('#cAge', mo).value, dx: $('#cDx', mo).value, dest: $('#cDest', mo).value, note: $('#cNote', mo).value }, this);
  };
  if ($('#cDel', mo)) $('#cDel', mo).onclick = function () { var b = this; confirmBox('ลบรายการ', 'ลบผู้ป่วยส่งต่อรายการนี้ใช่ไหม', 'ลบ', true).then(function (y) { if (y) send({ id: id, remove: true }, null); }); };
}

/* ---------- ส่งรายงาน: ภาพสรุป · ใบรายงานเต็ม · ข้อความ ---------- */
var SH = { tab: 'card', names: false, staffNames: true, blob: null, url: '' };
function inLine() { return / Line\//i.test(navigator.userAgent); }
function openShare() {
  var m = D.m = computeDay(S.days[D.date], D.unit);
  SH.tab = lsGet('shareTab', 'card'); SH.staffNames = lsGet('shareStaff', true); SH.names = false;
  var mo = modal({ title: 'ส่งรายงาน · ' + m.unit.short + ' · ' + thDate(D.date, { short: true }), cls: 'lg share', noFocus: true, body:
    '<div class="seg" id="shTabs"><button data-t="card">' + ic('image') + 'ภาพสรุป</button><button data-t="a4">' + ic('note') + 'ใบรายงานเต็ม</button><button data-t="text">' + ic('copy') + 'ข้อความ</button></div>' +
    '<div class="sh-opts"><label class="chk"><input type="checkbox" id="shStaff"' + (SH.staffNames ? ' checked' : '') + '><span>แสดงชื่อเจ้าหน้าที่</span></label>' +
    (m.cases.length ? '<label class="chk"><input type="checkbox" id="shNames"><span>แสดงชื่อ/HN ผู้ป่วยส่งต่อ</span></label>' : '') + '</div>' +
    (m.unknownLeft ? '<div class="alert warn">' + ic('alert') + '<span>ยังมีผู้ป่วยไม่ระบุแพทย์ ' + m.unknownLeft + ' ราย</span></div>' : '') +
    (!m.filled ? '<div class="alert warn">' + ic('alert') + '<span>ยังไม่ได้บันทึกหัตถการ/เจ้าหน้าที่ของวันนี้</span></div>' : '') +
    '<div class="sh-prev" id="shPrev"></div>',
    foot: '<div class="sh-acts" id="shActs"></div>' });
  $$('#shTabs button', mo).forEach(function (b) { b.onclick = function () { SH.tab = b.dataset.t; lsSet('shareTab', SH.tab); paintShare(); }; });
  $('#shStaff', mo).onchange = function () { SH.staffNames = this.checked; lsSet('shareStaff', this.checked); paintShare(); };
  if ($('#shNames', mo)) $('#shNames', mo).onchange = function () { SH.names = this.checked; paintShare(); };
  paintShare();
}
function reporterName() { return S.boot.me.name || S.boot.me.user; }
function paintShare() {
  var m = D.m, prev = $('#shPrev'), acts = $('#shActs'); if (!prev) return;
  $$('#shTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === SH.tab); });
  var opt = { names: SH.names, staffNames: SH.staffNames, reporter: reporterName() };
  if (SH.tab === 'text') {
    var txt = reportText(m, opt);
    prev.innerHTML = '<textarea class="sh-text" id="shText" rows="16" spellcheck="false">' + esc(txt) + '</textarea>';
    acts.innerHTML = '<button class="btn ghost" id="aLine">' + ic('send') + 'ส่งเข้าไลน์</button><button class="btn primary" id="aCopy">' + ic('copy') + 'คัดลอกข้อความ</button>';
    $('#aCopy').onclick = function () { copyText($('#shText').value).then(function () { toast('คัดลอกแล้ว วางในไลน์ได้เลย', 'ok'); reported('text'); }); };
    $('#aLine').onclick = function () { var t = $('#shText').value; reported('line-text'); if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) navigator.share({ text: t }).catch(function () { }); else window.open('https://line.me/R/share?text=' + encodeURIComponent(t), '_blank'); };
    return;
  }
  prev.innerHTML = '<div class="sh-img-wrap"><div class="sh-loading"><span class="spin"></span>กำลังสร้างภาพ…</div></div>';
  acts.innerHTML = '';
  var node = SH.tab === 'a4' ? a4Node(m, opt) : cardNode(m, opt);
  renderImage(node).then(function (blob) {
    if (SH.url) URL.revokeObjectURL(SH.url);
    SH.blob = blob; SH.url = URL.createObjectURL(blob);
    prev.innerHTML = '<div class="sh-img-wrap ' + SH.tab + '"><img id="shImg" src="' + SH.url + '" alt="ภาพรายงาน"></div>' + (inLine() ? '<p class="hint-line">' + ic('info') + 'เปิดจากในไลน์: แตะค้างที่ภาพเพื่อบันทึก/ส่งต่อ หรือ <a href="' + esc(location.href.split('#')[0] + '?openExternalBrowser=1' + location.hash) + '">เปิดในเบราว์เซอร์</a></p>' : '');
    var canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], 'a.png', { type: 'image/png' })] }));
    acts.innerHTML = (SH.tab === 'a4' ? '<button class="btn ghost" id="aPrint">' + ic('print') + 'พิมพ์ A4</button>' : '') +
      '<button class="btn ghost" id="aSave">' + ic('download') + 'บันทึกภาพ</button>' +
      (window.ClipboardItem && !/Android|iPhone|iPad/i.test(navigator.userAgent) ? '<button class="btn ghost" id="aClip">' + ic('copy') + 'คัดลอกภาพ</button>' : '') +
      (canShare ? '<button class="btn primary" id="aShare">' + ic('share') + 'แชร์ภาพ</button>' : '');
    var fname = 'รายงาน-' + (m.unit.short || '') + '-' + D.date + (SH.tab === 'a4' ? '-A4' : '') + '.png';
    $('#aSave').onclick = function () { var a = document.createElement('a'); a.href = SH.url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); reported('save'); };
    if ($('#aClip')) $('#aClip').onclick = function () { navigator.clipboard.write([new ClipboardItem({ 'image/png': SH.blob })]).then(function () { toast('คัดลอกภาพแล้ว วาง (Ctrl+V) ในแชตไลน์ได้เลย', 'ok'); reported('copy-image'); }).catch(function () { toast('เบราว์เซอร์นี้คัดลอกภาพไม่ได้ ใช้ปุ่มบันทึกภาพแทน', 'err'); }); };
    if ($('#aShare')) $('#aShare').onclick = function () { navigator.share({ files: [new File([SH.blob], fname, { type: 'image/png' })], title: 'รายงานประจำวัน' }).then(function () { reported('share'); }).catch(function () { }); };
    if ($('#aPrint')) $('#aPrint').onclick = function () { printA4(m, opt); reported('print'); };
  }).catch(function (e) { prev.innerHTML = '<div class="alert err">' + ic('alert') + '<span>สร้างภาพไม่สำเร็จ: ' + esc(e.message) + ' · ใช้แท็บข้อความแทนได้</span></div>'; });
}
function copyText(t) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
  var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { } ta.remove(); return Promise.resolve();
}
function reported(how) {
  if (!canEdit()) return;
  api('markReported', { date: D.date, unit: D.unit, how: how, _rid: rid() }).then(function (r) {
    var e = curEntry(); e.reportedAt = r.reportedAt; e.reportedBy = r.reportedBy; delete S.months[D.date.slice(0, 7)];
  }).catch(function () { });
}
var h2cP = null;
function loadH2C() {
  if (window.html2canvas) return Promise.resolve();
  if (!h2cP) h2cP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = res; s.onerror = function () { h2cP = null; rej(new Error('โหลดตัวสร้างภาพไม่ได้ (ตรวจอินเทอร์เน็ต)')); }; document.head.appendChild(s); });
  return h2cP;
}
function renderImage(node) {
  var host = document.createElement('div'); host.className = 'render-host'; host.appendChild(node); document.body.appendChild(host);
  return loadH2C().then(function () { return document.fonts && document.fonts.ready; }).then(function () {
    return window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  }).then(function (cv) {
    host.remove();
    return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('สร้างไฟล์ภาพไม่ได้')); }, 'image/png'); });
  }, function (e) { host.remove(); throw e; });
}
function el$(html) { var t = document.createElement('div'); t.innerHTML = html; return t.firstChild; }

/** ภาพสรุป (สำหรับมือถือ/ไลน์) กว้าง 720px */
function cardNode(m, opt) {
  var dl = doctorList(m), am = dl.filter(function (x) { return x.am > 0; }), pm = dl.filter(function (x) { return x.pm > 0; });
  var ex = m.extras.filter(function (x) { return x.total; }), sp = m.specials.filter(function (s) { return s.total; });
  var pr = m.procs.filter(function (p) { return p.total; }), kp = m.kpis.filter(function (k) { return k.value !== ''; });
  var docCol = function (title, list, key) {
    var exs = ex.filter(function (x) { return x[key] && x.countIn; });
    return '<div class="rc-col"><h4>' + title + '<span>' + (list.reduce(function (s, x) { return s + x[key]; }, 0) + exs.reduce(function (s, x) { return s + x[key]; }, 0)) + '</span></h4>' + (list.length ? list.map(function (x) { return '<div class="rc-li"><span>' + esc(x.unknown ? 'ไม่ระบุแพทย์' : x.short) + '</span><b>' + x[key] + '</b></div>'; }).join('') : '<div class="rc-none">—</div>') +
      (key === 'am' ? ex.filter(function (x) { return x.am && x.countIn; }).map(function (x) { return '<div class="rc-li ex"><span>' + esc(x.name.split(' ')[0]) + '</span><b>' + x.am + '</b></div>'; }).join('') : ex.filter(function (x) { return x.pm && x.countIn; }).map(function (x) { return '<div class="rc-li ex"><span>' + esc(x.name.split(' ')[0]) + '</span><b>' + x.pm + '</b></div>'; }).join('')) + '</div>';
  };
  var pos = S.boot.positions || ['GN', 'PN', 'NA'];
  return el$('<div class="rcard" style="--u:' + esc(m.unit.color) + ';--u1:' + mix(m.unit.color, '#ffffff', .14) + ';--u3:' + mix(m.unit.color, '#2a0616', .4) + '">' +
    '<div class="rc-top"><img src="icon-192.png" width="54" height="54" alt=""><div><div class="rc-unit">' + esc(m.unit.name) + '</div><div class="rc-date">วัน' + TH_D[dow(m.date)] + 'ที่ ' + thDate(m.date) + '</div></div></div>' +
    '<div class="rc-hero"><div><span class="rc-lbl">ผู้ป่วยทั้งหมด</span><span class="rc-big">' + fmt(m.total) + '</span><span class="rc-u">ราย</span></div>' +
    '<div class="rc-pills"><span class="am">เช้า ' + fmt(m.am) + '</span><span class="pm">บ่าย ' + fmt(m.pm) + '</span><span>แพทย์ ' + m.docCount + ' คน</span></div></div>' +
    '<div class="rc-docs">' + docCol('แพทย์เวรเช้า', am, 'am') + docCol('แพทย์เวรบ่าย', pm, 'pm') + '</div>' +
    (sp.length ? '<div class="rc-sec"><h4>คลินิกพิเศษ</h4><div class="rc-chips">' + sp.map(function (s) { return '<span>' + esc(s.label) + (s.docs.length ? ' · ' + esc(s.docs.join(', ')) : '') + ' <b>' + s.total + '</b></span>'; }).join('') + '</div></div>' : '') +
    (pr.length ? '<div class="rc-sec"><h4>หัตถการ</h4><div class="rc-grid">' + pr.map(function (p) { return '<div class="rc-li"><span>' + esc(p.name) + '</span><b>' + p.total + '</b></div>'; }).join('') + '</div></div>' : '') +
    (kp.length ? '<div class="rc-sec"><h4>ตัวชี้วัด</h4><div class="rc-grid">' + kp.map(function (k) { return '<div class="rc-li"><span>' + esc(k.name.replace(/\s*\(%\)$/, '')) + '</span><b>' + kpiText(k) + '</b></div>'; }).join('') + '</div></div>' : '') +
    (m.cases.length ? '<div class="rc-sec"><h4>ผู้ป่วยส่งต่อ ' + m.cases.length + ' ราย</h4>' + m.cases.map(function (c) { return '<div class="rc-case">' + esc(c.type) + (opt.names && c.name ? ' · ' + esc(c.name) + (c.hn ? ' (HN ' + esc(c.hn) + ')' : '') : '') + (c.dx ? ' · ' + esc(c.dx) : '') + (c.dest ? ' → ' + esc(c.dest) : '') + '</div>'; }).join('') + '</div>' : '') +
    (pos.filter(function (p) { return (m.staffN[p] || 0) > 0; }).length ? '<div class="rc-sec"><h4>เจ้าหน้าที่</h4><div class="rc-staff">' + pos.filter(function (p) { return (m.staffN[p] || 0) > 0; }).map(function (p) { return '<div><b>' + p + ' ' + fmt(m.staffN[p] || 0) + '</b>' + (opt.staffNames ? '<span>' + esc(staffText(m, p)) + '</span>' : '') + '</div>'; }).join('') + '</div></div>' : '') +
    (m.prob ? '<div class="rc-sec prob"><h4>ปัญหาที่พบ</h4><p>' + esc(m.prob) + '</p></div>' : '') +
    '<div class="rc-foot"><span>ผู้รายงาน ' + esc(opt.reporter) + '</span><span>OB-GYN Daily · ' + esc(thTime(nowStamp())) + '</span></div>' +
    '</div>');
}
/** ผสมสี hex (html2canvas ไม่รองรับ color-mix) */
function mix(a, b, t) { var p = function (h) { h = String(h).replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16) || 0; }); }, x = p(a), y = p(b); return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join(''); }
function nowStamp() { var t = new Date(Date.now() + 7 * 3600e3).toISOString(); return t.slice(0, 10) + ' ' + t.slice(11, 19); }

/** ใบรายงานเต็ม A4 (เลียนแบบฟอร์มกระดาษเดิม) · พิมพ์เฉพาะรายการที่มียอด (ตกลง 16 พ.ย. 69):
 *  ไม่เติมแถวแพทย์ว่าง · หัตถการ 0 ไม่พิมพ์ · คลินิกพิเศษ 0 / ตำแหน่งที่ไม่มีคน / ปัญหาที่ว่าง ไม่พิมพ์ · ตัวชี้วัดพิมพ์ทุกข้อ (กรอก 0 = แสดง 0) */
function a4Node(m, opt) {
  var dl = doctorList(m), am = dl.filter(function (x) { return x.am > 0; }), pm = dl.filter(function (x) { return x.pm > 0; });
  m.extras.forEach(function (x) { if (x.countIn && x.am) am.push({ short: x.name, am: x.am, ex: true }); if (x.countIn && x.pm) pm.push({ short: x.name, pm: x.pm, ex: true }); });
  var n = Math.max(1, am.length, pm.length), docRows = '';
  for (var i = 0; i < n; i++) {
    var a = am[i], b = pm[i];
    docRows += '<tr><td class="c">' + (a ? i + 1 : '') + '</td><td>' + (a ? esc(a.unknown ? 'ไม่ระบุแพทย์' : a.ex ? a.short : a.name) : (i === 0 ? '<span class="a4-none">ไม่มีผู้ป่วย</span>' : '')) + '</td><td class="c">' + (a ? a.am : '') + '</td><td class="c">' + (b ? i + 1 : '') + '</td><td>' + (b ? esc(b.unknown ? 'ไม่ระบุแพทย์' : b.ex ? b.short : b.name) : (i === 0 ? '<span class="a4-none">ไม่มีผู้ป่วย</span>' : '')) + '</td><td class="c">' + (b ? b.pm : '') + '</td></tr>';
  }
  var pr = m.procs.filter(function (p) { return p.total > 0; }), half = Math.ceil(pr.length / 2), prRows = '';
  for (var j = 0; j < half; j++) {
    var p = pr[j], q = pr[j + half];
    prRows += '<tr><td>' + (j + 1) + '. ' + esc(p.name) + '</td><td class="c">' + nz(p.am) + '</td><td class="c">' + nz(p.pm) + '</td>' + (q ? '<td>' + (j + half + 1) + '. ' + esc(q.name) + '</td><td class="c">' + nz(q.am) + '</td><td class="c">' + nz(q.pm) + '</td>' : '<td></td><td></td><td></td>') + '</tr>';
  }
  var prTot = 0; pr.forEach(function (x) { prTot += x.total; });
  var sp = m.specials.filter(function (s) { return s.total > 0; });
  var pos = (S.boot.positions || ['GN', 'PN', 'NA']).filter(function (p) { return (m.staffN[p] || 0) > 0 || staffText(m, p); });
  var spHtml = sp.length ? '<table class="a4t"><thead><tr><th>คลินิกพิเศษ</th><th style="width:22%">จำนวน</th></tr></thead><tbody>' +
    sp.map(function (s) { return '<tr><td>' + esc(s.label) + (s.docs.length ? ' <i>พ.' + esc(s.docs.map(function (x) { return x.replace(/^พ\./, ''); }).join(', ')) + '</i>' : '') + '</td><td class="c">' + fmt(s.total) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
  var kpHtml = m.kpis.length ? '<table class="a4t"><thead><tr><th>ตัวชี้วัด</th><th style="width:22%">ผล</th></tr></thead><tbody>' + m.kpis.map(function (k) { return '<tr><td>' + esc(k.name.replace(/\s*\(%\)$/, '')) + '</td><td class="c">' + kpiText(k) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
  var tail = (m.prob || m.note ? '<tr><th class="l" style="width:16%">ปัญหาที่พบ</th><td>' + esc(m.prob || '-') + (m.note ? '<br><i>หมายเหตุ: ' + esc(m.note) + '</i>' : '') + '</td></tr>' : '') +
    pos.map(function (p) { return '<tr><th class="l" style="width:16%">' + p + ' (' + fmt(m.staffN[p] || 0) + ')</th><td>' + esc(staffText(m, p) || '-') + '</td></tr>'; }).join('');
  return el$('<div class="a4">' +
    '<div class="a4-h"><img src="logo-hospital.png" width="44" height="44" alt=""><div class="a4-t"><b>' + esc(m.unit.title || ('แบบบันทึกรายงานเหตุการณ์' + m.unit.name)) + '</b><span>วัน' + TH_D[dow(m.date)] + ' ที่ ' + thDate(m.date) + '</span></div><div class="a4-tot"><span>รวมทั้งหมด</span><b>' + fmt(m.total) + '</b><span>ราย</span></div></div>' +
    '<table class="a4t"><thead><tr><th style="width:6%">ลำดับ</th><th>แพทย์ (เช้า)</th><th style="width:11%">จำนวนคนไข้</th><th style="width:6%">ลำดับ</th><th>แพทย์ (บ่าย)</th><th style="width:11%">จำนวนคนไข้</th></tr></thead><tbody>' + docRows +
    '<tr class="sum"><td colspan="2" class="r">รวมเช้า</td><td class="c">' + fmt(m.am) + '</td><td colspan="2" class="r">รวมบ่าย</td><td class="c">' + fmt(m.pm) + '</td></tr></tbody></table>' +
    (spHtml && kpHtml ? '<div class="a4-2">' + spHtml + kpHtml + '</div>' : spHtml + kpHtml) +
    (pr.length ? '<table class="a4t pr"><thead><tr><th>หัตถการ (รวม ' + fmt(prTot) + ' ครั้ง)</th><th style="width:7%">เช้า</th><th style="width:7%">บ่าย</th><th>หัตถการ</th><th style="width:7%">เช้า</th><th style="width:7%">บ่าย</th></tr></thead><tbody>' + prRows + '</tbody></table>' : '') +
    (m.cases.length ? '<table class="a4t"><thead><tr><th style="width:16%">ส่งต่อ</th><th>ชื่อ-สกุล</th><th style="width:12%">HN</th><th style="width:7%">อายุ</th><th>Dx</th><th style="width:14%">Ward</th></tr></thead><tbody>' + m.cases.map(function (c) { return '<tr><td>' + esc(c.type) + '</td><td>' + (opt.names ? esc(c.name) : '•••') + '</td><td>' + (opt.names ? esc(c.hn) : '•••') + '</td><td class="c">' + esc(c.age || '') + '</td><td>' + esc(c.dx || '') + '</td><td>' + esc(c.dest || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
    (tail ? '<table class="a4t"><tbody>' + tail + '</tbody></table>' : '') +
    '<div class="a4-f"><span>ผู้รายงาน ' + esc(opt.reporter) + '</span><span>พิมพ์จากระบบ OB-GYN Daily · ' + esc(thTime(nowStamp())) + '</span></div>' +
    '</div>');
}
function printA4(m, opt) {
  var root = $('#print-root') || (function () { var d = document.createElement('div'); d.id = 'print-root'; document.body.appendChild(d); return d; })();
  root.innerHTML = ''; root.appendChild(a4Node(m, opt));
  document.body.classList.add('printing');
  setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('printing'); root.innerHTML = ''; }, 500); }, 250);
}
