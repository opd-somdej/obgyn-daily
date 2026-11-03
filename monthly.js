/* monthly.js — รายงานรายเดือน (ปฏิทิน + ตารางสัปดาห์ที่ 1–5 ตามแบบฟอร์มเดิม · Excel · พิมพ์) และหน้าภาพรวม (กราฟ) */
'use strict';
function loadMonth(ym, force) {
  if (!force && S.months[ym] && Date.now() - S.months[ym]._at < 120000) return Promise.resolve(S.months[ym]);
  return api('getMonth', { ym: ym }).then(function (d) { d._at = Date.now(); S.months[ym] = d; return d; });
}
function monthNav(ym, base) {
  var cur = today().slice(0, 7);
  return '<div class="dh-date"><button class="icon-btn" data-ym="' + ymAdd(ym, -1) + '" aria-label="เดือนก่อน">' + ic('left') + '</button>' +
    '<label class="dh-pick"><span class="dh-wd">' + (base === 'month' ? 'รายงานรายเดือน' : 'ภาพรวม') + '</span><span class="dh-d">' + thMonth(ym) + '</span><input type="month" id="pickM" value="' + ym + '" max="' + cur + '" aria-label="เลือกเดือน"></label>' +
    '<button class="icon-btn" data-ym="' + ymAdd(ym, 1) + '" aria-label="เดือนถัดไป" ' + (ym >= cur ? 'disabled' : '') + '>' + ic('right') + '</button>' +
    (ym !== cur ? '<button class="btn ghost sm" data-ym="' + cur + '">เดือนนี้</button>' : '') + '</div>';
}
function seriesColor(i) {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!theme() && matchMedia('(prefers-color-scheme: dark)').matches);
  return (dark ? ['#e4528a', '#8f6fd0', '#d39a3a', '#4fa58a'] : ['#c2185b', '#7b4fa0', '#a8701a', '#2f7d64'])[i % 4];
}

/* ================= รายงานรายเดือน ================= */
PAGES.month = function (r, el) {
  var ym = /^\d{4}-\d{2}$/.test(r.a) ? r.a : today().slice(0, 7);
  if (ym > today().slice(0, 7)) ym = today().slice(0, 7);
  var unit = r.b && unitById(r.b) ? r.b : (lsGet('unit', '') && unitById(lsGet('unit', '')) ? lsGet('unit', '') : myUnits()[0].id);
  lsSet('unit', unit);
  document.title = 'รายงานรายเดือน ' + thMonth(ym, true) + ' · OB-GYN Daily';
  var mode = lsGet('weekMode', S.boot.texts.weekMode || 'block'), showZero = lsGet('showZero', false);
  var paint = function (mo) {
    var u = unitById(unit), rep = monthReport(mo, unit, mode), units = myUnits();
    el.innerHTML = '<div class="page month" style="--unit:' + esc(u.color) + '">' +
      '<header class="day-head">' + monthNav(ym, 'month') +
      (units.length > 1 ? '<div class="seg" role="tablist">' + units.map(function (x) { return '<button data-unit="' + x.id + '" class="' + (x.id === unit ? 'on' : '') + '" style="--c:' + esc(x.color) + '">' + esc(x.short) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="dh-acts"><button class="btn ghost" id="mXls">' + ic('excel') + '<span>Excel</span></button><button class="btn primary" id="mPrint">' + ic('print') + '<span>พิมพ์</span></button></div></header>' +
      calendarHtml(mo, rep, unit) +
      '<section class="card"><div class="card-h"><h2>' + ic('month') + 'ยอดผู้มารับบริการ · ' + esc(u.name) + '</h2>' +
      '<div class="card-tools"><div class="seg sm" id="wMode"><button data-w="block" class="' + (mode !== 'mon' ? 'on' : '') + '">วันที่ 1–7, 8–14 …</button><button data-w="mon" class="' + (mode === 'mon' ? 'on' : '') + '">จันทร์–อาทิตย์</button></div>' +
      '<label class="chk sm"><input type="checkbox" id="zero"' + (showZero ? ' checked' : '') + '><span>แสดงแถวที่เป็นศูนย์</span></label></div></div>' +
      '<div class="tbl-wrap">' + monthTable(rep, showZero) + '</div></section>' +
      '<p class="foot-meta">ยอดผู้ป่วยมาจาก HIS · หัตถการ ตัวชี้วัด เจ้าหน้าที่ มาจากรายงานประจำวันที่พยาบาลบันทึก · ร้อยละ = ค่าเฉลี่ยของวันที่บันทึก</p></div>';
    $$('[data-ym]', el).forEach(function (b) { b.onclick = function () { go('#/month/' + b.dataset.ym + '/' + unit); }; });
    $('#pickM').onchange = function () { if (this.value) go('#/month/' + this.value + '/' + unit); };
    $$('[data-unit]', el).forEach(function (b) { b.onclick = function () { go('#/month/' + ym + '/' + b.dataset.unit); }; });
    $$('#wMode button', el).forEach(function (b) { b.onclick = function () { mode = b.dataset.w; lsSet('weekMode', mode); paint(mo); }; });
    $('#zero').onchange = function () { showZero = this.checked; lsSet('showZero', showZero); paint(mo); };
    $$('[data-day]', el).forEach(function (b) { b.onclick = function () { go('#/day/' + b.dataset.day + '/' + unit); }; });
    $('#mXls').onclick = function () { exportMonthXlsx(rep, u, ym, this); };
    $('#mPrint').onclick = function () { printMonth(rep, u, ym, showZero); };
  };
  if (S.months[ym]) paint(S.months[ym]); else el.innerHTML = '<div class="page"><div class="sk sk-head"></div><div class="sk sk-card"></div></div>';
  loadMonth(ym).then(function (mo) { if (S.page === 'month') paint(mo); }).catch(function (e) { el.innerHTML = errorBox(e.message, 'location.reload()'); });
};
function calendarHtml(mo, rep, unit) {
  var ym = mo.ym, n = daysIn(ym), first = dow(ym + '-01'), cells = '';
  for (var i = 0; i < first; i++) cells += '<span class="cal-c pad"></span>';
  for (var d = 1; d <= n; d++) {
    var iso = ym + '-' + ('0' + d).slice(-2), m = rep.daily[iso], fut = iso > mo.today, t = mo.dayTypes[iso];
    var st = !m || fut ? '' : m.entry && m.entry.reportedAt ? 'rep' : m.filled ? 'fill' : (m.total > 0 && t === 'W') ? 'todo' : '';
    var lbl = st === 'rep' ? 'ส่งรายงานแล้ว' : st === 'fill' ? 'บันทึกแล้ว' : st === 'todo' ? 'ยังไม่บันทึก' : '';
    cells += '<button class="cal-c ' + (fut ? 'fut ' : '') + (t !== 'W' ? 'off ' : '') + (iso === mo.today ? 'now ' : '') + st + '" data-day="' + iso + '" ' + (fut ? 'disabled' : '') + ' aria-label="' + thDate(iso) + (m ? ' ผู้ป่วย ' + m.total + ' ราย ' + lbl : '') + '">' +
      '<span class="cal-d">' + d + '</span><span class="cal-n">' + (m && m.total ? fmt(m.total) : fut ? '' : '–') + '</span><i class="cal-s" title="' + lbl + '"></i></button>';
  }
  var g = function (k) { var r = rep.rows.filter(function (x) { return x.key === k; })[0]; return r ? r.total : 0; };
  return '<section class="card cal-card"><div class="cal-sum"><div><span class="muted">ผู้ป่วยทั้งเดือน</span><b>' + fmt(g('total')) + '</b></div><div><span class="muted">วันที่มีผู้ป่วย</span><b>' + g('days') + '</b></div><div><span class="muted">บันทึกแล้ว</span><b>' + g('filled') + '</b></div><div><span class="muted">ส่งรายงานแล้ว</span><b>' + g('reported') + '</b></div></div>' +
    '<div class="cal"><div class="cal-w">' + TH_DS.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="cal-g">' + cells + '</div></div>' +
    '<div class="cal-lg"><span><i class="cal-s rep"></i>ส่งรายงานแล้ว</span><span><i class="cal-s fill"></i>บันทึกแล้ว</span><span><i class="cal-s todo"></i>ยังไม่บันทึก</span></div></section>';
}
function cellVal(r, v) { if (v == null) return ''; if (r.kind === 'avg') return fmt(v); return v ? fmt(v) : (r.sec === 'pr' || r.sec === 'kp' ? '' : '0'); }
function monthTable(rep, showZero) {
  var head = '<thead><tr><th class="no">ลำดับ</th><th>รายการ/กิจกรรม</th>' + rep.weeks.map(function (w) { return '<th class="n">' + w.label.replace('สัปดาห์ที่ ', 'สัปดาห์ ') + '<small>' + w.range + '</small></th>'; }).join('') + '<th class="n tot">รวม</th></tr></thead>';
  var sec = '', no = 0, body = '';
  rep.rows.forEach(function (r) {
    if (r.sec === 'meta') return;
    var zero = r.kind === 'avg' ? r.total == null : !r.total;
    if (zero && !showZero && (r.sec === 'cl' || r.sec === 'ex' || r.sec === 'cs' || (r.sec === 'pt' && r.key !== 'total'))) return;
    if (r.sec !== sec) { sec = r.sec; body += '<tr class="sec"><th colspan="' + (rep.weeks.length + 3) + '">' + SEC_TH[sec] + '</th></tr>'; }
    no++;
    body += '<tr class="' + (zero ? 'zero ' : '') + (r.key === 'total' ? 'key' : '') + '"><td class="no">' + no + '</td><td>' + esc(r.label) + '</td>' + r.vals.map(function (v) { return '<td class="n">' + cellVal(r, v) + '</td>'; }).join('') + '<td class="n tot">' + cellVal(r, r.total) + '</td></tr>';
  });
  return '<table class="tbl mrep">' + head + '<tbody>' + body + '</tbody></table>';
}
var xlsxP = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxP) xlsxP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = function () { xlsxP = null; rej(new Error('โหลดตัวสร้าง Excel ไม่ได้ (ตรวจอินเทอร์เน็ต)')); }; document.head.appendChild(s); });
  return xlsxP;
}
function exportMonthXlsx(rep, u, ym, btn) {
  busy(btn, true);
  loadXlsx().then(function () {
    var aoa = [['ยอดผู้มารับบริการในคลินิก ' + u.name + ' ประจำเดือน ' + thMonth(ym)], [], ['ลำดับ', 'รายการ/กิจกรรม'].concat(rep.weeks.map(function (w) { return w.label + ' (' + w.range + ')'; })).concat(['รวม'])];
    var no = 0, sec = '';
    rep.rows.forEach(function (r) {
      if (r.sec !== sec) { sec = r.sec; aoa.push(['', SEC_TH[sec]]); }
      aoa.push([++no, r.label].concat(r.vals.map(function (v) { return v == null ? '' : v; })).concat([r.total == null ? '' : r.total]));
    });
    var daily = [['วันที่', 'ผู้ป่วยทั้งหมด', 'เช้า', 'บ่าย', 'จาก HIS', 'คีย์เพิ่ม', 'แพทย์ (คน)', 'หัตถการรวม', 'บันทึกแล้ว', 'ส่งรายงานแล้ว']];
    Object.keys(rep.daily).sort().forEach(function (iso) { var m = rep.daily[iso], pr = 0; m.procs.forEach(function (p) { pr += p.total; }); daily.push([thDate(iso, { short: true }), m.total, m.am, m.pm, m.apiTotal, m.total - m.apiTotal, m.docCount, pr, m.filled ? 'ใช่' : '', m.entry && m.entry.reportedAt ? 'ใช่' : '']); });
    var docs = {};
    Object.keys(rep.daily).forEach(function (iso) { doctorList(rep.daily[iso]).forEach(function (x) { var o = docs[x.dct] || (docs[x.dct] = { name: x.unknown ? 'ไม่ระบุแพทย์' : x.name, am: 0, pm: 0, total: 0, days: 0 }); o.am += x.am; o.pm += x.pm; o.total += x.total; o.days++; }); });
    var dsheet = [['แพทย์', 'ผู้ป่วยรวม', 'เช้า', 'บ่าย', 'จำนวนวันที่ตรวจ']].concat(Object.keys(docs).map(function (k) { return docs[k]; }).sort(function (a, b) { return b.total - a.total; }).map(function (o) { return [o.name, o.total, o.am, o.pm, o.days]; }));
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 6 }, { wch: 46 }].concat(rep.weeks.map(function () { return { wch: 14 }; })).concat([{ wch: 10 }]);
    XLSX.utils.book_append_sheet(wb, ws, 'รายสัปดาห์');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), 'รายวัน');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dsheet), 'รายแพทย์');
    XLSX.writeFile(wb, 'ยอดผู้มารับบริการ-' + u.short + '-' + ym + '.xlsx');
    busy(btn, false);
  }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
}
function printMonth(rep, u, ym, showZero) {
  var root = $('#print-root') || (function () { var d = document.createElement('div'); d.id = 'print-root'; document.body.appendChild(d); return d; })();
  root.innerHTML = '<div class="a4 a4m"><div class="a4-h"><img src="logo-hospital.png" width="40" height="40" alt=""><div class="a4-t"><b>ยอดผู้มารับบริการในคลินิก · ' + esc(u.name) + '</b><span>ประจำเดือน ' + thMonth(ym) + '</span></div></div>' + monthTable(rep, showZero) +
    '<div class="a4-f"><span>พิมพ์โดย ' + esc(S.boot.me.name || '') + '</span><span>OB-GYN Daily · ' + esc(thTime(nowStamp())) + '</span></div></div>';
  document.body.classList.add('printing');
  setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('printing'); root.innerHTML = ''; }, 500); }, 250);
}

/* ================= ภาพรวม ================= */
PAGES.overview = function (r, el) {
  var ym = /^\d{4}-\d{2}$/.test(r.a) ? r.a : today().slice(0, 7);
  if (ym > today().slice(0, 7)) ym = today().slice(0, 7);
  document.title = 'ภาพรวม ' + thMonth(ym, true) + ' · OB-GYN Daily';
  el.innerHTML = '<div class="page"><div class="sk sk-head"></div><div class="sk sk-tally"></div><div class="sk sk-card"></div></div>';
  Promise.all([loadMonth(ym), loadMonth(ymAdd(ym, -1)).catch(function () { return null; }), S.trend && Date.now() - S.trend._at < 600000 ? S.trend : api('getTrend', { months: 13 }).then(function (t) { t._at = Date.now(); S.trend = t; return t; })])
    .then(function (res) { if (S.page === 'overview') paintOverview(el, ym, res[0], res[1], res[2]); })
    .catch(function (e) { el.innerHTML = errorBox(e.message, 'location.reload()'); });
};
function paintOverview(el, ym, mo, prev, trend) {
  var units = S.boot.units, n = daysIn(ym), per = {}, totals = {}, docs = {}, clin = {}, procs = {}, filled = 0, workDays = 0, maxDay = null;
  units.forEach(function (u) { totals[u.id] = 0; });
  var days = [];
  for (var d = 1; d <= n; d++) {
    var iso = ym + '-' + ('0' + d).slice(-2); if (iso > mo.today) break;
    var dd = dayFromMonth(mo, iso), row = { date: iso, vals: {}, total: 0 };
    units.forEach(function (u) {
      var m = computeDay(dd, u.id); row.vals[u.id] = m.total; row.total += m.total; totals[u.id] += m.total;
      if (m.filled) filled++;
      m.clinics.forEach(function (c) { var o = clin[c.code] || (clin[c.code] = { name: c.short, unit: u.id, n: 0 }); o.n += c.total; });
      doctorList(m).forEach(function (x) { if (x.unknown) return; var o = docs[x.dct] || (docs[x.dct] = { name: x.name, n: 0, am: 0, pm: 0, days: 0, clinics: {} }); o.n += x.total; o.am += x.am; o.pm += x.pm; o.days++; x.clinics.forEach(function (c) { o.clinics[c] = 1; }); });
      m.procs.forEach(function (p) { if (p.total) { var o = procs[p.name] || (procs[p.name] = 0); procs[p.name] = o + p.total; } });
    });
    if (mo.dayTypes[iso] === 'W' && row.total > 0) workDays++;
    if (!maxDay || row.total > maxDay.total) maxDay = row;
    days.push(row);
  }
  var all = days.reduce(function (s, x) { return s + x.total; }, 0);
  var prevAll = 0;
  if (prev) { var pn = daysIn(prev.ym); for (var k = 1; k <= pn; k++) { var pi = prev.ym + '-' + ('0' + k).slice(-2); var pd = dayFromMonth(prev, pi); units.forEach(function (u) { prevAll += computeDay(pd, u.id).total; }); } }
  var delta = prevAll ? Math.round((all - prevAll) / prevAll * 100) : null;
  var wdTotal = days.filter(function (x) { return mo.dayTypes[x.date] === 'W'; }).reduce(function (s, x) { return s + x.total; }, 0);
  var needFill = days.filter(function (x) { return x.total > 0; }).length * units.length;
  el.innerHTML = '<div class="page overview">' +
    '<header class="day-head">' + monthNav(ym, 'overview') + '</header>' +
    '<section class="tiles">' +
    tile('ผู้ป่วยทั้งเดือน', fmt(all), 'ราย', delta == null ? '' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% จาก ' + thMonth(prev.ym, true) + (ym === mo.today.slice(0, 7) ? ' (ทั้งเดือน)' : '')) +
    tile('เฉลี่ยต่อวันทำการ', workDays ? fmt(Math.round(wdTotal / workDays)) : '–', 'ราย/วัน', workDays + ' วันทำการ') +
    tile('วันที่ผู้ป่วยมากที่สุด', maxDay && maxDay.total ? fmt(maxDay.total) : '–', 'ราย', maxDay && maxDay.total ? thDate(maxDay.date, { wd: true, short: true }) : '') +
    tile('บันทึกรายงานแล้ว', fmt(filled), '/ ' + fmt(needFill) + ' ใบ', units.map(function (u) { return u.short + ' ' + fmt(totals[u.id]); }).join(' · ')) +
    '</section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('chart') + 'ผู้ป่วยรายวัน</h2><div class="legend">' + units.map(function (u, i) { return '<span><i style="background:' + seriesColor(i) + '"></i>' + esc(u.short) + '</span>'; }).join('') + '</div></div><div class="chart" id="chDaily"></div></section>' +
    '<div class="ov-grid">' +
    '<section class="card"><div class="card-h"><h2>' + ic('chart') + 'แนวโน้ม 13 เดือน</h2><span class="hint">ผู้ป่วยทุกคลินิกในระบบ</span></div><div class="chart" id="chTrend"></div></section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('stetho') + 'รายคลินิก</h2></div>' + hbars(Object.keys(clin).map(function (k) { return { label: clin[k].name, n: clin[k].n, c: seriesColor(Math.max(0, units.map(function (u) { return u.id; }).indexOf(clin[k].unit))) }; })) + '</section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('users') + 'แพทย์ (ผู้ป่วยมากสุด 12 อันดับ)</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แพทย์</th><th>คลินิก</th><th class="n">วัน</th><th class="n">รวม</th></tr></thead><tbody>' +
    Object.keys(docs).map(function (k) { return docs[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 12).map(function (o) { return '<tr><td>' + esc(o.name) + '</td><td class="muted">' + esc(Object.keys(o.clinics).join(', ')) + '</td><td class="n">' + o.days + '</td><td class="n tot">' + fmt(o.n) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('hand') + 'หัตถการที่บันทึก</h2></div>' + (Object.keys(procs).length ? hbars(Object.keys(procs).map(function (k) { return { label: k, n: procs[k], c: seriesColor(0) }; }).slice(0)) : '<p class="muted small pad">ยังไม่มีการบันทึกหัตถการในเดือนนี้</p>') + '</section>' +
    '</div></div>';
  $$('[data-ym]', el).forEach(function (b) { b.onclick = function () { go('#/overview/' + b.dataset.ym); }; });
  $('#pickM').onchange = function () { if (this.value) go('#/overview/' + this.value); };
  stackBars($('#chDaily'), days, units);
  lineChart($('#chTrend'), trend.months);
}
function tile(lbl, num, unit, sub) { return '<div class="tile"><span class="tl-l">' + esc(lbl) + '</span><span class="tl-n">' + num + '<small>' + esc(unit) + '</small></span><span class="tl-s">' + esc(sub || '') + '</span></div>'; }
function hbars(list) {
  list.sort(function (a, b) { return b.n - a.n; }); list = list.filter(function (x) { return x.n > 0; });
  var max = list.length ? list[0].n : 1;
  return '<ul class="hbars">' + list.slice(0, 12).map(function (x) { return '<li><span class="hb-l">' + esc(x.label) + '</span><span class="hb-t"><i style="width:' + Math.max(2, x.n / max * 100) + '%;background:' + x.c + '"></i></span><b>' + fmt(x.n) + '</b></li>'; }).join('') + '</ul>';
}
function niceMax(v) { if (v <= 10) return 10; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function chartTip(host) {
  var t = host.querySelector('.ch-tip'); if (!t) { t = document.createElement('div'); t.className = 'ch-tip'; host.appendChild(t); }
  return { show: function (html, x, y) { t.innerHTML = html; t.style.display = 'block'; var w = host.clientWidth, tw = t.offsetWidth; t.style.left = Math.min(Math.max(0, x - tw / 2), w - tw) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px'; }, hide: function () { t.style.display = 'none'; } };
}
/** แท่งซ้อนรายวัน (หน่วยงาน) */
function stackBars(host, days, units) {
  var W = Math.max(320, host.clientWidth || 700), H = 230, padL = 36, padB = 26, padT = 10, n = Math.max(days.length, 28);
  var max = niceMax(Math.max.apply(null, days.map(function (d) { return d.total; }).concat([1]))), bw = (W - padL - 6) / n, gap = Math.min(4, bw * .25);
  var y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
  var g = '';
  for (var t = 0; t <= 4; t++) { var v = max / 4 * t, yy = y(v); g += '<line x1="' + padL + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (padL - 6) + '" y="' + (yy + 4) + '" class="ax" text-anchor="end">' + fmt(v) + '</text>'; }
  var bars = days.map(function (d, i) {
    var x = padL + i * bw + gap / 2, w = Math.max(2, bw - gap), acc = 0, s = '';
    units.forEach(function (u, k) {
      var v = d.vals[u.id] || 0; if (!v) return;
      var y1 = y(acc + v), y0 = y(acc); acc += v;
      s += '<rect x="' + x + '" y="' + y1 + '" width="' + w + '" height="' + Math.max(0, y0 - y1 - (acc < d.total ? 1.5 : 0)) + '" rx="' + Math.min(3, w / 3) + '" fill="' + seriesColor(k) + '"/>';
    });
    var dn = +d.date.slice(8), lab = (dn === 1 || dn % 5 === 0) ? '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" class="ax" text-anchor="middle">' + dn + '</text>' : '';
    return '<g class="bar" data-i="' + i + '">' + s + '<rect class="hit" x="' + (padL + i * bw) + '" y="' + padT + '" width="' + bw + '" height="' + (H - padT - padB) + '" fill="transparent"/>' + lab + '</g>';
  }).join('');
  host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="กราฟผู้ป่วยรายวัน">' + g + bars + '</svg>';
  var tip = chartTip(host);
  $$('.bar', host).forEach(function (b) {
    var show = function () { var d = days[+b.dataset.i], r = b.getBoundingClientRect(), hr = host.getBoundingClientRect(); tip.show('<b>' + thDate(d.date, { wd: true, short: true }) + '</b><br>' + units.map(function (u, k) { return '<i style="background:' + seriesColor(k) + '"></i>' + esc(u.short) + ' ' + fmt(d.vals[u.id] || 0); }).join('<br>') + '<br>รวม <b>' + fmt(d.total) + '</b>', r.left - hr.left + r.width / 2, r.top - hr.top + 30); b.classList.add('hov'); };
    b.addEventListener('mouseenter', show); b.addEventListener('click', show);
    b.addEventListener('mouseleave', function () { tip.hide(); b.classList.remove('hov'); });
  });
}
/** เส้นแนวโน้มรายเดือน */
function lineChart(host, months) {
  var W = Math.max(300, host.clientWidth || 500), H = 210, padL = 44, padB = 26, padT = 14, padR = 14;
  var max = niceMax(Math.max.apply(null, months.map(function (m) { return m.total; }).concat([1]))), n = months.length;
  var x = function (i) { return padL + (W - padL - padR) * (n === 1 ? .5 : i / (n - 1)); }, y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
  var g = '';
  for (var t = 0; t <= 4; t++) { var v = max / 4 * t; g += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/><text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + fmt(v) + '</text>'; }
  var pts = months.map(function (m, i) { return x(i) + ',' + y(m.total); }).join(' ');
  var dots = months.map(function (m, i) { return '<g class="pt" data-i="' + i + '"><circle cx="' + x(i) + '" cy="' + y(m.total) + '" r="4.5" fill="' + seriesColor(0) + '" class="ring"/><rect x="' + (x(i) - (W / n) / 2) + '" y="' + padT + '" width="' + (W / n) + '" height="' + (H - padT - padB) + '" fill="transparent"/>' + (i % 2 === (n - 1) % 2 ? '<text x="' + x(i) + '" y="' + (H - 8) + '" class="ax" text-anchor="middle">' + thMonth(m.ym, true).split(' ')[0] + '</text>' : '') + '</g>'; }).join('');
  host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="แนวโน้มผู้ป่วยรายเดือน">' + g + '<polyline points="' + pts + '" fill="none" stroke="' + seriesColor(0) + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>';
  var tip = chartTip(host);
  $$('.pt', host).forEach(function (p) {
    var show = function () { var m = months[+p.dataset.i]; tip.show('<b>' + thMonth(m.ym) + '</b><br>ผู้ป่วย ' + fmt(m.total) + ' ราย' + (m.days ? '<br>' + m.days + ' วันที่มีผู้ป่วย' : ''), x(+p.dataset.i) * host.clientWidth / W, y(m.total) * 1); };
    p.addEventListener('mouseenter', show); p.addEventListener('click', show); p.addEventListener('mouseleave', tip.hide);
  });
}
