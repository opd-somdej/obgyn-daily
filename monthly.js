/* monthly.js — รายงานตามช่วงเวลา (วัน · สัปดาห์ · เดือน · ไตรมาส · ครึ่งปี · ปีงบ · ปีปฏิทิน · กำหนดเอง) และหน้าภาพรวม
 * ตกลง 16 พ.ย. 69: ทั้ง 2 หน้าเลือกช่วงได้ · คอลัมน์อัตโนมัติตามช่วง · มี "รวมทุกหน่วย" · เทียบช่วงก่อนหน้า + ช่วงเดียวกันปีก่อน
 * ตัวเลขทุกตัวมาจาก computeDay() ชุดเดียวกับหน้ารายวัน (model.js) → ตรงกันทุกหน้า */
'use strict';
var ALL = 'all';

/* ================= โหลดข้อมูล ================= */
function loadMonth(ym, force) {
  if (!force && S.months[ym] && Date.now() - S.months[ym]._at < 120000) return Promise.resolve(S.months[ym]);
  return api('getMonth', { ym: ym }).then(function (d) { d._at = Date.now(); S.months[ym] = d; return d; });
}
/** โหลดหลายเดือน: ใช้ที่มีในเครื่อง (ไม่เกิน 2 นาที) · ที่ขาดดึงรวดเดียว (ครั้งละไม่เกิน 24 เดือน) */
function loadMonths(fromYm, toYm) {
  var cur = today().slice(0, 7); if (toYm > cur) toYm = cur;
  var all = [], need = [];
  for (var ym = fromYm; ym <= toYm; ym = ymAdd(ym, 1)) { all.push(ym); var c = S.months[ym]; if (!c || Date.now() - c._at > 120000) need.push(ym); }
  if (!need.length) return Promise.resolve(all);
  var chunks = [], i = 0;
  while (i < need.length) { var a = need[i], b = a; i++; while (i < need.length && need[i] === ymAdd(b, 1) && chunks.length < 99 && monthsBetween(a, need[i]) < 24) { b = need[i]; i++; } chunks.push([a, b]); }
  return Promise.all(chunks.map(function (c) {
    return (c[0] === c[1] ? api('getMonth', { ym: c[0] }).then(function (d) { return { months: [d] }; }) : api('getMonths', { from: c[0], to: c[1] }))
      .then(function (r) { r.months.forEach(function (m) { m._at = Date.now(); S.months[m.ym] = m; }); });
  })).then(function () { return all; });
}
function monthsBetween(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
function dayData(iso) { var mo = S.months[iso.slice(0, 7)]; return mo ? dayFromMonth(mo, iso) : null; }
function dayTypeOf(iso) { var mo = S.months[iso.slice(0, 7)]; return mo && mo.dayTypes ? mo.dayTypes[iso] : (dow(iso) % 6 === 0 ? 'S' : 'W'); }
function seriesColor(i) {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!theme() && matchMedia('(prefers-color-scheme: dark)').matches);
  return (dark ? ['#e4528a', '#8f6fd0', '#d39a3a', '#4fa58a'] : ['#c2185b', '#7b4fa0', '#a8701a', '#2f7d64'])[i % 4];
}

/* ================= ช่วงเวลา ================= */
var MODES = [['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['half', 'ครึ่งปี'], ['fy', 'ปีงบ'], ['cy', 'ปีปฏิทิน'], ['custom', 'กำหนดเอง']];
var MODE_TH = {}; MODES.forEach(function (m) { MODE_TH[m[0]] = m[1]; });
function dayDiff(a, b) { var p = ip(a), q = ip(b); return Math.round((Date.UTC(q.y, q.m - 1, q.d) - Date.UTC(p.y, p.m - 1, p.d)) / 864e5); }
function minIso(a, b) { return a < b ? a : b; }
function maxIso(a, b) { return a > b ? a : b; }
function lastDay(ym) { return ym + '-' + ('0' + daysIn(ym)).slice(-2); }
function mondayOf(iso) { var w = dow(iso); return addDays(iso, w === 0 ? -6 : 1 - w); }
function addYears(iso, k) { var y = +iso.slice(0, 4) + k, md = iso.slice(5); if (md === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) md = '02-28'; return y + '-' + md; }
/** ปีงบประมาณ (พ.ศ.) ของวันที่: ต.ค.–ก.ย. */
function fyOf(iso) { var y = +iso.slice(0, 4), m = +iso.slice(5, 7); return (m >= 10 ? y + 1 : y) + 543; }
function rangeTh(a, b) {
  if (a === b) return thDate(a);
  var pa = ip(a), pb = ip(b);
  if (pa.y === pb.y && pa.m === pb.m) return pa.d + '–' + pb.d + ' ' + TH_MS[pa.m - 1] + ' ' + (pa.y + 543);
  if (pa.y === pb.y) return pa.d + ' ' + TH_MS[pa.m - 1] + ' – ' + pb.d + ' ' + TH_MS[pb.m - 1] + ' ' + (pb.y + 543);
  return thDate(a, { short: true }) + ' – ' + thDate(b, { short: true });
}
/** คีย์ช่วงที่มีวันที่ iso */
function periodKey(mode, iso) {
  var m = +iso.slice(5, 7), f = fyOf(iso);
  if (mode === 'day') return iso;
  if (mode === 'week') return 'W' + mondayOf(iso);
  if (mode === 'quarter') return 'Q' + f + '-' + (Math.floor(((m + 2) % 12) / 3) + 1);
  if (mode === 'half') return 'H' + f + '-' + (m >= 10 || m <= 3 ? 1 : 2);
  if (mode === 'fy') return 'FY' + f;
  if (mode === 'cy') return 'Y' + iso.slice(0, 4);
  if (mode === 'custom') return iso.slice(0, 7) + '-01_' + iso;
  return iso.slice(0, 7);
}
/** คีย์ → {mode, key, from, to, label, name} · คีย์เดิม yyyy-MM (ลิงก์เก่า) = รายเดือน */
function parsePeriod(key) {
  key = String(key || ''); var t = today(), x, p;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) p = { mode: 'day', from: key, to: key };
  else if ((x = /^W(\d{4}-\d{2}-\d{2})$/.exec(key))) { var mo = mondayOf(x[1]); p = { mode: 'week', from: mo, to: addDays(mo, 6) }; key = 'W' + mo; }
  else if (/^\d{4}-\d{2}$/.test(key)) p = { mode: 'month', from: key + '-01', to: lastDay(key) };
  else if ((x = /^Q(\d{4})-([1-4])$/.exec(key))) { var ce = +x[1] - 543, q = +x[2], sm = [[ce - 1, 10], [ce, 1], [ce, 4], [ce, 7]][q - 1], s = sm[0] + '-' + ('0' + sm[1]).slice(-2); p = { mode: 'quarter', from: s + '-01', to: lastDay(ymAdd(s, 2)), fy: +x[1], q: q }; }
  else if ((x = /^H(\d{4})-([12])$/.exec(key))) { var c2 = +x[1] - 543; p = x[2] === '1' ? { mode: 'half', from: (c2 - 1) + '-10-01', to: c2 + '-03-31' } : { mode: 'half', from: c2 + '-04-01', to: c2 + '-09-30' }; p.fy = +x[1]; p.h = +x[2]; }
  else if ((x = /^FY(\d{4})$/.exec(key))) { var c3 = +x[1] - 543; p = { mode: 'fy', from: (c3 - 1) + '-10-01', to: c3 + '-09-30', fy: +x[1] }; }
  else if ((x = /^Y(\d{4})$/.exec(key))) p = { mode: 'cy', from: x[1] + '-01-01', to: x[1] + '-12-31' };
  else if ((x = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(key))) {
    var a = minIso(x[1], x[2]), b = maxIso(x[1], x[2]); if (b > t) b = t; if (a > b) a = b;
    if (dayDiff(a, b) > 1095) a = addDays(b, -1095);   // ไม่เกิน 3 ปี
    p = { mode: 'custom', from: a, to: b }; key = a + '_' + b;
  } else return parsePeriod(periodKey(lsGet('repMode', 'month'), t));
  p.key = key;
  var pf = ip(p.from);
  p.label = p.mode === 'day' ? 'วัน' + TH_D[dow(p.from)] + 'ที่ ' + thDate(p.from)
    : p.mode === 'week' ? 'สัปดาห์ ' + rangeTh(p.from, p.to)
      : p.mode === 'month' ? 'เดือน' + thMonth(p.from.slice(0, 7))
        : p.mode === 'quarter' ? 'ไตรมาส ' + p.q + ' ปีงบประมาณ ' + p.fy
          : p.mode === 'half' ? (p.h === 1 ? 'ครึ่งปีแรก' : 'ครึ่งปีหลัง') + ' ปีงบประมาณ ' + p.fy
            : p.mode === 'fy' ? 'ปีงบประมาณ ' + p.fy
              : p.mode === 'cy' ? 'ปี พ.ศ. ' + (pf.y + 543)
                : rangeTh(p.from, p.to);
  p.sub = p.mode === 'day' ? '' : rangeTh(p.from, p.to);
  p.short = p.mode === 'month' ? thMonth(p.from.slice(0, 7), true) : p.mode === 'quarter' ? 'Q' + p.q + '/' + String(p.fy).slice(-2) : p.mode === 'half' ? 'H' + p.h + '/' + String(p.fy).slice(-2) : p.mode === 'fy' ? 'ปีงบ ' + String(p.fy).slice(-2) : p.mode === 'cy' ? 'ปี ' + String(pf.y + 543).slice(-2) : p.mode === 'day' ? thDate(p.from, { short: true }) : rangeTh(p.from, p.to);
  p.effTo = minIso(p.to, t);              // วันสุดท้ายที่มีข้อมูลได้
  p.partial = p.to > t && p.from <= t;    // ช่วงที่ยังไม่จบ
  p.future = p.from > t;
  return p;
}
function shiftPeriod(p, k) {
  if (p.mode === 'day') return addDays(p.from, k);
  if (p.mode === 'week') return 'W' + addDays(p.from, 7 * k);
  if (p.mode === 'month') return ymAdd(p.from.slice(0, 7), k);
  if (p.mode === 'quarter') { var t = p.fy * 4 + (p.q - 1) + k; return 'Q' + Math.floor(t / 4) + '-' + (t % 4 + 1); }
  if (p.mode === 'half') { var h = p.fy * 2 + (p.h - 1) + k; return 'H' + Math.floor(h / 2) + '-' + (h % 2 + 1); }
  if (p.mode === 'fy') return 'FY' + (p.fy + k);
  if (p.mode === 'cy') return 'Y' + (+p.from.slice(0, 4) + k);
  var len = dayDiff(p.from, p.to) + 1; return addDays(p.from, k * len) + '_' + addDays(p.to, k * len);
}
/** ช่วงเปรียบเทียบ · ช่วงที่ยังไม่จบเทียบเท่าจำนวนวันที่ผ่านมา (เช่น 1–16 พ.ย. เทียบ 1–16 ต.ค.) */
function compareRanges(p) {
  if (p.future) return [];
  var n = dayDiff(p.from, p.effTo), out = [];
  var pp = parsePeriod(shiftPeriod(p, -1)), pt = p.partial ? minIso(pp.to, addDays(pp.from, n)) : pp.to;
  var yearly = p.mode === 'fy' || p.mode === 'cy';   // ปีงบ/ปีปฏิทิน: ช่วงก่อนหน้า = ปีก่อน (แสดงคอลัมน์เดียว)
  out.push({ id: 'prev', name: yearly ? 'ปีก่อน' : 'ช่วงก่อนหน้า', head: p.mode === 'custom' ? 'ช่วงก่อน' : yearly ? 'ปีก่อน' : MODE_TH[p.mode] + 'ก่อน', label: pp.label + (p.partial ? ' (' + rangeTh(pp.from, pt) + ')' : ''), from: pp.from, to: pt });
  if (yearly) return out;
  var wk = p.mode === 'day' || p.mode === 'week';   // วัน/สัปดาห์ เทียบวันเดียวกันของสัปดาห์ (ย้อน 52 สัปดาห์)
  var yf = wk ? addDays(p.from, -364) : addYears(p.from, -1);
  var yt = wk ? addDays(p.effTo, -364) : p.partial ? addYears(p.effTo, -1) : p.mode === 'custom' ? addYears(p.to, -1) : lastDay(ymAdd(p.to.slice(0, 7), -12));
  out.push({ id: 'yoy', name: 'ช่วงเดียวกันปีก่อน', head: 'ปีก่อน', label: 'ช่วงเดียวกันปีก่อน (' + rangeTh(yf, yt) + ')', from: yf, to: yt });
  return out;
}
/** คอลัมน์อัตโนมัติ: วัน → 1 · สัปดาห์/กำหนดเอง ≤ 14 วัน → รายวัน · เดือน → สัปดาห์ 1–5 · กำหนดเอง ≤ 62 วัน → รายสัปดาห์ · นอกนั้น → รายเดือน */
function bucketsOf(p, weekMode) {
  var n = dayDiff(p.from, p.to) + 1, out = [], d;
  var days = function (a, b) { var l = []; for (var x = a; x <= b; x = addDays(x, 1)) l.push(x); return l; };
  if (p.mode === 'day') return [{ from: p.from, to: p.to, label: thDate(p.from, { short: true }), sub: '', days: [p.from] }];
  if (p.mode === 'month') return weeksOf(p.from.slice(0, 7), weekMode).map(function (w) { return { from: w.from, to: w.to, label: w.label.replace('สัปดาห์ที่ ', 'สัปดาห์ '), sub: w.range, days: w.days }; });
  if (p.mode === 'week' || n <= 14) { for (d = p.from; d <= p.to; d = addDays(d, 1)) out.push({ from: d, to: d, label: TH_DS[dow(d)] + ' ' + +d.slice(8), sub: TH_MS[+d.slice(5, 7) - 1], days: [d], unit: 'day' }); return out; }
  if (p.mode === 'custom' && n <= 62) {
    for (d = p.from; d <= p.to;) { var e = minIso(addDays(mondayOf(d), 6), p.to); out.push({ from: d, to: e, label: 'สัปดาห์ ' + (out.length + 1), sub: rangeTh(d, e).replace(/ \d{4}$/, ''), days: days(d, e), unit: 'week' }); d = addDays(e, 1); }
    return out;
  }
  for (var ym = p.from.slice(0, 7); ym <= p.to.slice(0, 7); ym = ymAdd(ym, 1)) {
    var a = maxIso(p.from, ym + '-01'), b = minIso(p.to, lastDay(ym));
    out.push({ from: a, to: b, label: thMonth(ym, true), sub: a.slice(8) !== '01' || b !== lastDay(ym) ? +a.slice(8) + '–' + +b.slice(8) : '', days: days(a, b), unit: 'month' });
  }
  return out;
}
/** รายการช่วงให้เลือก (ตั้งแต่วันแรกที่มีข้อมูล ถึงปัจจุบัน · ใหม่ → เก่า) */
function periodChoices(mode) {
  var first = (S.boot.firstDate || today()), cur = parsePeriod(periodKey(mode, today())), out = [cur], k = cur;
  for (var i = 0; i < 60; i++) { k = parsePeriod(shiftPeriod(k, -1)); if (k.to < first) break; out.push(k); }
  return out;
}

/* ================= คำนวณรายงานตามช่วง ================= */
function unitIds(unit) { return unit === ALL ? S.boot.units.map(function (u) { return u.id; }) : [unit]; }
function unitLabel(unit) { if (unit === ALL) return 'รวมทุกหน่วย'; var u = unitById(unit); return u ? u.name : unit; }
/** สรุปของหน่วย (หรือรวมทุกหน่วย) ตามคอลัมน์ → {buckets, rows:[{sec,key,label,vals[],total,kind}], daily:{iso:{unit:m}}} */
function periodReport(unit, buckets) {
  var U = unitIds(unit), all = U.length > 1, W = buckets.length, rows = [], R = {}, t = today();
  var row = function (sec, key, label, kind) { var k = sec + ':' + key; if (!R[k]) { R[k] = { sec: sec, key: key, label: label, kind: kind || 'sum', vals: new Array(W).fill(0), cnt: new Array(W).fill(0) }; rows.push(R[k]); } return R[k]; };
  var unitTag = function (it) { return all && it.unit ? ' (' + ((unitById(it.unit) || {}).short || it.unit) + ')' : ''; };
  var clLabel = function (c) { return c.special ? c.special + ' (' + c.short + ')' : String(c.name).replace(/\s*อาคาร.*$/, ''); };
  // ลำดับแถวคงที่ (หน้าตาเหมือนแบบฟอร์มทุกช่วง)
  row('pt', 'total', 'จำนวนผู้ป่วยทั้งหมด');
  if (all) U.forEach(function (u) { row('pt', 'u:' + u, '· ' + unitLabel(u)); });
  row('pt', 'am', 'เวรเช้า'); row('pt', 'pm', 'เวรบ่าย');
  (S.boot.clinics || []).filter(function (c) { return U.indexOf(c.unit) >= 0 && c.show; }).forEach(function (c) { row('cl', c.code, clLabel(c)); });
  U.forEach(function (u) { itemsFor('extra', u, {}, 'ex').forEach(function (x) { row('ex', x.id, x.name + unitTag(x) + (x.countIn ? '' : ' (ไม่นับรวม)')); }); });
  U.forEach(function (u) { itemsFor('proc', u, {}, 'pr').forEach(function (x) { row('pr', x.id, x.name + unitTag(x)); }); });
  U.forEach(function (u) { itemsFor('kpi', u, {}, 'kp').forEach(function (x) { row('kp', x.id, x.name + unitTag(x), x.type === 'pct' ? 'avg' : 'sum'); }); });
  (S.boot.items || []).filter(function (x) { return x.kind === 'case' && x.active; }).forEach(function (x) { row('cs', x.name, x.name); });
  (S.boot.positions || ['GN', 'PN', 'NA']).forEach(function (p) { row('st', p, 'จำนวน ' + p + ' (เฉลี่ย/วัน)', 'avg'); });
  row('meta', 'days', 'วันที่มีผู้ป่วย'); row('meta', 'filled', all ? 'ใบรายงานที่บันทึกแล้ว' : 'วันที่บันทึกแล้ว'); row('meta', 'reported', all ? 'ใบรายงานที่ส่งแล้ว' : 'วันที่ส่งรายงานแล้ว'); row('meta', 'need', all ? 'ใบรายงานที่ควรบันทึก' : 'วันที่ควรบันทึก');
  var daily = {};
  buckets.forEach(function (b, wi) {
    b.days.forEach(function (iso) {
      if (iso > t) return;
      var dd = dayData(iso); if (!dd) return;
      var dm = daily[iso] = {}, dayTot = 0, st = {}, anyFill = false;
      var add = function (r, v) { r.vals[wi] += v; };
      U.forEach(function (u) {
        var m = dm[u] = computeDay(dd, u); dayTot += m.total;
        add(R['pt:total'], m.total); add(R['pt:am'], m.am); add(R['pt:pm'], m.pm); if (all) add(R['pt:u:' + u], m.total);
        m.clinics.forEach(function (c) { add(row('cl', c.code, clLabel(c)), c.total); });
        m.extras.forEach(function (x) { add(row('ex', x.id, x.name), x.total); });
        m.procs.forEach(function (p) { add(row('pr', p.id, p.name), p.total); });
        m.kpis.forEach(function (k) { if (k.value === '') return; var r = row('kp', k.id, k.name, k.type === 'pct' ? 'avg' : 'sum'); r.vals[wi] += +k.value; r.cnt[wi]++; });
        m.cases.forEach(function (c) { add(row('cs', c.type, c.type), 1); });
        if (m.filled) { anyFill = true; Object.keys(m.staffN).forEach(function (p) { st[p] = (st[p] || 0) + (m.staffN[p] || 0); }); }
        if (m.filled) add(R['meta:filled'], 1);
        if (m.entry && m.entry.reportedAt) add(R['meta:reported'], 1);
        if (m.total > 0 && dayTypeOf(iso) === 'W') add(R['meta:need'], 1);
      });
      if (anyFill) Object.keys(st).forEach(function (p) { if (st[p] > 0) { var r = row('st', p, 'จำนวน ' + p + ' (เฉลี่ย/วัน)', 'avg'); r.vals[wi] += st[p]; r.cnt[wi]++; } });
      if (dayTot > 0) add(R['meta:days'], 1);
    });
  });
  rows.forEach(function (r) {
    if (r.kind === 'avg') {
      var s = 0, c = 0; r.vals = r.vals.map(function (v, i) { s += v; c += r.cnt[i]; return r.cnt[i] ? Math.round(v / r.cnt[i] * 10) / 10 : null; });
      r.total = c ? Math.round(s / c * 10) / 10 : null;
    } else r.total = r.vals.reduce(function (a, b) { return a + b; }, 0);
  });
  return { buckets: buckets, rows: rows, daily: daily, units: U, all: all };
}
/** ยอดรวมทั้งช่วง (ใช้เทียบ) → {'sec:key': total} */
function periodTotals(unit, from, to) {
  if (to < from) return null;
  var days = []; for (var d = from; d <= to; d = addDays(d, 1)) days.push(d);
  var r = periodReport(unit, [{ from: from, to: to, days: days }]), out = {};
  r.rows.forEach(function (x) { out[x.sec + ':' + x.key] = x.total; });
  out._daily = r.daily; out._hasData = Object.keys(r.daily).length > 0;
  return out;
}
function rowVal(rep, k) { var r = rep.rows.filter(function (x) { return x.sec + ':' + x.key === k; })[0]; return r ? r.total : 0; }
/** เปลี่ยนแปลง (%) → {txt, cls} */
function delta(cur, prev) {
  if (prev == null || cur == null || prev === '' || !isFinite(prev)) return { txt: '', cls: '' };
  if (+prev === 0) return { txt: +cur ? 'ใหม่' : '', cls: +cur ? 'up' : '' };
  var p = Math.round((cur - prev) / prev * 1000) / 10;
  return { txt: (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + fmt(Math.abs(p)) + '%', cls: p > 0 ? 'up' : p < 0 ? 'down' : 'eq' };
}
var SEC_TH = { pt: 'ผู้ป่วย', cl: 'รายคลินิก', ex: 'ยอดคีย์เพิ่ม', pr: 'หัตถการ', kp: 'ตัวชี้วัด', cs: 'ผู้ป่วยส่งต่อ', st: 'อัตรากำลัง', meta: 'การบันทึก' };
function cellVal(r, v) { if (v == null) return ''; if (r.kind === 'avg') return fmt(v); return v ? fmt(v) : (r.sec === 'pr' || r.sec === 'kp' ? '' : '0'); }
/** แถวที่จะแสดง: รายการที่เป็นศูนย์ทั้งช่วง (คลินิก ยอดคีย์เพิ่ม หัตถการ ส่งต่อ แยกหน่วย) ซ่อน เว้นแต่ติ๊ก "แสดงแถวที่เป็นศูนย์" · ตัวชี้วัดแสดงทุกข้อ */
function visibleRows(rep, showZero) {
  return rep.rows.filter(function (r) {
    if (r.sec === 'meta') return false;
    var zero = r.kind === 'avg' ? r.total == null : !r.total;
    if (zero && !showZero && (r.sec === 'cl' || r.sec === 'ex' || r.sec === 'cs' || r.sec === 'pr' || r.sec === 'st' || (r.sec === 'pt' && r.key !== 'total'))) return false;
    return true;
  });
}
/** ตารางรายงาน (หน้าจอ + พิมพ์ใช้ชุดเดียว) · cmps = [{head, label, totals}] */
function reportTable(rep, showZero, cmps) {
  var multi = rep.buckets.length > 1;
  var head = '<thead><tr><th class="no">ลำดับ</th><th>รายการ/กิจกรรม</th>' + (multi ? rep.buckets.map(function (w) { return '<th class="n">' + esc(w.label) + (w.sub ? '<small>' + esc(w.sub) + '</small>' : '') + '</th>'; }).join('') : '') + '<th class="n tot">รวม</th>' +
    cmps.map(function (c) { return '<th class="n cmp" title="' + esc(c.label) + '">' + esc(c.head) + '<small>' + esc(c.range) + '</small></th>'; }).join('') + '</tr></thead>';
  var sec = '', no = 0, body = '', cols = (multi ? rep.buckets.length : 0) + 3 + cmps.length;
  visibleRows(rep, showZero).forEach(function (r) {
    var zero = r.kind === 'avg' ? r.total == null : !r.total;
    if (r.sec !== sec) { sec = r.sec; body += '<tr class="sec"><th colspan="' + cols + '">' + SEC_TH[sec] + '</th></tr>'; }
    no++;
    body += '<tr class="' + (zero ? 'zero ' : '') + (r.key === 'total' ? 'key' : '') + (/^u:/.test(r.key) ? ' sub' : '') + '"><td class="no">' + no + '</td><td>' + esc(r.label) + '</td>' +
      (multi ? r.vals.map(function (v) { return '<td class="n">' + cellVal(r, v) + '</td>'; }).join('') : '') + '<td class="n tot">' + cellVal(r, r.total) + '</td>' +
      cmps.map(function (c) {
        if (!c.totals) return '<td class="n cmp muted">–</td>';
        var pv = c.totals[r.sec + ':' + r.key], d = delta(r.total, pv == null ? (r.kind === 'avg' ? null : 0) : pv);
        return '<td class="n cmp">' + (pv == null ? '' : cellVal(r, pv) || '0') + (d.txt ? '<small class="dl ' + d.cls + '">' + d.txt + '</small>' : '') + '</td>';
      }).join('') + '</tr>';
  });
  return '<table class="tbl mrep' + (cmps.length ? ' has-cmp' : '') + '">' + head + '<tbody>' + body + '</tbody></table>';
}

/* ================= แถบเลือกช่วงเวลา (ใช้ทั้งหน้ารายงานและภาพรวม) ================= */
function periodBar(base, p, unit, acts) {
  var t = today(), cur = periodKey(p.mode, t), nxt = parsePeriod(shiftPeriod(p, 1)), units = S.boot.units;
  var pick = '';
  if (p.mode === 'day') pick = '<input type="date" id="pkIn" value="' + p.from + '" max="' + t + '" aria-label="เลือกวันที่">';
  else if (p.mode === 'week') pick = '<input type="date" id="pkIn" value="' + p.from + '" max="' + t + '" aria-label="เลือกวันในสัปดาห์">';
  else if (p.mode === 'month') pick = '<input type="month" id="pkIn" value="' + p.from.slice(0, 7) + '" max="' + t.slice(0, 7) + '" aria-label="เลือกเดือน">';
  else if (p.mode !== 'custom') pick = '<select id="pkSel" aria-label="เลือก' + MODE_TH[p.mode] + '">' + periodChoices(p.mode).map(function (x) { return '<option value="' + esc(x.key) + '"' + (x.key === p.key ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select>';
  return '<header class="day-head per-head">' +
    '<div class="seg sm pmodes" role="tablist" aria-label="ช่วงเวลา">' + MODES.map(function (m) { return '<button role="tab" data-mode="' + m[0] + '" class="' + (m[0] === p.mode ? 'on' : '') + '" aria-selected="' + (m[0] === p.mode) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
    '<div class="per-row">' +
    '<div class="dh-date"><button class="icon-btn" data-pk="' + esc(shiftPeriod(p, -1)) + '" aria-label="ช่วงก่อนหน้า">' + ic('left') + '</button>' +
    '<label class="dh-pick' + (p.mode === 'custom' ? ' static' : '') + '"><span class="dh-wd">' + (base === 'month' ? 'รายงาน' : 'ภาพรวม') + ' · ' + esc(MODE_TH[p.mode]) + (p.partial ? ' · ถึงวันนี้' : '') + '</span><span class="dh-d">' + esc(p.label) + '</span>' + (p.sub && p.mode !== 'week' && p.mode !== 'custom' ? '<span class="dh-sub">' + esc(p.sub) + '</span>' : '') + pick + '</label>' +
    '<button class="icon-btn" data-pk="' + esc(nxt.key) + '" aria-label="ช่วงถัดไป" ' + (nxt.from > t ? 'disabled' : '') + '>' + ic('right') + '</button>' +
    (p.mode !== 'custom' && p.key !== cur ? '<button class="btn ghost sm" data-pk="' + esc(cur) + '">ปัจจุบัน</button>' : '') + '</div>' +
    (units.length > 1 ? '<div class="seg" role="tablist" aria-label="หน่วยงาน">' + units.map(function (x) { return '<button data-unit="' + x.id + '" class="' + (x.id === unit ? 'on' : '') + '" style="--c:' + esc(x.color) + '">' + esc(x.short) + '</button>'; }).join('') + '<button data-unit="' + ALL + '" class="' + (unit === ALL ? 'on' : '') + '">รวมทุกหน่วย</button></div>' : '') +
    (acts ? '<div class="dh-acts">' + acts + '</div>' : '') + '</div>' +
    (p.mode === 'custom' ? '<form class="per-custom" id="pkCustom"><label>ตั้งแต่ <input type="date" id="pkFrom" value="' + p.from + '" max="' + t + '" min="' + esc(S.boot.firstDate || '') + '"></label><label>ถึง <input type="date" id="pkTo" value="' + p.to + '" max="' + t + '"></label><button class="btn sm primary" type="submit">แสดง</button>' +
      '<span class="per-quick">' + [['7 วัน', 6], ['30 วัน', 29], ['90 วัน', 89], ['365 วัน', 364]].map(function (q) { return '<button type="button" class="btn ghost sm" data-pk="' + addDays(t, -q[1]) + '_' + t + '">' + q[0] + 'ล่าสุด</button>'; }).join('') + '</span></form>' : '') +
    '</header>';
}
function bindPeriodBar(el, base, p, unit) {
  var nav = function (key, u) { go('#/' + base + '/' + key + '/' + (u || unit)); };
  $$('[data-pk]', el).forEach(function (b) { b.onclick = function () { nav(b.dataset.pk); }; });
  $$('[data-mode]', el).forEach(function (b) {
    b.onclick = function () {
      var m = b.dataset.mode; lsSet('repMode', m);
      nav(m === 'custom' ? p.from + '_' + p.effTo : periodKey(m, p.future ? today() : p.effTo));
    };
  });
  $$('[data-unit]', el).forEach(function (b) { b.onclick = function () { lsSet(base + 'Unit', b.dataset.unit); nav(p.key, b.dataset.unit); }; });
  var inp = $('#pkIn', el); if (inp) inp.onchange = function () { if (!this.value) return; var v = this.value > today().slice(0, this.value.length) ? today().slice(0, this.value.length) : this.value; nav(p.mode === 'week' ? 'W' + mondayOf(v) : v); };
  var sel = $('#pkSel', el); if (sel) sel.onchange = function () { nav(this.value); };
  var cf = $('#pkCustom', el); if (cf) cf.onsubmit = function (e) { e.preventDefault(); var a = $('#pkFrom').value, b2 = $('#pkTo').value; if (!a || !b2) { toast('เลือกวันเริ่มและวันสิ้นสุด', 'err'); return; } nav(minIso(a, b2) + '_' + maxIso(a, b2)); };
}
/** อ่านเส้นทาง #/month/<คีย์ช่วง>/<หน่วย> (ลิงก์เก่า #/month/2026-08/gyn ใช้ได้) */
function periodRoute(r, base, defUnit) {
  var p = parsePeriod(r.a || periodKey(lsGet('repMode', 'month'), today()));
  if (p.from > today()) p = parsePeriod(periodKey(p.mode, today()));
  var units = S.boot.units, saved = lsGet(base + 'Unit', defUnit);
  var unit = r.b === ALL || (r.b && unitById(r.b)) ? r.b : (saved === ALL || unitById(saved) ? saved : defUnit);
  if (units.length < 2 && unit === ALL) unit = units[0].id;
  lsSet(base + 'Unit', unit); lsSet('repMode', p.mode);
  return { p: p, unit: unit };
}
/** ช่วงเดือนที่ต้องโหลด (ช่วงหลัก + ช่วงเทียบ) */
function monthsNeeded(p, cmps) {
  var a = p.from, b = p.effTo; cmps.forEach(function (c) { a = minIso(a, c.from); b = maxIso(b, c.to); });
  var first = (S.boot.firstDate || a).slice(0, 7);
  return [maxIso(a.slice(0, 7), minIso(first, p.from.slice(0, 7))), b.slice(0, 7)];
}
function loadingHtml() { return '<div class="sk sk-tally"></div><div class="sk sk-card"></div>'; }

/* ================= หน้ารายงาน ================= */
PAGES.month = function (r, el) {
  var pr = periodRoute(r, 'month', myUnits()[0].id), p = pr.p, unit = pr.unit, hash = location.hash;
  document.title = 'รายงาน ' + p.short + ' · OB-GYN Daily';
  var st = { week: lsGet('weekMode', S.boot.texts.weekMode || 'block'), zero: lsGet('showZero', false), prev: lsGet('cmpPrev', false), yoy: lsGet('cmpYoy', false) };
  var color = unit === ALL ? 'var(--rose)' : unitById(unit).color;
  var acts = '<button class="btn ghost" id="mXls" disabled>' + ic('excel') + '<span>Excel</span></button><button class="btn primary" id="mPrint" disabled>' + ic('print') + '<span>พิมพ์</span></button>';
  el.innerHTML = '<div class="page month" style="--unit:' + esc(color) + '">' + periodBar('month', p, unit, acts) + '<div id="repBody">' + loadingHtml() + '</div></div>';
  bindPeriodBar(el, 'month', p, unit);
  if (p.future) { $('#repBody').innerHTML = '<div class="empty-box">' + ic('info') + 'ช่วงนี้ยังมาไม่ถึง</div>'; return; }
  var cmps = compareRanges(p), rng = monthsNeeded(p, cmps);
  loadMonths(rng[0], rng[1]).then(function () {
    if (S.page !== 'month' || location.hash !== hash) return;
    var paint = function () {
      var rep = periodReport(unit, bucketsOf(p, st.week));
      var tot = cmps.map(function (c) { return Object.assign({}, c, { totals: periodTotals(unit, c.from, c.to) }); });
      var yearly = p.mode === 'fy' || p.mode === 'cy';
      var shown = tot.filter(function (c) { return c.id === 'prev' ? (st.prev || (yearly && st.yoy)) : st.yoy; }).map(function (c) { return Object.assign({}, c, { range: rangeTh(c.from, c.to).replace(/ \d{4}$/, ''), totals: c.totals && c.totals._hasData ? c.totals : null }); });
      var body = $('#repBody'); if (!body) return;
      body.innerHTML = summaryHtml(p, rep, tot, unit) +
        (p.mode === 'month' ? calendarHtml(p, rep, unit) : '') +
        '<section class="card"><div class="card-h"><h2>' + ic('month') + 'ยอดผู้มารับบริการ · ' + esc(unitLabel(unit)) + '</h2>' +
        '<div class="card-tools">' + (p.mode === 'month' ? '<div class="seg sm" id="wMode"><button data-w="block" class="' + (st.week !== 'mon' ? 'on' : '') + '">วันที่ 1–7, 8–14 …</button><button data-w="mon" class="' + (st.week === 'mon' ? 'on' : '') + '">จันทร์–อาทิตย์</button></div>' : '<span class="hint">' + esc(colHint(rep.buckets)) + '</span>') +
        '<label class="chk sm"><input type="checkbox" id="cPrev"' + (st.prev ? ' checked' : '') + '><span>เทียบ' + esc(yearly ? 'ปีก่อน' : 'ช่วงก่อนหน้า') + '</span></label>' +
        (yearly ? '' : '<label class="chk sm"><input type="checkbox" id="cYoy"' + (st.yoy ? ' checked' : '') + '><span>เทียบช่วงเดียวกันปีก่อน</span></label>') +
        '<label class="chk sm"><input type="checkbox" id="zero"' + (st.zero ? ' checked' : '') + '><span>แสดงแถวที่เป็นศูนย์</span></label></div></div>' +
        '<div class="tbl-wrap">' + reportTable(rep, st.zero, shown) + '</div></section>' +
        '<p class="foot-meta">ยอดผู้ป่วยมาจาก HIS · หัตถการ ตัวชี้วัด เจ้าหน้าที่ มาจากรายงานประจำวันที่พยาบาลบันทึก · ร้อยละและอัตรากำลัง = ค่าเฉลี่ยของวันที่บันทึก' + (p.partial ? ' · ช่วงที่ยังไม่จบ เทียบเท่าจำนวนวันที่ผ่านมา' : '') + '</p>';
      $$('#wMode button', body).forEach(function (b) { b.onclick = function () { st.week = b.dataset.w; lsSet('weekMode', st.week); paint(); }; });
      $('#zero').onchange = function () { st.zero = this.checked; lsSet('showZero', st.zero); paint(); };
      $('#cPrev').onchange = function () { st.prev = this.checked; lsSet('cmpPrev', st.prev); if (yearly) { st.yoy = false; lsSet('cmpYoy', false); } paint(); };
      if ($('#cYoy')) $('#cYoy').onchange = function () { st.yoy = this.checked; lsSet('cmpYoy', st.yoy); paint(); };
      $$('[data-day]', body).forEach(function (b) { b.onclick = function () { go('#/day/' + b.dataset.day + '/' + (unit === ALL ? myUnits()[0].id : unit)); }; });
      $$('[data-goday]', body).forEach(function (b) { b.onclick = function () { go('#/day/' + p.from + '/' + (unit === ALL ? myUnits()[0].id : unit)); }; });
      $('#mXls').disabled = false; $('#mPrint').disabled = false;
      $('#mXls').onclick = function () { exportReportXlsx(rep, p, unit, shown, this); };
      $('#mPrint').onclick = function () { printReport(rep, p, unit, st.zero, shown); };
    };
    paint();
  }).catch(function (e) { var b = $('#repBody'); if (b) b.innerHTML = errorBox(e.message, 'location.reload()'); });
};
function colHint(bk) { var u = (bk[0] || {}).unit; return bk.length < 2 ? 'ยอดรวมทั้งช่วง' : u === 'day' ? 'แบ่งคอลัมน์รายวัน' : u === 'week' ? 'แบ่งคอลัมน์รายสัปดาห์ (จันทร์–อาทิตย์)' : 'แบ่งคอลัมน์รายเดือน'; }
function tile2(lbl, num, unit, sub) { return '<div class="tile"><span class="tl-l">' + esc(lbl) + '</span><span class="tl-n">' + num + '<small>' + esc(unit) + '</small></span><span class="tl-s">' + (sub || '') + '</span></div>'; }
function deltaLine(cur, tot, key) {
  return tot.map(function (c) { if (!c.totals || !c.totals._hasData) return ''; var pv = c.totals[key], d = delta(cur, pv); return '<span class="dl ' + d.cls + '" title="' + esc(c.label) + ' ' + fmt(pv || 0) + '">' + (d.txt || '±0%') + ' <em>จาก' + esc(c.id === 'yoy' ? 'ปีก่อน' : c.head) + '</em></span>'; }).filter(Boolean).join('');
}
/** การ์ดสรุป 4 ช่อง (ผู้ป่วย · เฉลี่ย/วันทำการ · หัตถการ · บันทึก) พร้อมเทียบช่วงก่อนหน้า/ปีก่อน */
function summaryHtml(p, rep, tot, unit) {
  var total = rowVal(rep, 'pt:total'), wd = 0, wdN = 0, procT = 0;
  Object.keys(rep.daily).forEach(function (iso) { if (dayTypeOf(iso) !== 'W') return; var s = 0; rep.units.forEach(function (u) { s += rep.daily[iso][u].total; }); if (s > 0) { wd += s; wdN++; } });
  rep.rows.forEach(function (r) { if (r.sec === 'pr') procT += r.total; });
  tot.forEach(function (c) { if (c.totals) { var s = 0; Object.keys(c.totals).forEach(function (k) { if (/^pr:/.test(k)) s += c.totals[k]; }); c.totals['_proc'] = s; } });
  var need = rowVal(rep, 'meta:need'), filled = rowVal(rep, 'meta:filled'), reported = rowVal(rep, 'meta:reported');
  return '<section class="tiles">' +
    tile2('ผู้ป่วยทั้งหมด', fmt(total), 'ราย', deltaLine(total, tot, 'pt:total')) +
    tile2(p.mode === 'day' ? 'ผู้ป่วยเวรเช้า / บ่าย' : 'เฉลี่ยต่อวันทำการ', p.mode === 'day' ? fmt(rowVal(rep, 'pt:am')) + ' / ' + fmt(rowVal(rep, 'pt:pm')) : wdN ? fmt(Math.round(wd / wdN)) : '–', p.mode === 'day' ? 'ราย' : 'ราย/วัน', p.mode === 'day' ? (p.mode === 'day' ? '<button class="lnk" data-goday>เปิดรายงานประจำวัน ›</button>' : '') : esc(wdN + ' วันทำการที่มีผู้ป่วย')) +
    tile2('หัตถการที่บันทึก', fmt(procT), 'ครั้ง', deltaLine(procT, tot, '_proc')) +
    tile2(rep.all ? 'ใบรายงานที่บันทึก' : 'วันที่บันทึกรายงาน', fmt(filled), '/ ' + fmt(need) + (rep.all ? ' ใบ' : ' วัน'), esc('ส่งรายงานแล้ว ' + fmt(reported))) +
    '</section>';
}
/** ปฏิทินสถานะการบันทึก (รายเดือน) */
function calendarHtml(p, rep, unit) {
  var ym = p.from.slice(0, 7), n = daysIn(ym), first = dow(ym + '-01'), cells = '', t = today();
  for (var i = 0; i < first; i++) cells += '<span class="cal-c pad"></span>';
  for (var d = 1; d <= n; d++) {
    var iso = ym + '-' + ('0' + d).slice(-2), dm = rep.daily[iso], fut = iso > t, typ = dayTypeOf(iso), tot = 0, need = 0, fill = 0, repd = 0;
    if (dm) rep.units.forEach(function (u) { var m = dm[u]; tot += m.total; if (m.total > 0) need++; if (m.filled) fill++; if (m.entry && m.entry.reportedAt) repd++; });
    var stt = !dm || fut ? '' : need && repd >= need ? 'rep' : fill && fill >= need ? 'fill' : (tot > 0 && typ === 'W') ? 'todo' : fill ? 'fill' : '';
    var lbl = stt === 'rep' ? 'ส่งรายงานแล้ว' : stt === 'fill' ? 'บันทึกแล้ว' : stt === 'todo' ? 'ยังไม่บันทึก' + (rep.all && fill ? 'ครบทุกหน่วย' : '') : '';
    cells += '<button class="cal-c ' + (fut ? 'fut ' : '') + (typ !== 'W' ? 'off ' : '') + (iso === t ? 'now ' : '') + stt + '" data-day="' + iso + '" ' + (fut ? 'disabled' : '') + ' aria-label="' + thDate(iso) + (dm ? ' ผู้ป่วย ' + tot + ' ราย ' + lbl : '') + '">' +
      '<span class="cal-d">' + d + '</span><span class="cal-n">' + (tot ? fmt(tot) : fut ? '' : '–') + '</span><i class="cal-s" title="' + lbl + '"></i></button>';
  }
  return '<section class="card cal-card"><div class="cal-sum"><div><span class="muted">ผู้ป่วยทั้งเดือน</span><b>' + fmt(rowVal(rep, 'pt:total')) + '</b></div><div><span class="muted">วันที่มีผู้ป่วย</span><b>' + rowVal(rep, 'meta:days') + '</b></div><div><span class="muted">' + (rep.all ? 'ใบที่บันทึกแล้ว' : 'บันทึกแล้ว') + '</span><b>' + rowVal(rep, 'meta:filled') + '</b></div><div><span class="muted">ส่งรายงานแล้ว</span><b>' + rowVal(rep, 'meta:reported') + '</b></div></div>' +
    '<div class="cal"><div class="cal-w">' + TH_DS.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="cal-g">' + cells + '</div></div>' +
    '<div class="cal-lg"><span><i class="cal-s rep"></i>ส่งรายงานแล้ว</span><span><i class="cal-s fill"></i>บันทึกแล้ว</span><span><i class="cal-s todo"></i>ยังไม่บันทึก' + (rep.all ? 'ครบทุกหน่วย' : '') + '</span></div></section>';
}

/* ================= Excel · พิมพ์ ================= */
var xlsxP = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxP) xlsxP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = function () { xlsxP = null; rej(new Error('โหลดตัวสร้าง Excel ไม่ได้ (ตรวจอินเทอร์เน็ต)')); }; document.head.appendChild(s); });
  return xlsxP;
}
function fileTag(p, unit) { return (unit === ALL ? 'รวมทุกหน่วย' : (unitById(unit) || {}).short || unit) + '-' + p.key.replace(/_/g, '-ถึง-'); }
function exportReportXlsx(rep, p, unit, cmps, btn) {
  busy(btn, true);
  loadXlsx().then(function () {
    var multi = rep.buckets.length > 1;
    var aoa = [['ยอดผู้มารับบริการในคลินิก ' + unitLabel(unit) + ' · ' + p.label], [rangeTh(p.from, p.to) + (p.partial ? ' (ข้อมูลถึง ' + thDate(p.effTo) + ')' : '')], [],
      ['ลำดับ', 'รายการ/กิจกรรม'].concat(multi ? rep.buckets.map(function (w) { return w.label + (w.sub ? ' (' + w.sub + ')' : ''); }) : []).concat(['รวม']).concat([].concat.apply([], cmps.map(function (c) { return [c.label, 'เปลี่ยนแปลง (%)']; })))];
    var no = 0, sec = '';
    rep.rows.forEach(function (r) {
      if (r.sec !== sec) { sec = r.sec; aoa.push(['', SEC_TH[sec]]); }
      var line = [++no, r.label].concat(multi ? r.vals.map(function (v) { return v == null ? '' : v; }) : []).concat([r.total == null ? '' : r.total]);
      cmps.forEach(function (c) { var pv = c.totals ? c.totals[r.sec + ':' + r.key] : null; line.push(pv == null ? '' : pv); line.push(pv && r.total != null ? Math.round((r.total - pv) / pv * 1000) / 10 : ''); });
      aoa.push(line);
    });
    var U = rep.units, daily = [['วันที่', 'ประเภทวัน'].concat(rep.all ? U.map(function (u) { return unitLabel(u); }) : []).concat(['ผู้ป่วยทั้งหมด', 'เช้า', 'บ่าย', 'จาก HIS', 'คีย์เพิ่ม', 'หัตถการรวม', 'บันทึกแล้ว', 'ส่งรายงานแล้ว'])];
    var docs = {};
    Object.keys(rep.daily).sort().forEach(function (iso) {
      var dm = rep.daily[iso], s = { t: 0, am: 0, pm: 0, api: 0, pr: 0, f: 0, r: 0 };
      U.forEach(function (u) {
        var m = dm[u]; s.t += m.total; s.am += m.am; s.pm += m.pm; s.api += m.apiTotal; m.procs.forEach(function (x) { s.pr += x.total; }); if (m.filled) s.f++; if (m.entry && m.entry.reportedAt) s.r++;
        doctorList(m).forEach(function (x) { var o = docs[x.dct] || (docs[x.dct] = { name: x.unknown ? 'ไม่ระบุแพทย์' : x.name, am: 0, pm: 0, total: 0, days: {} }); o.am += x.am; o.pm += x.pm; o.total += x.total; o.days[iso] = 1; });
      });
      daily.push([thDate(iso, { short: true }), dayTypeOf(iso) === 'W' ? 'ทำการ' : 'หยุด'].concat(rep.all ? U.map(function (u) { return dm[u].total; }) : []).concat([s.t, s.am, s.pm, s.api, s.t - s.api, s.pr, rep.all ? s.f + '/' + U.length : (s.f ? 'ใช่' : ''), rep.all ? s.r + '/' + U.length : (s.r ? 'ใช่' : '')]));
    });
    var dsheet = [['แพทย์', 'ผู้ป่วยรวม', 'เช้า', 'บ่าย', 'จำนวนวันที่ตรวจ']].concat(Object.keys(docs).map(function (k) { return docs[k]; }).sort(function (a, b) { return b.total - a.total; }).map(function (o) { return [o.name, o.total, o.am, o.pm, Object.keys(o.days).length]; }));
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 46 }].concat((multi ? rep.buckets : []).map(function () { return { wch: 12 }; })).concat([{ wch: 10 }]).concat([].concat.apply([], cmps.map(function () { return [{ wch: 16 }, { wch: 12 }]; })));
    XLSX.utils.book_append_sheet(wb, ws, 'สรุป');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(daily), 'รายวัน');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dsheet), 'รายแพทย์');
    XLSX.writeFile(wb, 'ยอดผู้มารับบริการ-' + fileTag(p, unit) + '.xlsx');
    busy(btn, false);
  }).catch(function (e) { busy(btn, false); toast(e.message, 'err'); });
}
/** พิมพ์ (เฉพาะแถวที่มียอด เว้นแต่ติ๊กแสดงศูนย์) · คอลัมน์เกิน 9 → พิมพ์แนวนอน */
function printReport(rep, p, unit, showZero, cmps) {
  var root = $('#print-root') || (function () { var d = document.createElement('div'); d.id = 'print-root'; document.body.appendChild(d); return d; })();
  var cols = (rep.buckets.length > 1 ? rep.buckets.length : 0) + 1 + cmps.length, land = cols > 8;
  root.innerHTML = (land ? '<style>@page { size: A4 landscape; margin: 0; }</style>' : '') +
    '<div class="a4 a4m' + (land ? ' land' : '') + '"><div class="a4-h"><img src="logo-hospital.png" width="40" height="40" alt=""><div class="a4-t"><b>ยอดผู้มารับบริการในคลินิก · ' + esc(unitLabel(unit)) + '</b><span>' + esc(p.label) + (p.sub && p.mode !== 'week' && p.mode !== 'custom' ? ' (' + esc(p.sub) + ')' : '') + (p.partial ? ' · ข้อมูลถึง ' + esc(thDate(p.effTo)) : '') + '</span></div></div>' +
    reportTable(rep, showZero, cmps) +
    (cmps.length ? '<p class="a4-note">' + cmps.map(function (c) { return esc(c.head) + ' = ' + esc(c.label); }).join(' · ') + '</p>' : '') +
    '<div class="a4-f"><span>พิมพ์โดย ' + esc(S.boot.me.name || '') + '</span><span>OB-GYN Daily · ' + esc(thTime(nowStamp())) + '</span></div></div>';
  document.body.classList.add('printing');
  setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('printing'); root.innerHTML = ''; }, 500); }, 250);
}

/* ================= ภาพรวม ================= */
PAGES.overview = function (r, el) {
  var pr = periodRoute(r, 'overview', ALL), p = pr.p, unit = pr.unit, hash = location.hash;
  document.title = 'ภาพรวม ' + p.short + ' · OB-GYN Daily';
  el.innerHTML = '<div class="page overview">' + periodBar('overview', p, unit, '') + '<div id="ovBody">' + loadingHtml() + '</div></div>';
  bindPeriodBar(el, 'overview', p, unit);
  if (p.future) { $('#ovBody').innerHTML = '<div class="empty-box">' + ic('info') + 'ช่วงนี้ยังมาไม่ถึง</div>'; return; }
  var cmps = compareRanges(p), rng = monthsNeeded(p, cmps);
  var trendP = S.trend && Date.now() - S.trend._at < 600000 ? Promise.resolve(S.trend) : api('getTrend', { months: 13 }).then(function (t) { t._at = Date.now(); S.trend = t; return t; });
  Promise.all([loadMonths(rng[0], rng[1]), trendP]).then(function (res) {
    if (S.page !== 'overview' || location.hash !== hash) return;
    paintOverview($('#ovBody'), p, unit, cmps, res[1]);
  }).catch(function (e) { var b = $('#ovBody'); if (b) b.innerHTML = errorBox(e.message, 'location.reload()'); });
};
function paintOverview(el, p, unit, cmps, trend) {
  if (!el) return;
  var n = dayDiff(p.from, p.to) + 1, gran = n <= 62 ? 'day' : 'month';
  var bk = [], d, ym;
  if (gran === 'day') for (d = p.from; d <= p.to; d = addDays(d, 1)) bk.push({ from: d, to: d, days: [d] });
  else for (ym = p.from.slice(0, 7); ym <= p.to.slice(0, 7); ym = ymAdd(ym, 1)) { var a = maxIso(p.from, ym + '-01'), b = minIso(p.to, lastDay(ym)), dd = []; for (d = a; d <= b; d = addDays(d, 1)) dd.push(d); bk.push({ from: a, to: b, days: dd, label: thMonth(ym, true) }); }
  var rep = periodReport(unit, bk), U = rep.units, units = U.map(function (u) { return unitById(u); });
  var tot = cmps.map(function (c) { return Object.assign({}, c, { totals: periodTotals(unit, c.from, c.to) }); });
  var docs = {}, clin = {}, procs = {}, maxDay = null, wd = 0, wdN = 0, filled = 0, need = 0;
  Object.keys(rep.daily).sort().forEach(function (iso) {
    var dm = rep.daily[iso], s = 0;
    U.forEach(function (u) {
      var m = dm[u]; s += m.total; if (m.filled) filled++; if (m.total > 0 && dayTypeOf(iso) === 'W') need++;
      m.clinics.forEach(function (c) { var o = clin[c.code] || (clin[c.code] = { name: c.short, unit: u, n: 0 }); o.n += c.total; });
      doctorList(m).forEach(function (x) { if (x.unknown) return; var o = docs[x.dct] || (docs[x.dct] = { name: x.name, n: 0, days: {}, clinics: {} }); o.n += x.total; o.days[iso] = 1; x.clinics.forEach(function (c) { o.clinics[c] = 1; }); });
      m.procs.forEach(function (x) { if (x.total) procs[x.name] = (procs[x.name] || 0) + x.total; });
    });
    if (dayTypeOf(iso) === 'W' && s > 0) { wd += s; wdN++; }
    if (!maxDay || s > maxDay.total) maxDay = { date: iso, total: s };
  });
  var all = rowVal(rep, 'pt:total'), procT = 0; Object.keys(procs).forEach(function (k) { procT += procs[k]; });
  tot.forEach(function (c) { if (c.totals) { var s = 0; Object.keys(c.totals).forEach(function (k) { if (/^pr:/.test(k)) s += c.totals[k]; }); c.totals._proc = s; var dset = {}; Object.keys(c.totals._daily || {}).forEach(function (iso) { U.forEach(function (u) { doctorList(c.totals._daily[iso][u]).forEach(function (x) { if (!x.unknown) dset[x.dct] = 1; }); }); }); c.totals._docs = Object.keys(dset).length; } });
  var series = bk.map(function (b) { var row = { label: b.label || '', from: b.from, to: b.to, vals: {}, total: 0 }; U.forEach(function (u) { row.vals[u] = 0; }); b.days.forEach(function (iso) { var dm = rep.daily[iso]; if (!dm) return; U.forEach(function (u) { row.vals[u] += dm[u].total; row.total += dm[u].total; }); }); return row; });
  var cmpRow = function (lbl, cur, key, fmtv) {
    return '<tr><td>' + esc(lbl) + '</td><td class="n tot">' + (fmtv || fmt)(cur) + '</td>' + tot.map(function (c) { var t = c.totals && c.totals._hasData ? c.totals : null, pv = t ? t[key] : null, d = delta(cur, pv); return '<td class="n">' + (t ? (fmtv || fmt)(pv || 0) + (d.txt ? '<small class="dl ' + d.cls + '">' + d.txt + '</small>' : '') : '<span class="muted">ไม่มีข้อมูล</span>') + '</td>'; }).join('') + '</tr>';
  };
  el.innerHTML =
    '<section class="tiles">' +
    tile2('ผู้ป่วยทั้งหมด', fmt(all), 'ราย', deltaLine(all, tot, 'pt:total')) +
    tile2('เฉลี่ยต่อวันทำการ', wdN ? fmt(Math.round(wd / wdN)) : '–', 'ราย/วัน', esc(wdN + ' วันทำการที่มีผู้ป่วย')) +
    tile2('วันที่ผู้ป่วยมากที่สุด', maxDay && maxDay.total ? fmt(maxDay.total) : '–', 'ราย', maxDay && maxDay.total ? esc(thDate(maxDay.date, { wd: true, short: true })) : '') +
    tile2(U.length > 1 ? 'ใบรายงานที่บันทึก' : 'วันที่บันทึกรายงาน', fmt(filled), '/ ' + fmt(need) + (U.length > 1 ? ' ใบ' : ' วัน'), esc(units.length > 1 ? units.map(function (u) { return u.short + ' ' + fmt(rowVal(rep, 'pt:u:' + u.id)); }).join(' · ') : '')) +
    '</section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('chart') + 'ผู้ป่วย' + (gran === 'day' ? 'รายวัน' : 'รายเดือน') + '</h2><div class="legend">' + units.map(function (u, i) { return '<span><i style="background:' + seriesColor(U.length > 1 ? i : Math.max(0, S.boot.units.indexOf(u))) + '"></i>' + esc(u.short) + '</span>'; }).join('') + '</div></div><div class="chart" id="chDaily"></div></section>' +
    (tot.length ? '<section class="card"><div class="card-h"><h2>' + ic('chart') + 'เทียบช่วงเวลา</h2><span class="hint">' + esc(p.partial ? 'ช่วงที่ยังไม่จบ เทียบเท่าจำนวนวันที่ผ่านมา' : p.label) + '</span></div><div class="tbl-wrap"><table class="tbl cmp-t"><thead><tr><th>รายการ</th><th class="n tot">' + esc(p.short) + '</th>' + tot.map(function (c) { return '<th class="n" title="' + esc(c.label) + '">' + esc(c.name) + '<small>' + esc(rangeTh(c.from, c.to)) + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
      cmpRow('ผู้ป่วยทั้งหมด', all, 'pt:total') + (U.length > 1 ? units.map(function (u) { return cmpRow('· ' + u.name, rowVal(rep, 'pt:u:' + u.id), 'pt:u:' + u.id); }).join('') : '') +
      cmpRow('เวรเช้า', rowVal(rep, 'pt:am'), 'pt:am') + cmpRow('เวรบ่าย', rowVal(rep, 'pt:pm'), 'pt:pm') + cmpRow('หัตถการที่บันทึก', procT, '_proc') + cmpRow('แพทย์ที่ออกตรวจ (คน)', Object.keys(docs).length, '_docs') +
      '</tbody></table></div></section>' : '') +
    '<div class="ov-grid">' +
    '<section class="card"><div class="card-h"><h2>' + ic('chart') + 'แนวโน้ม 13 เดือน</h2><span class="hint">ผู้ป่วยทุกคลินิกในระบบ</span></div><div class="chart" id="chTrend"></div></section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('stetho') + 'รายคลินิก</h2></div>' + hbars(Object.keys(clin).map(function (k) { return { label: clin[k].name, n: clin[k].n, c: seriesColor(Math.max(0, S.boot.units.map(function (u) { return u.id; }).indexOf(clin[k].unit))) }; })) + '</section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('users') + 'แพทย์ (ผู้ป่วยมากสุด 12 อันดับ)</h2></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แพทย์</th><th>คลินิก</th><th class="n">วัน</th><th class="n">รวม</th></tr></thead><tbody>' +
    Object.keys(docs).map(function (k) { return docs[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 12).map(function (o) { return '<tr><td>' + esc(o.name) + '</td><td class="muted">' + esc(Object.keys(o.clinics).join(', ')) + '</td><td class="n">' + Object.keys(o.days).length + '</td><td class="n tot">' + fmt(o.n) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' +
    '<section class="card"><div class="card-h"><h2>' + ic('hand') + 'หัตถการที่บันทึก</h2><span class="hint">รวม ' + fmt(procT) + ' ครั้ง</span></div>' + (Object.keys(procs).length ? hbars(Object.keys(procs).map(function (k) { return { label: k, n: procs[k], c: seriesColor(0) }; })) : '<p class="muted small pad">ยังไม่มีการบันทึกหัตถการในช่วงนี้</p>') + '</section>' +
    '</div>';
  stackBars($('#chDaily'), series, units, gran);
  lineChart($('#chTrend'), trend.months);
}
function tile(lbl, num, unit, sub) { return tile2(lbl, num, unit, esc(sub || '')); }
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
/** แท่งซ้อน (รายวัน/รายเดือน) แยกสีตามหน่วยงาน */
function stackBars(host, rows, units, gran) {
  var W = Math.max(320, host.clientWidth || 700), H = 230, padL = 40, padB = 26, padT = 10, n = gran === 'day' ? Math.max(rows.length, 7) : Math.max(rows.length, 3);
  var col = function (k) { return seriesColor(units.length > 1 ? k : Math.max(0, S.boot.units.indexOf(units[0]))); };
  var max = niceMax(Math.max.apply(null, rows.map(function (d) { return d.total; }).concat([1]))), bw = (W - padL - 6) / n, gap = Math.min(gran === 'day' ? 4 : 14, bw * .25);
  var y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
  var g = '';
  for (var t = 0; t <= 4; t++) { var v = max / 4 * t, yy = y(v); g += '<line x1="' + padL + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (padL - 6) + '" y="' + (yy + 4) + '" class="ax" text-anchor="end">' + fmt(v) + '</text>'; }
  var every = gran === 'day' ? (rows.length > 40 ? 7 : 5) : rows.length > 18 ? 3 : rows.length > 12 ? 2 : 1;
  var bars = rows.map(function (d, i) {
    var x = padL + i * bw + gap / 2, w = Math.max(2, bw - gap), acc = 0, s = '';
    units.forEach(function (u, k) {
      var v = d.vals[u.id] || 0; if (!v) return;
      var y1 = y(acc + v), y0 = y(acc); acc += v;
      s += '<rect x="' + x + '" y="' + y1 + '" width="' + w + '" height="' + Math.max(0, y0 - y1 - (acc < d.total ? 1.5 : 0)) + '" rx="' + Math.min(3, w / 3) + '" fill="' + col(k) + '"/>';
    });
    var lab = '';
    if (gran === 'day') { var dn = +d.from.slice(8); if (dn === 1 || dn % every === 0 || rows.length <= 14) lab = rows.length <= 14 ? TH_DS[dow(d.from)] + ' ' + dn : String(dn); }
    else if (i % every === 0) lab = d.label;
    return '<g class="bar" data-i="' + i + '">' + s + '<rect class="hit" x="' + (padL + i * bw) + '" y="' + padT + '" width="' + bw + '" height="' + (H - padT - padB) + '" fill="transparent"/>' + (lab ? '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" class="ax" text-anchor="middle">' + esc(lab) + '</text>' : '') + '</g>';
  }).join('');
  host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="กราฟผู้ป่วย' + (gran === 'day' ? 'รายวัน' : 'รายเดือน') + '">' + g + bars + '</svg>';
  var tip = chartTip(host);
  $$('.bar', host).forEach(function (b) {
    var show = function () { var d = rows[+b.dataset.i], r = b.getBoundingClientRect(), hr = host.getBoundingClientRect(); tip.show('<b>' + (gran === 'day' ? thDate(d.from, { wd: true, short: true }) : esc(d.label) + (d.from.slice(8) !== '01' || d.to !== lastDay(d.to.slice(0, 7)) ? ' (' + esc(rangeTh(d.from, d.to)) + ')' : '')) + '</b><br>' + units.map(function (u, k) { return '<i style="background:' + col(k) + '"></i>' + esc(u.short) + ' ' + fmt(d.vals[u.id] || 0); }).join('<br>') + (units.length > 1 ? '<br>รวม <b>' + fmt(d.total) + '</b>' : ''), r.left - hr.left + r.width / 2, r.top - hr.top + 30); b.classList.add('hov'); };
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
