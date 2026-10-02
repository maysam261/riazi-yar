/* =============================================================
   ریاضی‌یار — نسخه ۴.۱ (دیباگ‌شده)
   ============================================================= */
(function () {
'use strict';

/* ============================================================
   ۱) STATE
   ============================================================ */
const STORAGE_KEY = 'riazi-yar-v1';

const defaultState = {
  settings: {
    sound: true, animation: true, persianNumbers: true,
    difficulty: 'medium', questionCount: 10, examTime: 300,
    negativeMark: false
  },
  activeStudentId: null,
  students: []
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(defaultState);
    const saved = JSON.parse(raw);
    const merged = mergeDeep(deepClone(defaultState), saved);
    if (!Array.isArray(merged.students)) merged.students = [];
    if (merged.stats && !merged.students.length) {
      const id = 'stu_' + Date.now();
      merged.students.push({
        id, name: 'دانش‌آموز', family: '',
        grade: 6, createdAt: Date.now(),
        stats: merged.stats,
        progress: merged.progress || {
          perimeter: { attempts: 0, correct: 0 },
          area: { attempts: 0, correct: 0 },
          fractions: { attempts: 0, correct: 0 },
          decimals: { attempts: 0, correct: 0 }
        },
        history: merged.history || [],
        mistakes: merged.mistakes || {}
      });
      merged.activeStudentId = id;
      delete merged.stats;
      delete merged.progress;
      delete merged.history;
      delete merged.mistakes;
    }
    return merged;
  } catch (e) {
    console.warn('خطا در بارگذاری', e);
    return deepClone(defaultState);
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('خطا در ذخیره', e); }
}
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function mergeDeep(t, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) t[k] = mergeDeep(t[k] || {}, s[k]);
    else t[k] = s[k];
  }
  return t;
}

function activeStudent() {
  if (!state.activeStudentId) return null;
  return state.students.find(s => s.id === state.activeStudentId) || null;
}
function newStudentTemplate(name, family, grade) {
  return {
    id: 'stu_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: name || 'دانش‌آموز',
    family: family || '',
    grade: grade || 6,
    createdAt: Date.now(),
    stats: {
      coins: 0, stars: 0, xp: 0, level: 1,
      streak: 0, bestStreak: 0,
      totalQuestions: 0, totalCorrect: 0, badges: []
    },
    progress: {
      perimeter: { attempts: 0, correct: 0 },
      area: { attempts: 0, correct: 0 },
      fractions: { attempts: 0, correct: 0 },
      decimals: { attempts: 0, correct: 0 }
    },
    history: [],
    mistakes: {}
  };
}
function fullName(s) { return s ? `${s.name}${s.family ? ' ' + s.family : ''}`.trim() : ''; }

/* ============================================================
   ۲) HELPERS
   ============================================================ */
function fa(n) {
  const s = String(n);
  if (!state.settings.persianNumbers) return s;
  return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function faDec(n, dec = 2) {
  let s = round(n, dec).toString();
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  s = s.replace('.', '٫');
  return fa(s);
}
function en(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[،,]/g, '.').replace(/٫/g, '.');
}
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
function round(n, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function faSafe(n) { return escHtml(fa(n)); }
function eq(html) { return `<span class="eq">${html}</span>`; }
function pct(unit) { return unit ? ' ' + unit : ''; }

/* ============================================================
   ۳) SOUND
   ============================================================ */
let audioCtx = null;
function beep(freq, dur = 0.12, type = 'sine', gain = 0.08) {
  if (!state.settings.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}
const sound = {
  correct() { beep(880, .12); setTimeout(() => beep(1320, .16), 90); },
  wrong() { beep(220, .18, 'square', .06); },
  click() { beep(560, .05, 'triangle', .04); },
  win() { [660, 880, 1180].forEach((f, i) => setTimeout(() => beep(f, .16), i * 110)); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2), i * 120)); }
};

/* ============================================================
   ۴) FRACTIONS
   ============================================================ */
function simplify(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: 0, d: 1 };
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function fracEq(a, b) { return a && b && a.d != null && b.d != null && a.n * b.d === b.n * a.d; }
function fracAdd(a, b) { return simplify(a.n * b.d + b.n * a.d, a.d * b.d); }
function fracSub(a, b) { return simplify(a.n * b.d - b.n * a.d, a.d * b.d); }
function fracMul(a, b) { return simplify(a.n * b.n, a.d * b.d); }
function fracDiv(a, b) { return simplify(a.n * b.d, a.d * b.n); }
function fracVal(f) { return f.n / f.d; }
function fracHTML(f) {
  if (!f || f.d == null || f.n == null) return '';
  const s = simplify(f.n, f.d);
  if (s.d === 1) return `<span class="frac-int">${fa(s.n)}</span>`;
  return `<span class="frac"><span class="num">${fa(s.n)}</span><span class="den">${fa(s.d)}</span></span>`;
}
function displayAnswer(a) {
  if (a == null) return '';
  if (typeof a === 'number') return faDec(a, 2);
  if (a.isSym) return a.n === '>' ? '&gt;' : a.n === '<' ? '&lt;' : escHtml(a.n);
  if (a.isNum) return faSafe(a.n);
  if (a.n != null && a.d != null) return fracHTML(a);
  return faSafe(a);
}

/* ============================================================
   ۵) SHAPES
   ============================================================ */
const SC = { fill: '#c7d2fe', stroke: '#4338ca', fill2: '#a5b4fc', fill3: '#fde68a', accent: '#fbbf24' };

function svgWrap(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="shape-svg" role="img" aria-hidden="true">${inner}</svg>`;
}
function label(x, y, txt, anchor = 'middle', cls = 'svg-label') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" direction="rtl">${txt}</text>`;
}

function fitPoints(points, W, H, pad) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
  const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  const drawW = w * s, drawH = h * s;
  const offX = (W - drawW) / 2 - minX * s;
  const offY = (H - drawH) / 2 - minY * s;
  return points.map(p => [p[0] * s + offX, p[1] * s + offY]);
}
function polyCentroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
function labelOnSegment(P1, P2, centroid, txt, offset = 16) {
  const mx = (P1[0] + P2[0]) / 2, my = (P1[1] + P2[1]) / 2;
  let dx = mx - centroid[0], dy = my - centroid[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  return label(mx + dx * offset, my + dy * offset + 4, txt);
}
/* ✅ FIXED: امن‌سازی برای مثلث نامعتبر */
function triangleFromSides(a, b, c) {
  const x = (c * c - b * b + a * a) / (2 * a);
  const ySq = c * c - x * x;
  const y = Math.sqrt(Math.max(0.5, ySq));
  return { A: [x, y], B: [0, 0], C: [a, 0] };
}
function mathToSvg(points, W, H, pad) {
  const maxY = Math.max(...points.map(p => p[1]));
  const flipped = points.map(p => [p[0], maxY - p[1]]);
  return fitPoints(flipped, W, H, pad);
}
/* ✅ FIXED: مدیریت مقادیر غیرعددی */
function numOr(v, fallback) { return typeof v === 'number' && v > 0 ? v : fallback; }

const Shapes = {
  square(side) {
    const W = 220, H = 200, pad = 46;
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="4"/>` +
      label(x + box / 2, y + box + 22, fa(side), 'middle', 'svg-label-lg')
    );
  },
  rectangle(w, h) {
    const W = 260, H = 200, pad = 46;
    const wNum = numOr(w, 3);
    const hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="4"/>` +
      label(x + rw / 2, y + rh + 22, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  triangle(a, b, c) {
    const W = 260, H = 220, pad = 46;
    const v = triangleFromSides(a, b, c);
    const pts = mathToSvg([v.A, v.B, v.C], W, H, pad);
    const [pA, pB, pC] = pts;
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      labelOnSegment(pA, pB, cent, fa(c), 16) +
      labelOnSegment(pB, pC, cent, fa(a), 16) +
      labelOnSegment(pC, pA, cent, fa(b), 16)
    );
  },
  triangleBH(base, height) {
    const W = 260, H = 220, pad = 46;
    const A = [base / 2, height], B = [0, 0], C = [base, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
      `<rect x="${midBC[0] - 5}" y="${midBC[1] - 10}" width="10" height="10" fill="none" stroke="${SC.accent}" stroke-width="1.5"/>` +
      label(pA[0] + 12, (pA[1] + midBC[1]) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      label(midBC[0], midBC[1] + 22, fa(base), 'middle', 'svg-label-lg')
    );
  },
  circle(r) {
    const W = 220, H = 200;
    const cx = W / 2, cy = H / 2 - 4, R = 62;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="2.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3" fill="${SC.stroke}"/>` +
      label(cx + R / 2, cy - 8, fa(r), 'middle', 'svg-label-lg')
    );
  },
  parallelogram(a, b, h = null) {
    const W = 260, H = 200, pad = 46;
    const aNum = numOr(a, 5), bNum = numOr(b, 3);
    const showH = h != null && h > 0;
    const hDraw = showH ? h : aNum * 0.5;
    const pts = mathToSvg(
      [[0, 0], [aNum, 0], [aNum + bNum * 0.35, -hDraw], [bNum * 0.35, -hDraw]],
      W, H, pad
    );
    const cent = polyCentroid(pts);
    let heightLine = '';
    if (showH) {
      const xTop = (pts[3][0] + pts[2][0]) / 2;
      heightLine =
        `<line x1="${xTop}" y1="${pts[2][1]}" x2="${xTop}" y2="${pts[1][1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
        label(xTop + 10, (pts[2][1] + pts[1][1]) / 2 + 4, fa(h), 'start', 'svg-label-lg');
    }
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      heightLine +
      labelOnSegment(pts[3], pts[2], cent, fa(a), 16) +
      labelOnSegment(pts[1], pts[2], cent, fa(b), 16)
    );
  },
  rhombusSide(s) {
    const W = 240, H = 220, pad = 46;
    const sNum = numOr(s, 5);
    const halfW = sNum / 2, halfH = (sNum * 0.75) / 2;
    const pts = fitPoints(
      [[halfW, 0], [2 * halfW, halfH], [halfW, 2 * halfH], [0, halfH]],
      W, H, pad
    );
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 16)
    );
  },
  rhombusD(d1, d2) {
    const W = 260, H = 220, pad = 46;
    const d1Num = numOr(d1, 8), d2Num = numOr(d2, 6);
    const pts = fitPoints(
      [[d1Num / 2, 0], [d1Num, d2Num / 2], [d1Num / 2, d2Num], [0, d2Num / 2]],
      W, H, pad
    );
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[2][0]}" y2="${pts[2][1]}" stroke="${SC.accent}" stroke-width="1.6" stroke-dasharray="5 4"/>` +
      `<line x1="${pts[1][0]}" y1="${pts[1][1]}" x2="${pts[3][0]}" y2="${pts[3][1]}" stroke="${SC.accent}" stroke-width="1.6" stroke-dasharray="5 4"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(d2), 16) +
      labelOnSegment(pts[3], pts[0], cent, fa(d1), 16)
    );
  },
  trapezoid(bigBase, smallBase, height) {
    const W = 260, H = 220, pad = 46;
    const bb = numOr(bigBase, 10), sb = numOr(smallBase, 6), h = numOr(height, 4);
    const offset = (bb - sb) / 2;
    const pts = mathToSvg(
      [[offset, h], [offset + sb, h], [bb, 0], [0, 0]],
      W, H, pad
    );
    const [pA, pB, pC, pD] = pts;
    const cent = polyCentroid(pts);
    const midTop = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2];
    const footY = (pC[1] + pD[1]) / 2;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="${midTop[0]}" y1="${midTop[1]}" x2="${midTop[0]}" y2="${footY}" stroke="${SC.accent}" stroke-width="2.2" stroke-dasharray="5 4"/>` +
      label(midTop[0] + 12, (midTop[1] + footY) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      labelOnSegment(pA, pB, cent, fa(smallBase), 18) +
      labelOnSegment(pD, pC, cent, fa(bigBase), 18)
    );
  },
  regularPolygon(n, s) {
    const W = 240, H = 220, cx = W / 2, cy = H / 2, R = 78;
    const start = -Math.PI / 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * 2 * Math.PI / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const cent = [cx, cy];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 16)
    );
  },
  lshape(W1, H1, W2, H2) {
    const W = 260, H = 220, pad = 46;
    const w1 = numOr(W1, 6), h1 = numOr(H1, 4), w2 = numOr(W2, 3), h2 = numOr(H2, 5);
    const pts = mathToSvg(
      [[0, 0], [w1, 0], [w1, -h1], [w2, -h1], [w2, -h1 - h2], [0, -h1 - h2]],
      W, H, pad
    );
    const [pTR, pMidR, pMidIn, pBotR, pBotL, pTL] = pts;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label((pTL[0] + pTR[0]) / 2, pTR[1] - 8, fa(W1), 'middle', 'svg-label-lg') +
      label(pTR[0] + 10, (pTR[1] + pMidR[1]) / 2 + 4, fa(H1), 'start', 'svg-label-lg') +
      label(pBotR[0] + 10, (pBotR[1] + pBotL[1]) / 2 + 4, fa(H2), 'start', 'svg-label-lg') +
      label((pBotL[0] + pBotR[0]) / 2, pBotL[1] + 22, fa(W2), 'middle', 'svg-label-lg')
    );
  },
  house(w, h, roofH) {
    const W = 260, H = 240, pad = 46;
    const wN = numOr(w, 6), hN = numOr(h, 4), rH = numOr(roofH, 3);
    const pts = mathToSvg(
      [[0, 0], [wN, 0], [wN, hN], [wN / 2, hN + rH], [0, hN]],
      W, H, pad
    );
    const [pBL, pBR, pR, pTop, pL] = pts;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label((pBL[0] + pBR[0]) / 2, pBL[1] + 22, fa(w), 'middle', 'svg-label-lg') +
      label(pR[0] + 10, (pR[1] + pBR[1]) / 2 + 4, fa(h), 'start', 'svg-label-lg') +
      label(pTop[0], pTop[1] - 8, fa(roofH), 'middle', 'svg-label-lg')
    );
  },
  tshape(WT, HT, WB, HB) {
    const W = 260, H = 240, pad = 46;
    const wt = numOr(WT, 8), ht = numOr(HT, 2), wb = numOr(WB, 4), hb = numOr(HB, 6);
    const stemLeft = (wt - wb) / 2;
    const pts = mathToSvg(
      [
        [0, 0], [wt, 0], [wt, -ht],
        [stemLeft + wb, -ht], [stemLeft + wb, -ht - hb],
        [stemLeft, -ht - hb], [stemLeft, -ht], [0, -ht]
      ],
      W, H, pad
    );
    const [pTL, pTR, pMR, pBotR, pBotL, pML] = pts;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label((pTL[0] + pTR[0]) / 2, pTL[1] - 8, fa(WT), 'middle', 'svg-label-lg') +
      label(pTR[0] + 10, (pTR[1] + pMR[1]) / 2 + 4, fa(HT), 'start', 'svg-label-lg') +
      label((pBotL[0] + pBotR[0]) / 2, pBotL[1] + 22, fa(WB), 'middle', 'svg-label-lg') +
      label(pBotL[0] - 10, (pBotL[1] + pML[1]) / 2 + 4, fa(HB), 'end', 'svg-label-lg')
    );
  },
  fracPie(n, d) {
    const W = 160, H = 160, cx = 80, cy = 80, r = 60;
    let paths = '';
    for (let i = 0; i < d; i++) {
      const a1 = (i / d) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      const fill = i < n ? '#a5b4fc' : '#e5e7eb';
      if (d === 1) paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#4338ca" stroke-width="2"/>`;
      else paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="#4338ca" stroke-width="1.5"/>`;
    }
    return svgWrap(W, H, paths);
  }
};

/* ============================================================
   ۶) CONTEXTS + DIFFICULTY
   ============================================================ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 9];
  if (diff === 'hard') return [5, 25];
  return [3, 15];
}

const CTX_P = {
  square: [
    { story: 'قاب عکس مربعی به ضلع', u: 'سانتی‌متر', ask: 'برای قاب‌گیری دور آن چقدر چوب لازم است؟' },
    { story: 'زمین بازی مربعی به ضلع', u: 'متر', ask: 'اگر یک دور کامل دور آن بدویم، چند متر دویده‌ایم؟' },
    { story: 'سفره مربعی به ضلع', u: 'سانتی‌متر', ask: 'برای دوخت نوار دور آن چقدر نوار لازم است؟' },
    { story: 'باغچه مربعی به ضلع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  rectangle: [
    { story: 'استخر مستطیلی به طول', u: 'متر', ask: 'برای نصب حفاظ دور آن چقدر حفاظ لازم است؟' },
    { story: 'باغچه مستطیلی به طول', u: 'متر', ask: 'برای کشیدن سیم دور آن چقدر سیم لازم است؟' },
    { story: 'قاب مستطیلی به طول', u: 'سانتی‌متر', ask: 'برای قاب‌گیری آن چقدر نوار لازم است؟' },
    { story: 'زمین فوتبال به طول', u: 'متر', ask: 'اگر بازیکن دو دور کامل دور آن بدود، چند متر دویده است؟' }
  ],
  triangle: [
    { story: 'زمین مثلثی با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' },
    { story: 'تابلوی هشدار مثلثی با اضلاع', u: 'سانتی‌متر', ask: 'برای قاب‌گیری آن چقدر نوار لازم است؟' }
  ],
  circle: [
    { story: 'استخر دایره‌ای به شعاع', u: 'متر', ask: 'برای کشیدن نرده دور آن چقدر نرده لازم است؟ (π ≈ ۳٫۱۴)' },
    { story: 'باغ گل دایره‌ای به شعاع', u: 'متر', ask: 'برای دور آن چقدر نوار لازم است؟ (π ≈ ۳٫۱۴)' }
  ],
  parallelogram: [
    { story: 'زمین کشاورزی متوازی‌الاضلاع با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  rhombus: [
    { story: 'باغچه لوزی‌شکل به ضلع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ]
};
const CTX_A = {
  square: [
    { story: 'زمین کشاورزی مربعی به ضلع', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'کاشی مربعی به ضلع', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'آشپزخانه مربعی به ضلع', u: 'متر', ask: 'برای سنگ‌فرش آن چند متر مربع سنگ لازم است؟' }
  ],
  rectangle: [
    { story: 'زمین فوتبال به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'جلد کتاب به طول', u: 'سانتی‌متر', ask: 'مساحت جلد آن چقدر است؟' },
    { story: 'زمین کشاورزی به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'فرش مستطیلی به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' }
  ],
  triangle: [
    { story: 'زمین مثلثی با قاعده', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'تابلوی مثلثی با قاعده', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' }
  ],
  circle: [
    { story: 'پیتزای دایره‌ای به شعاع', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟ (π ≈ ۳٫۱۴)' },
    { story: 'استخر دایره‌ای به شعاع', u: 'متر', ask: 'مساحت کف آن چقدر است؟ (π ≈ ۳٫۱۴)' }
  ]
};
const CTX_FR = [
  { name: 'علی', u: 'تومان', verb: 'خرج کرد', q: 'چقدر خرج کرد؟' },
  { name: 'مریم', u: 'صفحه', verb: 'خواند', q: 'چند صفحه خواند؟' },
  { name: 'رضا', u: 'لیتر', verb: 'نوشید', q: 'چند لیتر نوشید؟' },
  { name: 'زهرا', u: 'دقیقه', verb: 'ورزش کرد', q: 'چند دقیقه ورزش کرد؟' }
];

/* ============================================================
   ۷) PERIMETER GENERATORS
   ============================================================ */
function genSquarePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  if (diff === 'easy') {
    return {
      topic: 'perimeter', key: 'sq-p',
      prompt: `محیط مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
      shape: Shapes.square(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر',
      steps: ['فرمول محیط مربع: محیط = ۴ × ضلع', `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`]
    };
  }
  const ctx = pick(CTX_P.square);
  return {
    topic: 'perimeter', key: 'sq-p',
    prompt: `${ctx.story} ${fa(s)} ${ctx.u} داریم. ${ctx.ask}`,
    shape: Shapes.square(s), type: 'numeric', answer: ans, unit: ctx.u,
    steps: ['مربع است → ۴ ضلع مساوی.', `محیط = ۴ × ضلع = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genSquarePerimeter.levels = ['easy', 'medium', 'hard'];

function genRectPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = 2 * (w + h);
  if (diff === 'easy') {
    return {
      topic: 'perimeter', key: 'rect-p',
      prompt: `محیط مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
      shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر',
      steps: ['فرمول: محیط = ۲ × (طول + عرض)', `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)} سانتی‌متر`]
    };
  }
  const ctx = pick(CTX_P.rectangle);
  return {
    topic: 'perimeter', key: 'rect-p',
    prompt: `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u} داریم. ${ctx.ask}`,
    shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: ctx.u,
    steps: ['مستطیل → دو ضلع روبه‌رو مساوی.', 'محیط = ۲ × (طول + عرض)', `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRectPerimeter.levels = ['easy', 'medium', 'hard'];

function genTrianglePerimeter(diff) {
  const [a, b] = diffRange(diff);
  let x, y, z, guard = 0;
  do {
    x = ri(a, b); y = ri(a, b); z = ri(a, b);
    guard++;
  } while ((x + y <= z || x + z <= y || y + z <= x) && guard < 30);
  if (guard >= 30) { x = a; y = a + 1; z = a + 2; }
  const ans = x + y + z;
  const ctx = diff === 'easy' ? { story: '', u: 'سانتی‌متر', ask: '' } : pick(CTX_P.triangle);
  const prompt = diff === 'easy'
    ? `محیط مثلثی با اضلاع ${fa(x)}، ${fa(y)} و ${fa(z)} سانتی‌متر چقدر است؟`
    : `${ctx.story} ${fa(x)}، ${fa(y)} و ${fa(z)} ${ctx.u} داریم. ${ctx.ask}`;
  return {
    topic: 'perimeter', key: 'tri-p',
    prompt, shape: Shapes.triangle(x, y, z),
    type: 'numeric', answer: ans, unit: ctx.u,
    steps: ['محیط مثلث = مجموع سه ضلع', `محیط = ${eq(`${fa(x)} + ${fa(y)} + ${fa(z)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genTrianglePerimeter.levels = ['easy', 'medium', 'hard'];

function genCirclePerimeter(diff) {
  const r = ri(2, diff === 'hard' ? 12 : 8);
  const ans = round(2 * 3.14 * r, 2);
  const ctx = diff === 'hard' ? pick(CTX_P.circle) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(r)} ${ctx.u} داریم. ${ctx.ask}`
    : `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π ≈ ۳٫۱۴)`;
  return {
    topic: 'perimeter', key: 'circ-p',
    prompt, shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: ctx.u,
    steps: ['فرمول محیط دایره: محیط = ۲ × π × شعاع', `محیط = ${eq(`۲ × ۳٫۱۴ × ${fa(r)}`)} = ${faDec(ans)}${pct(ctx.u)}`]
  };
}
genCirclePerimeter.levels = ['medium', 'hard'];

function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b);
  const ans = 2 * (x + y);
  const ctx = diff === 'hard' ? pick(CTX_P.parallelogram) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(x)} و ${fa(y)} ${ctx.u} داریم. ${ctx.ask}`
    : `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'para-p',
    prompt, shape: Shapes.parallelogram(x, y),
    type: 'numeric', answer: ans, unit: ctx.u,
    steps: [
      'اضلاع روبه‌رو در متوازی‌الاضلاع مساوی‌اند.',
      'محیط = ۲ × (ضلع بزرگ + ضلع کوچک)',
      `محیط = ${eq(`۲ × (${fa(x)} + ${fa(y)})`)} = ${fa(ans)}${pct(ctx.u)}`
    ]
  };
}
genParallelogramPerimeter.levels = ['medium', 'hard'];

function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  const ctx = diff === 'hard' ? pick(CTX_P.rhombus) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(s)} ${ctx.u} داریم. ${ctx.ask}`
    : `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'rhom-p',
    prompt, shape: Shapes.rhombusSide(s),
    type: 'numeric', answer: ans, unit: ctx.u,
    steps: ['چهار ضلع لوزی مساوی‌اند.', `محیط = ۴ × ضلع = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRhombusPerimeter.levels = ['medium', 'hard'];

function genPolygonPerimeter(diff) {
  const ns = diff === 'easy' ? [3, 4] : diff === 'medium' ? [5, 6] : [6, 8];
  const n = pick(ns);
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = n * s;
  const nameMap = { 3: 'مثلث', 4: 'مربع', 5: 'پنج‌ضلعی', 6: 'شش‌ضلعی', 8: 'هشت‌ضلعی' };
  const prompt = diff === 'hard'
    ? `باغ گل ${nameMap[n]} منتظم با ضلع ${fa(s)} متر داریم. برای نرده‌کشی دور آن چقدر نرده لازم است؟`
    : `محیط یک ${nameMap[n]} منتظم با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'poly-p',
    prompt, shape: Shapes.regularPolygon(n, s),
    type: 'numeric', answer: ans, unit: diff === 'hard' ? 'متر' : 'سانتی‌متر',
    steps: [
      `در ${nameMap[n]} منتظم، همه‌ی اضلاع مساوی‌اند.`,
      `محیط = تعداد ضلع × طول ضلع = ${eq(`${fa(n)} × ${fa(s)}`)} = ${fa(ans)}`
    ]
  };
}
genPolygonPerimeter.levels = ['medium', 'hard'];

function genFindSideFromPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const p = 4 * s;
  const stories = [
    `محیط یک زمین بازی مربعی ${fa(p)} متر است. برای خرید نرده، باید طول یک ضلع را بدانیم. ضلع چقدر است؟`,
    `دور یک سفره مربعی ${fa(p)} سانتی‌متر نوار لازم است. ضلع سفره چقدر است؟`,
    `محیط یک قاب مربعی ${fa(p)} سانتی‌متر است. طول هر ضلع چقدر است؟`
  ];
  return {
    topic: 'perimeter', key: 'find-side',
    prompt: diff === 'hard' ? pick(stories) : `محیط مربعی ${fa(p)} سانتی‌متر است. طول ضلع آن چقدر است؟`,
    shape: Shapes.square('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر',
    steps: ['می‌دانیم: محیط = ۴ × ضلع', 'پس: ضلع = محیط ÷ ۴', `ضلع = ${eq(`${fa(p)} ÷ ۴`)} = ${fa(s)} سانتی‌متر`]
  };
}
genFindSideFromPerimeter.levels = ['hard'];

/* ============================================================
   ۸) AREA GENERATORS
   ============================================================ */
function genSquareArea(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = s * s;
  const ctx = diff !== 'easy' ? pick(CTX_A.square) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(s)} ${ctx.u} داریم. ${ctx.ask}`
    : `مساحت مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'sq-a',
    prompt, shape: Shapes.square(s), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    steps: ['مساحت مربع = ضلع × ضلع', `مساحت = ${eq(`${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genSquareArea.levels = ['easy', 'medium', 'hard'];

function genRectArea(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = w * h;
  const ctx = diff !== 'easy' ? pick(CTX_A.rectangle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u} داریم. ${ctx.ask}`
    : `مساحت مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'rect-a',
    prompt, shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    steps: ['مساحت مستطیل = طول × عرض', `مساحت = ${eq(`${fa(w)} × ${fa(h)}`)} = ${fa(ans)}`]
  };
}
genRectArea.levels = ['easy', 'medium', 'hard'];

function genTriangleArea(diff) {
  const [a, b] = diffRange(diff);
  let base = ri(a, b), h = ri(a, b);
  if ((base * h) % 2 !== 0) h += 1;
  const ans = (base * h) / 2;
  const ctx = diff === 'hard' ? pick(CTX_A.triangle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(base)} ${ctx.u} و ارتفاع ${fa(h)} ${ctx.u} داریم. ${ctx.ask}`
    : `مساحت مثلثی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'tri-a',
    prompt, shape: Shapes.triangleBH(base, h), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    steps: ['مساحت مثلث = (قاعده × ارتفاع) ÷ ۲', `مساحت = ${eq(`(${fa(base)} × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genTriangleArea.levels = ['medium', 'hard'];

function genCircleArea(diff) {
  const r = ri(2, diff === 'hard' ? 10 : 7);
  const ans = round(3.14 * r * r, 2);
  const ctx = diff === 'hard' ? pick(CTX_A.circle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(r)} ${ctx.u} داریم. ${ctx.ask}`
    : `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π ≈ ۳٫۱۴)`;
  return {
    topic: 'area', key: 'circ-a',
    prompt, shape: Shapes.circle(r), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    steps: [
      'مساحت دایره = π × شعاع²',
      `مساحت = ${eq(`۳٫۱۴ × ${fa(r)}²`)} = ${eq(`۳٫۱۴ × ${fa(r * r)}`)} = ${faDec(ans)}`
    ]
  };
}
genCircleArea.levels = ['medium', 'hard'];

function genParallelogramArea(diff) {
  const [a, b] = diffRange(diff);
  const base = ri(a, b), h = ri(a, b);
  const ans = base * h;
  return {
    topic: 'area', key: 'para-a',
    prompt: `مساحت متوازی‌الاضلاعی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(base, 12, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: ['مساحت متوازی‌الاضلاع = قاعده × ارتفاع', `مساحت = ${eq(`${fa(base)} × ${fa(h)}`)} = ${fa(ans)}`]
  };
}
genParallelogramArea.levels = ['medium', 'hard'];

function genRhombusArea(diff) {
  const [a, b] = diffRange(diff);
  let d1 = ri(a, b), d2 = ri(a, b);
  if ((d1 * d2) % 2 !== 0) d2 += 1;
  const ans = (d1 * d2) / 2;
  return {
    topic: 'area', key: 'rhom-a',
    prompt: `مساحت لوزی با قطرهای ${fa(d1)} و ${fa(d2)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombusD(d1, d2), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      'مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲',
      `مساحت = ${eq(`(${fa(d1)} × ${fa(d2)}) ÷ ۲`)} = ${fa(ans)}`
    ]
  };
}
genRhombusArea.levels = ['medium', 'hard'];

function genTrapezoidArea(diff) {
  const [a, b] = diffRange(diff);
  let base1 = ri(a, b), base2 = ri(a, b), h = ri(a, b);
  if (((base1 + base2) * h) % 2 !== 0) h += 1;
  const ans = ((base1 + base2) * h) / 2;
  return {
    topic: 'area', key: 'trap-a',
    prompt: `مساحت ذوزنقه‌ای با دو قاعده ${fa(base1)} و ${fa(base2)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.trapezoid(base1, base2, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      'مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      `مساحت = ${eq(`((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`
    ]
  };
}
genTrapezoidArea.levels = ['hard'];

function genCompositeArea(diff) {
  const [a, b] = diffRange(diff);
  const variant = pick(['L', 'house', 'T']);

  if (variant === 'L') {
    const W1 = ri(a, b), H1 = ri(a, b);
    const W2 = ri(Math.max(2, Math.floor(W1 / 2)), Math.max(3, W1 - 1));
    const H2 = ri(a, b);
    const area1 = W1 * H1, area2 = W2 * H2, ans = area1 + area2;
    return {
      topic: 'area', key: 'comp-a',
      prompt: `مساحت شکل L زیر چقدر است؟`,
      shape: Shapes.lshape(W1, H1, W2, H2), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
      steps: [
        'شکل را به دو مستطیل تقسیم می‌کنیم:',
        `مستطیل بالایی: ${eq(`${fa(W1)} × ${fa(H1)}`)} = ${fa(area1)}`,
        `مستطیل پایینی: ${eq(`${fa(W2)} × ${fa(H2)}`)} = ${fa(area2)}`,
        `مساحت کل = ${eq(`${fa(area1)} + ${fa(area2)}`)} = ${fa(ans)}`
      ]
    };
  }
  if (variant === 'house') {
    const W = ri(Math.max(4, a), b);
    const H = ri(a, b);
    let triH = ri(Math.max(2, a), Math.max(3, b));
    if ((W * triH) % 2 !== 0) triH += 1;
    const rectArea = W * H;
    const triArea = (W * triH) / 2;
    const ans = rectArea + triArea;
    return {
      topic: 'area', key: 'comp-a',
      prompt: `نقشه یک خانه به شکل زیر (مستطیل + سقف مثلثی). مساحت کل چقدر است؟`,
      shape: Shapes.house(W, H, triH), type: 'numeric', answer: ans, unit: 'متر مربع',
      steps: [
        `مساحت مستطیل: ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(rectArea)}`,
        `مساحت مثلث: ${eq(`(${fa(W)} × ${fa(triH)}) ÷ ۲`)} = ${fa(triArea)}`,
        `مساحت کل = ${eq(`${fa(rectArea)} + ${fa(triArea)}`)} = ${fa(ans)}`
      ]
    };
  }
  const WT = ri(a, b), HT = ri(2, Math.max(3, Math.floor(b / 2)));
  const WB = ri(2, Math.max(3, WT - 1)), HB = ri(a, b);
  const areaT = WT * HT, areaB = WB * HB, ans = areaT + areaB;
  return {
    topic: 'area', key: 'comp-a',
    prompt: `مساحت شکل T زیر چقدر است؟`,
    shape: Shapes.tshape(WT, HT, WB, HB), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      'شکل را به دو مستطیل تقسیم می‌کنیم:',
      `مستطیل افقی: ${eq(`${fa(WT)} × ${fa(HT)}`)} = ${fa(areaT)}`,
      `مستطیل عمودی: ${eq(`${fa(WB)} × ${fa(HB)}`)} = ${fa(areaB)}`,
      `مساحت کل = ${eq(`${fa(areaT)} + ${fa(areaB)}`)} = ${fa(ans)}`
    ]
  };
}
genCompositeArea.levels = ['hard'];

/* ============================================================
   ۹) FRACTION GENERATORS
   ============================================================ */
function makeFracChoices(correct, genWrong, count = 3) {
  const opts = [correct];
  let attempts = 0;
  while (opts.length < count + 1 && attempts < 40) {
    attempts++;
    const w = genWrong();
    if (w && w.d != null && w.d !== 0 && !opts.some(o => fracEq(o, w)) && fracVal(w) >= 0) opts.push(w);
  }
  while (opts.length < count + 1) {
    const nn = ri(1, 12), dd = ri(2, 12);
    const w = { n: nn, d: dd };
    if (!opts.some(o => fracEq(o, w))) opts.push(w);
  }
  return shuffle(opts);
}

function genFracAdd(diff) {
  const sameDen = diff === 'easy';
  const maxD = diff === 'hard' ? 12 : 8;
  let d1, d2;
  if (sameDen) { d1 = d2 = ri(3, maxD); } else { d1 = ri(2, maxD); d2 = ri(2, maxD); }
  const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  const a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  const ans = fracAdd(a, b);
  const choices = makeFracChoices(ans, () => {
    const dd1 = ri(2, maxD), dd2 = ri(2, maxD);
    return fracAdd({ n: ri(1, dd1 - 1), d: dd1 }, { n: ri(1, dd2 - 1), d: dd2 });
  });
  const L = lcm(a.d, b.d);
  return {
    topic: 'fractions', key: 'frac-add',
    prompt: `حاصل جمع مقابل کدام است؟`,
    promptHTML: eq(`${fracHTML(a)} + ${fracHTML(b)} = ?`),
    type: 'choice', choices, correct: ans,
    steps: sameDen ? [
      'مخرج‌ها مساوی؛ فقط صورت‌ها را جمع می‌کنیم.',
      `${eq(`${fa(n1)} + ${fa(n2)}`)} = ${fa(n1 + n2)} — نتیجه ${fracHTML(ans)}`
    ] : [
      `مخرج مشترک: ${fa(L)}`,
      `${fracHTML(a)} + ${fracHTML(b)} = ${fracHTML(ans)}`
    ]
  };
}
genFracAdd.levels = ['easy', 'medium', 'hard'];

function genFracSub(diff) {
  const sameDen = diff === 'easy';
  const maxD = diff === 'hard' ? 12 : 8;
  let d1, d2;
  if (sameDen) { d1 = d2 = ri(3, maxD); } else { d1 = ri(2, maxD); d2 = ri(2, maxD); }
  let n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  let a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  if (sameDen) { if (n1 < n2) { [n1, n2] = [n2, n1]; a = { n: n1, d: d1 }; b = { n: n2, d: d2 }; } }
  else { if (fracVal(a) < fracVal(b)) [a, b] = [b, a]; }
  const ans = fracSub(a, b);
  const choices = makeFracChoices(ans, () => {
    const dd1 = ri(2, maxD), dd2 = ri(2, maxD);
    const f1 = { n: ri(1, dd1 - 1), d: dd1 }, f2 = { n: ri(1, dd2 - 1), d: dd2 };
    return fracVal(f1) > fracVal(f2) ? fracSub(f1, f2) : fracSub(f2, f1);
  });
  const L = lcm(a.d, b.d);
  return {
    topic: 'fractions', key: 'frac-sub',
    prompt: `حاصل تفریق مقابل کدام است؟`,
    promptHTML: eq(`${fracHTML(a)} − ${fracHTML(b)} = ?`),
    type: 'choice', choices, correct: ans,
    steps: sameDen ? [
      'مخرج‌ها مساوی؛ صورت‌ها را کم می‌کنیم.',
      `${eq(`${fa(a.n)} − ${fa(b.n)}`)} = ${fa(a.n - b.n)} — نتیجه ${fracHTML(ans)}`
    ] : [
      `مخرج مشترک: ${fa(L)}`,
      `${fracHTML(a)} − ${fracHTML(b)} = ${fracHTML(ans)}`
    ]
  };
}
genFracSub.levels = ['easy', 'medium', 'hard'];

function genFracMul(diff) {
  const maxD = diff === 'hard' ? 10 : 8;
  const a = { n: ri(1, 8), d: ri(2, maxD) };
  const b = { n: ri(1, 8), d: ri(2, maxD) };
  const ans = fracMul(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 12), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-mul',
    prompt: `حاصل ضرب کسرها کدام است؟`,
    promptHTML: eq(`${fracHTML(a)} × ${fracHTML(b)} = ?`),
    type: 'choice', choices, correct: ans,
    steps: [
      'در ضرب، صورت‌ها در هم و مخرج‌ها در هم ضرب می‌شوند.',
      `= ${fracHTML({ n: a.n * b.n, d: a.d * b.d })}`,
      `ساده‌شده: ${fracHTML(ans)}`
    ]
  };
}
genFracMul.levels = ['medium', 'hard'];

function genFracDiv(diff) {
  const maxD = diff === 'hard' ? 10 : 8;
  const a = { n: ri(1, 8), d: ri(2, maxD) };
  const b = { n: ri(1, 8), d: ri(2, maxD) };
  const ans = fracDiv(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 12), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-div',
    prompt: `حاصل تقسیم کسرها کدام است؟`,
    promptHTML: eq(`${fracHTML(a)} ÷ ${fracHTML(b)} = ?`),
    type: 'choice', choices, correct: ans,
    steps: [
      'در تقسیم، کسر دوم را معکوس کرده و ضرب می‌کنیم.',
      `${fracHTML(a)} ÷ ${fracHTML(b)} = ${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })}`,
      `= ${fracHTML(ans)}`
    ]
  };
}
genFracDiv.levels = ['hard'];

function genFracSimplify(diff) {
  let a, ans, guard = 0;
  do {
    const base = { n: ri(2, 8), d: ri(2, 9) };
    const k = diff === 'hard' ? ri(3, 6) : ri(2, 4);
    a = { n: base.n * k, d: base.d * k };
    ans = simplify(a.n, a.d);
    guard++;
  } while (ans.n === a.n && ans.d === a.d && guard < 20);
  const choices = makeFracChoices(ans, () => ({ n: ri(2, 12), d: ri(2, 12) }));
  return {
    topic: 'fractions', key: 'frac-simplify',
    prompt: `کسر مقابل را ساده کنید:`,
    promptHTML: fracHTML(a),
    type: 'choice', choices, correct: ans,
    steps: [
      `ب.م.م صورت و مخرج: ${fa(gcd(a.n, a.d))}`,
      `صورت و مخرج را بر ${fa(gcd(a.n, a.d))} تقسیم می‌کنیم.`,
      `نتیجه: ${fracHTML(ans)}`
    ]
  };
}
genFracSimplify.levels = ['easy', 'medium', 'hard'];

function genFracCompare(diff) {
  let d1, d2, n1, n2, a, b, guard = 0;
  const maxD = diff === 'hard' ? 15 : 10;
  do {
    d1 = ri(3, maxD); d2 = ri(3, maxD);
    n1 = ri(1, d1 - 1); n2 = ri(1, d2 - 1);
    a = { n: n1, d: d1 }; b = { n: n2, d: d2 };
    guard++;
  } while (fracVal(a) === fracVal(b) && guard < 20);
  const correct = fracVal(a) > fracVal(b) ? '>' : '<';
  const L = lcm(d1, d2);
  return {
    topic: 'fractions', key: 'frac-cmp',
    prompt: `کدام علامت رابطه زیر را درست می‌کند؟`,
    promptHTML: `${fracHTML(a)} &nbsp; ? &nbsp; ${fracHTML(b)}`,
    type: 'choice',
    choices: [
      { n: '>', d: null, isSym: true },
      { n: '<', d: null, isSym: true },
      { n: '=', d: null, isSym: true }
    ],
    correct: { n: correct, d: null, isSym: true },
    steps: [
      `مخرج مشترک: ${fa(L)}`,
      `${fracHTML({ n: a.n * L / d1, d: L })} و ${fracHTML({ n: b.n * L / d2, d: L })}`,
      `${fracHTML(a)} ${correct === '>' ? '&gt;' : '&lt;'} ${fracHTML(b)}`
    ]
  };
}
genFracCompare.levels = ['easy', 'medium', 'hard'];

function genMixedToImproper(diff) {
  const whole = ri(1, diff === 'hard' ? 5 : 3), d = ri(2, 8), n = ri(1, d - 1);
  const imp = { n: whole * d + n, d };
  const choices = makeFracChoices(imp, () => ({ n: ri(2, 40), d: ri(2, 9) }));
  return {
    topic: 'fractions', key: 'mixed-imp',
    prompt: `عدد مخلوط زیر را به کسر تبدیل کنید:`,
    promptHTML: `${fa(whole)}${fracHTML({ n, d })}`,
    type: 'choice', choices, correct: imp,
    steps: [
      'صورت = (عدد صحیح × مخرج) + صورت',
      `= ${eq(`(${fa(whole)} × ${fa(d)}) + ${fa(n)}`)} = ${fa(whole * d + n)}`,
      `کسر: ${fracHTML(imp)}`
    ]
  };
}
genMixedToImproper.levels = ['medium', 'hard'];

function genWordFrac(diff) {
  const d = ri(3, 8);
  const n = ri(1, d - 1);
  const total = d * ri(2, 6);
  const ans = (total / d) * n;
  const ctx = pick(CTX_FR);
  return {
    topic: 'fractions', key: 'frac-word',
    prompt: `${ctx.name} ${fracHTML({ n, d })} از ${fa(total)} ${ctx.u} را ${ctx.verb}. ${ctx.q}`,
    type: 'numeric', answer: ans, unit: ctx.u,
    steps: [
      `ابتدا یک قسمت از ${fa(d)}: ${eq(`${fa(total)} ÷ ${fa(d)}`)} = ${fa(total / d)}`,
      `حالا ${fa(n)} قسمت: ${eq(`${fa(n)} × ${fa(total / d)}`)} = ${fa(ans)}${pct(ctx.u)}`
    ]
  };
}
genWordFrac.levels = ['hard'];

/* ============================================================
   ۱۰) DECIMALS GENERATORS
   ============================================================ */
function genDecAdd(diff) {
  const cfg = { easy: [1, 9, 1], medium: [5, 30, 2], hard: [10, 80, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const n2 = round(ri(a * 10, b * 10) / 10, dec);
  const ans = round(n1 + n2, dec);
  return {
    topic: 'decimals', key: 'dec-add',
    prompt: `حاصل جمع زیر را محاسبه کنید:`,
    promptHTML: eq(`${faDec(n1, dec)} + ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans,
    steps: [
      'اعداد را زیر هم می‌نویسیم و ممیزها را تراز می‌کنیم.',
      `${eq(`${faDec(n1, dec)} + ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`
    ]
  };
}
genDecAdd.levels = ['easy', 'medium', 'hard'];

function genDecSub(diff) {
  const cfg = { easy: [1, 9, 1], medium: [5, 30, 2], hard: [10, 80, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  let n1 = round(ri(a * 10, b * 10) / 10, dec);
  let n2 = round(ri(a * 10, b * 10) / 10, dec);
  if (n1 < n2) [n1, n2] = [n2, n1];
  const ans = round(n1 - n2, dec);
  return {
    topic: 'decimals', key: 'dec-sub',
    prompt: `حاصل تفریق زیر را محاسبه کنید:`,
    promptHTML: eq(`${faDec(n1, dec)} − ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans,
    steps: [
      'اعداد را زیر هم می‌نویسیم و ممیزها را تراز می‌کنیم.',
      `${eq(`${faDec(n1, dec)} − ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`
    ]
  };
}
genDecSub.levels = ['easy', 'medium', 'hard'];

function genDecMul(diff) {
  const cfg = { medium: [2, 20, 1], hard: [5, 40, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const whole = ri(2, 9);
  const ans = round(n1 * whole, dec);
  return {
    topic: 'decimals', key: 'dec-mul',
    prompt: `حاصل ضرب زیر را محاسبه کنید:`,
    promptHTML: eq(`${faDec(n1, dec)} × ${fa(whole)} = ?`),
    type: 'numeric', answer: ans,
    steps: [
      'بدون ممیز ضرب می‌کنیم، سپس ممیز را برمی‌گردانیم.',
      `${eq(`${faDec(n1, dec)} × ${fa(whole)}`)} = ${faDec(ans, dec)}`
    ]
  };
}
genDecMul.levels = ['medium', 'hard'];

function genDecDiv(diff) {
  const whole = ri(2, 5);
  const ans = round(ri(10, 50) / 10, 1);
  const n1 = round(ans * whole, 1);
  return {
    topic: 'decimals', key: 'dec-div',
    prompt: `حاصل تقسیم زیر را محاسبه کنید:`,
    promptHTML: eq(`${faDec(n1, 1)} ÷ ${fa(whole)} = ?`),
    type: 'numeric', answer: ans,
    steps: [
      'عدد اعشاری را بر عدد صحیح تقسیم می‌کنیم.',
      `${eq(`${faDec(n1, 1)} ÷ ${fa(whole)}`)} = ${faDec(ans, 1)}`
    ]
  };
}
genDecDiv.levels = ['hard'];

function genDecCompare(diff) {
  const dec = diff === 'easy' ? 1 : 2;
  const max = diff === 'hard' ? 999 : diff === 'medium' ? 500 : 99;
  const n1 = round(ri(1, max) / 10, dec);
  let n2 = round(ri(1, max) / 10, dec);
  if (n1 === n2) n2 = round(n1 + 0.1, dec);
  const correct = n1 > n2 ? '>' : '<';
  return {
    topic: 'decimals', key: 'dec-cmp',
    prompt: `کدام علامت رابطه زیر را درست می‌کند؟`,
    promptHTML: eq(`${faDec(n1, dec)} &nbsp; ? &nbsp; ${faDec(n2, dec)}`),
    type: 'choice',
    choices: [
      { n: '>', d: null, isSym: true },
      { n: '<', d: null, isSym: true },
      { n: '=', d: null, isSym: true }
    ],
    correct: { n: correct, d: null, isSym: true },
    steps: [
      'ابتدا قسمت صحیح، سپس رقم‌های اعشار را از چپ به راست مقایسه می‌کنیم.',
      `${eq(`${faDec(n1, dec)} ${correct === '>' ? '&gt;' : '&lt;'} ${faDec(n2, dec)}`)}`
    ]
  };
}
genDecCompare.levels = ['easy', 'medium', 'hard'];

function genFracToDec(diff) {
  const options = [
    { n: 1, d: 2, v: 0.5 }, { n: 1, d: 4, v: 0.25 }, { n: 3, d: 4, v: 0.75 },
    { n: 1, d: 5, v: 0.2 }, { n: 2, d: 5, v: 0.4 }, { n: 3, d: 5, v: 0.6 },
    { n: 1, d: 8, v: 0.125 }, { n: 1, d: 10, v: 0.1 }, { n: 3, d: 10, v: 0.3 }
  ];
  const pool = diff === 'easy' ? options.filter(o => [0.5, 0.25, 0.2, 0.4].includes(o.v)) : options;
  const f = pick(pool);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3);
  const choices = shuffle([
    { n: String(f.v), d: null, isNum: true },
    ...wrong.map(o => ({ n: String(o.v), d: null, isNum: true }))
  ]);
  return {
    topic: 'decimals', key: 'frac-dec',
    prompt: `کسر مقابل را به عدد اعشاری تبدیل کنید:`,
    promptHTML: fracHTML(f),
    type: 'choice', choices, correct: { n: String(f.v), d: null, isNum: true },
    steps: [
      'صورت را بر مخرج تقسیم می‌کنیم:',
      `${eq(`${fa(f.n)} ÷ ${fa(f.d)}`)} = ${faDec(f.v, 3)}`
    ]
  };
}
genFracToDec.levels = ['easy', 'medium', 'hard'];

function genDecToFrac(diff) {
  const options = [
    { n: 1, d: 2, v: '0.5' }, { n: 1, d: 4, v: '0.25' }, { n: 3, d: 4, v: '0.75' },
    { n: 1, d: 5, v: '0.2' }, { n: 2, d: 5, v: '0.4' }, { n: 3, d: 10, v: '0.3' },
    { n: 7, d: 10, v: '0.7' }, { n: 1, d: 10, v: '0.1' }, { n: 9, d: 10, v: '0.9' }
  ];
  const pool = diff === 'easy' ? options.filter(o => ['0.5', '0.1', '0.3', '0.7', '0.9'].includes(o.v)) : options;
  const f = pick(pool);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3).map(o => ({ n: o.n, d: o.d }));
  const choices = shuffle([{ n: f.n, d: f.d }, ...wrong]);
  return {
    topic: 'decimals', key: 'dec-frac',
    prompt: `عدد اعشاری مقابل را به کسر تبدیل کنید:`,
    promptHTML: eq(faDec(f.v, 3)),
    type: 'choice', choices, correct: { n: f.n, d: f.d },
    steps: [
      'مخرج را بر اساس تعداد رقم‌های اعشار می‌نویسیم.',
      `نتیجه: ${fracHTML({ n: f.n, d: f.d })}`
    ]
  };
}
genDecToFrac.levels = ['medium', 'hard'];

function genDecWord(diff) {
  const whole = ri(2, 5);
  const price = round(ri(15, 80) / 10, 1);
  const ans = round(whole * price, 1);
  return {
    topic: 'decimals', key: 'dec-word',
    prompt: `اگر قیمت یک دفتر ${faDec(price, 1)} هزار تومان باشد، قیمت ${fa(whole)} دفتر چقدر می‌شود؟ (به هزار تومان)`,
    type: 'numeric', answer: ans, unit: 'هزار تومان',
    steps: [
      'برای چند برابر، ضرب می‌کنیم.',
      `${eq(`${faDec(price, 1)} × ${fa(whole)}`)} = ${faDec(ans, 1)} هزار تومان`
    ]
  };
}
genDecWord.levels = ['hard'];

/* ============================================================
   ۱۱) GENERATOR POOL
   ============================================================ */
const Generators = {
  perimeter: [genSquarePerimeter, genRectPerimeter, genTrianglePerimeter, genCirclePerimeter, genParallelogramPerimeter, genRhombusPerimeter, genPolygonPerimeter, genFindSideFromPerimeter],
  area: [genSquareArea, genRectArea, genTriangleArea, genCircleArea, genParallelogramArea, genRhombusArea, genTrapezoidArea, genCompositeArea],
  fractions: [genFracAdd, genFracSub, genFracMul, genFracDiv, genFracSimplify, genFracCompare, genMixedToImproper, genWordFrac],
  decimals: [genDecAdd, genDecSub, genDecMul, genDecDiv, genDecCompare, genFracToDec, genDecToFrac, genDecWord]
};

function generateQuestion(topic, difficulty) {
  const all = Generators[topic] || [];
  let pool = all.filter(g => g.levels && g.levels.includes(difficulty));
  if (!pool.length) pool = all;
  return pick(pool)(difficulty);
}

/* ============================================================
   ۱۲) GAMIFICATION
   ============================================================ */
const BADGES = [
  { id: 'first', emoji: '🎯', name: 'اولین قدم', desc: 'اولین پاسخ درست' },
  { id: 'streak5', emoji: '🔥', name: '۵ تایی', desc: '۵ پاسخ درست پشت‌سرهم' },
  { id: 'streak10', emoji: '⚡', name: '۱۰ تایی', desc: '۱۰ پاسخ درست پشت‌سرهم' },
  { id: 'coin100', emoji: '💰', name: 'پولدار', desc: '۱۰۰ سکه' },
  { id: 'star20', emoji: '⭐', name: 'ستاره‌چین', desc: '۲۰ ستاره' },
  { id: 'level5', emoji: '🏅', name: 'سطح ۵', desc: 'رسیدن به سطح ۵' },
  { id: 'master', emoji: '🧠', name: 'استاد', desc: '۲۰ پاسخ درست' },
  { id: 'perfect', emoji: '💎', name: 'بی‌نقص', desc: 'آزمون ۱۰۰٪' }
];

function awardCorrect(streak) {
  const s = activeStudent();
  if (!s) return;
  s.stats.xp += 10 + Math.min(streak, 10) * 2;
  s.stats.coins += 1 + Math.floor(streak / 3);
  s.stats.stars += streak >= 3 ? 1 : 0;
  checkLevelUp();
  checkBadges();
  saveState();
}
function checkLevelUp() {
  const s = activeStudent();
  if (!s) return;
  const newLevel = Math.floor(s.stats.xp / 100) + 1;
  if (newLevel > s.stats.level) {
    s.stats.level = newLevel;
    sound.levelUp();
    showFloat(`🎉 تبریک! به سطح ${fa(newLevel)} رسیدی!`);
  }
}
/* ✅ FIXED: پیام تجمیعی برای نشان‌ها */
function checkBadges() {
  const s = activeStudent();
  if (!s) return;
  let count = 0;
  const add = id => {
    if (!s.stats.badges.includes(id)) {
      s.stats.badges.push(id);
      count++;
    }
  };
  if (s.stats.totalCorrect >= 1) add('first');
  if (s.stats.bestStreak >= 5) add('streak5');
  if (s.stats.bestStreak >= 10) add('streak10');
  if (s.stats.coins >= 100) add('coin100');
  if (s.stats.stars >= 20) add('star20');
  if (s.stats.level >= 5) add('level5');
  if (s.stats.totalCorrect >= 20) add('master');
  if (count > 0) showFloat(count === 1 ? '🏆 نشان جدید گرفتی!' : `🏆 ${fa(count)} نشان جدید!`);
}
/* ✅ FIXED: offset پویا برای جلوگیری از همپوشانی */
let floatSlot = 0;
function showFloat(text) {
  const offset = 80 + (floatSlot % 3) * 60;
  floatSlot++;
  const el = document.createElement('div');
  el.className = 'float-reward';
  el.textContent = text;
  el.style.top = offset + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

/* ============================================================
   ۱۳) ROUTER
   ============================================================ */
let route = { name: 'home', params: {} };
let session = null;
let examTimer = null;

function navigate(name, params = {}) {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  /* ✅ FIXED: پاک کردن session در خروج از تمرین/آزمون */
  if (session && (name === 'students' || name === 'addStudent' || name === 'home')) {
    session = null;
  }
  route = { name, params };
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ۱۴) COMMON
   ============================================================ */
const app = document.getElementById('app');

/* ✅ FIXED: escHtml در title */
function header(title, showBack = false) {
  const s = activeStudent();
  return `
  <div class="top-bar">
    ${showBack
      ? `<button class="icon-btn back-btn" onclick="window.__goBack()" aria-label="بازگشت">➜</button>`
      : `<span style="width:44px"></span>`}
    <h1>${title}</h1>
    <div class="chips">
      ${s ? `<span class="chip" title="${escHtml(fullName(s))}">👤 ${fa(s.stats.coins)} 🪙</span>` : ''}
      ${s ? `<span class="chip" title="ستاره">⭐ ${fa(s.stats.stars)}</span>` : ''}
    </div>
  </div>`;
}

function bottomNav() {
  const items = [
    { id: 'home', ico: '🏠', label: 'خانه' },
    { id: 'perimeter', ico: '📏', label: 'محیط' },
    { id: 'area', ico: '📐', label: 'مساحت' },
    { id: 'fractions', ico: '🍰', label: 'کسر' },
    { id: 'decimals', ico: '🔢', label: 'اعشار' },
    { id: 'progress', ico: '📊', label: 'پیشرفت' }
  ];
  return `<nav class="bottom-nav" aria-label="ناوبری">${items.map(it => `
    <button class="nav-btn ${route.name === it.id ? 'active' : ''}" onclick="window.__nav('${it.id}')" aria-label="${it.label}">
      <span class="ico">${it.ico}</span>
      <span>${it.label}</span>
    </button>
  `).join('')}</nav>`;
}

/* ============================================================
   ۱۵) STUDENT MANAGEMENT
   ============================================================ */
function viewStudents() {
  const hasStudents = state.students.length > 0;
  return `
  ${header('👥 دانش‌آموزان')}
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:3.5rem">👨‍🎓</div>
    <h2 style="margin:8px 0">${hasStudents ? 'یک دانش‌آموز را انتخاب کن' : 'خوش آمدی!'}</h2>
    <p style="color:var(--muted);margin:0">${hasStudents ? 'برای شروع، یکی از پروفایل‌ها را انتخاب کن.' : 'برای شروع، اولین دانش‌آموز را اضافه کن.'}</p>
  </div>
  ${hasStudents ? `
    <div class="grid">
      ${state.students.map(s => `
        <div class="card student-card" onclick="window.__selectStudent('${s.id}')" role="button" tabindex="0">
          <div class="student-avatar">${escHtml((s.name[0] || '؟'))}</div>
          <div class="student-info">
            <p class="student-name">${escHtml(fullName(s))}</p>
            <p class="student-meta">پایه ${fa(s.grade)} — سطح ${fa(s.stats.level)} — ${fa(s.stats.totalCorrect)} پاسخ درست</p>
          </div>
          <div style="color:var(--primary);font-size:1.4rem">➜</div>
        </div>
      `).join('')}
    </div>
  ` : ''}
  <button class="btn full" style="margin-top:16px" onclick="window.__nav('addStudent')">
    ➕ افزودن دانش‌آموز جدید
  </button>
  `;
}

function viewAddStudent() {
  return `
  ${header('➕ دانش‌آموز جدید', true)}
  <div class="card">
    <label style="display:block;margin-bottom:12px">
      <span style="font-weight:600;font-size:.9rem">نام:</span>
      <input type="text" id="stuName" class="num-input" style="text-align:right;font-size:1rem;font-weight:400" placeholder="مثلاً علی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:12px">
      <span style="font-weight:600;font-size:.9rem">نام خانوادگی:</span>
      <input type="text" id="stuFamily" class="num-input" style="text-align:right;font-size:1rem;font-weight:400" placeholder="مثلاً محمدی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:12px">
      <span style="font-weight:600;font-size:.9rem">پایه تحصیلی:</span>
      <select id="stuGrade" class="num-input" style="text-align:right">
        ${[4, 5, 6, 7, 8, 9].map(g => `<option value="${g}" ${g === 6 ? 'selected' : ''}>پایه ${fa(g)}</option>`).join('')}
      </select>
    </label>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__createStudent()">
    ✅ ساخت پروفایل
  </button>
  ${bottomNav()}`;
}

/* ============================================================
   ۱۶) HOME / TOPIC
   ============================================================ */
function viewHome() {
  const s = activeStudent();
  return `
  ${header('ریاضی‌یار 🎓')}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('perimeter')" aria-label="محیط">
      <span class="icon-big">📏</span>
      <h3 class="card-title">محیط</h3>
      <p class="card-desc">دور شکل‌های هندسی</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('area')" aria-label="مساحت">
      <span class="icon-big">📐</span>
      <h3 class="card-title">مساحت</h3>
      <p class="card-desc">سطح داخل شکل‌ها</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('fractions')" aria-label="کسرها">
      <span class="icon-big">🍰</span>
      <h3 class="card-title">کسرها</h3>
      <p class="card-desc">جمع، تفریق، ضرب و تقسیم</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('decimals')" aria-label="اعداد اعشاری">
      <span class="icon-big">🔢</span>
      <h3 class="card-title">اعداد اعشاری</h3>
      <p class="card-desc">مفهوم، عملیات و تبدیل</p>
    </button>
  </div>
  <div style="margin-top:14px" class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت من</h3>
      <p class="card-desc">نمودار و نشان‌ها</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('students')" aria-label="تغییر دانش‌آموز">
      <span class="icon-big">👥</span>
      <h3 class="card-title">تغییر دانش‌آموز</h3>
      <p class="card-desc">${s ? escHtml(fullName(s)) : '—'}</p>
    </button>
  </div>
  <div style="margin-top:14px" class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('teacher')" aria-label="معلم">
      <span class="icon-big">👨‍🏫</span>
      <h3 class="card-title">معلم / والد</h3>
      <p class="card-desc">آزمون سفارشی</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('settings')" aria-label="تنظیمات">
      <span class="icon-big">⚙️</span>
      <h3 class="card-title">تنظیمات</h3>
      <p class="card-desc">صدا، سختی، اعداد</p>
    </button>
  </div>
  ${bottomNav()}`;
}

function viewTopic(topic) {
  const titles = { perimeter: '📏 محیط', area: '📐 مساحت', fractions: '🍰 کسرها', decimals: '🔢 اعداد اعشاری' };
  return `
  ${header(titles[topic], true)}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('learn', {topic:'${topic}'})" aria-label="آموزش">
      <span class="icon-big">📚</span>
      <h3 class="card-title">آموزش</h3>
      <p class="card-desc">درسنامه کامل با مثال</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('practice', {topic:'${topic}'})" aria-label="تمرین">
      <span class="icon-big">✏️</span>
      <h3 class="card-title">تمرین</h3>
      <p class="card-desc">سوال بی‌نهایت</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('examSetup', {topic:'${topic}'})" aria-label="آزمون">
      <span class="icon-big">🎯</span>
      <h3 class="card-title">آزمون</h3>
      <p class="card-desc">با کارنامه</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت</h3>
      <p class="card-desc">درصد تسلط</p>
    </button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۱۷) LESSONS DATA (غنی)
   ============================================================ */
const LESSONS = {
  perimeter: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛',
      formula: 'محیط = ۴ × ضلع',
      paragraphs: [
        'مربع شکلی است که چهار ضلع آن با هم مساوی‌اند و همه‌ی زوایایش قائمه (۹۰ درجه) هستند. محیط یعنی «دور تا دور» شکل.',
        'چون هر چهار ضلع مربع با هم مساوی‌اند، برای محاسبه‌ی محیط کافی است طول یک ضلع را در ۴ ضرب کنیم.'
      ],
      examples: [
        {
          text: 'مربعی با ضلع ۵ سانتی‌متر داریم. محیط آن چقدر است؟',
          shape: Shapes.square(5),
          steps: ['فرمول: محیط = ۴ × ضلع', 'محیط = ۴ × ۵', 'محیط = ۲۰'],
          answer: 'محیط = ۲۰ سانتی‌متر'
        },
        {
          text: 'زمین بازی مربعی به ضلع ۸ متر. اگر یک دور کامل دور آن بدویم، چند متر دویده‌ایم؟',
          shape: Shapes.square(8),
          steps: ['دور کامل = محیط مربع', 'محیط = ۴ × ۸', 'محیط = ۳۲'],
          answer: '۳۲ متر دویده‌ایم'
        },
        {
          text: 'محیط مربعی ۳۶ سانتی‌متر است. ضلع آن چقدر است؟',
          shape: Shapes.square('?'),
          steps: ['می‌دانیم: محیط = ۴ × ضلع', 'پس ضلع = محیط ÷ ۴', 'ضلع = ۳۶ ÷ ۴ = ۹'],
          answer: 'ضلع = ۹ سانتی‌متر'
        }
      ],
      tips: [
        'همیشه واحد اندازه‌گیری را در جواب بنویس.',
        'اگر محیط را داری و ضلع را می‌خواهی، تقسیم بر ۴ کن.'
      ],
      pitfalls: [
        'اشتباه رایج: بعضی‌ها فکر می‌کنند محیط مربع = ضلع × ضلع. این فرمول مساحت است، نه محیط!'
      ]
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭',
      formula: 'محیط = ۲ × (طول + عرض)',
      paragraphs: [
        'مستطیل شکلی است با چهار ضلع که اضلاع روبه‌رو با هم مساوی و موازی‌اند.',
        'برای محاسبه‌ی محیط، طول و عرض را با هم جمع می‌کنیم و حاصل را در ۲ ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'مستطیلی با طول ۷ و عرض ۴ سانتی‌متر. محیط آن چقدر است؟',
          shape: Shapes.rectangle(7, 4),
          steps: ['فرمول: محیط = ۲ × (طول + عرض)', 'محیط = ۲ × (۷ + ۴)', 'محیط = ۲ × ۱۱ = ۲۲'],
          answer: 'محیط = ۲۲ سانتی‌متر'
        },
        {
          text: 'استخری مستطیلی به طول ۲۰ و عرض ۱۰ متر. برای نصب حفاظ دور آن چقدر حفاظ لازم است؟',
          shape: Shapes.rectangle(20, 10),
          steps: ['دور کامل = محیط', 'محیط = ۲ × (۲۰ + ۱۰)', 'محیط = ۲ × ۳۰ = ۶۰'],
          answer: '۶۰ متر حفاظ لازم است'
        },
        {
          text: 'محیط مستطیلی ۴۰ سانتی‌متر و طول آن ۱۲ است. عرض چقدر است؟',
          steps: ['محیط = ۲ × (طول + عرض)', '۴۰ = ۲ × (۱۲ + عرض)', '۲۰ = ۱۲ + عرض', 'عرض = ۸'],
          answer: 'عرض = ۸ سانتی‌متر'
        }
      ],
      tips: [
        'وقتی محیط را داری و یکی از اضلاع مجهول است، ابتدا محیط را بر ۲ تقسیم کن.',
        'اضلاع روبه‌رو در مستطیل همیشه مساوی‌اند.'
      ],
      pitfalls: [
        'اشتباه رایج: جمع کردن همه‌ی اضلاع به‌جای استفاده از فرمول ضرب در ۲.'
      ]
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺',
      formula: 'محیط = ضلع۱ + ضلع۲ + ضلع۳',
      paragraphs: [
        'مثلث شکلی است با سه ضلع و سه زاویه. برخلاف مربع و مستطیل، اضلاع مثلث می‌توانند هر اندازه‌ای داشته باشند.',
        'محیط مثلث، مجموع طول سه ضلع آن است. همچنین نکته‌ی مهم این است که در هر مثلث، مجموع دو ضلع همیشه باید از ضلع سوم بزرگ‌تر باشد، وگرنه مثلث ساخته نمی‌شود.'
      ],
      examples: [
        {
          text: 'مثلثی با اضلاع ۶، ۸ و ۱۰ سانتی‌متر. محیط آن چقدر است؟',
          shape: Shapes.triangle(6, 8, 10),
          steps: ['محیط = جمع سه ضلع', 'محیط = ۶ + ۸ + ۱۰', 'محیط = ۲۴'],
          answer: 'محیط = ۲۴ سانتی‌متر'
        },
        {
          text: 'زمینی مثلثی با اضلاع ۱۵، ۲۰ و ۲۵ متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: Shapes.triangle(15, 20, 25),
          steps: ['محیط = ۱۵ + ۲۰ + ۲۵', 'محیط = ۶۰'],
          answer: '۶۰ متر نرده لازم است'
        },
        {
          text: 'آیا می‌توان مثلثی با اضلاع ۳، ۴ و ۸ ساخت؟',
          steps: ['شرط مثلث: مجموع دو ضلع > ضلع سوم', '۳ + ۴ = ۷ < ۸', 'پس این مثلث ساخته نمی‌شود!'],
          answer: 'خیر، ساخته نمی‌شود'
        }
      ],
      tips: [
        'برای محاسبه‌ی محیط مثلث، فقط سه ضلع را با هم جمع کن.',
        'اگر مجموع دو ضلع کوچک‌تر از ضلع بزرگ‌تر باشد، آن مثلث وجود ندارد.'
      ],
      pitfalls: [
        'اشتباه رایج: فکر می‌کنند همه‌ی اضلاع مثلث باید مساوی باشند. نه! مثلث می‌تواند اضلاع نامساوی داشته باشد.'
      ]
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪',
      formula: 'محیط = ۲ × π × شعاع',
      paragraphs: [
        'دایره مجموعه‌ای از نقاط است که همه‌شان از یک نقطه‌ی مرکزی به یک اندازه فاصله دارند. این فاصله را «شعاع» می‌نامیم. قطر = ۲ × شعاع.',
        'محیط دایره از فرمول خاصی به دست می‌آید که در آن عدد ثابتی به‌نام π (پی) نقش دارد. مقدار π تقریباً ۳٫۱۴ است.'
      ],
      examples: [
        {
          text: 'دایره‌ای با شعاع ۵ سانتی‌متر. محیط آن چقدر است؟ (π ≈ ۳٫۱۴)',
          shape: Shapes.circle(5),
          steps: ['فرمول: محیط = ۲ × π × شعاع', 'محیط = ۲ × ۳٫۱۴ × ۵', 'محیط = ۳۱٫۴'],
          answer: 'محیط ≈ ۳۱٫۴ سانتی‌متر'
        },
        {
          text: 'دایره‌ای به قطر ۱۰ متر. محیط آن چقدر است؟',
          shape: Shapes.circle(5),
          steps: ['قطر = ۱۰، پس شعاع = ۵', 'محیط = ۲ × ۳٫۱۴ × ۵', 'محیط = ۳۱٫۴'],
          answer: 'محیط ≈ ۳۱٫۴ متر'
        }
      ],
      tips: [
        'اگر قطر را داری، اول آن را بر ۲ تقسیم کن تا شعاع به دست بیاید.',
        'در جواب‌ها به‌جای π عدد ۳٫۱۴ بگذار.'
      ],
      pitfalls: [
        'اشتباه رایج: استفاده از قطر به‌جای شعاع در فرمول.'
      ]
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱',
      formula: 'محیط = ۲ × (ضلع بزرگ + ضلع کوچک)',
      paragraphs: [
        'متوازی‌الاضلاع شکلی چهارضلعی است که اضلاع روبه‌روی آن موازی و مساوی‌اند، ولی زوایایش قائمه نیستند.',
        'چون اضلاع روبه‌رو مساوی‌اند، محیط برابر است با دو برابر مجموع دو ضلع مجاور.'
      ],
      examples: [
        {
          text: 'متوازی‌الاضلاعی با اضلاع ۹ و ۶ سانتی‌متر. محیط آن چقدر است؟',
          shape: Shapes.parallelogram(9, 6),
          steps: ['محیط = ۲ × (ضلع بزرگ + ضلع کوچک)', 'محیط = ۲ × (۹ + ۶)', 'محیط = ۳۰'],
          answer: 'محیط = ۳۰ سانتی‌متر'
        },
        {
          text: 'زمین کشاورزی متوازی‌الاضلاع با اضلاع ۱۲ و ۸ متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: Shapes.parallelogram(12, 8),
          steps: ['محیط = ۲ × (۱۲ + ۸)', 'محیط = ۲ × ۲۰ = ۴۰'],
          answer: '۴۰ متر نرده لازم است'
        }
      ],
      tips: [
        'برای محیط، ارتفاع و زوایا نقشی ندارند — فقط دو ضلع مجاور را لازم داری.'
      ],
      pitfalls: [
        'اشتباه رایج: قاطی کردن اضلاع با ارتفاع. ارتفاع برای مساحت لازم است، نه محیط.'
      ]
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆',
      formula: 'محیط = ۴ × ضلع',
      paragraphs: [
        'لوزی یک متوازی‌الاضلاع خاص است که همه‌ی اضلاعش با هم مساوی‌اند. مثل یک مربع که کج شده باشد.',
        'چون هر چهار ضلع لوزی برابرند، محیط آن هم مانند مربع از فرمول ۴ × ضلع به دست می‌آید.'
      ],
      examples: [
        {
          text: 'لوزی به ضلع ۶ سانتی‌متر. محیط آن چقدر است؟',
          shape: Shapes.rhombusSide(6),
          steps: ['فرمول: محیط = ۴ × ضلع', 'محیط = ۴ × ۶', 'محیط = ۲۴'],
          answer: 'محیط = ۲۴ سانتی‌متر'
        },
        {
          text: 'باغچه‌ای لوزی‌شکل به ضلع ۵ متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: Shapes.rhombusSide(5),
          steps: ['محیط = ۴ × ۵', 'محیط = ۲۰'],
          answer: '۲۰ متر نرده لازم است'
        }
      ],
      tips: [
        'قطرهای لوزی برای محاسبه‌ی مساحت لازم‌اند، ولی برای محیط فقط ضلع را لازم داری.'
      ],
      pitfalls: [
        'اشتباه رایج: استفاده از قطرها برای محاسبه‌ی محیط.'
      ]
    },
    {
      id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟',
      formula: 'محیط = تعداد ضلع × طول یک ضلع',
      paragraphs: [
        'چندضلعی منتظم شکلی است که همه‌ی اضلاعش مساوی و همه‌ی زوایایش برابرند.',
        'برای محاسبه‌ی محیط، فقط کافی است تعداد ضلع‌ها را در طول یک ضلع ضرب کنیم.'
      ],
      examples: [
        {
          text: 'شش‌ضلعی منتظمی با ضلع ۵ سانتی‌متر. محیط آن چقدر است؟',
          shape: Shapes.regularPolygon(6, 5),
          steps: ['تعداد ضلع = ۶', 'محیط = ۶ × ۵', 'محیط = ۳۰'],
          answer: 'محیط = ۳۰ سانتی‌متر'
        },
        {
          text: 'باغ گلی پنج‌ضلعی منتظم به ضلع ۴ متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: Shapes.regularPolygon(5, 4),
          steps: ['تعداد ضلع = ۵', 'محیط = ۵ × ۴', 'محیط = ۲۰'],
          answer: '۲۰ متر نرده لازم است'
        }
      ],
      tips: [
        'نام شکل به تو می‌گوید چند ضلع دارد: پنج‌ضلعی = ۵، شش‌ضلعی = ۶، هشت‌ضلعی = ۸.'
      ],
      pitfalls: [
        'اشتباه رایج: فراموش کردن تعداد ضلع.'
      ]
    }
  ],
  area: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛',
      formula: 'مساحت = ضلع × ضلع',
      paragraphs: [
        'مساحت یعنی مقدار سطحی که شکل اشغال می‌کند. برخلاف محیط که «دور تا دور» را می‌سنجد، مساحت «درون» شکل را اندازه می‌گیرد.',
        'برای مربع، مساحت با ضرب ضلع در خودش به دست می‌آید.'
      ],
      examples: [
        {
          text: 'مربعی با ضلع ۶ سانتی‌متر. مساحت آن چقدر است؟',
          shape: Shapes.square(6),
          steps: ['فرمول: مساحت = ضلع × ضلع', 'مساحت = ۶ × ۶', 'مساحت = ۳۶'],
          answer: 'مساحت = ۳۶ سانتی‌متر مربع'
        },
        {
          text: 'اتاقی مربعی به ضلع ۴ متر. برای سنگ‌فرش آن چند متر مربع سنگ لازم است؟',
          shape: Shapes.square(4),
          steps: ['مساحت = ۴ × ۴', 'مساحت = ۱۶'],
          answer: '۱۶ متر مربع سنگ لازم است'
        },
        {
          text: 'مساحت مربعی ۴۹ سانتی‌متر مربع است. ضلع آن چقدر است؟',
          shape: Shapes.square('?'),
          steps: ['مساحت = ضلع²', '۴۹ = ضلع²', 'ضلع = √۴۹ = ۷'],
          answer: 'ضلع = ۷ سانتی‌متر'
        }
      ],
      tips: [
        'واحد مساحت همیشه «مربع» دارد: سانتی‌متر مربع، متر مربع.',
        'برای پیدا کردن ضلع از مساحت، جذر بگیر.'
      ],
      pitfalls: [
        'اشتباه رایج: اشتباه گرفتن محیط و مساحت.'
      ]
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭',
      formula: 'مساحت = طول × عرض',
      paragraphs: [
        'مساحت مستطیل با ضرب طول در عرض به دست می‌آید.',
        'این فرمول خیلی کاربردی است — مثلاً برای حساب کردن متراژ یک اتاق یا اندازه‌ی زمین کشاورزی.'
      ],
      examples: [
        {
          text: 'مستطیلی با طول ۷ و عرض ۴. مساحت آن چقدر است؟',
          shape: Shapes.rectangle(7, 4),
          steps: ['فرمول: مساحت = طول × عرض', 'مساحت = ۷ × ۴', 'مساحت = ۲۸'],
          answer: 'مساحت = ۲۸ سانتی‌متر مربع'
        },
        {
          text: 'زمین فوتبالی به طول ۱۰۰ و عرض ۶۰ متر. مساحتش چقدر است؟',
          shape: Shapes.rectangle(100, 60),
          steps: ['مساحت = ۱۰۰ × ۶۰', 'مساحت = ۶۰۰۰'],
          answer: 'مساحت = ۶۰۰۰ متر مربع'
        },
        {
          text: 'جلد کتابی به طول ۲۴ و عرض ۱۷ سانتی‌متر. مساحت جلد چقدر است؟',
          shape: Shapes.rectangle(24, 17),
          steps: ['مساحت = ۲۴ × ۱۷', 'مساحت = ۴۰۸'],
          answer: 'مساحت = ۴۰۸ سانتی‌متر مربع'
        }
      ],
      tips: [
        'طول و عرض را می‌شود جابجا کرد — نتیجه یکی است.',
        'اگر مساحت و یک ضلع را داری، ضلع دیگر = مساحت ÷ ضلع معلوم.'
      ],
      pitfalls: [
        'اشتباه رایج: جمع کردن طول و عرض به‌جای ضرب کردن.'
      ]
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺',
      formula: 'مساحت = (قاعده × ارتفاع) ÷ ۲',
      paragraphs: [
        'مساحت مثلث نصف مساحت مستطیلی است که مثلث در آن جا می‌شود.',
        '«قاعده» یکی از اضلاع است و «ارتفاع» فاصله‌ی عمودی از رأس مقابل تا آن قاعده.'
      ],
      examples: [
        {
          text: 'مثلثی با قاعده ۸ و ارتفاع ۵. مساحت آن چقدر است؟',
          shape: Shapes.triangleBH(8, 5),
          steps: ['فرمول: مساحت = (قاعده × ارتفاع) ÷ ۲', 'مساحت = (۸ × ۵) ÷ ۲', 'مساحت = ۴۰ ÷ ۲ = ۲۰'],
          answer: 'مساحت = ۲۰ سانتی‌متر مربع'
        },
        {
          text: 'تابلوی مثلثی با قاعده ۱۰ و ارتفاع ۶ متر. مساحتش چقدر است؟',
          shape: Shapes.triangleBH(10, 6),
          steps: ['مساحت = (۱۰ × ۶) ÷ ۲', 'مساحت = ۶۰ ÷ ۲ = ۳۰'],
          answer: 'مساحت = ۳۰ متر مربع'
        }
      ],
      tips: [
        'ارتفاع همیشه عمود بر قاعده است (زاویه‌ی ۹۰ درجه).'
      ],
      pitfalls: [
        'اشتباه رایج: فراموش کردن تقسیم بر ۲.'
      ]
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪',
      formula: 'مساحت = π × شعاع²',
      paragraphs: [
        'برای محاسبه‌ی سطح داخل دایره، از فرمول π × شعاع² استفاده می‌کنیم.',
        'دقت کن که شعاع² یعنی شعاع × شعاع، نه ۲ × شعاع!'
      ],
      examples: [
        {
          text: 'دایره‌ای با شعاع ۳ سانتی‌متر. مساحت آن چقدر است؟',
          shape: Shapes.circle(3),
          steps: ['مساحت = π × شعاع²', 'مساحت = ۳٫۱۴ × ۳²', 'مساحت = ۳٫۱۴ × ۹ = ۲۸٫۲۶'],
          answer: 'مساحت ≈ ۲۸٫۲۶ سانتی‌متر مربع'
        },
        {
          text: 'پیتزایی دایره‌ای به شعاع ۱۰ سانتی‌متر. مساحت آن چقدر است؟',
          shape: Shapes.circle(10),
          steps: ['مساحت = ۳٫۱۴ × ۱۰²', 'مساحت = ۳٫۱۴ × ۱۰۰ = ۳۱۴'],
          answer: 'مساحت = ۳۱۴ سانتی‌متر مربع'
        }
      ],
      tips: [
        'دقت کن که شعاع² با ۲ × شعاع فرق دارد. مثلاً ۳² = ۹، نه ۶!',
        'اگر قطر داری، اول تقسیم بر ۲ کن.'
      ],
      pitfalls: [
        'اشتباه رایج: استفاده از قطر به‌جای شعاع، یا محاسبه‌ی ۲ × شعاع به‌جای شعاع².'
      ]
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱',
      formula: 'مساحت = قاعده × ارتفاع',
      paragraphs: [
        'مساحت متوازی‌الاضلاع، دقیقاً مانند مستطیل، با ضرب قاعده در ارتفاع به دست می‌آید.',
        'ارتفاع همان فاصله‌ی عمودی بین دو قاعده‌ی موازی است، نه ضلع کج.'
      ],
      examples: [
        {
          text: 'متوازی‌الاضلاعی با قاعده ۶ و ارتفاع ۴. مساحت آن چقدر است؟',
          shape: Shapes.parallelogram(6, 10, 4),
          steps: ['فرمول: مساحت = قاعده × ارتفاع', 'مساحت = ۶ × ۴', 'مساحت = ۲۴'],
          answer: 'مساحت = ۲۴ سانتی‌متر مربع'
        },
        {
          text: 'زمین کشاورزی متوازی‌الاضلاع با قاعده ۲۰ و ارتفاع ۱۵ متر. مساحت آن چقدر است؟',
          shape: Shapes.parallelogram(20, 12, 15),
          steps: ['مساحت = ۲۰ × ۱۵', 'مساحت = ۳۰۰'],
          answer: 'مساحت = ۳۰۰ متر مربع'
        }
      ],
      tips: [
        'ارتفاع همیشه عمود بر قاعده است.'
      ],
      pitfalls: [
        'اشتباه رایج: ضرب کردن دو ضلع مجاور به‌جای قاعده در ارتفاع.'
      ]
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆',
      formula: 'مساحت = (قطر بزرگ × قطر کوچک) ÷ ۲',
      paragraphs: [
        'لوزی دو قطر دارد که عمود بر هم هستند و یکدیگر را نصف می‌کنند.',
        'مساحت لوزی نصف حاصل‌ضرب دو قطر است.'
      ],
      examples: [
        {
          text: 'لوزی با قطرهای ۸ و ۶. مساحت آن چقدر است؟',
          shape: Shapes.rhombusD(8, 6),
          steps: ['فرمول: مساحت = (قطر۱ × قطر۲) ÷ ۲', 'مساحت = (۸ × ۶) ÷ ۲', 'مساحت = ۴۸ ÷ ۲ = ۲۴'],
          answer: 'مساحت = ۲۴ سانتی‌متر مربع'
        },
        {
          text: 'باغچه‌ای لوزی‌شکل با قطرهای ۱۲ و ۱۰ متر. مساحتش چقدر است؟',
          shape: Shapes.rhombusD(12, 10),
          steps: ['مساحت = (۱۲ × ۱۰) ÷ ۲', 'مساحت = ۱۲۰ ÷ ۲ = ۶۰'],
          answer: 'مساحت = ۶۰ متر مربع'
        }
      ],
      tips: [
        'قطرها را می‌شود جابجا کرد — نتیجه یکی است.'
      ],
      pitfalls: [
        'اشتباه رایج: ضرب کردن قطرها بدون تقسیم بر ۲.'
      ]
    },
    {
      id: 'trap', title: 'ذوزنقه', emoji: '⏢',
      formula: 'مساحت = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      paragraphs: [
        'ذوزنقه شکلی چهارضلعی است که فقط دو ضلع آن موازی‌اند. به این دو ضلع موازی، «قاعده» می‌گویند.',
        'فرمول: میانگین دو قاعده را حساب می‌کنیم (جمع و تقسیم بر ۲) و در ارتفاع ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'ذوزنقه‌ای با قاعده‌های ۱۰ و ۶ و ارتفاع ۴. مساحت آن چقدر است؟',
          shape: Shapes.trapezoid(10, 6, 4),
          steps: ['فرمول: ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲', 'مساحت = ((۶ + ۱۰) × ۴) ÷ ۲', 'مساحت = (۱۶ × ۴) ÷ ۲ = ۳۲'],
          answer: 'مساحت = ۳۲ سانتی‌متر مربع'
        },
        {
          text: 'زمینی ذوزنقه‌ای با قاعده‌های ۲۰ و ۱۲ و ارتفاع ۸ متر. مساحت آن چقدر است؟',
          shape: Shapes.trapezoid(20, 12, 8),
          steps: ['مساحت = ((۱۲ + ۲۰) × ۸) ÷ ۲', 'مساحت = (۳۲ × ۸) ÷ ۲ = ۱۲۸'],
          answer: 'مساحت = ۱۲۸ متر مربع'
        }
      ],
      tips: [
        'قاعده بزرگ‌تر را با قاعده کوچک‌تر جمع می‌کنیم.',
        'ارتفاع باید عمود بر دو قاعده باشد.'
      ],
      pitfalls: [
        'اشتباه رایج: فراموش کردن تقسیم بر ۲ در انتها.'
      ]
    }
  ],
  fractions: [
    {
      id: 'concept', title: 'مفهوم کسر', emoji: '🍕',
      formula: 'صورت / مخرج',
      paragraphs: [
        'کسر یعنی «چند قسمت از یک کل». مثلاً اگر یک پیتزا را به ۴ قسمت مساوی تقسیم کنیم و ۳ قسمت آن را بخوریم، می‌گوییم ۳/۴ پیتزا خورده‌ایم.',
        'عدد بالایی را «صورت» و عدد پایینی را «مخرج» می‌نامیم. مخرج نشان می‌دهد کل به چند قسمت تقسیم شده، و صورت نشان می‌دهد چند قسمت برداشته‌ایم.'
      ],
      examples: [
        {
          text: 'شکل زیر را نگاه کن. کسر رنگی چقدر است؟',
          html: Shapes.fracPie(3, 4),
          steps: ['کل به ۴ قسمت تقسیم شده → مخرج = ۴', '۳ قسمت رنگی است → صورت = ۳'],
          answer: 'کسر رنگی = ۳/۴'
        },
        {
          text: 'کسر ۲/۵ یعنی چه؟',
          html: `${fracHTML({ n: 2, d: 5 })}`,
          steps: ['مخرج ۵ → کل به ۵ قسمت تقسیم شده', 'صورت ۲ → ۲ قسمت برداشته شده'],
          answer: '۲ قسمت از ۵ قسمت مساوی'
        }
      ],
      tips: [
        'مخرج هرگز نمی‌تواند صفر باشد.',
        'همه‌ی قسمت‌ها باید مساوی باشند.'
      ],
      pitfalls: [
        'اشتباه رایج: قاطی کردن جای صورت و مخرج.'
      ]
    },
    {
      id: 'equiv', title: 'کسر معادل', emoji: '🟰',
      formula: 'a/b = (a×k)/(b×k)',
      paragraphs: [
        'دو کسر وقتی معادل هستند که مقدارشان یکی باشد، حتی اگر صورت و مخرجشان متفاوت باشد. مثلاً ۱/۲ و ۲/۴ و ۳/۶ همه یک مقدار دارند (نصف).',
        'برای ساختن کسر معادل، صورت و مخرج را در یک عدد ضرب، یا هر دو را بر یک عدد تقسیم می‌کنیم.'
      ],
      examples: [
        {
          text: 'آیا ۱/۲ و ۳/۶ معادل‌اند؟',
          html: `${fracHTML({ n: 1, d: 2 })} ? ${fracHTML({ n: 3, d: 6 })}`,
          steps: ['صورت و مخرج ۱/۲ را در ۳ ضرب کن', '۱×۳ = ۳ و ۲×۳ = ۶', 'پس ۱/۲ = ۳/۶ ✓'],
          answer: 'بله، معادل‌اند'
        },
        {
          text: 'برای کسر ۲/۳ یک کسر معادل با مخرج ۹ بساز.',
          html: `${fracHTML({ n: 2, d: 3 })} = ? / ۹`,
          steps: ['از ۳ به ۹ یعنی ضرب در ۳', 'پس صورت هم × ۳: ۲ × ۳ = ۶'],
          answer: '۶/۹'
        }
      ],
      tips: [
        'ضرب یا تقسیم صورت و مخرج در یک عدد، مقدار کسر را تغییر نمی‌دهد.'
      ],
      pitfalls: [
        'اشتباه رایج: فقط صورت یا فقط مخرج را ضرب کردن.'
      ]
    },
    {
      id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️',
      formula: 'تقسیم بر ب.م.م',
      paragraphs: [
        'ساده کردن یعنی نوشتن کسری به ساده‌ترین شکل ممکن. برای این کار، صورت و مخرج را بر بزرگ‌ترین مقسوم‌علیه مشترکشان (ب.م.م) تقسیم می‌کنیم.',
        'کسر ساده‌شده با کسر اولیه برابر است، فقط ظاهرش ساده‌تر می‌شود.'
      ],
      examples: [
        {
          text: 'کسر ۶/۸ را ساده کن.',
          html: fracHTML({ n: 6, d: 8 }),
          steps: ['ب.م.م ۶ و ۸ = ۲', '۶÷۲ = ۳ و ۸÷۲ = ۴ → ۳/۴'],
          answer: '۳/۴'
        },
        {
          text: 'کسر ۱۵/۲۵ را ساده کن.',
          html: fracHTML({ n: 15, d: 25 }),
          steps: ['ب.م.م ۱۵ و ۲۵ = ۵', '۱۵÷۵ = ۳ و ۲۵÷۵ = ۵ → ۳/۵'],
          answer: '۳/۵'
        }
      ],
      tips: [
        'اگر ب.م.م را بلد نیستی، با اعداد کوچک شروع کن و کم‌کم ساده کن.'
      ],
      pitfalls: [
        'اشتباه رایج: تقسیم فقط یکی از صورت یا مخرج.'
      ]
    },
    {
      id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️',
      formula: 'مخرج مشترک',
      paragraphs: [
        'برای مقایسه‌ی دو کسر با مخرج‌های مختلف، باید مخرج‌ها را مشترک کنیم و بعد صورت‌ها را مقایسه کنیم.',
        'وقتی مخرج‌ها یکی شدند، کسری که صورت بزرگ‌تری دارد، بزرگ‌تر است.'
      ],
      examples: [
        {
          text: 'کدام بزرگ‌تر است: ۲/۳ یا ۱/۲؟',
          html: `${fracHTML({ n: 2, d: 3 })} ? ${fracHTML({ n: 1, d: 2 })}`,
          steps: ['مخرج مشترک: ۶', '۲/۳ = ۴/۶', '۱/۲ = ۳/۶', '۴ > ۳ پس ۲/۳ > ۱/۲'],
          answer: '۲/۳ بزرگ‌تر است'
        },
        {
          text: 'کدام بزرگ‌تر است: ۳/۵ یا ۵/۸؟',
          html: `${fracHTML({ n: 3, d: 5 })} ? ${fracHTML({ n: 5, d: 8 })}`,
          steps: ['مخرج مشترک: ۴۰', '۳/۵ = ۲۴/۴۰', '۵/۸ = ۲۵/۴۰', '۲۴ < ۲۵ پس ۳/۵ < ۵/۸'],
          answer: '۵/۸ بزرگ‌تر است'
        }
      ],
      tips: [
        'وقتی مخرج‌ها مساوی‌اند، فقط صورت را مقایسه کن.'
      ],
      pitfalls: [
        'اشتباه رایج: فکر کردن اینکه کسر با مخرج بزرگ‌تر حتماً بزرگ‌تر است. نه! مثلاً ۱/۲ > ۱/۵.'
      ]
    },
    {
      id: 'add', title: 'جمع کسرها', emoji: '➕',
      formula: 'مخرج مشترک → جمع صورت‌ها',
      paragraphs: [
        'برای جمع دو کسر، اول باید مخرج‌ها را مشترک کنیم. چون فقط چیزهایی با واحد یکسان را می‌توان جمع کرد.',
        'بعد از مشترک کردن مخرج‌ها، صورت‌ها را جمع می‌کنیم و نتیجه را ساده می‌کنیم.'
      ],
      examples: [
        {
          text: 'حاصل جمع ۱/۳ + ۱/۴ = ?',
          html: `${fracHTML({ n: 1, d: 3 })} + ${fracHTML({ n: 1, d: 4 })}`,
          steps: ['مخرج مشترک ۳ و ۴ = ۱۲', '۱/۳ = ۴/۱۲', '۱/۴ = ۳/۱۲', '۴ + ۳ = ۷ → نتیجه ۷/۱۲'],
          answer: '۷/۱۲'
        },
        {
          text: 'حاصل ۲/۵ + ۱/۵ = ?',
          html: `${fracHTML({ n: 2, d: 5 })} + ${fracHTML({ n: 1, d: 5 })}`,
          steps: ['مخرج‌ها مساوی‌اند → فقط صورت‌ها را جمع کن', '۲ + ۱ = ۳'],
          answer: '۳/۵'
        }
      ],
      tips: [
        'اگر مخرج‌ها مساوی‌اند، سریع فقط صورت‌ها را جمع کن.'
      ],
      pitfalls: [
        'اشتباه رایج: جمع کردن صورت‌ها و مخرج‌ها با هم! مثلاً ۱/۲ + ۱/۲ ≠ ۲/۴. جواب درست ۲/۲ = ۱ است.'
      ]
    },
    {
      id: 'sub', title: 'تفریق کسرها', emoji: '➖',
      formula: 'مخرج مشترک → تفریق صورت‌ها',
      paragraphs: [
        'تفریق کسرها هم مثل جمع است: اول مخرج‌ها را مشترک می‌کنیم، سپس صورت‌ها را از هم کم می‌کنیم.',
        'نتیجه را در انتها ساده کن.'
      ],
      examples: [
        {
          text: 'حاصل ۳/۴ − ۱/۴ = ?',
          html: `${fracHTML({ n: 3, d: 4 })} − ${fracHTML({ n: 1, d: 4 })}`,
          steps: ['مخرج مساوی → فقط صورت‌ها را کم کن', '۳ − ۱ = ۲', '۲/۴ ساده می‌شود به ۱/۲'],
          answer: '۱/۲'
        },
        {
          text: 'حاصل ۵/۶ − ۱/۳ = ?',
          html: `${fracHTML({ n: 5, d: 6 })} − ${fracHTML({ n: 1, d: 3 })}`,
          steps: ['مخرج مشترک ۶', '۱/۳ = ۲/۶', '۵/۶ − ۲/۶ = ۳/۶ = ۱/۲'],
          answer: '۱/۲'
        }
      ],
      tips: [
        'همیشه نتیجه را ساده کن.'
      ],
      pitfalls: [
        'اشتباه رایج: کم کردن مخرج‌ها از هم.'
      ]
    },
    {
      id: 'mul', title: 'ضرب کسرها', emoji: '✖️',
      formula: '(صورت×صورت) / (مخرج×مخرج)',
      paragraphs: [
        'ضرب کسرها ساده‌ترین عملیات است! فقط صورت‌ها را در هم و مخرج‌ها را در هم ضرب می‌کنیم. نیازی به مخرج مشترک نیست.',
        'اگر بتوانی قبل از ضرب، صورت و مخرج‌ها را ساده کنی، محاسبه آسان‌تر می‌شود.'
      ],
      examples: [
        {
          text: 'حاصل ۲/۳ × ۳/۵ = ?',
          html: `${fracHTML({ n: 2, d: 3 })} × ${fracHTML({ n: 3, d: 5 })}`,
          steps: ['صورت‌ها: ۲ × ۳ = ۶', 'مخرج‌ها: ۳ × ۵ = ۱۵', '۶/۱۵ ساده = ۲/۵'],
          answer: '۲/۵'
        },
        {
          text: 'حاصل ۱/۲ × ۲/۵ = ?',
          html: `${fracHTML({ n: 1, d: 2 })} × ${fracHTML({ n: 2, d: 5 })}`,
          steps: ['صورت‌ها: ۱ × ۲ = ۲', 'مخرج‌ها: ۲ × ۵ = ۱۰', '۲/۱۰ = ۱/۵'],
          answer: '۱/۵'
        }
      ],
      tips: [
        'می‌توانی صورت با مخرج را قبل از ضرب ساده کنی.'
      ],
      pitfalls: [
        'اشتباه رایج: گرفتن مخرج مشترک برای ضرب. لازم نیست!'
      ]
    },
    {
      id: 'div', title: 'تقسیم کسرها', emoji: '➗',
      formula: 'کسر دوم را معکوس کن و ضرب کن',
      paragraphs: [
        'برای تقسیم دو کسر، کسر دوم را معکوس می‌کنیم (صورت و مخرج را جابجا) و بعد ضرب می‌کنیم.',
        'معکوس ۲/۳ می‌شود ۳/۲.'
      ],
      examples: [
        {
          text: 'حاصل ۱/۲ ÷ ۱/۴ = ?',
          html: `${fracHTML({ n: 1, d: 2 })} ÷ ${fracHTML({ n: 1, d: 4 })}`,
          steps: ['معکوس ۱/۴ می‌شود ۴/۱', '۱/۲ × ۴/۱ = ۴/۲', '= ۲'],
          answer: '۲'
        },
        {
          text: 'حاصل ۳/۴ ÷ ۲/۳ = ?',
          html: `${fracHTML({ n: 3, d: 4 })} ÷ ${fracHTML({ n: 2, d: 3 })}`,
          steps: ['معکوس ۲/۳ می‌شود ۳/۲', '۳/۴ × ۳/۲ = ۹/۸'],
          answer: '۹/۸'
        }
      ],
      tips: [
        'یادت باشد: «تقسیم بر یک کسر = ضرب در معکوس آن».'
      ],
      pitfalls: [
        'اشتباه رایج: معکوس کردن کسر اول به‌جای کسر دوم.'
      ]
    },
    {
      id: 'mixed', title: 'عدد مخلوط', emoji: '🔢',
      formula: 'عدد صحیح + کسر',
      paragraphs: [
        'عدد مخلوط ترکیبی از یک عدد صحیح و یک کسر است، مثلاً ۲ و ۱/۳ که یعنی ۲ + ۱/۳.',
        'برای تبدیل عدد مخلوط به کسر: صورت = (عدد صحیح × مخرج) + صورت. مخرج ثابت می‌ماند.'
      ],
      examples: [
        {
          text: 'عدد مخلوط ۲ و ۱/۳ را به کسر تبدیل کن.',
          html: `۲${fracHTML({ n: 1, d: 3 })}`,
          steps: ['صورت = (۲ × ۳) + ۱ = ۶ + ۱ = ۷', 'مخرج = ۳'],
          answer: '۷/۳'
        },
        {
          text: 'عدد مخلوط ۳ و ۲/۵ را به کسر تبدیل کن.',
          html: `۳${fracHTML({ n: 2, d: 5 })}`,
          steps: ['صورت = (۳ × ۵) + ۲ = ۱۵ + ۲ = ۱۷', 'مخرج = ۵'],
          answer: '۱۷/۵'
        }
      ],
      tips: [
        'برای برعکس (کسر به مخلوط): صورت را بر مخرج تقسیم کن.'
      ],
      pitfalls: [
        'اشتباه رایج: ضرب نکردن عدد صحیح در مخرج.'
      ]
    }
  ],
  decimals: [
    {
      id: 'concept', title: 'مفهوم اعشار', emoji: '🔟',
      formula: 'یک‌دهم، صدم، هزارم',
      paragraphs: [
        'اعداد اعشاری برای نمایش قسمت‌های کمتر از یک استفاده می‌شوند. مثلاً نصف یک سیب = ۰٫۵.',
        'بعد از ممیز، اولین رقم نشان‌دهنده‌ی دهم، دومی صدم، و سومی هزارم است.'
      ],
      examples: [
        {
          text: '۰٫۵ یعنی چه؟',
          html: eq('۰٫۵'),
          steps: ['۵ در جای دهم', '۵/۱۰ = ۱/۲'],
          answer: '۰٫۵ = نصف'
        },
        {
          text: '۰٫۲۵ به کسر معادلش تبدیل کن.',
          html: eq('۰٫۲۵'),
          steps: ['۲۵ در جای صدم', '۲۵/۱۰۰', 'ساده می‌شود به ۱/۴'],
          answer: '۰٫۲۵ = ۱/۴'
        }
      ],
      tips: [
        'هر رقم بعد از ممیز، یک جایگاه دارد: دهم، صدم، هزارم.'
      ],
      pitfalls: [
        'اشتباه رایج: فراموش کردن صفر قبل از ممیز.'
      ]
    },
    {
      id: 'place', title: 'ارزش مکانی', emoji: '📍',
      formula: 'یکان، دهم، صدم',
      paragraphs: [
        'هر رقم در یک عدد اعشاری، یک ارزش دارد که به موقعیتش بستگی دارد.',
        'در عدد ۳٫۴۵: رقم ۳ در جای یکان، ۴ در جای دهم و ۵ در جای صدم است.'
      ],
      examples: [
        {
          text: 'در عدد ۷٫۸۹، رقم ۸ چه ارزشی دارد؟',
          html: eq('۷٫۸۹'),
          steps: ['۷: یکان', '۸: دهم', '۹: صدم'],
          answer: '۸ در جای دهم است → ۰٫۸'
        },
        {
          text: 'ارزش رقم ۵ در ۱۲٫۰۵ چقدر است؟',
          html: eq('۱۲٫۰۵'),
          steps: ['۵ در جای صدم است'],
          answer: '۵ صدم = ۰٫۰۵'
        }
      ],
      tips: [
        'از چپ به راست بعد از ممیز: دهم، صدم، هزارم.'
      ],
      pitfalls: [
        'اشتباه رایج: فکر کردن که همه‌ی ارقام بعد از ممیز یک ارزش دارند.'
      ]
    },
    {
      id: 'compare', title: 'مقایسه اعشار', emoji: '⚖️',
      formula: 'مقایسه رقم به رقم',
      paragraphs: [
        'برای مقایسه‌ی دو عدد اعشاری، ابتدا قسمت صحیح را مقایسه می‌کنیم. اگر مساوی بود، ارقام بعد از ممیز را از چپ به راست مقایسه می‌کنیم.',
        'مثلاً ۰٫۷ > ۰٫۵ چون ۷ > ۵.'
      ],
      examples: [
        {
          text: 'کدام بزرگ‌تر است: ۰٫۷ یا ۰٫۵؟',
          html: eq('۰٫۷ ? ۰٫۵'),
          steps: ['قسمت صحیح هر دو = ۰', 'دهم: ۷ > ۵'],
          answer: '۰٫۷ > ۰٫۵'
        },
        {
          text: 'کدام بزرگ‌تر است: ۳٫۲۵ یا ۳٫۵؟',
          html: eq('۳٫۲۵ ? ۳٫۵'),
          steps: ['قسمت صحیح: ۳ = ۳', 'دهم: ۲ < ۵', 'پس ۳٫۲۵ < ۳٫۵'],
          answer: '۳٫۵ بزرگ‌تر است'
        }
      ],
      tips: [
        'اگر یکی از اعداد ارقام کمتری داشت، به‌جای آن صفر بگذار. مثلاً ۳٫۵ = ۳٫۵۰.'
      ],
      pitfalls: [
        'اشتباه رایج: مقایسه بر اساس تعداد ارقام.'
      ]
    },
    {
      id: 'add', title: 'جمع اعشار', emoji: '➕',
      formula: 'ممیزها زیر هم',
      paragraphs: [
        'برای جمع دو عدد اعشاری، آن‌ها را طوری زیر هم می‌نویسیم که ممیزها دقیقاً زیر هم قرار بگیرند.',
        'بعد مثل اعداد صحیح جمع می‌کنیم و ممیز را در همان ستون قرار می‌دهیم.'
      ],
      examples: [
        {
          text: '۳٫۴ + ۲٫۱ = ?',
          html: eq('۳٫۴ + ۲٫۱'),
          steps: ['۳٫۴', '۲٫۱ زیرش با ممیز هم‌تراز', '۳٫۴ + ۲٫۱ = ۵٫۵'],
          answer: '۵٫۵'
        },
        {
          text: '۰٫۲۵ + ۱٫۳ = ?',
          html: eq('۰٫۲۵ + ۱٫۳'),
          steps: ['۱٫۳ را بنویس ۱٫۳۰', '۰٫۲۵ + ۱٫۳۰ = ۱٫۵۵'],
          answer: '۱٫۵۵'
        }
      ],
      tips: [
        'اگر تعداد ارقام اعشار دو عدد فرق داشت، با صفر پر کن.'
      ],
      pitfalls: [
        'اشتباه رایج: زیر هم نوشتن بدون تراز کردن ممیزها.'
      ]
    },
    {
      id: 'sub', title: 'تفریق اعشار', emoji: '➖',
      formula: 'ممیزها زیر هم',
      paragraphs: [
        'تفریق اعشار دقیقاً مثل جمع است: ممیزها را زیر هم می‌گذاریم و مثل اعداد صحیح تفریق می‌کنیم.',
        'اگر لازم بود، با صفر پر می‌کنیم تا تعداد ارقام اعشار برابر شود.'
      ],
      examples: [
        {
          text: '۵٫۵ − ۲٫۱ = ?',
          html: eq('۵٫۵ − ۲٫۱'),
          steps: ['۵٫۵', '۲٫۱ زیرش', '۵٫۵ − ۲٫۱ = ۳٫۴'],
          answer: '۳٫۴'
        },
        {
          text: '۳٫۲ − ۰٫۷۵ = ?',
          html: eq('۳٫۲ − ۰٫۷۵'),
          steps: ['۳٫۲ = ۳٫۲۰', '۳٫۲۰ − ۰٫۷۵ = ۲٫۴۵'],
          answer: '۲٫۴۵'
        }
      ],
      tips: [
        'قرض گرفتن از ستون کنار، مثل تفریق اعداد صحیح.'
      ],
      pitfalls: [
        'اشتباه رایج: کم کردن عدد کوچکتر از بزرگتر بدون توجه به ترتیب.'
      ]
    },
    {
      id: 'mul', title: 'ضرب اعشار', emoji: '✖️',
      formula: 'ضرب بدون ممیز، سپس ممیز',
      paragraphs: [
        'برای ضرب دو عدد اعشاری، ابتدا آن‌ها را بدون ممیز ضرب می‌کنیم. سپس در نتیجه، به تعداد مجموع ارقام اعشار دو عدد، از راست ممیز می‌گذاریم.',
        'مثلاً ۰٫۵ × ۰٫۲: ۵ × ۲ = ۱۰، مجموع ارقام اعشار = ۲، نتیجه ۰٫۱۰ = ۰٫۱.'
      ],
      examples: [
        {
          text: '۰٫۵ × ۳ = ?',
          html: eq('۰٫۵ × ۳'),
          steps: ['۵ × ۳ = ۱۵', 'ارقام اعشار = ۱', 'ممیز از راست: ۱٫۵'],
          answer: '۱٫۵'
        },
        {
          text: '۰٫۲ × ۰٫۳ = ?',
          html: eq('۰٫۲ × ۰٫۳'),
          steps: ['۲ × ۳ = ۶', 'مجموع ارقام اعشار = ۲', 'ممیز: ۰٫۰۶'],
          answer: '۰٫۰۶'
        }
      ],
      tips: [
        'تعداد کل ارقام اعشار را در ضرب، جمع کن.'
      ],
      pitfalls: [
        'اشتباه رایج: اشتباه شمردن ارقام اعشار در نتیجه.'
      ]
    },
    {
      id: 'div', title: 'تقسیم اعشار', emoji: '➗',
      formula: 'حذف ممیز مقسوم‌علیه',
      paragraphs: [
        'برای تقسیم اعشاری، اگر مقسوم‌علیه اعشاری بود، ممیز آن را با ضرب کردن در ۱۰، ۱۰۰ و... حذف می‌کنیم. مقسوم را هم به همان اندازه جابجا می‌کنیم.',
        'بعد مثل تقسیم اعداد صحیح انجام می‌دهیم.'
      ],
      examples: [
        {
          text: '۱٫۵ ÷ ۳ = ?',
          html: eq('۱٫۵ ÷ ۳'),
          steps: ['مقسوم‌علیه صحیح است', '۱۵ ÷ ۳ = ۵', 'ممیز: ۰٫۵'],
          answer: '۰٫۵'
        },
        {
          text: '۲٫۴ ÷ ۰٫۶ = ?',
          html: eq('۲٫۴ ÷ ۰٫۶'),
          steps: ['مقسوم‌علیه × ۱۰ → ۶', 'مقسوم هم × ۱۰ → ۲۴', '۲۴ ÷ ۶ = ۴'],
          answer: '۴'
        }
      ],
      tips: [
        'اگر هر دو عدد را در ۱۰ ضرب کنی، جواب تقسیم تغییر نمی‌کند.'
      ],
      pitfalls: [
        'اشتباه رایج: جابجا نکردن ممیز مقسوم.'
      ]
    },
    {
      id: 'frac-to-dec', title: 'کسر به اعشار', emoji: '🔄',
      formula: 'صورت ÷ مخرج',
      paragraphs: [
        'برای تبدیل یک کسر به عدد اعشاری، کافی است صورت را بر مخرج تقسیم کنیم.',
        'مثلاً ۳/۴ یعنی ۳ ÷ ۴ = ۰٫۷۵.'
      ],
      examples: [
        {
          text: '۳/۴ را به اعشار تبدیل کن.',
          html: fracHTML({ n: 3, d: 4 }),
          steps: ['۳ ÷ ۴ = ۰٫۷۵'],
          answer: '۰٫۷۵'
        },
        {
          text: '۱/۸ را به اعشار تبدیل کن.',
          html: fracHTML({ n: 1, d: 8 }),
          steps: ['۱ ÷ ۸ = ۰٫۱۲۵'],
          answer: '۰٫۱۲۵'
        }
      ],
      tips: [
        'بعضی کسرها اعشار پایان‌پذیر دارند، بعضی متناوب (۱/۳ = ۰٫۳۳۳...).'
      ],
      pitfalls: [
        'اشتباه رایج: تقسیم مخرج بر صورت.'
      ]
    },
    {
      id: 'dec-to-frac', title: 'اعشار به کسر', emoji: '🔄',
      formula: 'حذف ممیز / توان ۱۰',
      paragraphs: [
        'برای تبدیل اعشار به کسر: تعداد ارقام بعد از ممیز را می‌شماریم. اگر ۱ رقم باشد، مخرج ۱۰؛ ۲ رقم، ۱۰۰؛ ۳ رقم، ۱۰۰۰.',
        'در انتها کسر را ساده می‌کنیم.'
      ],
      examples: [
        {
          text: '۰٫۷ را به کسر تبدیل کن.',
          html: eq('۰٫۷'),
          steps: ['۱ رقم اعشار → مخرج ۱۰', 'صورت = ۷', 'کسر: ۷/۱۰'],
          answer: '۷/۱۰'
        },
        {
          text: '۰٫۷۵ را به کسر تبدیل کن.',
          html: eq('۰٫۷۵'),
          steps: ['۲ رقم اعشار → مخرج ۱۰۰', 'صورت = ۷۵', '۷۵/۱۰۰ ساده = ۳/۴'],
          answer: '۳/۴'
        }
      ],
      tips: [
        'همیشه در انتها ساده کن.'
      ],
      pitfalls: [
        'اشتباه رایج: فراموش کردن ساده کردن در انتها.'
      ]
    }
  ]
};

function viewLearn(topic) {
  const lessons = LESSONS[topic];
  return `
  ${header('📚 آموزش', true)}
  <p style="color:var(--muted);margin:0 0 14px">یک موضوع را انتخاب کن تا درسنامه ببینی:</p>
  <div class="grid grid-2">
    ${lessons.map(l => `
      <button class="card card-btn" onclick="window.__nav('lesson', {topic:'${topic}', id:'${l.id}'})">
        <span class="icon-big">${l.emoji}</span>
        <h3 class="card-title">${l.title}</h3>
      </button>
    `).join('')}
  </div>
  ${bottomNav()}`;
}

function viewLesson(topic, id) {
  const lesson = LESSONS[topic].find(l => l.id === id);
  if (!lesson) return `<div class="empty">درس یافت نشد</div>`;
  const allIds = LESSONS[topic].map(l => l.id);
  const idx = allIds.indexOf(id);
  const nextId = allIds[idx + 1] || null;
  const prevId = allIds[idx - 1] || null;

  return `
  ${header(lesson.title, true)}
  <div class="lesson-hero">
    <div class="emoji-big">${lesson.emoji}</div>
    <h2>${lesson.title}</h2>
    <div class="formula">${lesson.formula}</div>
  </div>

  <div class="lesson-section">
    <h3>📖 توضیح</h3>
    ${lesson.paragraphs.map(p => `<p>${p}</p>`).join('')}
  </div>

  <div class="lesson-section">
    <h3>📌 مثال‌های حل‌شده</h3>
    ${lesson.examples.map((ex, i) => `
      <div class="example-card">
        <p class="ex-title">مثال ${fa(i + 1)}:</p>
        <p>${ex.text}</p>
        ${ex.shape ? `<div class="q-shape">${ex.shape}</div>` : ''}
        ${ex.html ? `<div style="text-align:center;font-size:1.2rem;padding:8px">${ex.html}</div>` : ''}
        <ul class="example-steps">
          ${ex.steps.map(s => `<li>${s}</li>`).join('')}
        </ul>
        <div class="example-answer">✅ ${ex.answer}</div>
      </div>
    `).join('')}
  </div>

  <div class="lesson-section">
    <h3>💡 نکات مهم</h3>
    <ul class="tips-list">
      ${lesson.tips.map(t => `<li>${t}</li>`).join('')}
    </ul>
  </div>

  ${lesson.pitfalls && lesson.pitfalls.length ? `
  <div class="lesson-section">
    <h3>⚠️ اشتباهات رایج</h3>
    <ul class="pitfalls-list">
      ${lesson.pitfalls.map(t => `<li>${t}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="lesson-nav">
    ${prevId ? `<button class="btn sec" onclick="window.__nav('lesson',{topic:'${topic}',id:'${prevId}'})">⬅️ قبلی</button>` : ''}
    ${nextId ? `<button class="btn" onclick="window.__nav('lesson',{topic:'${topic}',id:'${nextId}'})">➡️ بعدی</button>` : ''}
  </div>

  <button class="btn success full" style="margin-top:16px" onclick="window.__nav('practice',{topic:'${topic}'})">
    ✏️ بریم تمرین کنیم!
  </button>
  ${bottomNav()}`;
}

/* ============================================================
   ۱۸) PRACTICE
   ============================================================ */
function viewPractice(topic) {
  if (!session || session.mode !== 'practice' || session.topic !== topic) startPractice(topic);
  return renderPractice();
}
function startPractice(topic) {
  session = {
    mode: 'practice', topic,
    difficulty: state.settings.difficulty,
    index: 0, correct: 0, wrong: 0, streak: 0,
    current: null, answered: false, selected: null, inputValue: ''
  };
  nextPracticeQuestion();
}
function nextPracticeQuestion() {
  session.current = generateQuestion(session.topic, session.difficulty);
  session.answered = false;
  session.selected = null;
  session.inputValue = '';
}
function renderPractice() {
  const q = session.current;
  if (!q) return `<div class="empty">در حال بارگذاری...</div>`;
  const names = { perimeter: '📏 محیط', area: '📐 مساحت', fractions: '🍰 کسرها', decimals: '🔢 اعشار' };
  return `
  ${header(names[session.topic], true)}
  <div class="stats-row">
    <div class="stat-item"><div class="stat-value">${fa(session.index + 1)}</div><div class="stat-label">سوال</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--success)">${fa(session.correct)}</div><div class="stat-label">درست</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--danger)">${fa(session.wrong)}</div><div class="stat-label">نادرست</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--accent)">🔥 ${fa(session.streak)}</div><div class="stat-label">پشت‌سرهم</div></div>
  </div>
  <div class="pill-row" style="margin-bottom:12px">
    <button class="pill ${session.difficulty === 'easy' ? 'active' : ''}" onclick="window.__setDiff('easy')">آسان</button>
    <button class="pill ${session.difficulty === 'medium' ? 'active' : ''}" onclick="window.__setDiff('medium')">متوسط</button>
    <button class="pill ${session.difficulty === 'hard' ? 'active' : ''}" onclick="window.__setDiff('hard')">سخت</button>
  </div>
  <div class="question-box">
    ${q.promptHTML ? `<p class="q-prompt">${q.promptHTML}</p>` : `<p class="q-prompt">${q.prompt}</p>`}
    ${q.shape ? `<div class="q-shape">${q.shape}</div>` : ''}
  </div>
  <div class="answer-area" id="answerArea">${renderAnswerInput(q)}</div>
  <div id="feedbackArea"></div>
  <div style="margin-top:16px">
    <button class="btn full" id="actionBtn" onclick="window.__submitOrNext()">
      ${session.answered ? '➡️ سوال بعدی' : '✅ بررسی پاسخ'}
    </button>
  </div>
  ${bottomNav()}`;
}
function renderAnswerInput(q) {
  if (session.answered) {
    if (q.type === 'numeric') return `<input class="num-input" value="${faSafe(session.inputValue)}" disabled aria-label="پاسخ تو">`;
    return `<div class="choice-grid">${q.choices.map((c, i) => choiceHTML(c, i, q)).join('')}</div>`;
  }
  if (q.type === 'numeric') {
    return `
      <div class="input-row">
        <input type="text" inputmode="decimal" class="num-input" id="numInput"
          placeholder="پاسخ${q.unit ? ' (' + q.unit + ')' : ''}" value="${faSafe(session.inputValue)}"
          aria-label="پاسخ عددی"
          oninput="window.__onInput(this.value)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window.__submitOrNext();}">
      </div>
      <p style="color:var(--muted);font-size:.85rem;margin:0">💡 فقط عدد را وارد کن.${q.unit ? ' واحد: ' + q.unit : ''}</p>`;
  }
  return `<div class="choice-grid">${q.choices.map((c, i) => choiceHTML(c, i, q)).join('')}</div>`;
}
function choiceHTML(c, i, q) {
  let display;
  if (c.isSym) display = c.n === '>' ? '&gt;' : c.n === '<' ? '&lt;' : escHtml(c.n);
  else if (c.isNum) display = faSafe(c.n);
  else display = fracHTML(c);
  let cls = 'choice';
  if (session.answered) {
    if (equalAnswer(c, q.correct)) cls += ' correct';
    else if (session.selected && equalAnswer(session.selected, c)) cls += ' wrong';
  } else if (session.selected && equalAnswer(session.selected, c)) cls += ' selected';
  return `<button class="${cls}" ${session.answered ? 'disabled' : ''} onclick="window.__selectChoice(${i})" aria-label="گزینه">${display}</button>`;
}
function equalAnswer(a, b) {
  if (!a || !b) return false;
  if (a.isSym || b.isSym) return a.isSym && b.isSym && a.n === b.n;
  if (a.isNum || b.isNum) return a.isNum && b.isNum && String(a.n) === String(b.n);
  if (a.n != null && b.n != null && a.d != null && b.d != null) return fracEq(a, b);
  return false;
}
function submitAnswer() {
  const q = session.current;
  if (session.answered || !q) return;
  if (q.type === 'numeric') {
    const raw = (session.inputValue || '').trim();
    const num = parseFloat(en(raw));
    if (isNaN(num)) { showWarn('❗ لطفاً یک عدد وارد کن.'); return; }
    finishQuestion(Math.abs(num - q.answer) < 0.01);
  } else {
    if (!session.selected) { showWarn('❗ یکی از گزینه‌ها را انتخاب کن.'); return; }
    finishQuestion(equalAnswer(session.selected, q.correct));
  }
}
function showWarn(msg) {
  const fb = document.getElementById('feedbackArea');
  if (!fb) return;
  fb.innerHTML = `<div class="feedback warn"><h4 style="margin:0">${msg}</h4></div>`;
  setTimeout(() => {
    if (fb.firstChild && fb.firstChild.classList && fb.firstChild.classList.contains('warn')) fb.innerHTML = '';
  }, 2200);
}
function finishQuestion(correct) {
  const q = session.current;
  const stu = activeStudent();
  session.answered = true;
  if (stu) {
    stu.stats.totalQuestions++;
    stu.progress[q.topic].attempts++;
  }
  if (correct) {
    session.correct++;
    session.streak++;
    if (stu) {
      stu.stats.totalCorrect++;
      if (session.streak > stu.stats.bestStreak) stu.stats.bestStreak = session.streak;
      stu.progress[q.topic].correct++;
    }
    awardCorrect(session.streak);
    sound.correct();
  } else {
    session.wrong++;
    session.streak = 0;
    if (stu) {
      const mk = q.topic + ':' + q.key;
      stu.mistakes[mk] = (stu.mistakes[mk] || 0) + 1;
    }
    sound.wrong();
  }
  saveState();

  const area = document.getElementById('answerArea');
  if (area) area.innerHTML = renderAnswerInput(q);
  const btn = document.getElementById('actionBtn');
  if (btn) btn.textContent = '➡️ سوال بعدی';

  const fb = document.getElementById('feedbackArea');
  if (fb) {
    const correctDisp = q.type === 'numeric' ? `${faDec(q.answer, 2)}${q.unit ? ' ' + q.unit : ''}` : displayAnswer(q.correct);
    const title = correct ? pick(['🎉 آفرین!', '✨ درست بود!', '💯 عالی!', '🌟 ادامه بده!']) : '❌ اشکالی نداره، ببین کجا اشتباه کردی:';
    fb.innerHTML = `
      <div class="feedback ${correct ? 'good' : 'bad'}">
        <h4>${title}</h4>
        ${!correct ? `<p>پاسخ درست: <strong class="correct-text">${correctDisp}</strong></p>` : ''}
        <strong>راه‌حل گام‌به‌گام:</strong>
        <ul class="steps">${q.steps.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>`;
  }
}
function nextQuestionAction() {
  if (!session) return;
  if (!session.answered) { submitAnswer(); return; }
  if (session.mode === 'practice') {
    session.index++;
    nextPracticeQuestion();
    render();
  }
}

/* ============================================================
   ۱۹) EXAM
   ============================================================ */
function viewExamSetup(topic) {
  const names = { perimeter: 'محیط', area: 'مساحت', fractions: 'کسرها', decimals: 'اعداد اعشاری' };
  return `
  ${header('🎯 آزمون', true)}
  <div class="card">
    <h3 class="card-title">تنظیمات آزمون</h3>
    <p>موضوع: <strong>${names[topic]}</strong></p>
    <label style="display:block;margin-top:12px">تعداد سوال:
      <select id="examCount" class="num-input" style="text-align:right">
        ${[5, 10, 15, 20].map(n => `<option value="${n}" ${n === state.settings.questionCount ? 'selected' : ''}>${fa(n)} سوال</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">زمان:
      <select id="examTime" class="num-input" style="text-align:right">
        ${[60, 180, 300, 600, 900].map(n => `<option value="${n}" ${n === state.settings.examTime ? 'selected' : ''}>${fa(Math.floor(n / 60))} دقیقه</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">سطح دشواری:
      <select id="examDiff" class="num-input" style="text-align:right">
        <option value="easy" ${state.settings.difficulty === 'easy' ? 'selected' : ''}>آسان</option>
        <option value="medium" ${state.settings.difficulty === 'medium' ? 'selected' : ''}>متوسط</option>
        <option value="hard" ${state.settings.difficulty === 'hard' ? 'selected' : ''}>سخت</option>
      </select>
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
      <input type="checkbox" id="examNeg" ${state.settings.negativeMark ? 'checked' : ''}>
      نمره منفی برای پاسخ غلط
    </label>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__startExam('${topic}')">🚀 شروع آزمون</button>
  ${bottomNav()}`;
}
function startExam(topic) {
  const count = parseInt(document.getElementById('examCount').value, 10) || 10;
  const time = parseInt(document.getElementById('examTime').value, 10) || 300;
  const diff = document.getElementById('examDiff').value || 'medium';
  const neg = document.getElementById('examNeg').checked;
  const questions = [];
  for (let i = 0; i < count; i++) questions.push(generateQuestion(topic, diff));
  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null, inputValue: '',
    correct: 0, wrong: 0, negativeMark: neg,
    timeLeft: time, totalTime: time
  };
  navigate('exam');
  startExamTimer();
}
function startExamTimer() {
  if (examTimer) clearInterval(examTimer);
  examTimer = setInterval(() => {
    if (!session || session.mode !== 'exam') { clearInterval(examTimer); examTimer = null; return; }
    session.timeLeft--;
    if (session.timeLeft <= 0) {
      clearInterval(examTimer); examTimer = null;
      alert('⏰ زمان آزمون تمام شد!');
      endExam();
      return;
    }
    const statsRow = document.querySelectorAll('.stat-value');
    if (statsRow.length >= 2) {
      const min = Math.floor(session.timeLeft / 60);
      const sec = session.timeLeft % 60;
      statsRow[1].textContent = `⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}`;
      statsRow[1].style.color = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
    }
  }, 1000);
}
function viewExam() {
  if (!session || session.mode !== 'exam') {
    return `${header('🎯 آزمون')}<div class="empty"><span class="emoji-big">📝</span>آزمونی در جریان نیست</div>${bottomNav()}`;
  }
  const q = session.current;
  if (!q) return `<div class="empty">خطا</div>`;
  const names = { perimeter: 'محیط', area: 'مساحت', fractions: 'کسرها', decimals: 'اعداد اعشاری' };
  const min = Math.floor(session.timeLeft / 60);
  const sec = session.timeLeft % 60;
  const timeColor = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
  return `
  ${header('🎯 آزمون ' + names[session.topic])}
  <div class="stats-row">
    <div class="stat-item"><div class="stat-value">${fa(session.index + 1)}/${fa(session.questions.length)}</div><div class="stat-label">سوال</div></div>
    <div class="stat-item"><div class="stat-value" style="color:${timeColor}">⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}</div><div class="stat-label">زمان</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--success)">${fa(session.correct)}</div><div class="stat-label">درست</div></div>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${(session.index / session.questions.length) * 100}%"></div></div>
  <div class="question-box">
    ${q.promptHTML ? `<p class="q-prompt">${q.promptHTML}</p>` : `<p class="q-prompt">${q.prompt}</p>`}
    ${q.shape ? `<div class="q-shape">${q.shape}</div>` : ''}
  </div>
  <div class="answer-area">${renderExamAnswerInput(q)}</div>
  <div style="margin-top:16px;display:flex;gap:8px">
    <button class="btn full" onclick="window.__examNext()">
      ${session.index + 1 >= session.questions.length ? '🏁 پایان آزمون' : '➡️ بعدی'}
    </button>
    <button class="btn danger" onclick="if(confirm('خروج از آزمون؟')) window.__nav('home')">خروج</button>
  </div>
  ${bottomNav()}`;
}
function renderExamAnswerInput(q) {
  if (q.type === 'numeric') {
    return `
      <input type="text" inputmode="decimal" class="num-input" id="numInput"
        placeholder="پاسخ${q.unit ? ' (' + q.unit + ')' : ''}" value="${faSafe(session.inputValue || '')}"
        aria-label="پاسخ عددی"
        oninput="window.__onInput(this.value)"
        onkeydown="if(event.key==='Enter'){event.preventDefault();window.__examNext();}">`;
  }
  return `<div class="choice-grid">${q.choices.map((c, i) => {
    let cls = 'choice';
    if (session.selected && equalAnswer(session.selected, c)) cls += ' selected';
    let display;
    if (c.isSym) display = c.n === '>' ? '&gt;' : c.n === '<' ? '&lt;' : escHtml(c.n);
    else if (c.isNum) display = faSafe(c.n);
    else display = fracHTML(c);
    return `<button class="${cls}" onclick="window.__examSelect(${i})" aria-label="گزینه">${display}</button>`;
  }).join('')}</div>`;
}
function examNext() {
  if (!session || session.mode !== 'exam') return;
  const q = session.current;
  let userAns = null, isCorrect = false;
  if (q.type === 'numeric') {
    const num = parseFloat(en(session.inputValue || ''));
    if (!isNaN(num)) { userAns = num; isCorrect = Math.abs(num - q.answer) < 0.01; }
  } else {
    if (session.selected) { userAns = session.selected; isCorrect = equalAnswer(session.selected, q.correct); }
  }
  session.answers.push({ q, userAns, isCorrect });
  if (isCorrect) session.correct++; else session.wrong++;
  const stu = activeStudent();
  if (stu) {
    stu.stats.totalQuestions++;
    stu.progress[q.topic].attempts++;
    if (isCorrect) {
      stu.stats.totalCorrect++;
      stu.progress[q.topic].correct++;
    } else {
      const mk = q.topic + ':' + q.key;
      stu.mistakes[mk] = (stu.mistakes[mk] || 0) + 1;
    }
  }
  saveState();
  session.index++;
  if (session.index >= session.questions.length) endExam();
  else {
    session.current = session.questions[session.index];
    session.selected = null;
    session.inputValue = '';
    render();
  }
}
function endExam() {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  if (!session) return;
  const s = session;
  let score = s.correct;
  if (s.negativeMark) score = s.correct - 0.25 * s.wrong;
  score = Math.max(0, round(score, 2));
  const pctv = Math.round((score / s.questions.length) * 100);
  const stu = activeStudent();
  if (stu) {
    stu.history.unshift({ date: Date.now(), topic: s.topic, score: pctv, correct: s.correct, total: s.questions.length });
    if (stu.history.length > 40) stu.history.length = 40;
    if (pctv === 100 && !stu.stats.badges.includes('perfect')) {
      stu.stats.badges.push('perfect');
      showFloat('💎 نشان بی‌نقص!');
    }
  }
  saveState();
  sound.win();
  const payload = { pct: pctv, answers: s.answers, topic: s.topic };
  session = null;
  navigate('examResult', payload);
}
function viewExamResult() {
  const params = route.params || {};
  const pctv = params.pct, answers = params.answers, topic = params.topic;
  if (!answers) return `<div class="empty">کارنامه‌ای نیست</div>`;
  const correct = answers.filter(a => a.isCorrect).length;
  const wrong = answers.length - correct;
  const emoji = pctv >= 80 ? '🏆' : pctv >= 60 ? '👍' : pctv >= 40 ? '💪' : '📚';
  const msg = pctv >= 80 ? 'فوق‌العاده بود!' : pctv >= 60 ? 'خوب بود، ادامه بده!' : pctv >= 40 ? 'باز هم تمرین کن!' : 'ناامید نشو، دوباره تلاش کن!';
  const stu = activeStudent();
  return `
  ${header('📋 کارنامه', true)}
  ${stu ? `<p style="text-align:center;color:var(--muted);margin:0 0 12px">${escHtml(fullName(stu))} — پایه ${fa(stu.grade)}</p>` : ''}
  <div class="card" style="text-align:center">
    <div style="font-size:4rem;margin-bottom:8px">${emoji}</div>
    <h2 style="margin:0">${msg}</h2>
    <div style="font-size:2.5rem;font-weight:800;color:var(--primary);margin:12px 0">${fa(pctv)}٪</div>
    <div class="stats-row" style="margin-top:16px">
      <div class="stat-item"><div class="stat-value" style="color:var(--success)">${fa(correct)}</div><div class="stat-label">درست</div></div>
      <div class="stat-item"><div class="stat-value" style="color:var(--danger)">${fa(wrong)}</div><div class="stat-label">غلط</div></div>
      <div class="stat-item"><div class="stat-value">${fa(answers.length)}</div><div class="stat-label">کل</div></div>
    </div>
  </div>
  <h3 style="margin:20px 0 10px">🔎 مرور پاسخ‌ها</h3>
  <div style="display:grid;gap:10px">
    ${answers.map((a, i) => {
      const correctDisp = a.q.type === 'numeric'
        ? `${faDec(a.q.answer, 2)}${a.q.unit ? ' ' + a.q.unit : ''}`
        : displayAnswer(a.q.correct);
      let userDisp = '';
      if (!a.isCorrect && a.userAns != null) {
        userDisp = typeof a.userAns === 'number' ? faDec(a.userAns, 2) : displayAnswer(a.userAns);
      }
      return `
      <div class="card" style="border-right:4px solid ${a.isCorrect ? 'var(--success)' : 'var(--danger)'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>سوال ${fa(i + 1)}</strong>
          <span>${a.isCorrect ? '✅' : '❌'}</span>
        </div>
        <p style="margin:8px 0">${a.q.promptHTML || a.q.prompt}</p>
        ${a.q.shape ? `<div class="q-shape">${a.q.shape}</div>` : ''}
        <div style="font-size:.9rem;color:var(--muted)">
          ${userDisp ? `<div>پاسخ تو: <span class="wrong-text">${userDisp}</span></div>` : ''}
          <div>پاسخ درست: <span class="correct-text">${correctDisp}</span></div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <div style="margin-top:16px;display:flex;gap:8px">
    <button class="btn full" onclick="window.__nav('examSetup',{topic:'${topic}'})">🔁 آزمون دوباره</button>
    <button class="btn sec" onclick="window.__nav('home')">🏠 خانه</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۰) PROGRESS
   ============================================================ */
function viewProgress() {
  const stu = activeStudent();
  if (!stu) return `<div class="empty">دانش‌آموزی انتخاب نشده</div>`;
  const p = stu.progress;
  const topics = [
    { key: 'perimeter', name: 'محیط', emoji: '📏' },
    { key: 'area', name: 'مساحت', emoji: '📐' },
    { key: 'fractions', name: 'کسرها', emoji: '🍰' },
    { key: 'decimals', name: 'اعشار', emoji: '🔢' }
  ];
  const totalQ = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].attempts) || 0), 0);
  const totalC = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].correct) || 0), 0);
  const overall = totalQ ? Math.round((totalC / totalQ) * 100) : 0;
  const mistakeList = Object.entries(stu.mistakes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const names = {
    'sq-p': 'محیط مربع', 'rect-p': 'محیط مستطیل', 'tri-p': 'محیط مثلث', 'circ-p': 'محیط دایره',
    'para-p': 'محیط متوازی‌الاضلاع', 'rhom-p': 'محیط لوزی', 'poly-p': 'محیط چندضلعی', 'find-side': 'یافتن ضلع',
    'sq-a': 'مساحت مربع', 'rect-a': 'مساحت مستطیل', 'tri-a': 'مساحت مثلث', 'circ-a': 'مساحت دایره',
    'para-a': 'مساحت متوازی‌الاضلاع', 'rhom-a': 'مساحت لوزی', 'trap-a': 'مساحت ذوزنقه', 'comp-a': 'شکل ترکیبی',
    'frac-add': 'جمع کسر', 'frac-sub': 'تفریق کسر', 'frac-mul': 'ضرب کسر', 'frac-div': 'تقسیم کسر',
    'frac-simplify': 'ساده‌کردن', 'frac-cmp': 'مقایسه کسر', 'mixed-imp': 'مخلوط به کسر', 'frac-word': 'مسئله کسری',
    'dec-add': 'جمع اعشار', 'dec-sub': 'تفریق اعشار', 'dec-mul': 'ضرب اعشار', 'dec-div': 'تقسیم اعشار',
    'dec-cmp': 'مقایسه اعشار', 'frac-dec': 'کسر به اعشار', 'dec-frac': 'اعشار به کسر', 'dec-word': 'مسئله اعشاری'
  };
  return `
  ${header('📊 پیشرفت', true)}
  <div class="card" style="text-align:center">
    <div class="student-avatar" style="margin:0 auto 10px">${escHtml(stu.name[0] || '؟')}</div>
    <h2 style="margin:0 0 4px">${escHtml(fullName(stu))}</h2>
    <p style="color:var(--muted);margin:0">پایه ${fa(stu.grade)}</p>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="stats-row">
      <div class="stat-item"><div class="stat-value">${fa(stu.stats.level)}</div><div class="stat-label">سطح</div></div>
      <div class="stat-item"><div class="stat-value">${fa(overall)}٪</div><div class="stat-label">تسلط</div></div>
      <div class="stat-item"><div class="stat-value">${fa(stu.stats.bestStreak)}</div><div class="stat-label">رکورد</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalC)}</div><div class="stat-label">درست</div></div>
    </div>
  </div>
  <h3 style="margin:20px 0 10px">📈 تسلط در هر مبحث</h3>
  <div class="card">
    ${topics.map(t => {
      const tp = p[t.key] || { attempts: 0, correct: 0 };
      const pctv = tp.attempts ? Math.round((tp.correct / tp.attempts) * 100) : 0;
      return `
      <div class="bar-row">
        <div class="lbl">${t.emoji} ${t.name}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pctv}%">${pctv > 10 ? fa(pctv) + '٪' : ''}</div></div>
        <div class="pct">${fa(pctv)}٪</div>
      </div>`;
    }).join('')}
  </div>
  ${mistakeList.length ? `
  <h3 style="margin:20px 0 10px">🎯 نقاط ضعف</h3>
  <div class="card">
    ${mistakeList.map(([k, v]) => {
      const key = k.split(':')[1];
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border)">
        <span>${names[key] || key}</span>
        <span style="color:var(--danger);font-weight:700">${fa(v)} اشتباه</span>
      </div>`;
    }).join('')}
    <button class="btn info full" style="margin-top:12px" onclick="window.__nav('practice',{topic:'${mistakeList[0][0].split(':')[0]}'})">💡 تمرین پیشنهادی</button>
  </div>` : ''}
  <h3 style="margin:20px 0 10px">🏆 نشان‌ها</h3>
  <div class="card">
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${BADGES.map(b => `
        <div class="badge ${stu.stats.badges.includes(b.id) ? 'earned' : 'locked'}" title="${b.desc}">
          <span class="emoji">${b.emoji}</span>
          <span class="name">${b.name}</span>
        </div>`).join('')}
    </div>
  </div>
  <h3 style="margin:20px 0 10px">📜 تاریخچه آزمون‌ها</h3>
  <div class="card">
    ${stu.history.length ? stu.history.slice(0, 10).map(h => {
      const d = new Date(h.date);
      const dateStr = `${fa(d.getFullYear())}/${fa(d.getMonth() + 1)}/${fa(d.getDate())}`;
      const tn = { perimeter: 'محیط', area: 'مساحت', fractions: 'کسرها', decimals: 'اعشار' }[h.topic] || h.topic;
      const color = h.score >= 70 ? 'var(--success)' : h.score >= 40 ? 'var(--accent)' : 'var(--danger)';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border)">
        <span>${dateStr} — ${tn}</span>
        <span style="font-weight:700;color:${color}">${fa(h.score)}٪</span>
      </div>`;
    }).join('') : '<p style="color:var(--muted);text-align:center">هنوز آزمونی نداده</p>'}
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۱) SETTINGS
   ============================================================ */
function viewSettings() {
  const s = state.settings;
  return `
  ${header('⚙️ تنظیمات', true)}
  <div class="card">
    <h3 class="card-title">🔊 صدا</h3>
    <div class="pill-row">
      <button class="pill ${s.sound ? 'active' : ''}" onclick="window.__setSetting('sound',true)">روشن</button>
      <button class="pill ${!s.sound ? 'active' : ''}" onclick="window.__setSetting('sound',false)">خاموش</button>
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">🎬 انیمیشن</h3>
    <div class="pill-row">
      <button class="pill ${s.animation ? 'active' : ''}" onclick="window.__setSetting('animation',true)">روشن</button>
      <button class="pill ${!s.animation ? 'active' : ''}" onclick="window.__setSetting('animation',false)">خاموش</button>
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">🎚️ دشواری پیش‌فرض</h3>
    <div class="pill-row">
      ${['easy', 'medium', 'hard'].map(d => `<button class="pill ${s.difficulty === d ? 'active' : ''}" onclick="window.__setSetting('difficulty','${d}')">${d === 'easy' ? 'آسان' : d === 'medium' ? 'متوسط' : 'سخت'}</button>`).join('')}
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">🔢 نمایش اعداد</h3>
    <div class="pill-row">
      <button class="pill ${s.persianNumbers ? 'active' : ''}" onclick="window.__setSetting('persianNumbers',true)">فارسی ۱۲۳</button>
      <button class="pill ${!s.persianNumbers ? 'active' : ''}" onclick="window.__setSetting('persianNumbers',false)">انگلیسی 123</button>
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">👥 مدیریت دانش‌آموزان</h3>
    <button class="btn info full" onclick="window.__nav('students')">مشاهده‌ی همه دانش‌آموزان</button>
  </div>
  <div class="card">
    <h3 class="card-title">⚠️ منطقه خطر</h3>
    <p class="card-desc">پیشرفت دانش‌آموز فعلی پاک می‌شود.</p>
    <button class="btn danger full" style="margin-top:10px" onclick="window.__resetActiveStudent()">🗑️ پاک کردن پیشرفت این دانش‌آموز</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۲) TEACHER
   ============================================================ */
function viewTeacher() {
  const stu = activeStudent();
  return `
  ${header('👨‍🏫 معلم / والد', true)}
  <div class="card">
    <h3 class="card-title">🎯 آزمون سفارشی</h3>
    <label style="display:block;margin-top:12px">موضوع:
      <select id="tchTopic" class="num-input" style="text-align:right">
        <option value="perimeter">محیط</option>
        <option value="area">مساحت</option>
        <option value="fractions">کسرها</option>
        <option value="decimals">اعداد اعشاری</option>
      </select>
    </label>
    <label style="display:block;margin-top:12px">تعداد سوال:
      <input type="number" class="num-input" id="tchCount" value="10" min="1" max="50" style="text-align:center">
    </label>
    <label style="display:block;margin-top:12px">زمان (دقیقه):
      <input type="number" class="num-input" id="tchTime" value="5" min="1" max="60" style="text-align:center">
    </label>
    <label style="display:block;margin-top:12px">سطح:
      <select id="tchDiff" class="num-input" style="text-align:right">
        <option value="easy">آسان</option>
        <option value="medium" selected>متوسط</option>
        <option value="hard">سخت</option>
      </select>
    </label>
    <button class="btn full" style="margin-top:16px" onclick="window.__teacherStartExam()">🚀 شروع آزمون</button>
  </div>
  ${stu ? `
  <div class="card">
    <h3 class="card-title">📊 وضعیت ${escHtml(fullName(stu))}</h3>
    <p>پایه: <strong>${fa(stu.grade)}</strong></p>
    <p>سطح: <strong>${fa(stu.stats.level)}</strong></p>
    <p>پاسخ‌های درست: <strong>${fa(stu.stats.totalCorrect)} / ${fa(stu.stats.totalQuestions)}</strong></p>
    <p>تعداد آزمون‌ها: <strong>${fa(stu.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها</button>
  </div>` : ''}
  ${bottomNav()}`;
}

/* ============================================================
   ۲۳) RENDER
   ============================================================ */
function render() {
  document.body.classList.toggle('no-anim', !state.settings.animation);
  if (!activeStudent() && !['students', 'addStudent'].includes(route.name)) {
    route = { name: state.students.length ? 'students' : 'addStudent', params: {} };
  }
  let html = '';
  switch (route.name) {
    case 'students': html = viewStudents(); break;
    case 'addStudent': html = viewAddStudent(); break;
    case 'home': html = viewHome(); break;
    case 'perimeter':
    case 'area':
    case 'fractions':
    case 'decimals': html = viewTopic(route.name); break;
    case 'learn': html = viewLearn(route.params.topic); break;
    case 'lesson': html = viewLesson(route.params.topic, route.params.id); break;
    case 'practice': html = viewPractice(route.params.topic); break;
    case 'examSetup': html = viewExamSetup(route.params.topic); break;
    case 'exam': html = viewExam(); break;
    case 'examResult': html = viewExamResult(); break;
    case 'progress': html = viewProgress(); break;
    case 'settings': html = viewSettings(); break;
    case 'teacher': html = viewTeacher(); break;
    default: html = activeStudent() ? viewHome() : viewStudents();
  }
  app.innerHTML = html;
}

/* ============================================================
   ۲۴) GLOBAL FUNCTIONS
   ============================================================ */
window.__nav = (name, params = {}) => { sound.click(); navigate(name, params); };
window.__goBack = () => {
  sound.click();
  if (route.name === 'home' || route.name === 'students') return;
  if ((route.name === 'practice' || route.name === 'exam') && session) session = null;
  if (route.name === 'addStudent') { navigate('students'); return; }
  if (['perimeter', 'area', 'fractions', 'decimals'].includes(route.name)) navigate('home');
  else if (route.name === 'lesson') navigate('learn', { topic: route.params.topic });
  else if (['learn', 'practice', 'examSetup'].includes(route.name)) navigate(route.params.topic || 'home');
  else navigate('home');
};
window.__setDiff = (d) => {
  if (!session || session.mode !== 'practice') return;
  session.difficulty = d;
  state.settings.difficulty = d;
  saveState();
  nextPracticeQuestion();
  render();
};
window.__onInput = (v) => { if (session) session.inputValue = v; };
window.__selectChoice = (i) => {
  if (!session || session.answered) return;
  session.selected = session.current.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => el.classList.toggle('selected', idx === i));
};
window.__examSelect = (i) => {
  if (!session || session.mode !== 'exam') return;
  session.selected = session.current.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => el.classList.toggle('selected', idx === i));
};
window.__submitOrNext = () => {
  if (!session) return;
  if (session.answered) nextQuestionAction();
  else submitAnswer();
};
window.__examNext = () => { if (session && session.mode === 'exam') examNext(); };
window.__startExam = (topic) => { sound.click(); startExam(topic); };
window.__setSetting = (key, val) => {
  state.settings[key] = val;
  saveState();
  if (key === 'animation') document.body.classList.toggle('no-anim', !val);
  render();
};
/* ✅ FIXED: پاک کردن session هنگام تعویض دانش‌آموز */
window.__selectStudent = (id) => {
  sound.click();
  session = null;
  state.activeStudentId = id;
  saveState();
  navigate('home');
};
window.__createStudent = () => {
  const nameEl = document.getElementById('stuName');
  const familyEl = document.getElementById('stuFamily');
  const gradeEl = document.getElementById('stuGrade');
  if (!nameEl) return;
  const name = (nameEl.value || '').trim();
  const family = familyEl ? (familyEl.value || '').trim() : '';
  const grade = gradeEl ? (parseInt(gradeEl.value, 10) || 6) : 6;
  if (!name) { alert('لطفاً نام را وارد کن.'); return; }
  const stu = newStudentTemplate(name, family, grade);
  state.students.push(stu);
  state.activeStudentId = stu.id;
  saveState();
  sound.win();
  showFloat(`🎉 خوش آمدی ${name}!`);
  navigate('home');
};
window.__resetActiveStudent = () => {
  const stu = activeStudent();
  if (!stu) return;
  if (!confirm(`پیشرفت ${fullName(stu)} پاک شود؟`)) return;
  const idx = state.students.findIndex(s => s.id === stu.id);
  if (idx >= 0) {
    const t = newStudentTemplate(stu.name, stu.family, stu.grade);
    t.id = stu.id;
    t.createdAt = stu.createdAt;
    state.students[idx] = t;
  }
  saveState();
  showFloat('🗑️ پاک شد');
  navigate('home');
};
window.__teacherStartExam = () => {
  const topicEl = document.getElementById('tchTopic');
  const countEl = document.getElementById('tchCount');
  const timeEl = document.getElementById('tchTime');
  const diffEl = document.getElementById('tchDiff');
  if (!topicEl) return;
  const topic = topicEl.value;
  const count = Math.max(1, Math.min(50, parseInt(countEl.value, 10) || 10));
  const timeMin = Math.max(1, Math.min(60, parseInt(timeEl.value, 10) || 5));
  const time = timeMin * 60;
  const diff = diffEl.value;
  const questions = [];
  for (let i = 0; i < count; i++) questions.push(generateQuestion(topic, diff));
  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null, inputValue: '',
    correct: 0, wrong: 0, negativeMark: false,
    timeLeft: time, totalTime: time
  };
  navigate('exam');
  startExamTimer();
};
window.__exportData = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'riazi-yar-backup.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

/* ============================================================
   ۲۵) KEYBOARD
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && route.name !== 'home' && route.name !== 'students') window.__goBack();
  if (e.key === 'Enter' && route.name === 'addStudent') {
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') window.__createStudent();
  }
});

/* ============================================================
   ۲۶) INIT
   ============================================================ */
if (state.students.length === 0) {
  route = { name: 'addStudent', params: {} };
} else if (!state.activeStudentId || !activeStudent()) {
  route = { name: 'students', params: {} };
}
render();

})();