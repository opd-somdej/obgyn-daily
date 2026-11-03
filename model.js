/* model.js — คำนวณยอดทั้งหมดในเบราว์เซอร์ (ชุดเดียวใช้ทุกหน้า: รายวัน · ภาพ/ใบรายงาน · ข้อความไลน์ · รายเดือน · ภาพรวม)
 * ยอดจาก HIS = สิ่งที่ API ส่งมา (คลินิก × แพทย์) · บ่าย = ที่พยาบาลคีย์ · เช้า = รวม − บ่าย */
'use strict';
var UNKNOWN = '0';
function guessUnitFront(code) { return /^(AN|OB|PN|CLPN|LC)/.test(String(code)) ? 'obs' : 'gyn'; }
function clinicInfo(code) {
  var c = (S.boot.clinics || []).filter(function (x) { return x.code === code; })[0];
  if (c) return c;
  var u = S.boot.units.some(function (x) { return x.id === guessUnitFront(code); }) ? guessUnitFront(code) : (S.boot.units[0] || {}).id;
  return { code: code, name: code, short: code, unit: u, special: '', show: true, order: 999, isNew: true };
}
function docName(dct, short) { if (dct === UNKNOWN) return 'ไม่ระบุแพทย์'; var d = S.boot.docs[dct]; return d ? (short ? d[1] : d[0]) : 'แพทย์ ' + dct; }
function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
function itemsFor(kind, unitId, data, dataKey) {
  var used = (data && data[dataKey]) || {};
  return (S.boot.items || []).filter(function (it) {
    if (it.kind !== kind) return false;
    if (it.unit && it.unit !== unitId) return false;
    return it.active || (used[it.id] != null);
  });
}
function pairOf(m, id) { var p = (m || {})[id]; return p ? [+p[0] || 0, +p[1] || 0] : [0, 0]; }
function staffFor(unitId) { return (S.boot.staff || []).filter(function (s) { return s.active && (!s.unit || s.unit === unitId); }); }

/** คำนวณรายงานของ 1 วัน × 1 หน่วยงาน */
function computeDay(day, unitId) {
  var ent = (day && day.entries && day.entries[unitId]) || {}, data = ent.data || {};
  var pm = data.pm || {}, asg = data.asg || {};
  var byClinic = {}, hidden = 0, hiddenList = {};
  (day && day.visits || []).forEach(function (v) {
    var ci = clinicInfo(v[0]);
    if (ci.unit !== unitId) return;
    if (!ci.show) { hidden += v[2]; hiddenList[ci.short || ci.code] = (hiddenList[ci.short || ci.code] || 0) + v[2]; return; }
    var c = byClinic[v[0]] || (byClinic[v[0]] = { code: v[0], info: ci, rows: {} });
    var r = c.rows[v[1]] || (c.rows[v[1]] = { clinic: v[0], dct: v[1], api: 0, moved: 0 });
    r.api += v[2];
  });
  // ย้ายผู้ป่วย "ไม่ระบุแพทย์" ให้แพทย์ที่ตรวจจริง
  Object.keys(asg).forEach(function (code) {
    var c = byClinic[code]; if (!c || !c.rows[UNKNOWN]) return;
    var left = c.rows[UNKNOWN].api;
    Object.keys(asg[code]).forEach(function (dct) {
      var n = Math.min(+asg[code][dct] || 0, left); if (n <= 0) return;
      left -= n; c.rows[UNKNOWN].moved += n;
      var r = c.rows[dct] || (c.rows[dct] = { clinic: code, dct: dct, api: 0, moved: 0 });
      r.moved -= n;   // ติดลบ = ได้รับเพิ่ม
    });
  });
  var clinics = Object.keys(byClinic).map(function (k) { return byClinic[k]; })
    .sort(function (a, b) { return (a.info.order || 999) - (b.info.order || 999) || a.code.localeCompare(b.code); })
    .map(function (c) {
      var rows = Object.keys(c.rows).map(function (k) {
        var r = c.rows[k], total = r.api - r.moved, key = r.clinic + '|' + r.dct, p = Math.min(+pm[key] || 0, Math.max(0, total));
        return { key: key, clinic: r.clinic, dct: r.dct, unknown: r.dct === UNKNOWN, name: docName(r.dct), short: docName(r.dct, true), api: r.api, got: Math.max(0, -r.moved), gave: Math.max(0, r.moved), total: total, pm: p, am: total - p };
      }).filter(function (r) { return r.total > 0 || r.api > 0; })
        .sort(function (a, b) { return (a.unknown - b.unknown) || b.total - a.total || a.name.localeCompare(b.name, 'th'); });
      var t = 0, a = 0, p2 = 0; rows.forEach(function (r) { t += r.total; a += r.am; p2 += r.pm; });
      return { code: c.code, name: c.info.name, short: c.info.short || c.code, special: c.info.special || '', isNew: !!c.info.isNew, rows: rows, total: t, am: a, pm: p2 };
    });
  var apiTotal = 0, am = 0, pmT = 0, docs = {}, unknownLeft = 0;
  clinics.forEach(function (c) { apiTotal += c.total; am += c.am; pmT += c.pm; c.rows.forEach(function (r) { if (r.unknown) unknownLeft += r.total; else if (r.total > 0) docs[r.dct] = 1; }); });
  var extras = itemsFor('extra', unitId, data, 'ex').map(function (it) { var p = pairOf(data.ex, it.id); return { id: it.id, name: it.name, special: it.special, countIn: it.countIn, active: it.active, am: p[0], pm: p[1], total: p[0] + p[1] }; });
  var exIn = 0, exAm = 0, exPm = 0;
  extras.forEach(function (x) { if (x.countIn) { exIn += x.total; exAm += x.am; exPm += x.pm; } });
  // คลินิกพิเศษ (ตามชื่อที่แอดมินตั้งให้คลินิก/ยอดคีย์เพิ่ม)
  var spec = {}, specOrder = [];
  clinics.forEach(function (c) {
    if (!c.special) return;
    var s = spec[c.special] || (spec[c.special] = { label: c.special, total: 0, docs: [] }); if (specOrder.indexOf(c.special) < 0) specOrder.push(c.special);
    s.total += c.total; c.rows.forEach(function (r) { if (r.total > 0 && !r.unknown) s.docs.push(r.short); });
  });
  extras.forEach(function (x) {
    if (!x.special || !x.total) return;
    var s = spec[x.special] || (spec[x.special] = { label: x.special, total: 0, docs: [] }); if (specOrder.indexOf(x.special) < 0) specOrder.push(x.special);
    s.total += x.total;
  });
  var procs = itemsFor('proc', unitId, data, 'pr').map(function (it) {
    var p = pairOf(data.pr, it.id), linked = false;
    if (it.link) {   // นับจากรายชื่อผู้ป่วยส่งต่อ
      var cs = (day && day.cases || []).filter(function (x) { return x.unit === unitId && x.type === it.link; });
      if (cs.length) { linked = true; p = [cs.filter(function (x) { return x.period !== 'pm'; }).length, cs.filter(function (x) { return x.period === 'pm'; }).length]; }
    }
    return { id: it.id, name: it.name, active: it.active, link: it.link, linked: linked, am: p[0], pm: p[1], total: p[0] + p[1] };
  });
  var kpis = itemsFor('kpi', unitId, data, 'kp').map(function (it) { var v = (data.kp || {})[it.id]; return { id: it.id, name: it.name, type: it.type, active: it.active, value: v == null ? '' : String(v) }; });
  var roster = staffFor(unitId), sel = data.st || [], selIdx = {};
  sel.forEach(function (x) { selIdx[x.id] = x; });
  var staffOn = sel.map(function (x) { var s = (S.boot.staff || []).filter(function (y) { return y.id === x.id; })[0]; return s ? { id: s.id, name: s.name, pos: s.pos, sh: x.sh, note: x.note || '' } : null; }).filter(Boolean);
  var counts = {}; (S.boot.positions || ['GN', 'PN', 'NA']).forEach(function (p) { counts[p] = 0; });
  staffOn.forEach(function (x) { counts[x.pos] = (counts[x.pos] || 0) + ((S.boot.shifts || {})[x.sh] || 1); });
  var sn = data.sn || {}, staffN = {};
  Object.keys(counts).forEach(function (p) { staffN[p] = sn[p] != null && sn[p] !== '' ? +sn[p] : counts[p]; });
  var cases = (day && day.cases || []).filter(function (x) { return x.unit === unitId; });
  var filled = !!(Object.keys(data.pr || {}).length || Object.keys(data.pm || {}).length || (data.st || []).length || Object.keys(data.kp || {}).length);
  return {
    unit: unitById(unitId), unitId: unitId, date: day && day.date, clinics: clinics, extras: extras, specials: specOrder.map(function (k) { return spec[k]; }),
    apiTotal: apiTotal, total: apiTotal + exIn, am: am + exAm, pm: pmT + exPm, docCount: Object.keys(docs).length, unknownLeft: unknownLeft,
    hidden: hidden, hiddenList: hiddenList, procs: procs, kpis: kpis, roster: roster, selected: selIdx, staffOn: staffOn, staffCount: counts, staffN: staffN, sn: sn,
    cases: cases, prob: data.prob || '', note: data.note || '', entry: ent, filled: filled, hasPm: Object.keys(pm).length > 0
  };
}

/** แพทย์รวมทุกคลินิกของหน่วย (สำหรับภาพ/ใบรายงาน) → [{name, short, am, pm, total, clinics:[]}] เรียงมาก→น้อย · ไม่ระบุแพทย์ไว้ท้าย */
function doctorList(m) {
  var by = {};
  m.clinics.forEach(function (c) {
    c.rows.forEach(function (r) {
      if (r.total <= 0) return;
      var k = r.dct, o = by[k] || (by[k] = { dct: r.dct, name: r.name, short: r.short, unknown: r.unknown, am: 0, pm: 0, total: 0, clinics: [] });
      o.am += r.am; o.pm += r.pm; o.total += r.total; if (o.clinics.indexOf(c.short) < 0) o.clinics.push(c.short);
    });
  });
  return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (a.unknown - b.unknown) || b.total - a.total; });
}
/** ชื่อเจ้าหน้าที่ในรายงาน: ชื่อต้น + เวร (ช/บ) */
function staffText(m, pos) {
  return m.staffOn.filter(function (x) { return x.pos === pos; }).map(function (x) { return x.name.split(' ')[0] + ' ' + x.sh + (x.note ? ' (' + x.note + ')' : ''); }).join(', ');
}
function kpiText(k) { return k.value === '' ? '' : (fmt(k.value) + (k.type === 'pct' ? '%' : '')); }

/** ข้อความสำหรับวางในไลน์ */
function reportText(m, opt) {
  opt = opt || {};
  var L = [], u = m.unit || {}, d = m.date;
  L.push('รายงานประจำวัน ' + (u.name || ''));
  L.push('วัน' + TH_D[dow(d)] + 'ที่ ' + thDate(d));
  L.push('');
  L.push('ผู้ป่วยทั้งหมด ' + fmt(m.total) + ' ราย (เช้า ' + fmt(m.am) + ' · บ่าย ' + fmt(m.pm) + ')');
  var dl = doctorList(m), am = dl.filter(function (x) { return x.am > 0; }), pm = dl.filter(function (x) { return x.pm > 0; });
  if (am.length) L.push('แพทย์เช้า: ' + am.map(function (x) { return x.short + ' ' + x.am; }).join(' · '));
  if (pm.length) L.push('แพทย์บ่าย: ' + pm.map(function (x) { return x.short + ' ' + x.pm; }).join(' · '));
  var ex = m.extras.filter(function (x) { return x.total; });
  if (ex.length) L.push('คีย์เพิ่ม: ' + ex.map(function (x) { return x.name + ' ' + x.total; }).join(' · '));
  var sp = m.specials.filter(function (s) { return s.total; });
  if (sp.length) { L.push(''); L.push('คลินิกพิเศษ'); sp.forEach(function (s) { L.push('• ' + s.label + ' ' + s.total + (s.docs.length ? ' (' + s.docs.join(', ') + ')' : '')); }); }
  var pr = m.procs.filter(function (p) { return p.total; });
  if (pr.length) { L.push(''); L.push('หัตถการ'); pr.forEach(function (p) { L.push('• ' + p.name + ' ' + p.total + (p.am && p.pm ? ' (เช้า ' + p.am + ' บ่าย ' + p.pm + ')' : p.pm ? ' (บ่าย)' : '')); }); }
  var kp = m.kpis.filter(function (k) { return k.value !== ''; });
  if (kp.length) { L.push(''); L.push('ตัวชี้วัด'); kp.forEach(function (k) { L.push('• ' + k.name.replace(/\s*\(%\)$/, '') + ' ' + kpiText(k)); }); }
  var cs = m.cases;
  if (cs.length) {
    L.push(''); L.push('ผู้ป่วยส่งต่อ ' + cs.length + ' ราย');
    cs.forEach(function (c) { L.push('• ' + c.type + (opt.names ? ' · ' + (c.name || '') + (c.hn ? ' HN ' + c.hn : '') : '') + (c.dx ? ' · ' + c.dx : '') + (c.dest ? ' → ' + c.dest : '')); });
  }
  var pos = S.boot.positions || ['GN', 'PN', 'NA'], st = pos.map(function (p) { return p + ' ' + fmt(m.staffN[p] || 0); }).join(' · ');
  L.push(''); L.push('เจ้าหน้าที่ ' + st);
  if (opt.staffNames) pos.forEach(function (p) { var t = staffText(m, p); if (t) L.push(p + ': ' + t); });
  if (m.prob) { L.push(''); L.push('ปัญหาที่พบ: ' + m.prob); }
  if (m.note) L.push('หมายเหตุ: ' + m.note);
  L.push(''); L.push('ผู้รายงาน ' + (opt.reporter || S.boot.me.name || ''));
  return L.join('\n');
}

/* ---------- รายเดือน ---------- */
/** แบ่งสัปดาห์: block = วันที่ 1–7, 8–14, 15–21, 22–28, 29–สิ้นเดือน (ตามแบบฟอร์มเดิม) · mon = จันทร์–อาทิตย์ */
function weeksOf(ym, mode) {
  var n = daysIn(ym), out = [];
  if (mode === 'mon') {
    var cur = null;
    for (var d = 1; d <= n; d++) {
      var iso = ym + '-' + ('0' + d).slice(-2);
      if (!cur || dow(iso) === 1) { cur = { from: iso, to: iso, days: [] }; out.push(cur); }
      cur.to = iso; cur.days.push(iso);
    }
  } else {
    for (var w = 0; w * 7 < n; w++) { var days = []; for (var k = w * 7 + 1; k <= Math.min(n, w * 7 + 7); k++) days.push(ym + '-' + ('0' + k).slice(-2)); out.push({ from: days[0], to: days[days.length - 1], days: days }); }
  }
  out.forEach(function (w, i) { w.label = 'สัปดาห์ที่ ' + (i + 1); w.range = +w.from.slice(8) + (w.from !== w.to ? '–' + +w.to.slice(8) : ''); });
  return out;
}
/** วันจากข้อมูลรายเดือน → รูปแบบเดียวกับ getDay (ใช้ computeDay ชุดเดียว) */
function dayFromMonth(mo, iso) {
  var cs = (mo.cases[iso] || []).map(function (x) { return { unit: x[0], type: x[1], period: x[2] }; });
  return { date: iso, visits: mo.visits[iso] || [], entries: mo.entries[iso] || {}, cases: cs, api: mo.days[iso] || null };
}
/** สรุปรายเดือนของหน่วย → {weeks, rows:[{sec, label, vals[], total, kind}]} */
function monthReport(mo, unitId, mode) {
  var weeks = weeksOf(mo.ym, mode), W = weeks.length, rows = [], R = {};
  var row = function (sec, key, label, kind, extra) { var k = sec + ':' + key; if (!R[k]) { R[k] = { sec: sec, key: key, label: label, kind: kind || 'sum', vals: new Array(W).fill(0), cnt: new Array(W).fill(0), extra: extra || '' }; rows.push(R[k]); } return R[k]; };
  // ลำดับแถวคงที่ก่อน (ให้หน้าตาเหมือนแบบฟอร์มทุกเดือน)
  row('pt', 'total', 'จำนวนผู้ป่วยทั้งหมด', 'sum');
  row('pt', 'am', 'เวรเช้า', 'sum'); row('pt', 'pm', 'เวรบ่าย', 'sum');
  (S.boot.clinics || []).filter(function (c) { return c.unit === unitId && c.show; }).forEach(function (c) { row('cl', c.code, c.special ? c.special + ' (' + c.short + ')' : c.name.replace(/\s*อาคาร.*$/, ''), 'sum'); });
  itemsFor('extra', unitId, {}, 'ex').forEach(function (x) { row('ex', x.id, x.name + (x.countIn ? '' : ' (ไม่นับรวม)'), 'sum'); });
  itemsFor('proc', unitId, {}, 'pr').forEach(function (p) { row('pr', p.id, p.name, 'sum'); });
  itemsFor('kpi', unitId, {}, 'kp').forEach(function (k) { row('kp', k.id, k.name, k.type === 'pct' ? 'avg' : 'sum'); });
  (S.boot.items || []).filter(function (x) { return x.kind === 'case' && x.active; }).forEach(function (x) { row('cs', x.name, x.name, 'sum'); });
  (S.boot.positions || ['GN', 'PN', 'NA']).forEach(function (p) { row('st', p, 'จำนวน ' + p + ' (เฉลี่ย/วัน)', 'avg'); });
  row('meta', 'days', 'วันที่มีผู้ป่วย', 'sum'); row('meta', 'filled', 'วันที่บันทึกแล้ว', 'sum'); row('meta', 'reported', 'วันที่ส่งรายงานแล้ว', 'sum');
  var daily = {};
  weeks.forEach(function (w, wi) {
    w.days.forEach(function (iso) {
      if (iso > mo.today) return;
      var m = computeDay(dayFromMonth(mo, iso), unitId); daily[iso] = m;
      var add = function (r, v) { r.vals[wi] += v; };
      add(R['pt:total'], m.total); add(R['pt:am'], m.am); add(R['pt:pm'], m.pm);
      m.clinics.forEach(function (c) { add(row('cl', c.code, c.special ? c.special + ' (' + c.short + ')' : c.name.replace(/\s*อาคาร.*$/, ''), 'sum'), c.total); });
      m.extras.forEach(function (x) { add(row('ex', x.id, x.name, 'sum'), x.total); });
      m.procs.forEach(function (p) { add(row('pr', p.id, p.name, 'sum'), p.total); });
      m.kpis.forEach(function (k) { if (k.value === '') return; var r = row('kp', k.id, k.name, k.type === 'pct' ? 'avg' : 'sum'); r.vals[wi] += +k.value; r.cnt[wi]++; });
      m.cases.forEach(function (c) { add(row('cs', c.type, c.type, 'sum'), 1); });
      if (m.filled) Object.keys(m.staffN).forEach(function (p) { if (m.staffN[p] > 0) { var r = row('st', p, 'จำนวน ' + p + ' (เฉลี่ย/วัน)', 'avg'); r.vals[wi] += m.staffN[p]; r.cnt[wi]++; } });
      if (m.total > 0) add(R['meta:days'], 1);
      if (m.filled) add(R['meta:filled'], 1);
      if (m.entry && m.entry.reportedAt) add(R['meta:reported'], 1);
    });
  });
  rows.forEach(function (r) {
    if (r.kind === 'avg') {
      var s = 0, c = 0; r.vals = r.vals.map(function (v, i) { s += v; c += r.cnt[i]; return r.cnt[i] ? Math.round(v / r.cnt[i] * 10) / 10 : null; });
      r.total = c ? Math.round(s / c * 10) / 10 : null;
    } else r.total = r.vals.reduce(function (a, b) { return a + b; }, 0);
  });
  return { weeks: weeks, rows: rows, daily: daily };
}
var SEC_TH = { pt: 'ผู้ป่วย', cl: 'รายคลินิก', ex: 'ยอดคีย์เพิ่ม', pr: 'หัตถการ', kp: 'ตัวชี้วัด', cs: 'ผู้ป่วยส่งต่อ', st: 'อัตรากำลัง', meta: 'การบันทึก' };
