/* =========================================================
   CRT Academy — app.js  (Vanilla JS ไม่ต้องใช้ Library)
   ========================================================= */
'use strict';

/* ---------- 1) Utilities ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
const COL = {
  up: '#22c55e', down: '#ef4444', high: '#f59e0b', low: '#38bdf8',
  mid: '#a78bfa', sweep: '#f472b6', tp: '#22c55e', sl: '#ef4444',
  entry: '#fde047', fvg: '#38bdf8', grid: '#1e293b', muted: '#64748b', text: '#cbd5e1',
};
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toFixed(d);
const r2 = (n) => Math.round(n * 100) / 100;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
  if (parent) parent.appendChild(e);
  return e;
}

function svgText(parent, x, y, text, color, anchor = 'start', size = 11.5) {
  const t = svgEl('text', {
    x, y, fill: color, 'font-size': size, 'font-weight': 600, 'text-anchor': anchor,
    'paint-order': 'stroke', stroke: '#0f172a', 'stroke-width': 3, 'stroke-linejoin': 'round',
  }, parent);
  t.textContent = text;
  return t;
}

/* annotation helpers */
const hl = (y, color, label, from, to, dash = true) => ({ type: 'hline', y, color, label, from, to, dash });
const zone = (y, y2, color, label, from, to) => ({ type: 'zone', y, y2, color, label, from, to });
const mk = (i, y, text, color, pos = 'above') => ({ type: 'marker', i, y, text, color, pos });
const arrow = (i1, y1, i2, y2, color, label) => ({ type: 'arrow', i1, y1, i2, y2, color, label });

function rangeAnn(c1, from = 0, to) {
  return [
    hl(c1.h, COL.high, 'CRT High', from, to),
    hl((c1.h + c1.l) / 2, COL.mid, '50%', from, to),
    hl(c1.l, COL.low, 'CRT Low', from, to),
  ];
}

/* ---------- 2) Chart renderer (SVG) ---------- */
function drawChart(svg, candles, opts = {}) {
  const W = opts.width || 640;
  const H = opts.height || 340;
  const pad = { t: 22, r: 64, b: 34, l: 10 };
  const ann = opts.annotations || [];
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const vals = [];
  candles.forEach((c) => vals.push(c.h, c.l));
  ann.forEach((a) => ['y', 'y1', 'y2'].forEach((k) => { if (a[k] !== undefined) vals.push(a[k]); }));
  (opts.extraRange || []).forEach((v) => vals.push(v));
  let max = Math.max(...vals);
  let min = Math.min(...vals);
  const span = max - min || 1;
  max += span * 0.1;
  min -= span * 0.1;

  const n = Math.max(opts.slots || candles.length, 1);
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / n;
  const bodyW = Math.max(4, Math.min(slot * 0.6, 44));
  const X = (i) => pad.l + slot * i + slot / 2;
  const Y = (p) => pad.t + ((max - p) / (max - min)) * plotH;
  const xFrom = (i) => (i === undefined ? pad.l : X(i) - slot / 2);
  const xTo = (i) => (i === undefined ? W - pad.r : X(i) + slot / 2);

  // grid + price axis
  for (let g = 0; g <= 4; g++) {
    const p = min + ((max - min) * g) / 4;
    const y = Y(p);
    svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: COL.grid }, svg);
    const t = svgEl('text', { x: W - pad.r + 6, y: y + 4, fill: COL.muted, 'font-size': 10, 'font-family': 'JetBrains Mono, monospace' }, svg);
    t.textContent = fmt(p);
  }

  // zones
  ann.filter((a) => a.type === 'zone').forEach((a) => {
    const x1 = xFrom(a.from), x2 = xTo(a.to);
    const yT = Y(Math.max(a.y, a.y2)), yB = Y(Math.min(a.y, a.y2));
    svgEl('rect', { x: x1, y: yT, width: x2 - x1, height: yB - yT, fill: a.color, 'fill-opacity': 0.13, stroke: a.color, 'stroke-opacity': 0.35 }, svg);
    if (a.label) svgText(svg, x1 + 4, yT + 14, a.label, a.color);
  });

  // horizontal lines + price tags
  ann.filter((a) => a.type === 'hline').forEach((a) => {
    const x1 = xFrom(a.from), x2 = xTo(a.to), y = Y(a.y);
    svgEl('line', { x1, x2, y1: y, y2: y, stroke: a.color, 'stroke-width': 1.5, 'stroke-dasharray': a.dash ? '6 4' : 'none' }, svg);
    if (a.label) svgText(svg, x1 + 4, y - 5, a.label, a.color);
    svgEl('rect', { x: W - pad.r + 2, y: y - 8, width: pad.r - 4, height: 16, rx: 3, fill: a.color }, svg);
    const t = svgEl('text', { x: W - pad.r / 2 + 1, y: y + 4, fill: '#0b1220', 'font-size': 10.5, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace' }, svg);
    t.textContent = fmt(a.y);
  });

  // candles
  candles.forEach((c, i) => {
    const color = c.c >= c.o ? COL.up : COL.down;
    const g = svgEl('g', { opacity: c.ghost ? 0.35 : 1 }, svg);
    svgEl('line', { x1: X(i), x2: X(i), y1: Y(c.h), y2: Y(c.l), stroke: color, 'stroke-width': 1.6 }, g);
    const top = Y(Math.max(c.o, c.c)), bot = Y(Math.min(c.o, c.c));
    svgEl('rect', { x: X(i) - bodyW / 2, y: top, width: bodyW, height: Math.max(1.5, bot - top), fill: color, rx: 2 }, g);
    if (c.label) svgText(svg, X(i), H - 12, c.label, COL.text, 'middle', 12);
  });

  // markers
  ann.filter((a) => a.type === 'marker').forEach((a) => {
    const x = X(a.i), y = Y(a.y);
    svgEl('circle', { cx: x, cy: y, r: 4.5, fill: a.color, stroke: '#0f172a', 'stroke-width': 1.5 }, svg);
    svgText(svg, x, a.pos === 'below' ? y + 19 : y - 11, a.text, a.color, 'middle');
  });

  // arrows
  ann.filter((a) => a.type === 'arrow').forEach((a) => {
    const x1 = X(a.i1), y1 = Y(a.y1), x2 = X(a.i2), y2 = Y(a.y2);
    svgEl('line', { x1, y1, x2, y2, stroke: a.color, 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg);
    const ang = Math.atan2(y2 - y1, x2 - x1), s = 10;
    const pts = [[x2, y2], [x2 - s * Math.cos(ang - 0.45), y2 - s * Math.sin(ang - 0.45)], [x2 - s * Math.cos(ang + 0.45), y2 - s * Math.sin(ang + 0.45)]];
    svgEl('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: a.color }, svg);
    if (a.label) svgText(svg, (x1 + x2) / 2 + 8, (y1 + y2) / 2, a.label, a.color);
  });
}

/* ---------- 3) CRT Logic (กฎเดียวที่ใช้ทั้งเว็บ) ---------- */
function classifyCRT(c1, c2) {
  const sweptHigh = c2.h > c1.h;
  const sweptLow = c2.l < c1.l;

  if (sweptHigh && sweptLow) {
    return { type: 'outside', valid: false, title: 'Outside Bar — ไม่ใช่ CRT', detail: 'C2 กวาดทั้ง High และ Low ของ C1 ทิศทางจึงไม่ชัดเจน หลายคนเลือกใช้ C2 เป็นกรอบ (Range) ใหม่แทน' };
  }
  if (sweptLow) {
    return c2.c > c1.l
      ? { type: 'bullish', valid: true, title: 'Bullish CRT ✓', detail: 'C2 กวาด CRT Low แล้วปิดกลับเข้ากรอบ คาดว่าราคาจะวิ่งไปหา 50% และ CRT High' }
      : { type: 'breakdown', valid: false, title: 'Breakdown — ไม่ใช่ CRT', detail: 'C2 ปิดต่ำกว่าหรือเท่ากับ CRT Low (ปิดนอกกรอบ) แสดงว่าแรงขายยังคุมตลาด นี่คือการเบรกเอาต์ ไม่ใช่การกวาดแล้วกลับตัว' };
  }
  if (sweptHigh) {
    return c2.c < c1.h
      ? { type: 'bearish', valid: true, title: 'Bearish CRT ✓', detail: 'C2 กวาด CRT High แล้วปิดกลับเข้ากรอบ คาดว่าราคาจะวิ่งไปหา 50% และ CRT Low' }
      : { type: 'breakout', valid: false, title: 'Breakout — ไม่ใช่ CRT', detail: 'C2 ปิดสูงกว่าหรือเท่ากับ CRT High (ปิดนอกกรอบ) แสดงว่าแรงซื้อยังคุมตลาด นี่คือการเบรกเอาต์ขึ้น' };
  }
  return { type: 'inside', valid: false, title: 'Inside Bar — ยังไม่มี Setup', detail: 'C2 ไม่ได้กวาดฝั่งใดเลย ให้ใช้กรอบของ C1 เดิมแล้วรอแท่งถัดไป' };
}

function crtLevels(c1, c2, type) {
  const mid = (c1.h + c1.l) / 2;
  const bull = type === 'bullish';
  const entry = c2.c;
  const sl = bull ? c2.l : c2.h;
  const tp1 = mid;
  const tp2 = bull ? c1.h : c1.l;
  const risk = Math.abs(entry - sl) || 1e-9;
  const rr1 = (bull ? tp1 - entry : entry - tp1) / risk;
  const rr2 = (bull ? tp2 - entry : entry - tp2) / risk;
  return { entry, sl, tp1, tp2, rr1, rr2 };
}

function crtNotes(c1, c2, type) {
  const R = c1.h - c1.l, mid = (c1.h + c1.l) / 2, notes = [];
  if (type === 'bullish') {
    notes.push(c2.c > mid
      ? 'C2 ปิดเหนือ 50%: แรงกลับตัวชัด แต่เหลือระยะถึง CRT High น้อย (RR ลดลง)'
      : 'C2 ปิดใต้ 50%: ยังมีระยะถึงเป้าหมาย แต่ควรรอการยืนยันใน TF เล็ก');
    if ((c1.l - c2.l) / R > 0.5) notes.push('กวาดลึกกว่า 50% ของกรอบ: ระวังว่าอาจไม่ใช่แค่ Sweep แต่เป็นแรงขายจริง');
  }
  if (type === 'bearish') {
    notes.push(c2.c < mid
      ? 'C2 ปิดใต้ 50%: แรงกลับตัวชัด แต่เหลือระยะถึง CRT Low น้อย (RR ลดลง)'
      : 'C2 ปิดเหนือ 50%: ยังมีระยะถึงเป้าหมาย แต่ควรรอการยืนยันใน TF เล็ก');
    if ((c2.h - c1.h) / R > 0.5) notes.push('กวาดลึกกว่า 50% ของกรอบ: ระวังว่าอาจไม่ใช่แค่ Sweep แต่เป็นแรงซื้อจริง');
  }
  notes.push('ระดับ SL ในตารางยังไม่รวม Buffer / Spread ใช้งานจริงควรเผื่อเพิ่ม');
  return notes;
}

const lvl = (label, v) => `<div class="level"><small>${label}</small><span>${typeof v === 'number' ? fmt(v) : v}</span></div>`;

/* ---------- 4) Pattern Library ---------- */
const C1_BEAR = { o: 108, h: 110, l: 100, c: 102 };
const C1_BULL = { o: 102, h: 110, l: 100, c: 108 };
const withLabel = (c, label) => ({ ...c, label });

const PATTERNS = [
  {
    group: 'core', title: 'Bullish CRT', badge: 'Valid Setup', badgeClass: 'valid',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 102, h: 104, l: 97.5, c: 103.2, label: 'C2' }, { o: 103.2, h: 110.6, l: 102.6, c: 110.1, label: 'C3' }],
    ann: [...rangeAnn(C1_BEAR), mk(1, 97.5, 'Sweep', COL.sweep, 'below'), arrow(1.3, 103.2, 1.7, 110, COL.tp)],
    desc: 'C2 กวาด CRT Low แล้วปิดกลับเข้ากรอบ คาดว่าราคาจะวิ่งไปหา 50% และ CRT High',
    points: ['C2 Low &lt; C1 Low (กวาดสภาพคล่องฝั่งล่าง)', 'C2 Close &gt; C1 Low (ปิดกลับเข้ากรอบ)', 'C2 High ไม่เกิน C1 High', 'SL ใต้ไส้ C2 · TP1 = 50% · TP2 = CRT High'],
  },
  {
    group: 'core', title: 'Bearish CRT', badge: 'Valid Setup', badgeClass: 'valid',
    candles: [withLabel(C1_BULL, 'C1'), { o: 108, h: 112.4, l: 106.2, c: 106.8, label: 'C2' }, { o: 106.8, h: 107.4, l: 99.4, c: 99.9, label: 'C3' }],
    ann: [...rangeAnn(C1_BULL), mk(1, 112.4, 'Sweep', COL.sweep, 'above'), arrow(1.3, 106.8, 1.7, 100, COL.tp)],
    desc: 'C2 กวาด CRT High แล้วปิดกลับเข้ากรอบ คาดว่าราคาจะวิ่งไปหา 50% และ CRT Low',
    points: ['C2 High &gt; C1 High (กวาดสภาพคล่องฝั่งบน)', 'C2 Close &lt; C1 High (ปิดกลับเข้ากรอบ)', 'C2 Low ไม่ต่ำกว่า C1 Low', 'SL เหนือไส้ C2 · TP1 = 50% · TP2 = CRT Low'],
  },
  {
    group: 'invalid', title: 'Breakout / Breakdown', badge: 'ไม่ใช่ CRT', badgeClass: 'invalid',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 102, h: 102.8, l: 96.2, c: 97, label: 'C2' }, { o: 97, h: 97.8, l: 93.5, c: 94.2, label: 'C3' }],
    ann: [...rangeAnn(C1_BEAR), mk(1, 96.2, 'ปิดนอกกรอบ', COL.down, 'below')],
    desc: 'C2 ทะลุ CRT Low แล้ว "ปิด" ใต้กรอบ แปลว่าราคาไปต่อ ไม่ได้กวาดแล้วกลับตัว',
    points: ['จุดสำคัญอยู่ที่ราคาปิด ไม่ใช่แค่การทะลุ', 'ห้ามซื้อสวน เพราะยังเป็นแรงขาย', 'อาจกลายเป็นสัญญาณไปต่อในทิศเดิม'],
  },
  {
    group: 'invalid', title: 'Inside Bar (ไม่กวาด)', badge: 'รอ', badgeClass: 'warn',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 102.5, h: 106.5, l: 101.2, c: 105.4, label: 'C2' }],
    slots: 3,
    ann: [...rangeAnn(C1_BEAR)],
    desc: 'C2 อยู่ในกรอบทั้งแท่ง ยังไม่มีการกวาดสภาพคล่อง',
    points: ['ยังไม่มี Setup', 'ใช้กรอบ C1 เดิมแล้วรอแท่งถัดไปมากวาด', 'สภาพคล่องยังสะสมอยู่ทั้งสองฝั่ง'],
  },
  {
    group: 'invalid', title: 'Outside Bar (กวาดสองฝั่ง)', badge: 'ไม่ชัดเจน', badgeClass: 'warn',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 103, h: 111.8, l: 98.2, c: 104.5, label: 'C2' }],
    slots: 3,
    ann: [...rangeAnn(C1_BEAR), mk(1, 111.8, 'Sweep H', COL.sweep, 'above'), mk(1, 98.2, 'Sweep L', COL.sweep, 'below')],
    desc: 'C2 กวาดทั้ง High และ Low ของ C1 จึงอ่านทิศทางไม่ออก',
    points: ['ไม่นับเป็น CRT', 'นิยมใช้ C2 เป็นกรอบ (Range) ใหม่แทน', 'มักเกิดช่วงข่าวแรง'],
  },
  {
    group: 'outcome', title: 'ถึงแค่ 50% แล้วกลับตัว', badge: 'Valid · ได้ TP1', badgeClass: 'valid',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 102, h: 103.6, l: 97.8, c: 102.9, label: 'C2' }, { o: 102.9, h: 105.6, l: 102.4, c: 104.6, label: 'C3' }, { o: 104.6, h: 105.2, l: 101.2, c: 101.8, label: 'C4' }],
    ann: [...rangeAnn(C1_BEAR), mk(1, 97.8, 'Sweep', COL.sweep, 'below'), mk(2, 105.6, 'TP1', COL.tp, 'above')],
    desc: 'Setup ถูกต้อง แต่ราคาไปถึงแค่ 50% ของกรอบแล้วกลับตัว',
    points: ['เป็นเหตุผลที่ควรแบ่งปิดกำไรที่ TP1 (50%)', 'หลังถึง TP1 ควรเลื่อน SL มาบังทุน', 'อย่าคาดหวังว่าทุกครั้งจะไปถึง TP2'],
  },
  {
    group: 'outcome', title: 'Failed CRT (โดน SL)', badge: 'Valid · แพ้', badgeClass: 'invalid',
    candles: [withLabel(C1_BEAR, 'C1'), { o: 102, h: 103.8, l: 98, c: 102.6, label: 'C2' }, { o: 102.6, h: 103.4, l: 96.4, c: 96.9, label: 'C3' }],
    ann: [...rangeAnn(C1_BEAR), hl(97.7, COL.sl, 'SL', 1), mk(1, 98, 'Sweep', COL.sweep, 'below')],
    desc: 'Setup ถูกต้องทุกข้อ แต่ราคาทะลุไส้ Sweep ลงไปต่อ',
    points: ['ไม่มีระบบไหนชนะ 100%', 'SL ใต้ไส้ Sweep ช่วยจำกัดความเสียหาย', 'จัดการความเสี่ยงต่อไม้ให้ไม่เกิน 1–2%'],
  },
  {
    group: 'advanced', title: 'Multi-Candle Range', badge: 'ขั้นสูง', badgeClass: 'warn',
    candles: [
      { o: 103, h: 110, l: 102, c: 108, label: 'R1' }, { o: 108, h: 109.2, l: 100, c: 101.5, label: 'R2' },
      { o: 101.5, h: 106, l: 100.8, c: 105.2, label: 'R3' }, { o: 105.2, h: 105.8, l: 98.2, c: 104.1, label: 'C2' },
      { o: 104.1, h: 110.5, l: 103.6, c: 110.2, label: 'C3' },
    ],
    ann: [zone(100, 110, COL.high, 'Range 3 แท่ง', 0, 2), ...rangeAnn({ h: 110, l: 100 }), mk(3, 98.2, 'Sweep', COL.sweep, 'below')],
    desc: 'ใช้ High สูงสุดและ Low ต่ำสุดของกลุ่มแท่งเป็นกรอบ แทนการใช้แท่งเดียว',
    points: ['เทียบเท่ากรอบของ TF ที่ใหญ่ขึ้น', 'เหมาะกับช่วงตลาดสะสมตัว (Consolidation)', 'กฎการ Sweep และการปิดยังเหมือนเดิม'],
  },
];

function renderPatterns(filter = 'all') {
  const grid = $('patternGrid');
  grid.innerHTML = '';
  PATTERNS.filter((p) => filter === 'all' || p.group === filter).forEach((p) => {
    const card = document.createElement('article');
    card.className = 'card pattern';
    card.innerHTML = `
      <div class="pattern-head"><h4>${p.title}</h4><span class="badge ${p.badgeClass}">${p.badge}</span></div>
      <svg class="chart" role="img" aria-label="${p.title}"></svg>
      <p>${p.desc}</p>
      <ul>${p.points.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    grid.appendChild(card);
    drawChart(card.querySelector('svg'), p.candles, { annotations: p.ann, slots: p.slots, height: 300 });
  });
}

function initPatterns() {
  renderPatterns();
  $('patternFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#patternFilters .chip').forEach((b) => b.classList.toggle('active', b === btn));
    renderPatterns(btn.dataset.filter);
  });
}

/* ---------- 5) Hero animation + Anatomy ---------- */
function initHero() {
  const c1 = { ...C1_BEAR, label: 'C1' };
  const c2 = { o: 102, h: 104, l: 97.5, c: 103.2, label: 'C2' };
  const c3 = { o: 103.2, h: 110.6, l: 102.6, c: 110.1, label: 'C3' };
  const sweep = mk(1, 97.5, 'Sweep!', COL.sweep, 'below');
  const frames = [
    { candles: [c1], ann: rangeAnn(c1), cap: 'ขั้นที่ 1: C1 สร้างกรอบ (CRT High / 50% / CRT Low)' },
    { candles: [c1, c2], ann: [...rangeAnn(c1), sweep], cap: 'ขั้นที่ 2: C2 กวาด CRT Low แล้วปิดกลับเข้ากรอบ' },
    { candles: [c1, c2, c3], ann: [...rangeAnn(c1), sweep, arrow(1.3, 103.2, 1.7, 110, COL.tp)], cap: 'ขั้นที่ 3: C3 วิ่งไปหา 50% และ CRT High' },
  ];
  let k = 0;
  const render = (f) => {
    drawChart($('heroChart'), f.candles, { slots: 3, annotations: f.ann, extraRange: [96.5, 111] });
    $('heroCaption').textContent = f.cap;
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    render(frames[2]);
  } else {
    render(frames[0]);
    setInterval(() => { k = (k + 1) % frames.length; render(frames[k]); }, 2300);
  }

  drawChart($('anatomyChart'), [
    { ...C1_BEAR, label: 'C1 · Range' },
    { o: 102, h: 104, l: 97.5, c: 103.2, label: 'C2 · Manipulation' },
    { o: 103.2, h: 110.6, l: 102.6, c: 110.1, label: 'C3 · Distribution' },
  ], {
    height: 360,
    annotations: [
      zone(105, 110, COL.down, 'Premium', 0), zone(100, 105, COL.up, 'Discount', 0),
      ...rangeAnn(C1_BEAR), mk(1, 97.5, 'Liquidity Sweep', COL.sweep, 'below'),
      arrow(1.3, 103.2, 1.7, 110, COL.tp, 'Target'),
    ],
  });
}

/* ---------- 6) Lab ---------- */
const LAB_C1 = { ...C1_BEAR, label: 'C1' };
const LAB_PRESETS = {
  bullish: { o: 102, h: 104, l: 97.5, c: 103.2 },
  bearish: { o: 107.5, h: 112.4, l: 105.8, c: 106.2 },
  breakout: { o: 104, h: 113, l: 103.5, c: 112.2 },
  breakdown: { o: 102, h: 102.8, l: 96.2, c: 97 },
  inside: { o: 102.5, h: 106.5, l: 101.2, c: 105.4 },
  outside: { o: 103, h: 111.8, l: 98.2, c: 104.5 },
};

function labSet(c) {
  ['o', 'h', 'l', 'c'].forEach((k) => { $('s-' + k).value = c[k]; $('v-' + k).textContent = fmt(c[k]); });
}

function updateLab() {
  const c2 = { o: +$('s-o').value, h: +$('s-h').value, l: +$('s-l').value, c: +$('s-c').value };
  c2.h = Math.max(c2.h, c2.o, c2.c);
  c2.l = Math.min(c2.l, c2.o, c2.c);
  labSet(c2);
  c2.label = 'C2';

  const res = classifyCRT(LAB_C1, c2);
  const ann = rangeAnn(LAB_C1);
  if (c2.l < LAB_C1.l) ann.push(mk(1, c2.l, 'Sweep Low', COL.sweep, 'below'));
  if (c2.h > LAB_C1.h) ann.push(mk(1, c2.h, 'Sweep High', COL.sweep, 'above'));
  if (res.type === 'bullish') ann.push(arrow(1.35, c2.c, 2.2, LAB_C1.h, COL.tp, 'Target'));
  if (res.type === 'bearish') ann.push(arrow(1.35, c2.c, 2.2, LAB_C1.l, COL.tp, 'Target'));
  drawChart($('labChart'), [LAB_C1, c2], { slots: 3, annotations: ann, extraRange: [93, 117] });

  const box = $('labResult');
  const cls = res.valid ? 'ok' : (res.type === 'inside' || res.type === 'outside' ? 'warn' : 'bad');
  box.className = 'result ' + cls;
  let html = `<h4>${res.title}</h4><p>${res.detail}</p>`;
  if (res.valid) {
    const v = crtLevels(LAB_C1, c2, res.type);
    html += `<div class="levels">
      ${lvl('Entry (≈ เปิด C3)', v.entry)}${lvl('Stop Loss', v.sl)}${lvl('TP1 (50%)', v.tp1)}${lvl('TP2', v.tp2)}
      ${lvl('RR ถึง TP1', v.rr1 > 0 ? '1 : ' + fmt(v.rr1) : '—')}${lvl('RR ถึง TP2', '1 : ' + fmt(v.rr2))}</div>`;
    html += `<ul>${crtNotes(LAB_C1, c2, res.type).map((n) => `<li>${n}</li>`).join('')}</ul>`;
  }
  box.innerHTML = html;
}

function initLab() {
  labSet(LAB_PRESETS.bullish);
  ['o', 'h', 'l', 'c'].forEach((k) => $('s-' + k).addEventListener('input', updateLab));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    labSet(LAB_PRESETS[b.dataset.preset]);
    updateLab();
  }));
  updateLab();
}

/* ---------- 7) Entry model chart (LTF) ---------- */
function initEntryChart() {
  const raw = [
    [104, 104.5, 102.8, 103.2], [103.2, 103.6, 101.8, 102.0], [102.0, 102.9, 101.5, 102.6], [102.6, 103.4, 102.2, 103.1],
    [103.1, 103.2, 101.0, 101.3], [101.3, 101.6, 99.6, 100.2], [100.2, 100.4, 98.6, 99.0], [99.0, 99.8, 98.4, 99.6],
    [99.6, 101.4, 99.4, 101.2], [101.2, 104.0, 101.0, 103.8], [103.8, 104.6, 102.6, 104.2], [104.2, 104.4, 102.2, 102.5],
    [102.5, 104.9, 102.3, 104.7], [104.7, 106.0, 104.5, 105.8],
  ];
  const candles = raw.map(([o, h, l, c]) => ({ o, h, l, c }));
  drawChart($('entryChart'), candles, {
    height: 360,
    annotations: [
      zone(101.4, 102.6, COL.fvg, 'FVG', 8, 13),
      hl(100, COL.low, 'CRT Low (HTF)'),
      hl(105, COL.mid, 'TP1 · 50% (HTF)'),
      hl(103.4, COL.high, 'MSS', 3, 9, false),
      hl(98.1, COL.sl, 'SL', 5),
      mk(7, 98.4, 'Sweep', COL.sweep, 'below'),
      mk(11, 102.4, 'Entry', COL.entry, 'below'),
    ],
  });
}

/* ---------- 8) Quiz ---------- */
const quiz = { score: 0, total: 0, streak: 0, best: store.get('crt-best', 0), cur: null, answered: false };

function genScenario() {
  const base = rand(100, 300);
  const R = rand(4, 12);
  const l = r2(base), h = r2(base + R);
  const c1 = { o: r2(l + R * rand(0.15, 0.85)), h, l, c: r2(l + R * rand(0.15, 0.85)), label: 'C1' };
  const t = pick(['bullish', 'bullish', 'bearish', 'bearish', 'breakdown', 'breakout', 'inside', 'outside']);
  let o, hh, ll, cc;
  switch (t) {
    case 'bullish':
      ll = l - R * rand(0.05, 0.35); cc = l + R * rand(0.1, 0.8); o = l + R * rand(0.1, 0.7);
      hh = Math.min(Math.max(o, cc) + R * rand(0, 0.12), h - R * 0.03); break;
    case 'bearish':
      hh = h + R * rand(0.05, 0.35); cc = h - R * rand(0.1, 0.8); o = h - R * rand(0.1, 0.7);
      ll = Math.max(Math.min(o, cc) - R * rand(0, 0.12), l + R * 0.03); break;
    case 'breakdown':
      ll = l - R * rand(0.2, 0.6); cc = l - (l - ll) * rand(0.15, 0.8); o = l + R * rand(0.1, 0.5);
      hh = Math.min(Math.max(o, cc) + R * rand(0, 0.1), h - R * 0.03); break;
    case 'breakout':
      hh = h + R * rand(0.2, 0.6); cc = h + (hh - h) * rand(0.15, 0.8); o = h - R * rand(0.1, 0.5);
      ll = Math.max(Math.min(o, cc) - R * rand(0, 0.1), l + R * 0.03); break;
    case 'inside':
      ll = l + R * rand(0.05, 0.3); hh = h - R * rand(0.05, 0.3);
      o = ll + (hh - ll) * rand(0.1, 0.9); cc = ll + (hh - ll) * rand(0.1, 0.9); break;
    default: // outside
      ll = l - R * rand(0.05, 0.3); hh = h + R * rand(0.05, 0.3);
      o = l + R * rand(0.2, 0.8); cc = l + R * rand(0.2, 0.8);
  }
  const c2 = { o: r2(o), h: r2(Math.max(hh, o, cc)), l: r2(Math.min(ll, o, cc)), c: r2(cc), label: 'C2' };
  const res = classifyCRT(c1, c2); // คำตอบมาจากกฎเดียวกับทั้งเว็บ
  const c3 = genC3(c1, c2, res);
  return { c1, c2, c3, res, extra: [c3.h, c3.l] };
}

function genC3(c1, c2, res) {
  const R = c1.h - c1.l, o = c2.c;
  const win = Math.random() < 0.65; // จำลองเพื่อฝึก ไม่ใช่สถิติจริง
  let c;
  if (res.type === 'bullish') c = win ? c1.h - R * rand(-0.1, 0.25) : c2.l - R * rand(0.05, 0.3);
  else if (res.type === 'bearish') c = win ? c1.l + R * rand(-0.1, 0.25) : c2.h + R * rand(0.05, 0.3);
  else if (res.type === 'breakdown') c = o - R * rand(-0.2, 0.5);
  else if (res.type === 'breakout') c = o + R * rand(-0.2, 0.5);
  else c = o + R * rand(-0.4, 0.4);
  const h = Math.max(o, c) + R * rand(0.02, 0.15);
  const l = Math.min(o, c) - R * rand(0.02, 0.15);
  return { o: r2(o), h: r2(h), l: r2(l), c: r2(c), label: 'C3', win };
}

const ohlcLine = (name, c) => `<span><b>${name}</b> O ${fmt(c.o)} · H ${fmt(c.h)} · L ${fmt(c.l)} · C ${fmt(c.c)}</span>`;

function updateStats() {
  $('qScore').textContent = quiz.score;
  $('qTotal').textContent = quiz.total;
  $('qAcc').textContent = quiz.total ? Math.round((quiz.score / quiz.total) * 100) + '%' : '0%';
  $('qStreak').textContent = quiz.streak;
  $('qBest').textContent = quiz.best;
}

function newQuestion() {
  const s = genScenario();
  quiz.cur = s;
  quiz.answered = false;
  drawChart($('quizChart'), [s.c1, s.c2], { slots: 3, annotations: rangeAnn(s.c1), extraRange: s.extra });
  $('quizOhlc').innerHTML = ohlcLine('C1', s.c1) + ohlcLine('C2', s.c2);
  $('quizFeedback').className = 'feedback';
  $('quizFeedback').innerHTML = '';
  document.querySelectorAll('.answer').forEach((b) => { b.disabled = false; b.classList.remove('correct', 'wrong'); });
}

function answerQuiz(ans) {
  if (quiz.answered) return;
  quiz.answered = true;
  const s = quiz.cur;
  const truth = s.res.valid ? s.res.type : 'none';
  const ok = ans === truth;

  quiz.total++;
  if (ok) {
    quiz.score++; quiz.streak++;
    if (quiz.streak > quiz.best) { quiz.best = quiz.streak; store.set('crt-best', quiz.best); }
  } else {
    quiz.streak = 0;
  }
  updateStats();

  document.querySelectorAll('.answer').forEach((b) => {
    b.disabled = true;
    if (b.dataset.answer === truth) b.classList.add('correct');
    else if (b.dataset.answer === ans) b.classList.add('wrong');
  });

  const ann = rangeAnn(s.c1);
  if (s.c2.l < s.c1.l) ann.push(mk(1, s.c2.l, 'Sweep', COL.sweep, 'below'));
  if (s.c2.h > s.c1.h) ann.push(mk(1, s.c2.h, 'Sweep', COL.sweep, 'above'));
  drawChart($('quizChart'), [s.c1, s.c2, { ...s.c3, label: 'C3 (จำลอง)' }], { slots: 3, annotations: ann, extraRange: s.extra });

  let outcome = 'C3 เป็นผลลัพธ์จำลองแบบสุ่ม ไม่ใช่สถิติจริงของตลาด';
  if (s.res.valid) {
    outcome = s.c3.win
      ? 'ผลจำลอง: ครั้งนี้ราคาวิ่งไปถึงเป้าหมาย'
      : 'ผลจำลอง: ครั้งนี้ Setup ล้มเหลว ราคาทะลุไส้ Sweep (โดน SL) จำไว้ว่า CRT ให้ความได้เปรียบ ไม่ได้ให้ความแน่นอน';
  }
  const fb = $('quizFeedback');
  fb.className = 'feedback show ' + (ok ? 'ok' : 'bad');
  fb.innerHTML = `<b>${ok ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</b> คำตอบคือ <b>${s.res.title}</b><br>${s.res.detail}<br><span class="muted">${outcome}</span>`;
}

function initQuiz() {
  document.querySelectorAll('.answer').forEach((b) => b.addEventListener('click', () => answerQuiz(b.dataset.answer)));
  $('quizNext').addEventListener('click', newQuestion);
  $('quizReset').addEventListener('click', () => {
    Object.assign(quiz, { score: 0, total: 0, streak: 0, best: 0 });
    store.set('crt-best', 0);
    updateStats();
    newQuestion();
  });
  updateStats();
  newQuestion();
}

/* ---------- 9) Calculator ---------- */
function calc() {
  const dir = $('cDir').value, bull = dir === 'bull';
  const H = +$('cHigh').value, Lo = +$('cLow').value, S = +$('cSweep').value, E = +$('cEntry').value;
  const B = +$('cBuffer').value || 0, bal = +$('cBalance').value || 0, rp = +$('cRisk').value || 0;
  const box = $('calcResult');
  const err = [];

  if (!(H > Lo)) err.push('CRT High ต้องมากกว่า CRT Low');
  if (bull) {
    if (!(S < Lo)) err.push('จุด Sweep (C2 Low) ต้องต่ำกว่า CRT Low');
    if (!(E > S && E < H)) err.push('Entry ต้องอยู่ระหว่างจุด Sweep กับ CRT High');
  } else {
    if (!(S > H)) err.push('จุด Sweep (C2 High) ต้องสูงกว่า CRT High');
    if (!(E < S && E > Lo)) err.push('Entry ต้องอยู่ระหว่าง CRT Low กับจุด Sweep');
  }
  if (B < 0) err.push('Buffer ต้องไม่ติดลบ');

  if (err.length) {
    box.className = 'result bad';
    box.innerHTML = `<h4>ตรวจสอบข้อมูล</h4><ul>${err.map((e) => `<li>${e}</li>`).join('')}</ul>`;
    $('calcChart').innerHTML = '';
    return;
  }

  const mid = (H + Lo) / 2;
  const sl = bull ? S - B : S + B;
  const risk = Math.abs(E - sl);
  const tp1 = mid, tp2 = bull ? H : Lo;
  const rr1 = (bull ? tp1 - E : E - tp1) / risk;
  const rr2 = (bull ? tp2 - E : E - tp2) / risk;
  const riskMoney = (bal * rp) / 100;
  const size = riskMoney / risk;

  const warn = [];
  if (rr1 <= 0) warn.push('Entry เลยระดับ 50% ไปแล้ว ทำให้ใช้ TP1 ไม่ได้ ควรใช้ TP2 อย่างเดียวหรือข้ามเทรดนี้');
  if (rr2 < 2) warn.push('RR ถึง TP2 ต่ำกว่า 1:2 ผลตอบแทนอาจไม่คุ้มความเสี่ยงในระยะยาว');
  if (rp > 2) warn.push('ความเสี่ยงต่อไม้มากกว่า 2% ถือว่าสูงสำหรับมือใหม่');

  box.className = 'result ' + (warn.length ? 'warn' : 'ok');
  box.innerHTML = `<h4>ผลการคำนวณ</h4>
    <div class="levels">
      ${lvl('Stop Loss', sl)}${lvl('TP1 (50%)', tp1)}${lvl('TP2', tp2)}${lvl('ระยะ SL', risk)}
      ${lvl('RR ถึง TP1', rr1 > 0 ? '1 : ' + fmt(rr1) : '—')}${lvl('RR ถึง TP2', '1 : ' + fmt(rr2))}
      ${lvl('เงินที่เสี่ยง', riskMoney)}${lvl('ขนาด (หน่วย)', fmt(size, 4))}
    </div>
    ${warn.length ? `<ul>${warn.map((w) => `<li>${w}</li>`).join('')}</ul>` : '<p class="muted">ตัวเลขอยู่ในเกณฑ์ที่เหมาะสม</p>'}`;

  // visual
  const R = H - Lo;
  const c1 = bull ? { o: H - R * 0.2, h: H, l: Lo, c: Lo + R * 0.2, label: 'C1' } : { o: Lo + R * 0.2, h: H, l: Lo, c: H - R * 0.2, label: 'C1' };
  const c2 = bull
    ? { o: c1.c, h: Math.min(Math.max(c1.c, E) + R * 0.05, H), l: S, c: E, label: 'C2' }
    : { o: c1.c, h: S, l: Math.max(Math.min(c1.c, E) - R * 0.05, Lo), c: E, label: 'C2' };
  drawChart($('calcChart'), [c1, c2], {
    slots: 3,
    annotations: [hl(tp2, COL.tp, 'TP2', 1), hl(tp1, COL.mid, 'TP1', 1), hl(E, COL.entry, 'Entry', 1, undefined, false), hl(sl, COL.sl, 'SL', 1)],
  });
}

function initCalc() {
  $('cDir').addEventListener('change', () => {
    const bull = $('cDir').value === 'bull';
    $('cSweepText').textContent = bull ? 'จุด Sweep (C2 Low)' : 'จุด Sweep (C2 High)';
    $('cSweep').value = bull ? 97.5 : 112.5;
    $('cEntry').value = bull ? 102 : 108;
    calc();
  });
  ['cHigh', 'cLow', 'cSweep', 'cEntry', 'cBuffer', 'cBalance', 'cRisk'].forEach((id) => $(id).addEventListener('input', calc));
  calc();
}

/* ---------- 10) Checklist & Glossary ---------- */
const CHECKLIST = [
  'กำหนด C1 จาก TF ใหญ่ และกรอบอยู่ใกล้ Key Level (HTF Order Block / FVG / แนวรับต้านสำคัญ)',
  'C2 กวาด High หรือ Low ของ C1 อย่างชัดเจน (กวาดแค่ฝั่งเดียว)',
  'C2 ปิดกลับเข้ามาในกรอบ หรือมี MSS ใน TF เล็กยืนยัน',
  'ทิศทางของ Setup สอดคล้องกับ Bias ของ TF ใหญ่',
  'อยู่ในช่วงเวลาที่มีสภาพคล่อง (London / New York)',
  'ไม่มีข่าวแรงกำลังจะประกาศในช่วงที่ถือออเดอร์',
  'SL อยู่เลยไส้ Sweep และ RR ถึงเป้าหมาย ≥ 1:2',
  'ความเสี่ยงต่อไม้ไม่เกิน 1–2% ของพอร์ต',
];

const GLOSSARY = [
  ['CRT (Candle Range Theory)', 'แนวคิดที่มองแท่งเทียนแต่ละแท่งเป็นกรอบราคา และใช้การกวาด High/Low ของกรอบเป็นสัญญาณ'],
  ['CRT High / CRT Low', 'ราคาสูงสุดและต่ำสุดของแท่ง C1 ใช้เป็นขอบกรอบและเป้าหมาย'],
  ['50% / Equilibrium', 'จุดกึ่งกลางของกรอบ ใช้เป็น TP1 และใช้แบ่งโซน Premium / Discount'],
  ['Premium / Discount', 'ครึ่งบน (แพง) และครึ่งล่าง (ถูก) ของกรอบ หลักคือซื้อในโซน Discount และขายในโซน Premium'],
  ['Liquidity (สภาพคล่อง)', 'กลุ่มคำสั่ง Stop Loss และ Pending Order ที่มักกองอยู่เหนือ High หรือใต้ Low'],
  ['Sweep / Liquidity Grab', 'ราคาทะลุ High/Low ออกไปชั่วคราวเพื่อกินคำสั่งเหล่านั้น แล้วกลับเข้ามาในกรอบ'],
  ['Turtle Soup', 'ชื่อเรียกการทะลุหลอก (False Breakout) แล้วกลับตัว ใช้ในสาย ICT'],
  ['MSS (Market Structure Shift)', 'ราคาทำลาย Swing ล่าสุดในทิศตรงข้าม เป็นสัญญาณเปลี่ยนทิศใน TF เล็ก'],
  ['FVG (Fair Value Gap)', 'ช่องว่างระหว่างไส้ของแท่งที่ 1 และแท่งที่ 3 ในชุด 3 แท่งที่วิ่งแรง'],
  ['Order Block', 'แท่งเทียนสวนทางแท่งสุดท้ายก่อนราคาวิ่งแรง'],
  ['HTF / LTF', 'Higher Timeframe (ใช้กำหนดกรอบ) / Lower Timeframe (ใช้หาจุดเข้า)'],
  ['Power of 3 (AMD)', 'Accumulation → Manipulation → Distribution ซึ่งตรงกับ C1 → C2 → C3'],
  ['Killzone', 'ช่วงเวลาที่ตลาดมีสภาพคล่องและความผันผวนสูง เช่น ช่วงเปิดลอนดอนและนิวยอร์ก'],
  ['Inside / Outside Bar', 'แท่งที่อยู่ในกรอบทั้งแท่ง / แท่งที่ครอบทั้ง High และ Low ของแท่งก่อนหน้า'],
];

function initChecklist() {
  const saved = store.get('crt-checklist', []);
  const ul = $('checklist');
  ul.innerHTML = CHECKLIST.map((t, i) =>
    `<li><label><input type="checkbox" ${saved[i] ? 'checked' : ''}><span>${t}</span></label></li>`).join('');

  const update = () => {
    const boxes = [...ul.querySelectorAll('input')];
    const state = boxes.map((b) => b.checked);
    store.set('crt-checklist', state);
    const done = state.filter(Boolean).length;
    $('checkBar').style.width = (done / boxes.length) * 100 + '%';
    $('checkText').textContent = done === boxes.length
      ? `ครบ ${done}/${boxes.length} ข้อ: Setup ผ่านเกณฑ์ (แต่ยังต้องจัดการความเสี่ยงเสมอ)`
      : `ผ่าน ${done}/${boxes.length} ข้อ ถ้ายังไม่ครบควรรอก่อน`;
  };
  ul.addEventListener('change', update);
  $('checkReset').addEventListener('click', () => { ul.querySelectorAll('input').forEach((b) => { b.checked = false; }); update(); });
  update();
}

function initGlossary() {
  $('glossaryList').innerHTML = GLOSSARY.map(([t, d]) => `<div class="card"><dt>${t}</dt><dd>${d}</dd></div>`).join('');
}

/* ---------- 11) Navigation ---------- */
function initNav() {
  const nav = $('nav');
  $('menuBtn').addEventListener('click', () => nav.classList.toggle('open'));
  const links = [...nav.querySelectorAll('a')];
  links.forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => obs.observe(s));
}

/* ---------- Boot ---------- */
initNav();
initHero();
initPatterns();
initLab();
initEntryChart();
initQuiz();
initCalc();
initChecklist();
initGlossary();
