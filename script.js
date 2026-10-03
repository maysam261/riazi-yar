/* =============================================================
   ریاضی‌یار — نسخه ۱۲.۰
   - حالت شب (روشن/تاریک/خودکار)
   - لوگوهای لوکال
   - متن راهنمای داینامیک
   - شکل‌های ترکیبی پیشرفته (آسان/متوسط/سخت)
   - آموزش واحدها
   - اثبات فرمول‌ها با انیمیشن
   - اعشار روی محور
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
    difficulty: 'easy', questionCount: 10, examTime: 300,
    theme: 'auto'
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
    if (!merged.settings.theme) merged.settings.theme = 'auto';
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
      volume: { attempts: 0, correct: 0 },
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
function numOr(v, f) { return typeof v === 'number' && v > 0 ? v : f; }

/* ============================================================
   ۳) THEME
   ============================================================ */
function isDarkTheme() {
  const t = state.settings.theme || 'auto';
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  const dark = isDarkTheme();
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const m = document.getElementById('themeColorMeta');
  if (m) m.setAttribute('content', dark ? '#0f0f1a' : '#7c3aed');
}
window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((state.settings.theme || 'auto') === 'auto') { applyTheme(); render(); }
});

/* ============================================================
   ۴) ANIMATION STYLES
   ============================================================ */
function ensureAnimStyles() {
  if (document.getElementById('riazi-anim-styles')) return;
  const s = document.createElement('style');
  s.id = 'riazi-anim-styles';
  s.textContent = '';
  document.head.appendChild(s);
}

/* ============================================================
   ۵) SOUND
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
   ۶) FRACTIONS
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
function mixedHTML(f) {
  const s = simplify(f.n, f.d);
  if (s.d === 1) return fa(s.n);
  const sign = s.n < 0 ? '−' : '';
  const abs = Math.abs(s.n);
  const whole = Math.floor(abs / s.d);
  const rem = abs % s.d;
  if (whole === 0) return `${sign}${fracHTML({ n: rem, d: s.d })}`;
  return `${sign}<span class="mixed">${fa(whole)}${fracHTML({ n: rem, d: s.d })}</span>`;
}
function displayAnswer(a) {
  if (a == null) return '';
  if (typeof a === 'number') return faDec(a, 2);
  if (a.isSym) return a.n === '>' ? '&gt;' : a.n === '<' ? '&lt;' : escHtml(a.n);
  if (a.isNum) {
    const num = parseFloat(a.n);
    if (Number.isFinite(num)) return faDec(num, 2);
    return faSafe(a.n);
  }
  if (a.n != null && a.d != null) return fracHTML(a);
  return faSafe(a);
}
function displayCorrectWithUnit(q) {
  if (q.numericAnswer != null) return `${faDec(q.numericAnswer, 2)}${q.unit ? ' ' + q.unit : ''}`;
  return displayAnswer(q.correct);
}

/* ============================================================
   ۷) NUMERIC → CHOICE
   ============================================================ */
function fallbackDistractors(correct) {
  const isInt = Number.isInteger(correct);
  const dec = isInt ? 0 : 2;
  const wrongs = [];
  const seen = new Set([correct]);
  const deltas = isInt
    ? [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10]
    : [0.1, -0.1, 0.2, -0.2, 0.5, -0.5, 1, -1, 2, -2];
  for (const d of deltas) {
    if (wrongs.length >= 3) break;
    const w = round(correct + d, dec);
    if (w <= 0) continue;
    if (seen.has(w)) continue;
    seen.add(w); wrongs.push(w);
  }
  let n = 1;
  while (wrongs.length < 3) {
    const w = round(correct + n * (isInt ? 1 : 0.5), dec);
    if (w > 0 && !seen.has(w)) { wrongs.push(w); seen.add(w); }
    n++; if (n > 50) break;
  }
  while (wrongs.length < 3) {
    const w = round(correct + wrongs.length + 100, dec);
    if (!seen.has(w)) { wrongs.push(w); seen.add(w); }
  }
  return wrongs;
}
function numericToChoice(q) {
  if (!q || q.type !== 'numeric') return q;
  const correct = q.answer;
  if (!Number.isFinite(correct)) return q;
  let wrongs = [];
  const seen = new Set([correct]);
  if (Array.isArray(q.distractors)) {
    for (const w of q.distractors) {
      if (wrongs.length >= 3) break;
      if (!Number.isFinite(w) || w <= 0) continue;
      const rw = round(w, 2);
      if (seen.has(rw)) continue;
      if (Math.abs(rw - correct) < 0.001) continue;
      seen.add(rw); wrongs.push(rw);
    }
  }
  if (wrongs.length < 3) {
    for (const w of fallbackDistractors(correct)) {
      if (wrongs.length >= 3) break;
      if (seen.has(w)) continue;
      seen.add(w); wrongs.push(w);
    }
  }
  wrongs = wrongs.slice(0, 3);
  const allOpts = shuffle([correct, ...wrongs]);
  return {
    ...q,
    type: 'choice',
    numericAnswer: correct,
    choices: allOpts.map(v => ({ n: String(v), d: null, isNum: true })),
    correct: { n: String(correct), d: null, isNum: true }
  };
}

/* ============================================================
   ۸) SHAPES (استاتیک)
   ============================================================ */
const SC = {
  fill: 'var(--shape-fill)',
  fill2: 'var(--shape-fill-2)',
  fill3: 'var(--shape-fill-3)',
  fill4: 'var(--shape-fill-4)',
  stroke: 'var(--shape-stroke)',
  accent: 'var(--shape-accent)',
  grid: 'var(--shape-grid)',
  blank: 'var(--shape-blank)'
};

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

const Shapes = {
  square(side) {
    const W = 220, H = 200, pad = 46;
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" rx="4"/>` +
      label(x + box / 2, y + box + 24, fa(side), 'middle', 'svg-label-lg')
    );
  },
  rectangle(w, h) {
    const W = 260, H = 200, pad = 50;
    const wNum = numOr(w, 3), hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" rx="4"/>` +
      label(x + rw / 2, y + rh + 24, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  triangle(a, b, c) {
    const W = 280, H = 240, pad = 55;
    const v = triangleFromSides(a, b, c);
    const pts = mathToSvg([v.A, v.B, v.C], W, H, pad);
    const [pA, pB, pC] = pts;
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      labelOnSegment(pA, pB, cent, fa(c), 18) +
      labelOnSegment(pB, pC, cent, fa(a), 18) +
      labelOnSegment(pC, pA, cent, fa(b), 18)
    );
  },
  triangleBH(base, height) {
    const W = 280, H = 240, pad = 55;
    const A = [base / 2, height], B = [0, 0], C = [base, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>` +
      `<rect x="${midBC[0] - 5}" y="${midBC[1] - 10}" width="10" height="10" fill="none" stroke="${SC.accent}" stroke-width="1.5"/>` +
      label(pA[0] + 14, (pA[1] + midBC[1]) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      label(midBC[0], midBC[1] + 24, fa(base), 'middle', 'svg-label-lg')
    );
  },
  circle(r) {
    const W = 240, H = 220;
    const cx = W / 2, cy = H / 2, R = 68;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="2.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      label(cx + R / 2, cy - 10, fa(r), 'middle', 'svg-label-lg')
    );
  },
  parallelogram(a, b, h = null) {
    const W = 280, H = 220, pad = 55;
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
        `<line x1="${xTop}" y1="${pts[2][1]}" x2="${xTop}" y2="${pts[1][1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>` +
        label(xTop + 12, (pts[2][1] + pts[1][1]) / 2 + 4, fa(h), 'start', 'svg-label-lg');
    }
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      heightLine +
      labelOnSegment(pts[3], pts[2], cent, fa(a), 18) +
      labelOnSegment(pts[1], pts[2], cent, fa(b), 18)
    );
  },
  rhombusSide(s) {
    const W = 260, H = 240, pad = 55;
    const sNum = numOr(s, 5);
    const halfW = sNum / 2, halfH = (sNum * 0.75) / 2;
    const pts = fitPoints(
      [[halfW, 0], [2 * halfW, halfH], [halfW, 2 * halfH], [0, halfH]],
      W, H, pad
    );
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 18)
    );
  },
  rhombusD(d1, d2) {
    const W = 280, H = 240, pad = 55;
    const d1Num = numOr(d1, 8), d2Num = numOr(d2, 6);
    const pts = fitPoints(
      [[d1Num / 2, 0], [d1Num, d2Num / 2], [d1Num / 2, d2Num], [0, d2Num / 2]],
      W, H, pad
    );
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[2][0]}" y2="${pts[2][1]}" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="6 4"/>` +
      `<line x1="${pts[1][0]}" y1="${pts[1][1]}" x2="${pts[3][0]}" y2="${pts[3][1]}" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="6 4"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(d2), 18) +
      labelOnSegment(pts[3], pts[0], cent, fa(d1), 18)
    );
  },
  trapezoid(bigBase, smallBase, height) {
    const W = 280, H = 240, pad = 55;
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
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<line x1="${midTop[0]}" y1="${midTop[1]}" x2="${midTop[0]}" y2="${footY}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>` +
      label(midTop[0] + 14, (midTop[1] + footY) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      labelOnSegment(pA, pB, cent, fa(smallBase), 22) +
      labelOnSegment(pD, pC, cent, fa(bigBase), 22)
    );
  },
  regularPolygon(n, s) {
    const W = 260, H = 240, cx = W / 2, cy = H / 2, R = 82;
    const start = -Math.PI / 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * 2 * Math.PI / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const cent = [cx, cy];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 18)
    );
  },
  /* ============ L-SHAPE (مربع + مستطیل) ============ */
  lshape(w1, h1, w2, h2) {
    const W = 300, H = 260, pad = 60;
    const s = Math.min((W - 2 * pad) / Math.max(w1, w2), (H - 2 * pad) / (h1 + h2));
    const dw1 = w1 * s, dh1 = h1 * s, dw2 = w2 * s, dh2 = h2 * s;
    const totalW = Math.max(dw1, dw2);
    const totalH = dh1 + dh2;
    const x0 = (W - totalW) / 2;
    const y0 = (H - totalH) / 2;
    // pts (SVG): top-left → top-right of stem → inner → bottom-right → bottom-left
    // Top part = w2×h2, bottom part = w1×h1
    const pts = [
      [x0, y0],
      [x0 + dw2, y0],
      [x0 + dw2, y0 + dh2],
      [x0 + dw1, y0 + dh2],
      [x0 + dw1, y0 + dh1 + dh2],
      [x0, y0 + dh1 + dh2]
    ];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      label(x0 + dw1 / 2, y0 + dh1 + dh2 + 26, fa(w1), 'middle', 'svg-label-lg') +
      label(x0 + dw1 + 14, y0 + dh2 + dh1 / 2 + 4, fa(h1), 'start', 'svg-label-lg') +
      label(x0 + dw2 / 2, y0 - 10, fa(w2), 'middle', 'svg-label-lg') +
      label(x0 + dw2 + 14, y0 + dh2 / 2 + 4, fa(h2), 'start', 'svg-label-lg')
    );
  },
  /* ============ HOUSE (مستطیل + مثلث) ============ */
  house(w, h, roofH) {
    const W = 300, H = 280, pad = 60;
    const wN = numOr(w, 6), hN = numOr(h, 4), rH = numOr(roofH, 3);
    const totalH = hN + rH;
    const s = Math.min((W - 2 * pad) / wN, (H - 2 * pad) / totalH);
    const dw = wN * s, dh = hN * s, drH = rH * s;
    const x0 = (W - dw) / 2;
    const y0 = (H - (dh + drH)) / 2;
    const baseY = y0 + drH;
    const apexX = x0 + dw / 2;
    const apexY = y0;
    return svgWrap(W, H,
      `<polygon points="${x0},${baseY} ${apexX},${apexY} ${x0 + dw},${baseY}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<rect x="${x0}" y="${baseY}" width="${dw}" height="${dh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<line x1="${apexX}" y1="${apexY}" x2="${apexX}" y2="${baseY}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4"/>` +
      label(apexX + 12, (apexY + baseY) / 2 + 4, fa(roofH), 'start', 'svg-label-lg') +
      label(x0 + dw / 2, baseY + dh + 26, fa(wN), 'middle', 'svg-label-lg') +
      label(x0 - 12, baseY + dh / 2 + 4, fa(hN), 'end', 'svg-label-lg')
    );
  },
  /* ============ T-SHAPE ============ */
  tshape(WT, HT, WB, HB) {
    const W = 300, H = 280, pad = 60;
    const wt = numOr(WT, 8), ht = numOr(HT, 3);
    const wb = Math.min(numOr(WB, 4), wt);
    const hb = numOr(HB, 5);
    const s = Math.min((W - 2 * pad) / wt, (H - 2 * pad) / (ht + hb));
    const dwt = wt * s, dht = ht * s, dwb = wb * s, dhb = hb * s;
    const x0 = (W - dwt) / 2;
    const y0 = (H - (dht + dhb)) / 2;
    const stemX = x0 + (dwt - dwb) / 2;
    return svgWrap(W, H,
      `<rect x="${x0}" y="${y0}" width="${dwt}" height="${dht}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<rect x="${stemX}" y="${y0 + dht}" width="${dwb}" height="${dhb}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      label(x0 + dwt / 2, y0 - 10, fa(WT), 'middle', 'svg-label-lg') +
      label(x0 + dwt + 14, y0 + dht / 2 + 4, fa(HT), 'start', 'svg-label-lg') +
      label(stemX + dwb + 14, y0 + dht + dhb / 2 + 4, fa(HB), 'start', 'svg-label-lg') +
      label(stemX + dwb / 2, y0 + dht + dhb + 26, fa(WB), 'middle', 'svg-label-lg')
    );
  },
  /* ============ U-SHAPE (متوسط - ۳ شکل) ============ */
  ushape(wOuter, hTotal, wInner, hInner) {
    const W = 320, H = 280, pad = 60;
    const s = Math.min((W - 2 * pad) / wOuter, (H - 2 * pad) / hTotal);
    const dWO = wOuter * s, dH = hTotal * s;
    const dWI = wInner * s, dHI = hInner * s;
    const x0 = (W - dWO) / 2, y0 = (H - dH) / 2;
    const stemW = (dWO - dWI) / 2;
    const pts = [
      [x0, y0],
      [x0 + dWO, y0],
      [x0 + dWO, y0 + dH],
      [x0 + stemW + dWI, y0 + dH],
      [x0 + stemW + dWI, y0 + dH - dHI],
      [x0 + stemW, y0 + dH - dHI],
      [x0 + stemW, y0 + dH],
      [x0, y0 + dH]
    ];
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      label(x0 + dWO / 2, y0 - 10, fa(wOuter), 'middle', 'svg-label-lg') +
      label(x0 + dWO + 14, y0 + dH / 2 + 4, fa(hTotal), 'start', 'svg-label-lg') +
      label(x0 + dWO / 2, y0 + dH + 26, fa(wInner), 'middle', 'svg-label-lg') +
      label(x0 - 14, y0 + dH - dHI / 2 + 4, fa(hInner), 'end', 'svg-label-lg')
    );
  },
  /* ============ PARK (مستطیل + نیم‌دایره) ============ */
  parkWithSemi(w, h, semiR) {
    const W = 320, H = 240, pad = 60;
    const s = Math.min((W - 2 * pad) / (w + 2 * semiR), (H - 2 * pad) / h);
    const dw = w * s, dh = h * s, dr = semiR * s;
    const x0 = (W - (dw + 2 * dr)) / 2;
    const y0 = (H - dh) / 2;
    return svgWrap(W, H,
      `<rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<path d="M ${x0 + dw} ${y0} A ${dr} ${dh/2} 0 0 1 ${x0 + dw} ${y0 + dh} Z" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<path d="M ${x0} ${y0} A ${dr} ${dh/2} 0 0 0 ${x0} ${y0 + dh} Z" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      label(x0 + dw / 2, y0 + dh + 26, fa(w), 'middle', 'svg-label-lg') +
      label(x0 - 14, y0 + dh / 2 + 4, fa(h), 'end', 'svg-label-lg') +
      label(x0 + dw + dr, y0 + dh / 2 + 4, fa(semiR), 'start', 'svg-label-lg')
    );
  },
  /* ============ ترکیب سخت: مثلث + مستطیل + نیم‌دایره ============ */
  houseWithGarden(wHouse, hHouse, roofH, gardenR) {
    const W = 320, H = 320, pad = 60;
    const totalH = hHouse + roofH + gardenR * 1.2;
    const totalW = wHouse;
    const s = Math.min((W - 2 * pad) / totalW, (H - 2 * pad) / totalH);
    const dw = wHouse * s, dh = hHouse * s, drH = roofH * s, dgr = gardenR * s;
    const x0 = (W - dw) / 2;
    const y0 = (H - totalH * s) / 2;
    const apexY = y0;
    const baseRoofY = y0 + drH;
    const baseHouseY = baseRoofY + dh;
    return svgWrap(W, H,
      `<polygon points="${x0},${baseRoofY} ${x0 + dw / 2},${apexY} ${x0 + dw},${baseRoofY}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<rect x="${x0}" y="${baseRoofY}" width="${dw}" height="${dh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<path d="M ${x0} ${baseHouseY} A ${dgr} ${dgr} 0 0 0 ${x0 + dw} ${baseHouseY} Z" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      label(x0 + dw / 2 + 14, (apexY + baseRoofY) / 2 + 4, fa(roofH), 'start', 'svg-label-lg') +
      label(x0 + dw + 14, baseRoofY + dh / 2 + 4, fa(hHouse), 'start', 'svg-label-lg') +
      label(x0 + dw / 2, baseRoofY + dh + dgr / 2 + 4, fa(wHouse), 'middle', 'svg-label-lg') +
      label(x0 + dw / 2 - 60, baseHouseY + 10, fa(gardenR), 'middle', 'svg-label-lg')
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
      const fill = i < n ? SC.fill2 : SC.blank;
      if (d === 1) paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${SC.stroke}" stroke-width="2"/>`;
      else paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="${SC.stroke}" stroke-width="1.5"/>`;
    }
    return svgWrap(W, H, paths);
  },
  cube(edge) {
    const W = 240, H = 220, pad = 40;
    const size = 100, offset = 30;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      `<polygon points="${x0},${y0} ${x0 + size},${y0} ${x0 + size},${y0 + size} ${x0},${y0 + size}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 + size - offset},${y0 - offset} ${x0 + size - offset},${y0 + size - offset} ${x0 - offset},${y0 + size - offset}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<line x1="${x0 - offset}" y1="${y0 - offset}" x2="${x0}" y2="${y0}" stroke="${SC.stroke}" stroke-width="2.5"/>` +
      `<line x1="${x0 + size - offset}" y1="${y0 - offset}" x2="${x0 + size}" y2="${y0}" stroke="${SC.stroke}" stroke-width="2.5"/>` +
      `<line x1="${x0 - offset}" y1="${y0 + size - offset}" x2="${x0}" y2="${y0 + size}" stroke="${SC.stroke}" stroke-width="2.5"/>` +
      `<line x1="${x0 + size - offset}" y1="${y0 + size - offset}" x2="${x0 + size}" y2="${y0 + size}" stroke="${SC.stroke}" stroke-width="2.5"/>` +
      label(x0 + size / 2 - offset / 2, y0 + size - offset + 24, fa(edge), 'middle', 'svg-label-lg')
    );
  },
  box(length, width, height) {
    const W = 280, H = 220, pad = 40;
    const maxDim = Math.max(length, width, height);
    const scale = 90 / maxDim;
    const A = length * scale, B = height * scale, C = width * scale;
    const offset = 25;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      `<rect x="${x0 - offset}" y="${y0 - offset}" width="${A}" height="${B}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" rx="3"/>` +
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset},${y0 - offset}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<polygon points="${x0 + A - offset},${y0 - offset} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 + B - offset - C * 0.6} ${x0 + A - offset},${y0 + B - offset}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      label(x0 - offset + A / 2, y0 - offset + B + 24, fa(length), 'middle', 'svg-label-lg') +
      label(x0 - offset - 12, y0 - offset + B / 2 + 4, fa(height), 'end', 'svg-label-lg') +
      label(x0 + A - offset + C / 2 + 8, y0 - offset - C * 0.3 - 4, fa(width), 'start', 'svg-label-lg')
    );
  }
};

/* ============================================================
   ۹) SHAPES ANIM (با کلیک)
   ============================================================ */
const ShapesAnim = {
  tracingSquare(side) {
    const W = 240, H = 220, pad = 50;
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    const len = 4 * box;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill}" fill-opacity="0.35" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len: ${len}; stroke-dasharray: ${len}"/>` +
      label(x + box / 2, y + box + 24, fa(side), 'middle', 'svg-label-lg')
    );
  },
  tracingRect(w, h) {
    const W = 280, H = 220, pad = 50;
    const wNum = numOr(w, 3), hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    const len = 2 * (rw + rh);
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" fill-opacity="0.35" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len: ${len}; stroke-dasharray: ${len}"/>` +
      label(x + rw / 2, y + rh + 24, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  tracingTriangle(a, b, c) {
    const W = 280, H = 240, pad = 55;
    const v = triangleFromSides(a, b, c);
    const pts = mathToSvg([v.A, v.B, v.C], W, H, pad);
    const [pA, pB, pC] = pts;
    const cent = polyCentroid(pts);
    const perim = Math.hypot(pA[0]-pB[0], pA[1]-pB[1]) +
                  Math.hypot(pB[0]-pC[0], pB[1]-pC[1]) +
                  Math.hypot(pC[0]-pA[0], pC[1]-pA[1]);
    const len = Math.ceil(perim * 2);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" fill-opacity="0.35" stroke="${SC.stroke}" stroke-width="4" stroke-linejoin="round" class="anim-draw-loop" style="--len: ${len}; stroke-dasharray: ${len}"/>` +
      labelOnSegment(pA, pB, cent, fa(c), 18) +
      labelOnSegment(pB, pC, cent, fa(a), 18) +
      labelOnSegment(pC, pA, cent, fa(b), 18)
    );
  },
  circleRadiusAnim(r) {
    const W = 240, H = 220;
    const cx = W / 2, cy = H / 2, R = 68;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" fill-opacity="0.4" stroke="${SC.stroke}" stroke-width="3.5" class="anim-fade-loop"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len: ${R}; stroke-dasharray: ${R}; animation-delay: 0.3s"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      label(cx + R / 2, cy - 10, fa(r), 'middle', 'svg-label-lg')
    );
  },
  gridRect(w, h) {
    const W = 280, H = 220, pad = 50;
    const wNum = numOr(w, 3), hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    let grid = '';
    for (let j = 0; j < hNum; j++) {
      for (let i = 0; i < wNum; i++) {
        const idx = j * wNum + i;
        const delay = (idx * 0.05).toFixed(2);
        grid += `<rect x="${(x + i*s).toFixed(1)}" y="${(y + j*s).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${SC.fill2}" stroke="${SC.grid}" stroke-width="1" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      }
    }
    return svgWrap(W, H,
      grid +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="none" stroke="${SC.stroke}" stroke-width="3.5" rx="2"/>` +
      label(x + rw / 2, y + rh + 24, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  gridSquare(side) { return ShapesAnim.gridRect(side, side); },
  triangleAreaAnim(base, height) {
    const W = 280, H = 240, pad = 55;
    const A = [base / 2, height], B = [0, 0], C = [base, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    const hLen = Math.abs(pA[1] - midBC[1]);
    return svgWrap(W, H,
      `<polygon points="${pB.join(',')} ${pC.join(',')} ${pA[0]},${pC[1]} ${pA[0]},${pB[1]}" fill="none" stroke="${SC.stroke}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>` +
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round" class="anim-fade-loop"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len: ${hLen}; stroke-dasharray: ${hLen}; animation-delay: 0.5s"/>` +
      label(pA[0] + 14, (pA[1] + midBC[1]) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      label(midBC[0], midBC[1] + 24, fa(base), 'middle', 'svg-label-lg')
    );
  },
  cubeBuild(edge) {
    const W = 240, H = 220, pad = 40;
    const size = 100, offset = 30;
    const x0 = pad + offset, y0 = pad + offset;
    const frontPts = `${x0 - offset},${y0 - offset} ${x0 + size - offset},${y0 - offset} ${x0 + size - offset},${y0 + size - offset} ${x0 - offset},${y0 + size - offset}`;
    const topPts = `${x0 - offset},${y0 - offset} ${x0},${y0} ${x0 + size},${y0} ${x0 + size - offset},${y0 - offset}`;
    const rightPts = `${x0 + size - offset},${y0 - offset} ${x0 + size},${y0} ${x0 + size},${y0 + size} ${x0 + size - offset},${y0 + size - offset}`;
    return svgWrap(W, H,
      `<polygon points="${rightPts}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0s"/>` +
      `<polygon points="${topPts}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0.3s"/>` +
      `<polygon points="${frontPts}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0.6s"/>` +
      label(x0 + size / 2 - offset / 2, y0 + size - offset + 24, fa(edge), 'middle', 'svg-label-lg')
    );
  },
  boxBuild(length, width, height) {
    const W = 280, H = 220, pad = 40;
    const maxDim = Math.max(length, width, height);
    const scale = 90 / maxDim;
    const A = length * scale, B = height * scale, C = width * scale;
    const offset = 25;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      `<polygon points="${x0 + A - offset},${y0 - offset} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 + B - offset - C * 0.6} ${x0 + A - offset},${y0 + B - offset}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0s"/>` +
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset},${y0 - offset}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0.3s"/>` +
      `<rect x="${x0 - offset}" y="${y0 - offset}" width="${A}" height="${B}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" rx="3" class="anim-slide-loop" style="animation-delay: 0.6s"/>` +
      label(x0 - offset + A / 2, y0 - offset + B + 24, fa(length), 'middle', 'svg-label-lg') +
      label(x0 - offset - 12, y0 - offset + B / 2 + 4, fa(height), 'end', 'svg-label-lg') +
      label(x0 + A - offset + C / 2 + 8, y0 - offset - C * 0.3 - 4, fa(width), 'start', 'svg-label-lg')
    );
  },
  fracPieAnim(n, d) {
    const W = 160, H = 160, cx = 80, cy = 80, r = 60;
    let paths = '';
    for (let i = 0; i < d; i++) {
      const a1 = (i / d) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      const fill = i < n ? SC.fill2 : SC.blank;
      const delay = (i * 0.15).toFixed(2);
      if (d === 1) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${SC.stroke}" stroke-width="2" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      } else {
        paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="${SC.stroke}" stroke-width="1.5" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      }
    }
    return svgWrap(W, H, paths);
  },
  fracBarAnim(n, d) {
    const W = 300, H = 90, pad = 20;
    const barW = W - 2 * pad;
    const segW = barW / d;
    const y = 20, h = 35;
    let rects = '';
    for (let i = 0; i < d; i++) {
      const fill = i < n ? SC.fill2 : SC.blank;
      const delay = (i * 0.12).toFixed(2);
      rects += `<rect x="${(pad + i * segW).toFixed(1)}" y="${y}" width="${segW.toFixed(1)}" height="${h}" fill="${fill}" stroke="${SC.stroke}" stroke-width="1.5" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
    }
    const fracText = `<text x="${W/2}" y="${y + h + 25}" text-anchor="middle" class="svg-label-lg" direction="rtl">${fracHTML({ n, d })}</text>`;
    return svgWrap(W, H, rects + fracText);
  },
  numberLineAnim(from, to, value) {
    const W = 340, H = 90, pad = 30;
    const y = 48;
    const step = (W - 2 * pad) / (to - from);
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = from; i <= to; i++) {
      const x = pad + (i - from) * step;
      line += `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" stroke="${SC.stroke}" stroke-width="2"/>`;
      line += `<text x="${x}" y="${y + 26}" text-anchor="middle" class="svg-label" direction="rtl">${fa(i)}</text>`;
    }
    const markerX = pad + (value - from) * step;
    line += `<circle cx="${markerX}" cy="${y}" r="8" fill="${SC.accent}" stroke="var(--card)" stroke-width="2" class="anim-pop-loop" style="animation-delay: 0.5s"/>`;
    line += `<line x1="${markerX}" y1="${y - 22}" x2="${markerX}" y2="${y - 9}" stroke="${SC.accent}" stroke-width="2.5" stroke-linecap="round" class="anim-draw-loop" style="--len: 13; stroke-dasharray: 13; animation-delay: 0.3s"/>`;
    return svgWrap(W, H, line);
  },
  /* اعشار روی محور با تقسیم به دهم */
  decimalLine(marks, highlight, from, to) {
    const W = 360, H = 100, pad = 30;
    const y = 50;
    const range = to - from;
    const step = (W - 2 * pad) / range;
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = 0; i <= range * 10; i++) {
      const v = from + i / 10;
      const x = pad + (v - from) * step;
      const isMain = i % 10 === 0;
      const isHalf = i % 5 === 0 && !isMain;
      const len = isMain ? 8 : (isHalf ? 5 : 3);
      line += `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="${SC.stroke}" stroke-width="${isMain ? 2 : 1}"/>`;
      if (isMain) {
        line += `<text x="${x}" y="${y + 28}" text-anchor="middle" class="svg-label" direction="rtl">${fa(i / 10)}</text>`;
      }
    }
    if (highlight != null) {
      const hx = pad + (highlight - from) * step;
      line += `<circle cx="${hx}" cy="${y}" r="8" fill="${SC.accent}" stroke="var(--card)" stroke-width="2" class="anim-pop-loop" style="animation-delay: 0.5s"/>`;
      line += `<line x1="${hx}" y1="${y - 22}" x2="${hx}" y2="${y - 9}" stroke="${SC.accent}" stroke-width="2.5" stroke-linecap="round" class="anim-draw-loop" style="--len: 13; stroke-dasharray: 13; animation-delay: 0.3s"/>`;
      line += `<text x="${hx}" y="${y - 32}" text-anchor="middle" class="svg-label-lg" style="font-weight:800;fill:${SC.accent}">${faDec(highlight, 1)}</text>`;
    }
    if (Array.isArray(marks)) {
      marks.forEach((m, idx) => {
        const mx = pad + (m - from) * step;
        line += `<circle cx="${mx}" cy="${y}" r="5" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="1.5" class="anim-pop-loop" style="animation-delay: ${0.7 + idx * 0.15}s"/>`;
      });
    }
    return svgWrap(W, H, line);
  },
  /* اعشار جمع روی محور */
  decimalAddOnLine(from, to, a, b) {
    const W = 360, H = 110, pad = 30;
    const y = 55;
    const range = to - from;
    const step = (W - 2 * pad) / range;
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = 0; i <= range * 10; i++) {
      const v = from + i / 10;
      const x = pad + (v - from) * step;
      const isMain = i % 10 === 0;
      const len = isMain ? 8 : 4;
      line += `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="${SC.stroke}" stroke-width="${isMain ? 2 : 1}"/>`;
      if (isMain) line += `<text x="${x}" y="${y + 28}" text-anchor="middle" class="svg-label" direction="rtl">${fa(i / 10)}</text>`;
    }
    const ax = pad + (a - from) * step;
    const bx = pad + (a + b - from) * step;
    line += `<path d="M ${ax} ${y - 12} Q ${(ax+bx)/2} ${y - 34} ${bx} ${y - 12}" fill="none" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len: 200; stroke-dasharray: 200; animation-delay: 0.3s"/>`;
    line += `<circle cx="${ax}" cy="${y}" r="7" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2" class="anim-pop-loop"/>`;
    line += `<circle cx="${bx}" cy="${y}" r="7" fill="${SC.accent}" stroke="${SC.stroke}" stroke-width="2" class="anim-pop-loop" style="animation-delay: 0.6s"/>`;
    line += `<text x="${ax}" y="${y - 22}" text-anchor="middle" class="svg-label" style="fill:${SC.stroke}">${faDec(a, 1)}</text>`;
    line += `<text x="${bx}" y="${y - 22}" text-anchor="middle" class="svg-label-lg" style="fill:${SC.accent};font-weight:800">${faDec(a + b, 1)}</text>`;
    return svgWrap(W, H, line);
  }
};

/* ============================================================
   ۱۰) HINTS + WRAP ANIM
   ============================================================ */
const HINT_BY_TOPIC = {
  perimeter: 'برای دیدن محیط، روی شکل بزن',
  area:      'برای دیدن مساحت، روی شکل بزن',
  volume:    'برای دیدن حجم، روی شکل بزن',
  fractions: 'برای دیدن کسر، روی شکل بزن',
  decimals:  'برای دیدن اعشار، روی محور بزن'
};
const TAP_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a3 3 0 0 1 6 0v6"/><path d="M9 11a3 3 0 0 0-3 3 6 6 0 0 0 6 6h2a5 5 0 0 0 5-5v-3a2 2 0 0 0-4 0"/></svg>`;

function wrapAnim(html, opts) {
  opts = opts || {};
  if (!html) return '';
  const hasAnim = /anim-(draw|fade|pop|slide)-loop/.test(html);
  const wrapClass = (opts.wrapClass !== undefined) ? opts.wrapClass : 'q-shape';
  const wrapStyle = opts.wrapStyle || '';
  const className = wrapClass + (hasAnim ? ' anim-wrap' : '');
  const classAttr = className ? ` class="${className}"` : '';
  const styleAttr = wrapStyle ? ` style="${wrapStyle}"` : '';
  const clickAttr = hasAnim
    ? ` onclick="window.__playAnim(this)" role="button" tabindex="0" aria-label="${opts.hint || 'برای دیدن انیمیشن، بزن'}"`
    : '';
  const hint = (hasAnim && opts.hint)
    ? `<div class="anim-hint-wrap"><span class="anim-hint">${TAP_ICON}${opts.hint}</span></div>`
    : '';
  return `<div${classAttr}${styleAttr}${clickAttr}>${html}${hint}</div>`;
}

/* ============================================================
   ۱۱) DIFFICULTY
   ============================================================ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 6];
  if (diff === 'hard') return [6, 12];
  return [4, 9];
}

/* ============================================================
   ۱۲) UNITS CARD (آموزش واحدهای اندازه‌گیری)
   ============================================================ */
function unitsCard(topic, diff) {
  if (topic === 'perimeter') {
    return `
    <div class="units-card">
      <h3>📏 واحد اندازه‌گیری محیط</h3>
      <p>محیط یعنی <strong>دور تا دور</strong> شکل. برای اندازه‌گیری آن از <strong>سانتی‌متر</strong> یا <strong>متر</strong> استفاده می‌کنیم.</p>
      <div class="highlight">
        <strong>🏷️ سانتی‌متر یعنی چه؟</strong><br>
        همان خط‌کشی که در کیف داری، تقسیم‌بندی‌های ریزش سانتی‌متر است. فاصله‌ی بین هر خط تا خط بعدی = ۱ سانتی‌متر.
      </div>
      <p>پس اگر بگوییم «محیط مربعی ۲۰ سانتی‌متر است»، یعنی اگر بخواهیم با خط‌کش دورش را اندازه بگیریم، ۲۰ تا سانتی‌متر می‌شود.</p>
    </div>`;
  }
  if (topic === 'area') {
    return `
    <div class="units-card">
      <h3>📐 واحد اندازه‌گیری مساحت</h3>
      <p>مساحت یعنی <strong>سطح داخل</strong> شکل. برای اندازه‌گیری آن از <strong>سانتی‌متر مربع</strong> یا <strong>متر مربع</strong> استفاده می‌کنیم.</p>
      <div class="highlight">
        <strong>🟦 سانتی‌متر مربع یعنی چه؟</strong><br>
        یک مربع خیلی کوچک تصور کن که هر ضلعش <strong>۱ سانتی‌متر</strong> است. به این مربع کوچک می‌گوییم «۱ سانتی‌متر مربع».
      </div>
      <p>برای شمارش مساحت، می‌شمریم که چند تا از این مربع‌های کوچک می‌توانند داخل شکل جا بشوند. تعداد آن‌ها = مساحت شکل!</p>
    </div>`;
  }
  if (topic === 'volume') {
    return `
    <div class="units-card">
      <h3>🧊 واحد اندازه‌گیری حجم</h3>
      <p>حجم یعنی <strong>فضای داخل</strong> یک شکل سه‌بعدی. برای اندازه‌گیری آن از <strong>سانتی‌متر مکعب</strong> یا <strong>متر مکعب</strong> استفاده می‌کنیم.</p>
      <div class="highlight">
        <strong>🧊 سانتی‌متر مکعب یعنی چه؟</strong><br>
        یک مکعب کوچک تصور کن که هر ضلعش <strong>۱ سانتی‌متر</strong> است. مثل یک تاس خیلی کوچک. به این می‌گوییم «۱ سانتی‌متر مکعب».
      </div>
      <p>برای حجم، می‌شمریم که چند تا از این مکعب‌های کوچک می‌توانند داخل شکل جا بشوند.</p>
    </div>`;
  }
  if (topic === 'fractions') {
    return `
    <div class="units-card">
      <h3>🍕 مفهوم کسر</h3>
      <p>کسر یعنی <strong>چند قسمت از یک کل</strong>. مثلاً وقتی یک کیک را به ۴ قسمت مساوی تقسیم می‌کنیم و یک قسمت را می‌خوریم، ۱ از ۴ را خورده‌ایم.</p>
      <div class="highlight">
        <strong>🔢 صورت و مخرج:</strong><br>
        - عدد بالا (صورت): چند قسمت برداشته‌ایم<br>
        - عدد پایین (مخرج): کل به چند قسمت تقسیم شده
      </div>
    </div>`;
  }
  if (topic === 'decimals') {
    return `
    <div class="units-card">
      <h3>🔟 مفهوم اعشار</h3>
      <p>اعداد اعشاری برای نشان دادن قسمت‌های <strong>کمتر از یک</strong> استفاده می‌شوند. مثلاً نصف یک سیب را می‌توانیم ۰٫۵ بنویسیم.</p>
      <div class="highlight">
        <strong>📍 جایگاه‌های بعد از ممیز:</strong><br>
        - رقم اول بعد از ممیز: دهم (۰٫۱ = یک‌دهم)<br>
        - رقم دوم: صدم (۰٫۰۱ = یک‌صدم)<br>
        - رقم سوم: هزارم (۰٫۰۰۱ = یک‌هزارم)
      </div>
      <p>روی محور اعداد، هر قسمت بین ۰ و ۱ را می‌توان به ۱۰ قسمت مساوی تقسیم کرد؛ هر قسمت یک دهم است.</p>
    </div>`;
  }
  return '';
}

/* ============================================================
   ۱۳) PROOF CARD (اثبات فرمول)
   ============================================================ */
function proofCard(shapeKey, topic) {
  if (topic === 'area') {
    if (shapeKey === 'tri') {
      return `
      <div class="proof-card">
        <h3>🎨 چرا فرمول مثلث نصف است؟</h3>
        <p>تصور کن یک مثلث داری. اگر یک مثلث دقیقاً مثل خودش را برعکس کنارش بگذاری، با هم می‌شوند یک <strong>مستطیل</strong> یا <strong>متوازی‌الاضلاع</strong>.</p>
        <p>پس مساحت مثلث <strong>نصف</strong> مساحت آن مستطیل است. به همین خاطر در فرمول، در آخر بر ۲ تقسیم می‌کنیم:</p>
        <div class="conclusion">مساحت مثلث = (قاعده × ارتفاع) ÷ ۲</div>
      </div>`;
    }
    if (shapeKey === 'circ') {
      return `
      <div class="proof-card">
        <h3>🎨 چرا از π در فرمول دایره استفاده می‌کنیم؟</h3>
        <p>ریاضی‌دان‌های قدیم کشف کردند که هر دایره‌ای، حدود <strong>۳ برابر و کمی بیشتر</strong> از مربعی است که ضلعش به اندازه‌ی شعاع دایره است.</p>
        <p>آن «کمی بیشتر» عدد خاصی است به نام <strong>π (پی)</strong> که تقریباً برابر <strong>۳٫۱۴</strong> است.</p>
        <div class="conclusion">مساحت دایره = π × شعاع × شعاع</div>
      </div>`;
    }
    if (shapeKey === 'para') {
      return `
      <div class="proof-card">
        <h3>🎨 چرا فرمول متوازی‌الاضلاع مثل مستطیل است؟</h3>
        <p>اگر از یک طرف متوازی‌الاضلاع یک مثلث ببریم و به طرف دیگر بچسبانیم، تبدیل به <strong>مستطیل</strong> می‌شود!</p>
        <p>پس مساحتش همان مساحت آن مستطیل است:</p>
        <div class="conclusion">مساحت = قاعده × ارتفاع</div>
      </div>`;
    }
    if (shapeKey === 'rhom') {
      return `
      <div class="proof-card">
        <h3>🎨 چرا لوزی تقسیم بر ۲ دارد؟</h3>
        <p>لوزی را می‌توان با قطرهایش به <strong>۴ مثلث کوچک</strong> تقسیم کرد. اگر این مثلث‌ها را جدا کنیم و کنار هم بچینیم، یک مستطیل درست می‌شود که عرضش «نصف قطر بزرگ» و ارتفاعش «نصف قطر کوچک» است.</p>
        <div class="conclusion">مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲</div>
      </div>`;
    }
    if (shapeKey === 'trap') {
      return `
      <div class="proof-card">
        <h3>🎨 چرا ذوزنقه این فرمول را دارد؟</h3>
        <p>اگر دو ذوزنقه‌ی دقیقاً یکسان را برعکس هم بچسبانی، یک <strong>مستطیل یا متوازی‌الاضلاع</strong> می‌شود که عرضش = مجموع دو قاعده، و ارتفاعش = همان ارتفاع ذوزنقه.</p>
        <p>پس مساحت یک ذوزنقه <strong>نصف</strong> آن است:</p>
        <div class="conclusion">مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲</div>
      </div>`;
    }
  }
  return '';
}

/* ============================================================
   ۱۴) CONTEXTS
   ============================================================ */
const CTX_P = {
  square: [
    { story: 'یک کاشی مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'دور تا دور این کاشی چند سانتی‌متر است؟' },
    { story: 'زمین بازی مدرسه مربعی است و هر ضلعش', u: 'متر', ask: 'اگر یک دور کامل دور زمین بدویم، چند متر می‌دویم؟' },
    { story: 'سفره‌ی مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'برای دوخت نوار دور سفره چقدر نوار لازم است؟' },
    { story: 'یک باغچه‌ی مربعی داریم که هر ضلعش', u: 'متر', ask: 'برای نرده‌کشی دور باغچه چقدر نرده لازم است؟' }
  ],
  rectangle: [
    { story: 'استخر مستطیلی داریم به طول', u: 'متر', ask: 'برای نصب حفاظ دور آن چقدر حفاظ لازم است؟' },
    { story: 'جلد کتاب ریاضی ما مستطیلی است به طول', u: 'سانتی‌متر', ask: 'دور تا دور جلد کتاب چند سانتی‌متر است؟' },
    { story: 'یک زمین فوتبال مستطیلی داریم به طول', u: 'متر', ask: 'دور تا دور زمین چند متر است؟' }
  ],
  triangle: [
    { story: 'یک زمین مثلثی داریم با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' },
    { story: 'تابلوی هشدار مدرسه مثلثی است با اضلاع', u: 'سانتی‌متر', ask: 'برای قاب‌گیری آن چقدر نوار لازم است؟' }
  ],
  circle: [
    { story: 'استخر دایره‌ای داریم با شعاع', u: 'متر', ask: 'برای کشیدن نرده دور آن چقدر نرده لازم است؟ (π = ۳٫۱۴)' },
    { story: 'یک باغ گل دایره‌ای داریم با شعاع', u: 'متر', ask: 'دور تا دور آن چند متر است؟ (π = ۳٫۱۴)' }
  ],
  parallelogram: [
    { story: 'زمین کشاورزی متوازی‌الاضلاع با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  rhombus: [
    { story: 'باغچه‌ای لوزی‌شکل داریم که هر ضلعش', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  lshape: [
    { story: 'یک زمین L شکل داریم که از دو مستطیل ساخته شده', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  house: [
    { story: 'یک خانه با سقف مثلثی داریم', u: 'متر', ask: 'برای کشیدن نوار دور کل خانه (سقف + دیوارها) چقدر نوار لازم است؟' }
  ],
  park: [
    { story: 'یک زمین ورزشی با دو انتهای نیم‌دایره‌ای داریم', u: 'متر', ask: 'برای یک دور کامل دور آن چقدر می‌دویم؟' }
  ]
};
const CTX_A = {
  square: [
    { story: 'اتاقی مربعی داریم که ضلعش', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'یک کاشی مربعی با ضلع', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' }
  ],
  rectangle: [
    { story: 'زمین فوتبال به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'جلد دفتر به طول', u: 'سانتی‌متر', ask: 'مساحت جلد چقدر است؟' }
  ],
  triangle: [
    { story: 'بیرق مثلثی با قاعده', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' }
  ],
  circle: [
    { story: 'پیتزای دایره‌ای با شعاع', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟ (π = ۳٫۱۴)' }
  ],
  parallelogram: [
    { story: 'زمین کشاورزی متوازی‌الاضلاع با قاعده', u: 'متر', ask: 'مساحت آن چقدر است؟' }
  ],
  rhombus: [
    { story: 'باغچه‌ی لوزی‌شکل با قطرهای', u: 'متر', ask: 'مساحت آن چقدر است؟' }
  ]
};
const CTX_V = {
  cube: [
    { story: 'یک جعبه‌ی مکعبی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' },
    { story: 'یک تاس مکعبی با ضلع', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }
  ],
  box: [
    { story: 'یک جعبه کفش به طول', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' },
    { story: 'یخچال خانه به طول', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }
  ]
};
const CTX_FR = [
  { name: 'علی', u: 'تومان', verb: 'خرج کرد', q: 'چقدر خرج کرد؟' },
  { name: 'مریم', u: 'صفحه', verb: 'خواند', q: 'چند صفحه خواند؟' },
  { name: 'رضا', u: 'لیتر', verb: 'نوشید', q: 'چند لیتر نوشید؟' },
  { name: 'زهرا', u: 'دقیقه', verb: 'ورزش کرد', q: 'چند دقیقه ورزش کرد؟' }
];

/* ============================================================
   ۱۵) PERIMETER GENERATORS
   ============================================================ */
function genSquarePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  if (diff === 'easy') return {
    topic: 'perimeter', key: 'sq-p',
    prompt: `محیط مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.square(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`]
  };
  const ctx = pick(CTX_P.square);
  return {
    topic: 'perimeter', key: 'sq-p',
    prompt: `${ctx.story} ${fa(s)} ${ctx.u} است. ${ctx.ask}`,
    shape: Shapes.square(s), type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genSquarePerimeter.levels = ['easy', 'medium', 'hard'];

function genRectPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b); const ans = 2 * (w + h);
  const distractors = [w * h, w + h, 4 * (w + h), w + h + 2];
  if (diff === 'easy') return {
    topic: 'perimeter', key: 'rect-p',
    prompt: `محیط مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['مستطیل ۴ ضلع دارد: دو طول و دو عرض.', 'محیط = ۲ × (طول + عرض)',
      `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)} سانتی‌متر`]
  };
  const ctx = pick(CTX_P.rectangle);
  return {
    topic: 'perimeter', key: 'rect-p',
    prompt: `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u} است. ${ctx.ask}`,
    shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['مستطیل ۴ ضلع دارد.', 'محیط = ۲ × (طول + عرض)',
      `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRectPerimeter.levels = ['easy', 'medium', 'hard'];

function genTrianglePerimeter(diff) {
  const [a, b] = diffRange(diff);
  let x, y, z, g = 0;
  do { x = ri(a, b); y = ri(a, b); z = ri(a, b); g++; }
  while ((x+y<=z||x+z<=y||y+z<=x) && g < 40);
  if (g >= 40) { x = a; y = a + 1; z = a + 2; }
  const ans = x + y + z;
  const distractors = [x * y * z, x + y, 2 * (x + y + z), x * y];
  const ctx = diff === 'easy' ? { story: '', u: 'سانتی‌متر', ask: '' } : pick(CTX_P.triangle);
  const prompt = diff === 'easy'
    ? `محیط مثلثی با اضلاع ${fa(x)}، ${fa(y)} و ${fa(z)} سانتی‌متر چقدر است؟`
    : `${ctx.story} ${fa(x)}، ${fa(y)} و ${fa(z)} ${ctx.u}. ${ctx.ask}`;
  return {
    topic: 'perimeter', key: 'tri-p', prompt, shape: Shapes.triangle(x, y, z),
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['محیط مثلث = جمع سه ضلع', `محیط = ${eq(`${fa(x)} + ${fa(y)} + ${fa(z)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genTrianglePerimeter.levels = ['easy', 'medium', 'hard'];

function genCirclePerimeter(diff) {
  const r = ri(2, diff === 'hard' ? 6 : 5);
  const ans = round(2 * 3.14 * r, 2);
  const distractors = [round(3.14 * r * r, 2), round(3.14 * r, 2), round(4 * 3.14 * r, 2), r * r];
  const ctx = diff === 'hard' ? pick(CTX_P.circle) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(r)} ${ctx.u}. ${ctx.ask}`
    : `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`;
  return {
    topic: 'perimeter', key: 'circ-p', prompt, shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['محیط دایره = ۲ × π × شعاع', `محیط = ${eq(`۲ × ۳٫۱۴ × ${fa(r)}`)} = ${faDec(ans)}${pct(ctx.u)}`]
  };
}
genCirclePerimeter.levels = ['medium', 'hard'];

function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b); const ans = 2 * (x + y);
  const distractors = [x * y, x + y, 4 * (x + y), 2 * x + y];
  const ctx = diff === 'hard' ? pick(CTX_P.parallelogram) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(x)} و ${fa(y)} ${ctx.u}. ${ctx.ask}`
    : `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'para-p', prompt, shape: Shapes.parallelogram(x, y),
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['اضلاع روبه‌رو مساوی‌اند.', 'محیط = ۲ × (a + b)',
      `محیط = ${eq(`۲ × (${fa(x)} + ${fa(y)})`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genParallelogramPerimeter.levels = ['medium', 'hard'];

function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  const ctx = diff === 'hard' ? pick(CTX_P.rhombus) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}`
    : `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'rhom-p', prompt, shape: Shapes.rhombusSide(s),
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: ['لوزی ۴ ضلع مساوی.', `محیط = ۴ × ضلع = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRhombusPerimeter.levels = ['medium', 'hard'];

function genPolygonPerimeter(diff) {
  const ns = diff === 'easy' ? [3, 4] : diff === 'medium' ? [5, 6] : [6, 8];
  const n = pick(ns);
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = n * s;
  const distractors = [s * s, (n - 1) * s, (n + 1) * s, n + s];
  const nameMap = { 3: 'مثلث', 4: 'مربع', 5: 'پنج‌ضلعی', 6: 'شش‌ضلعی', 8: 'هشت‌ضلعی' };
  const prompt = diff === 'hard'
    ? `باغ گل مدرسه ${nameMap[n]} منتظم با ضلع ${fa(s)} متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟`
    : `محیط یک ${nameMap[n]} منتظم با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'poly-p', prompt, shape: Shapes.regularPolygon(n, s),
    type: 'numeric', answer: ans, unit: diff === 'hard' ? 'متر' : 'سانتی‌متر', distractors,
    steps: [`${nameMap[n]} منتظم یعنی همه اضلاع مساوی.`, 'محیط = تعداد ضلع × ضلع',
      `محیط = ${eq(`${fa(n)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genPolygonPerimeter.levels = ['medium', 'hard'];

function genFindSideFromPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b), p = 4 * s;
  const distractors = [round(p / 2, 2), p, 4 * p, s + 2];
  return {
    topic: 'perimeter', key: 'find-side',
    prompt: `محیط مربعی ${fa(p)} سانتی‌متر است. طول ضلع آن چقدر است؟`,
    shape: Shapes.square('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر', distractors,
    steps: ['محیط = ۴ × ضلع', 'ضلع = محیط ÷ ۴', `ضلع = ${eq(`${fa(p)} ÷ ۴`)} = ${fa(s)}`]
  };
}
genFindSideFromPerimeter.levels = ['hard'];

/* --- شکل‌های ترکیبی محیط --- */
function genLShapePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const W1 = ri(a, b), H1 = ri(a, b);
  const W2 = ri(Math.max(2, Math.floor(W1 / 2)), W1);
  const H2 = ri(a, Math.max(2, b));
  const perimeter = W1 + H1 + W2 + H2 + (W1 - W2) + (H1 + H2);
  // perimeter = all edges around L shape
  const ans = W1 + H1 + W2 + H2 + (W1 - W2) + (H1 + H2);
  // Wait, perimeter of L-shape is sum of all outer edges
  // L-shape: top of small (W2), right of small (H2), right of large (H1 - H2), bottom (W1), left (H1+H2), left of small top (0)
  // Actually simpler: perimeter = 2*(W1+H1+H2) - 2*(W1-W2) ... let me recalc
  // L-shape outline: 
  // Top edge of stem: W2
  // Right of stem: H2
  // Right of lower part (going down): H1 - H2 (if H1 > H2)
  // Bottom: W1
  // Left: H1 + H2
  // Left of stem top: W1 - W2
  // total = W2 + H2 + (H1 - H2 if H1>H2 else 0) + W1 + H1 + H2 + (W1 - W2)
  // Simplify: let H1 be height of lower, H2 be height of stem top
  // Actually original points: top-left(0,0) → top-right(W2, 0) → (W2, H2) → (W1, H2) → (W1, H1+H2) → (0, H1+H2)
  // Edges: W2, H2, W1-W2, H1, W1, H1+H2
  const perim = W2 + H2 + (W1 - W2) + H1 + W1 + (H1 + H2);
  const distractors = [W1 * H1 + W2 * H2, 2*(W1+H1), W1+H1+W2+H2, perim * 2];
  return {
    topic: 'perimeter', key: 'l-p',
    prompt: `این شکل L شکل است (از یک مستطیل بزرگ و یک مستطیل کوچک ساخته شده). محیط آن چقدر است؟`,
    shape: Shapes.lshape(W1, H1, W2, H2), type: 'numeric', answer: perim, unit: 'سانتی‌متر', distractors,
    steps: [
      'محیط یعنی دور تا دور شکل.',
      `اضلاع بیرونی: ${fa(W2)} + ${fa(H2)} + ${fa(W1-W2)} + ${fa(H1)} + ${fa(W1)} + ${fa(H1+H2)}`,
      `جمع همه = ${fa(perim)} سانتی‌متر`
    ]
  };
}
genLShapePerimeter.levels = ['medium', 'hard'];

function genHousePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(4, a), b);
  const H = ri(a, Math.min(6, b));
  const roofH = ri(2, 4);
  // Perimeter of house = two slanted sides of roof + width (base) + 2 sides + top edge (bottom of house base is the ground, not counted)
  // Actually the perimeter around the house shape:
  // Left slant + right slant of roof + right wall + bottom + left wall
  // Slant length = sqrt((W/2)^2 + roofH^2)
  const slant = Math.sqrt((W/2)**2 + roofH**2);
  const perim = round(2 * slant + 2 * H + W, 2);
  const distractors = [2*(W+H) + W, W + H + roofH, W + 2*H, round(slant * 4 + W, 2)];
  return {
    topic: 'perimeter', key: 'house-p',
    prompt: `این خانه از یک مستطیل (اتاق) و یک مثلث (سقف) ساخته شده. محیط کل خانه (سقف + دیوارها + کف) چقدر است؟`,
    shape: Shapes.house(W, H, roofH), type: 'numeric', answer: perim, unit: 'سانتی‌متر', distractors,
    steps: [
      `سقف از دو ضلع شیب‌دار ساخته شده.`,
      `طول هر شیب = √((${fa(W)}÷۲)² + ${fa(roofH)}²) ≈ ${faDec(slant, 2)}`,
      `دیوارها: ۲ × ${fa(H)} = ${fa(2*H)}`,
      `کف: ${fa(W)}`,
      `محیط = ۲ × ${faDec(slant, 2)} + ${fa(2*H)} + ${fa(W)} ≈ ${faDec(perim, 2)}`
    ]
  };
}
genHousePerimeter.levels = ['hard'];

function genParkPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(6, a), Math.min(12, b));
  const H = ri(a, Math.min(6, b));
  const r = H / 2;
  // Perimeter = two straight sides + two semicircle arcs (which together make a full circle)
  const perim = round(2 * W + 2 * 3.14 * r, 2);
  const distractors = [2 * W + H, 2*(W+H), W + 2*H, round(2*W + 3.14*r, 2)];
  return {
    topic: 'perimeter', key: 'park-p',
    prompt: `این زمین ورزشی از یک مستطیل وسط و دو نیم‌دایره در دو طرف ساخته شده. محیط کل چقدر است؟`,
    shape: Shapes.parkWithSemi(W, H, r), type: 'numeric', answer: perim, unit: 'متر', distractors,
    steps: [
      `دو ضلع مستقیم بالا و پایین: ۲ × ${fa(W)} = ${fa(2*W)}`,
      `دو نیم‌دایره با هم = یک دایره کامل با شعاع ${faDec(r, 2)}`,
      `محیط دایره = ۲ × ۳٫۱۴ × ${faDec(r, 2)} ≈ ${faDec(2*3.14*r, 2)}`,
      `محیط کل ≈ ${faDec(perim, 2)} متر`
    ]
  };
}
genParkPerimeter.levels = ['hard'];

/* ============================================================
   ۱۶) AREA GENERATORS
   ============================================================ */
function genSquareArea(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = s * s;
  const distractors = [4 * s, 2 * s, s + s, s + 4];
  const ctx = diff !== 'easy' ? pick(CTX_A.square) : null;
  const prompt = ctx ? `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}` : `مساحت مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'sq-a', prompt, shape: Shapes.square(s),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مربع = ضلع × ضلع', `مساحت = ${eq(`${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genSquareArea.levels = ['easy', 'medium', 'hard'];

function genRectArea(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b); const ans = w * h;
  const distractors = [2 * (w + h), w + h, w * h * 2, w + h + 2];
  const ctx = diff !== 'easy' ? pick(CTX_A.rectangle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u}. ${ctx.ask}`
    : `مساحت مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'rect-a', prompt, shape: Shapes.rectangle(w, h),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مستطیل = طول × عرض', `مساحت = ${eq(`${fa(w)} × ${fa(h)}`)} = ${fa(ans)}`]
  };
}
genRectArea.levels = ['easy', 'medium', 'hard'];

function genTriangleArea(diff) {
  const [a, b] = diffRange(diff);
  let base = ri(a, b), h = ri(a, b);
  if ((base * h) % 2 !== 0) h += 1;
  const ans = (base * h) / 2;
  const distractors = [base * h, base + h, base * h * 2, base + h + 2];
  const ctx = diff === 'hard' ? pick(CTX_A.triangle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(base)} و ارتفاع ${fa(h)}. ${ctx.ask}`
    : `مساحت مثلثی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'tri-a', prompt, shape: Shapes.triangleBH(base, h),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مثلث = (قاعده × ارتفاع) ÷ ۲',
      `مساحت = ${eq(`(${fa(base)} × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genTriangleArea.levels = ['medium', 'hard'];

function genCircleArea(diff) {
  const r = ri(2, diff === 'hard' ? 6 : 5);
  const ans = round(3.14 * r * r, 2);
  const distractors = [round(2 * 3.14 * r, 2), round(3.14 * r, 2), r * r, round(3.14 * r * r * 2, 2)];
  const ctx = diff === 'hard' ? pick(CTX_A.circle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(r)}. ${ctx.ask}`
    : `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`;
  return {
    topic: 'area', key: 'circ-a', prompt, shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت دایره = π × شعاع × شعاع',
      `مساحت = ${eq(`۳٫۱۴ × ${fa(r)} × ${fa(r)}`)} = ${faDec(ans)}`]
  };
}
genCircleArea.levels = ['medium', 'hard'];

function genParallelogramArea(diff) {
  const [a, b] = diffRange(diff);
  const base = ri(a, b), h = ri(a, b); const ans = base * h;
  const distractors = [2 * (base + h), base + h, base * h * 2, base + h + 2];
  const ctx = diff === 'hard' ? pick(CTX_A.parallelogram) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(base)} و ارتفاع ${fa(h)}. ${ctx.ask}`
    : `مساحت متوازی‌الاضلاعی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'para-a', prompt, shape: Shapes.parallelogram(base, 12, h),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت = قاعده × ارتفاع', `مساحت = ${eq(`${fa(base)} × ${fa(h)}`)} = ${fa(ans)}`]
  };
}
genParallelogramArea.levels = ['medium', 'hard'];

function genRhombusArea(diff) {
  const [a, b] = diffRange(diff);
  let d1 = ri(a, b), d2 = ri(a, b);
  if ((d1 * d2) % 2 !== 0) d2 += 1;
  const ans = (d1 * d2) / 2;
  const distractors = [d1 * d2, d1 + d2, d1 * d2 * 2, (d1 + d2) * 2];
  const ctx = diff === 'hard' ? pick(CTX_A.rhombus) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(d1)} و ${fa(d2)}. ${ctx.ask}`
    : `مساحت لوزی با قطرهای ${fa(d1)} و ${fa(d2)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'rhom-a', prompt, shape: Shapes.rhombusD(d1, d2),
    type: 'numeric', answer: ans, unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع', distractors,
    steps: ['مساحت لوزی = (قطر۱ × قطر۲) ÷ ۲',
      `مساحت = ${eq(`(${fa(d1)} × ${fa(d2)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genRhombusArea.levels = ['medium', 'hard'];

function genTrapezoidArea(diff) {
  const [a, b] = diffRange(diff);
  let base1 = ri(a, b), base2 = ri(a, b), h = ri(a, b);
  if (((base1 + base2) * h) % 2 !== 0) h += 1;
  const ans = ((base1 + base2) * h) / 2;
  const distractors = [(base1 + base2) * h, base1 + base2 + h, base1 * base2 * h, (base1 + base2) * 2];
  return {
    topic: 'area', key: 'trap-a',
    prompt: `مساحت ذوزنقه‌ای با دو قاعده ${fa(base1)} و ${fa(base2)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.trapezoid(base1, base2, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      `مساحت = ${eq(`((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genTrapezoidArea.levels = ['hard'];

/* --- شکل‌های ترکیبی مساحت --- */
function genLShapeArea(diff) {
  const [a, b] = diffRange(diff);
  const W1 = ri(a, b), H1 = ri(a, Math.min(6, b));
  const W2 = ri(Math.max(2, Math.floor(W1 / 2)), Math.max(3, W1 - 1));
  const H2 = ri(a, Math.min(6, b));
  const area1 = W1 * H1, area2 = W2 * H2, ans = area1 + area2;
  const distractors = [area1 * area2, W1 + H1 + W2 + H2, 2 * (W1 + H1 + W2 + H2), ans * 2];
  return {
    topic: 'area', key: 'comp-l',
    prompt: 'این شکل L شکل است و از یک مستطیل بزرگ و یک مستطیل کوچک ساخته شده. مساحتش چقدر است؟',
    shape: Shapes.lshape(W1, H1, W2, H2), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['این شکل از دو مستطیل ساخته شده.',
      `مستطیل پایینی (بزرگ): ${eq(`${fa(W1)} × ${fa(H1)}`)} = ${fa(area1)}`,
      `مستطیل بالایی (کوچک): ${eq(`${fa(W2)} × ${fa(H2)}`)} = ${fa(area2)}`,
      `مساحت کل = ${eq(`${fa(area1)} + ${fa(area2)}`)} = ${fa(ans)}`]
  };
}
genLShapeArea.levels = ['easy', 'medium', 'hard'];

function genTShapeArea(diff) {
  const [a, b] = diffRange(diff);
  const WT = ri(Math.max(4, a), b), HT = ri(2, 3);
  const WB = ri(2, Math.max(3, WT - 2)), HB = ri(a, Math.min(6, b));
  const areaT = WT * HT, areaB = WB * HB, ans = areaT + areaB;
  const distractors = [ans * 2, WT + HT + WB + HB, areaT * areaB, Math.abs(areaT - areaB) + 3];
  return {
    topic: 'area', key: 'comp-t',
    prompt: 'این شکل شبیه حرف T است (از یک مستطیل افقی و یک مستطیل عمودی ساخته شده). مساحتش چقدر است؟',
    shape: Shapes.tshape(WT, HT, WB, HB), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['این شکل از دو مستطیل ساخته شده.',
      `مستطیل افقی (بالا): ${eq(`${fa(WT)} × ${fa(HT)}`)} = ${fa(areaT)}`,
      `مستطیل عمودی (پایین): ${eq(`${fa(WB)} × ${fa(HB)}`)} = ${fa(areaB)}`,
      `مساحت کل = ${eq(`${fa(areaT)} + ${fa(areaB)}`)} = ${fa(ans)}`]
  };
}
genTShapeArea.levels = ['medium', 'hard'];

function genUShapeArea(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(5, a), b);
  const H = ri(Math.max(4, a), b);
  const wi = ri(2, Math.max(2, W - 3));
  const hi = ri(2, Math.max(2, H - 2));
  const areaOuter = W * H;
  const areaInner = wi * hi;
  const ans = areaOuter - areaInner;
  const distractors = [areaOuter + areaInner, areaOuter, W + H + wi + hi, ans * 2];
  return {
    topic: 'area', key: 'comp-u',
    prompt: 'این شکل U شکل است (یک مستطیل بزرگ که از بالای وسط، یک مستطیل کوچک از آن بریده شده). مساحتش چقدر است؟',
    shape: Shapes.ushape(W, H, wi, hi), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: [
      `مستطیل بزرگ (کل): ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(areaOuter)}`,
      `مستطیل کوچک (بُرش): ${eq(`${fa(wi)} × ${fa(hi)}`)} = ${fa(areaInner)}`,
      `مساحت U = بزرگ − کوچک = ${eq(`${fa(areaOuter)} − ${fa(areaInner)}`)} = ${fa(ans)}`
    ]
  };
}
genUShapeArea.levels = ['medium', 'hard'];

function genHouseArea(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(4, a), Math.min(8, b));
  const H = ri(a, Math.min(6, b));
  let triH = ri(2, 4);
  if ((W * triH) % 2 !== 0) triH += 1;
  const rectArea = W * H;
  const triArea = (W * triH) / 2;
  const ans = rectArea + triArea;
  const distractors = [Math.abs(rectArea - triArea) + 2, W + H + triH, ans * 2, rectArea * 2];
  return {
    topic: 'area', key: 'comp-house',
    prompt: 'این شکل مثل یک خانه است: یک مستطیل (اتاق) + یک مثلث (سقف). مساحت کل چقدر است؟',
    shape: Shapes.house(W, H, triH), type: 'numeric', answer: ans, unit: 'متر مربع', distractors,
    steps: ['مساحت مستطیل (اتاق) = طول × عرض',
      `${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(rectArea)}`,
      'مساحت مثلث (سقف) = (قاعده × ارتفاع) ÷ ۲',
      `${eq(`(${fa(W)} × ${fa(triH)}) ÷ ۲`)} = ${fa(triArea)}`,
      `مساحت کل = ${eq(`${fa(rectArea)} + ${fa(triArea)}`)} = ${fa(ans)}`]
  };
}
genHouseArea.levels = ['medium', 'hard'];

function genParkArea(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(6, a), Math.min(12, b));
  const H = ri(a, Math.min(6, b));
  const r = H / 2;
  const rectArea = W * H;
  const circleArea = round(3.14 * r * r, 2);
  const ans = round(rectArea + circleArea, 2);
  const distractors = [rectArea, circleArea, W * H + H, round(rectArea + 2 * 3.14 * r, 2)];
  return {
    topic: 'area', key: 'comp-park',
    prompt: 'این زمین ورزشی از یک مستطیل وسط + دو نیم‌دایره در دو طرف ساخته شده. مساحت کل چقدر است؟',
    shape: Shapes.parkWithSemi(W, H, r), type: 'numeric', answer: ans, unit: 'متر مربع', distractors,
    steps: [
      `مستطیل وسط: ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(rectArea)}`,
      `دو نیم‌دایره = یک دایره با شعاع ${faDec(r, 2)}`,
      `مساحت دایره: ۳٫۱۴ × ${faDec(r, 2)} × ${faDec(r, 2)} ≈ ${faDec(circleArea, 2)}`,
      `مساحت کل ≈ ${faDec(ans, 2)} متر مربع`
    ]
  };
}
genParkArea.levels = ['hard'];

function genHouseWithGardenArea(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(5, a), b);
  const H = ri(a, Math.min(5, b));
  let triH = ri(2, 4);
  if ((W * triH) % 2 !== 0) triH += 1;
  const r = ri(Math.max(2, Math.floor(W / 4)), Math.max(3, Math.floor(W / 3)));
  const roofArea = (W * triH) / 2;
  const houseArea = W * H;
  const gardenArea = round(3.14 * r * r / 2, 2);
  const ans = round(roofArea + houseArea + gardenArea, 2);
  const distractors = [houseArea + roofArea, round(houseArea + gardenArea, 2), ans * 2, round(roofArea + gardenArea, 2)];
  return {
    topic: 'area', key: 'comp-villa',
    prompt: 'این شکل از یک سقف مثلثی + یک اتاق مستطیلی + یک باغچه‌ی نیم‌دایره‌ای ساخته شده. مساحت کل چقدر است؟',
    shape: Shapes.houseWithGarden(W, H, triH, r), type: 'numeric', answer: ans, unit: 'متر مربع', distractors,
    steps: [
      `سقف مثلثی: ${eq(`(${fa(W)} × ${fa(triH)}) ÷ ۲`)} = ${fa(roofArea)}`,
      `اتاق مستطیلی: ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(houseArea)}`,
      `باغچه نیم‌دایره: (۳٫۱۴ × ${fa(r)}² ) ÷ ۲ ≈ ${faDec(gardenArea, 2)}`,
      `مساحت کل ≈ ${faDec(ans, 2)} متر مربع`
    ]
  };
}
genHouseWithGardenArea.levels = ['hard'];

/* ============================================================
   ۱۷) VOLUME GENERATORS
   ============================================================ */
function genCubeVolume(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, Math.min(6, b)); const ans = s * s * s;
  const distractors = [s * s, 6 * s * s, 3 * s, s * s * 2];
  if (diff === 'easy') return {
    topic: 'volume', key: 'cube-v',
    prompt: `حجم مکعبی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.cube(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب', distractors,
    steps: ['حجم مکعب = ضلع × ضلع × ضلع', `حجم = ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
  const ctx = pick(CTX_V.cube);
  return {
    topic: 'volume', key: 'cube-v',
    prompt: `${ctx.story} ${fa(s)}. ${ctx.ask}`,
    shape: Shapes.cube(s), type: 'numeric', answer: ans, unit: ctx.u + ' مکعب', distractors,
    steps: ['حجم = ضلع × ضلع × ضلع', `حجم = ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genCubeVolume.levels = ['easy', 'medium', 'hard'];

function genBoxVolume(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, Math.min(6, b)), h = ri(a, Math.min(5, b)), d = ri(a, Math.min(5, b));
  const ans = w * h * d;
  const distractors = [w * h, w + h + d, 2 * (w + h + d), w * h * 2];
  if (diff === 'easy') return {
    topic: 'volume', key: 'box-v',
    prompt: `حجم مکعب مستطیلی به طول ${fa(w)}، عرض ${fa(h)} و ارتفاع ${fa(d)} سانتی‌متر چقدر است؟`,
    shape: Shapes.box(w, h, d), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب', distractors,
    steps: ['حجم = طول × عرض × ارتفاع', `حجم = ${eq(`${fa(w)} × ${fa(h)} × ${fa(d)}`)} = ${fa(ans)}`]
  };
  const ctx = pick(CTX_V.box);
  return {
    topic: 'volume', key: 'box-v',
    prompt: `${ctx.story} ${fa(w)}، عرض ${fa(h)} و ارتفاع ${fa(d)}. ${ctx.ask}`,
    shape: Shapes.box(w, h, d), type: 'numeric', answer: ans, unit: ctx.u + ' مکعب', distractors,
    steps: ['حجم = طول × عرض × ارتفاع', `حجم = ${eq(`${fa(w)} × ${fa(h)} × ${fa(d)}`)} = ${fa(ans)}`]
  };
}
genBoxVolume.levels = ['easy', 'medium', 'hard'];

function genFindEdgeFromVolume(diff) {
  const s = ri(2, 5);
  const v = s * s * s;
  const distractors = [round(v / 3, 2), round(v / 2, 2), round(v * 2, 2), s + 2];
  return {
    topic: 'volume', key: 'find-edge',
    prompt: `حجم مکعبی ${fa(v)} سانتی‌متر مکعب است. ضلع آن چقدر است؟`,
    shape: Shapes.cube('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر', distractors,
    steps: ['حجم مکعب = ضلع × ضلع × ضلع', 'ضلع = ریشه سوم حجم',
      `چون ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(v)}، پس ضلع = ${fa(s)}`]
  };
}
genFindEdgeFromVolume.levels = ['hard'];

/* ============================================================
   ۱۸) FRACTION GENERATORS
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
  const maxD = diff === 'hard' ? 10 : 8;
  let d1, d2;
  if (sameDen) { d1 = d2 = ri(3, maxD); } else { d1 = ri(2, maxD); d2 = ri(2, maxD); }
  const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  const a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  const ans = fracAdd(a, b);
  const choices = makeFracChoices(ans, () => {
    const dd1 = ri(2, maxD), dd2 = ri(2, maxD);
    return fracAdd({ n: ri(1, dd1 - 1), d: dd1 }, { n: ri(1, dd2 - 1), d: dd2 });
  });
  let steps;
  if (sameDen) {
    steps = [`مخرج‌ها مساوی‌اند (${fa(d1)}).`,
      `صورت‌ها را جمع می‌کنیم: ${eq(`${fa(n1)} + ${fa(n2)}`)} = ${fa(n1 + n2)}`,
      `نتیجه: ${fracHTML(ans)}`];
  } else {
    const L = lcm(d1, d2);
    const k1 = L / d1, k2 = L / d2;
    steps = [`مخرج‌ها فرق دارند. مخرج مشترک: ${fa(L)}.`,
      `${fracHTML(a)} = ${fracHTML({ n: n1 * k1, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: n2 * k2, d: L })}`,
      `جمع صورت‌ها: ${eq(`${fa(n1*k1)} + ${fa(n2*k2)}`)} = ${fa(n1*k1 + n2*k2)}`,
      `نتیجه: ${fracHTML(ans)}`];
  }
  return {
    topic: 'fractions', key: 'frac-add',
    prompt: 'حاصل جمع این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} + ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans, steps
  };
}
genFracAdd.levels = ['easy', 'medium', 'hard'];

function genFracSub(diff) {
  const sameDen = diff === 'easy';
  const maxD = diff === 'hard' ? 10 : 8;
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
  let steps;
  if (sameDen) {
    steps = [`مخرج‌ها مساوی (${fa(d1)}).`,
      `صورت‌ها را کم می‌کنیم: ${eq(`${fa(a.n)} − ${fa(b.n)}`)} = ${fa(a.n - b.n)}`,
      `نتیجه: ${fracHTML(ans)}`];
  } else {
    const L = lcm(a.d, b.d);
    const k1 = L / a.d, k2 = L / b.d;
    steps = [`مخرج مشترک: ${fa(L)}.`,
      `${fracHTML(a)} = ${fracHTML({ n: a.n * k1, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: b.n * k2, d: L })}`,
      `تفریق: ${fracHTML(ans)}`];
  }
  return {
    topic: 'fractions', key: 'frac-sub',
    prompt: 'حاصل تفریق این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} − ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans, steps
  };
}
genFracSub.levels = ['easy', 'medium', 'hard'];

function genFracMul(diff) {
  const maxD = diff === 'hard' ? 8 : 6;
  const a = { n: ri(1, 6), d: ri(2, maxD) };
  const b = { n: ri(1, 6), d: ri(2, maxD) };
  const ans = fracMul(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 10), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-mul',
    prompt: 'حاصل ضرب این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} × ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans,
    steps: ['در ضرب، مخرج مشترک لازم نیست.',
      `صورت‌ها: ${eq(`${fa(a.n)} × ${fa(b.n)}`)} = ${fa(a.n * b.n)}`,
      `مخرج‌ها: ${eq(`${fa(a.d)} × ${fa(b.d)}`)} = ${fa(a.d * b.d)}`,
      `نتیجه: ${fracHTML(ans)}`]
  };
}
genFracMul.levels = ['medium', 'hard'];

function genFracDiv(diff) {
  const maxD = diff === 'hard' ? 8 : 6;
  const a = { n: ri(1, 6), d: ri(2, maxD) };
  const b = { n: ri(1, 6), d: ri(2, maxD) };
  const ans = fracDiv(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 10), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-div',
    prompt: 'حاصل تقسیم این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} ÷ ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans,
    steps: ['کسر دوم را معکوس می‌کنیم.',
      `معکوس ${fracHTML(b)} = ${fracHTML({ n: b.d, d: b.n })}`,
      `ضرب: ${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })} = ${fracHTML(ans)}`]
  };
}
genFracDiv.levels = ['hard'];

function genFracSimplify(diff) {
  let a, ans, guard = 0;
  do {
    const base = { n: ri(2, 6), d: ri(2, 8) };
    const k = diff === 'hard' ? ri(3, 5) : ri(2, 3);
    a = { n: base.n * k, d: base.d * k };
    ans = simplify(a.n, a.d);
    guard++;
  } while (ans.n === a.n && ans.d === a.d && guard < 20);
  const choices = makeFracChoices(ans, () => ({ n: ri(2, 10), d: ri(2, 10) }));
  const g = gcd(a.n, a.d);
  return {
    topic: 'fractions', key: 'frac-simplify',
    prompt: 'این کسر را ساده کن:',
    promptHTML: fracHTML(a),
    type: 'choice', choices, correct: ans,
    steps: [`ب.م.م صورت و مخرج: ${fa(g)}`,
      `صورت: ${eq(`${fa(a.n)} ÷ ${fa(g)}`)} = ${fa(ans.n)}`,
      `مخرج: ${eq(`${fa(a.d)} ÷ ${fa(g)}`)} = ${fa(ans.d)}`,
      `نتیجه: ${fracHTML(ans)}`]
  };
}
genFracSimplify.levels = ['easy', 'medium', 'hard'];

function genFracCompare(diff) {
  let d1, d2, n1, n2, a, b, guard = 0;
  const maxD = diff === 'hard' ? 10 : 8;
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
    prompt: 'کدام علامت درست است؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} &nbsp; ? &nbsp; ${fracHTML(b)}</span>`,
    type: 'choice',
    choices: [
      { n: '>', d: null, isSym: true },
      { n: '<', d: null, isSym: true },
      { n: '=', d: null, isSym: true }
    ],
    correct: { n: correct, d: null, isSym: true },
    steps: [`مخرج مشترک: ${fa(L)}`,
      `${fracHTML(a)} = ${fracHTML({ n: a.n * L / d1, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: b.n * L / d2, d: L })}`,
      `${fracHTML(a)} ${correct === '>' ? '>' : '<'} ${fracHTML(b)}`]
  };
}
genFracCompare.levels = ['easy', 'medium', 'hard'];

function genMixedToImproper(diff) {
  const whole = ri(1, diff === 'hard' ? 4 : 3), d = ri(2, 6), n = ri(1, d - 1);
  const imp = { n: whole * d + n, d };
  const choices = makeFracChoices(imp, () => ({ n: ri(2, 30), d: ri(2, 8) }));
  return {
    topic: 'fractions', key: 'mixed-imp',
    prompt: 'این عدد مخلوط را به کسر تبدیل کن:',
    promptHTML: mixedHTML(imp),
    type: 'choice', choices, correct: imp,
    steps: [`(${fa(whole)} × ${fa(d)}) + ${fa(n)} = ${fa(whole * d + n)}`,
      `کسر: ${fracHTML(imp)}`]
  };
}
genMixedToImproper.levels = ['medium', 'hard'];

function genWordFrac(diff) {
  const d = ri(3, 6); const n = ri(1, d - 1);
  const total = d * ri(2, 4);
  const ans = (total / d) * n;
  const distractors = [total, round(total / d, 2), total - ans > 0 ? total - ans : ans + 5, round(total / 2, 2)];
  const ctx = pick(CTX_FR);
  return {
    topic: 'fractions', key: 'frac-word',
    prompt: `${ctx.name} ${fracHTML({ n, d })} از ${fa(total)} ${ctx.u} را ${ctx.verb}. ${ctx.q}`,
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: [`یک قسمت از ${fa(d)}: ${eq(`${fa(total)} ÷ ${fa(d)}`)} = ${fa(total / d)}`,
      `${fa(n)} قسمت: ${eq(`${fa(n)} × ${fa(total / d)}`)} = ${fa(ans)}`]
  };
}
genWordFrac.levels = ['hard'];

/* ============================================================
   ۱۹) DECIMALS GENERATORS
   ============================================================ */
function genDecAdd(diff) {
  const cfg = { easy: [1, 5, 1], medium: [2, 7, 1], hard: [3, 9, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const n2 = round(ri(a * 10, b * 10) / 10, dec);
  const ans = round(n1 + n2, dec);
  const distractors = [round(ans / 2, dec), round(ans * 2, dec), round(ans + 1, dec), round(Math.abs(n1 - n2), dec)];
  return {
    topic: 'decimals', key: 'dec-add',
    prompt: 'حاصل جمع زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} + ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans, distractors,
    steps: ['اعداد را زیر هم با ممیز تراز می‌نویسیم.',
      `${eq(`${faDec(n1, dec)} + ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`]
  };
}
genDecAdd.levels = ['easy', 'medium', 'hard'];

function genDecSub(diff) {
  const cfg = { easy: [1, 5, 1], medium: [2, 7, 1], hard: [3, 9, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  let n1 = round(ri(a * 10, b * 10) / 10, dec);
  let n2 = round(ri(a * 10, b * 10) / 10, dec);
  if (n1 < n2) [n1, n2] = [n2, n1];
  const ans = round(n1 - n2, dec);
  const distractors = [round(n1 + n2, dec), round(ans / 2, dec), round(ans + 1, dec), round(n1, dec)];
  return {
    topic: 'decimals', key: 'dec-sub',
    prompt: 'حاصل تفریق زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} − ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans, distractors,
    steps: ['اعداد را زیر هم با ممیز تراز می‌نویسیم.',
      `${eq(`${faDec(n1, dec)} − ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`]
  };
}
genDecSub.levels = ['easy', 'medium', 'hard'];

function genDecMul(diff) {
  const cfg = { medium: [2, 5, 1], hard: [3, 6, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const whole = ri(2, 6);
  const ans = round(n1 * whole, dec);
  const distractors = [round(n1 + whole, dec), round(ans / 2, dec), round(ans * 2, dec), round(n1, dec)];
  return {
    topic: 'decimals', key: 'dec-mul',
    prompt: 'حاصل ضرب زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} × ${fa(whole)} = ?`),
    type: 'numeric', answer: ans, distractors,
    steps: ['اول بدون ممیز ضرب، بعد ممیز به تعداد ارقام اعشار.',
      `${eq(`${faDec(n1, dec)} × ${fa(whole)}`)} = ${faDec(ans, dec)}`]
  };
}
genDecMul.levels = ['medium', 'hard'];

function genDecDiv(diff) {
  const whole = ri(2, 5);
  const ans = round(ri(5, 20) / 10, 1);
  const n1 = round(ans * whole, 1);
  const distractors = [round(ans * 2, 1), round(ans / 2, 1), round(n1, 1), round(ans + 1, 1)];
  return {
    topic: 'decimals', key: 'dec-div',
    prompt: 'حاصل تقسیم زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, 1)} ÷ ${fa(whole)} = ?`),
    type: 'numeric', answer: ans, distractors,
    steps: [`${eq(`${faDec(n1, 1)} ÷ ${fa(whole)}`)} = ${faDec(ans, 1)}`]
  };
}
genDecDiv.levels = ['hard'];

function genDecCompare(diff) {
  const dec = diff === 'easy' ? 1 : 2;
  const max = diff === 'hard' ? 500 : 99;
  const n1 = round(ri(1, max) / 10, dec);
  let n2 = round(ri(1, max) / 10, dec);
  if (n1 === n2) n2 = round(n1 + 0.1, dec);
  const correct = n1 > n2 ? '>' : '<';
  return {
    topic: 'decimals', key: 'dec-cmp',
    prompt: 'کدام علامت درست است؟',
    promptHTML: eq(`${faDec(n1, dec)} &nbsp; ? &nbsp; ${faDec(n2, dec)}`),
    type: 'choice',
    choices: [
      { n: '>', d: null, isSym: true },
      { n: '<', d: null, isSym: true },
      { n: '=', d: null, isSym: true }
    ],
    correct: { n: correct, d: null, isSym: true },
    steps: ['اول قسمت صحیح، سپس رقم‌های اعشار از چپ به راست.',
      `${eq(`${faDec(n1, dec)} ${correct === '>' ? '>' : '<'} ${faDec(n2, dec)}`)}`]
  };
}
genDecCompare.levels = ['easy', 'medium', 'hard'];

function genFracToDec(diff) {
  const options = [
    { n: 1, d: 2, v: 0.5 }, { n: 1, d: 4, v: 0.25 }, { n: 3, d: 4, v: 0.75 },
    { n: 1, d: 5, v: 0.2 }, { n: 2, d: 5, v: 0.4 }, { n: 3, d: 5, v: 0.6 },
    { n: 1, d: 10, v: 0.1 }, { n: 3, d: 10, v: 0.3 }
  ];
  const pool = diff === 'easy' ? options.filter(o => [0.5, 0.25, 0.2].includes(o.v)) : options;
  const f = pick(pool);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3);
  const choices = shuffle([
    { n: String(f.v), d: null, isNum: true },
    ...wrong.map(o => ({ n: String(o.v), d: null, isNum: true }))
  ]);
  return {
    topic: 'decimals', key: 'frac-dec',
    prompt: 'این کسر را به اعشار تبدیل کن:',
    promptHTML: fracHTML(f),
    type: 'choice', choices, correct: { n: String(f.v), d: null, isNum: true },
    steps: [`${eq(`${fa(f.n)} ÷ ${fa(f.d)}`)} = ${faDec(f.v, 3)}`]
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
    prompt: 'این اعشار را به کسر تبدیل کن:',
    promptHTML: eq(faDec(f.v, 3)),
    type: 'choice', choices, correct: { n: f.n, d: f.d },
    steps: [`مخرج بر اساس تعداد ارقام اعشار.`, `نتیجه: ${fracHTML({ n: f.n, d: f.d })}`]
  };
}
genDecToFrac.levels = ['medium', 'hard'];

function genDecWord(diff) {
  const whole = ri(2, 4);
  const price = round(ri(15, 45) / 10, 1);
  const ans = round(whole * price, 1);
  const distractors = [round(ans / 2, 1), round(ans * 2, 1), round(price + whole, 1), round(price, 1)];
  return {
    topic: 'decimals', key: 'dec-word',
    prompt: `قیمت یک دفتر ${faDec(price, 1)} هزار تومان است. قیمت ${fa(whole)} دفتر چقدر می‌شود؟`,
    type: 'numeric', answer: ans, unit: 'هزار تومان', distractors,
    steps: [`${eq(`${faDec(price, 1)} × ${fa(whole)}`)} = ${faDec(ans, 1)}`]
  };
}
genDecWord.levels = ['hard'];

/* --- اعشار روی محور --- */
function genDecOnLine(diff) {
  const vals = diff === 'easy'
    ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    : [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
  const v = pick(vals);
  const wrongs = shuffle(vals.filter(x => x !== v)).slice(0, 3);
  const choices = shuffle([v, ...wrongs].map(x => ({ n: String(x), d: null, isNum: true })));
  return {
    topic: 'decimals', key: 'dec-line',
    prompt: 'نشانگر روی محور چه عددی را نشان می‌دهد؟',
    promptHTML: ShapesAnim.decimalLine([], v, 0, 1),
    type: 'choice', choices, correct: { n: String(v), d: null, isNum: true },
    steps: [`نشانگر روی ${faDec(v, 2)} است.`, `هر تقسیم کوچک = یک‌دهم`]
  };
}
genDecOnLine.levels = ['easy', 'medium'];

function genDecAddOnLine(diff) {
  const a = round(ri(1, 5) / 10, 1);
  const b = round(ri(1, 4) / 10, 1);
  const ans = round(a + b, 1);
  const choices = shuffle([
    { n: String(ans), d: null, isNum: true },
    { n: String(round(a + b + 0.1, 1)), d: null, isNum: true },
    { n: String(round(Math.abs(a - b), 1)), d: null, isNum: true },
    { n: String(round(a + b - 0.1, 1)), d: null, isNum: true }
  ]);
  return {
    topic: 'decimals', key: 'dec-line-add',
    prompt: 'روی محور اعداد، از عدد اول به اندازه‌ی عدد دوم جلو برو. به چه عددی می‌رسیم؟',
    promptHTML: ShapesAnim.decimalAddOnLine(0, 1.2, a, b),
    type: 'choice', choices, correct: { n: String(ans), d: null, isNum: true },
    steps: [`از ${faDec(a, 1)} شروع می‌کنیم.`,
      `${faDec(b, 1)} واحد به راست می‌رویم.`,
      `نتیجه: ${faDec(ans, 1)}`]
  };
}
genDecAddOnLine.levels = ['medium', 'hard'];

function genDecSubOnLine(diff) {
  const a = round(ri(5, 9) / 10, 1);
  const b = round(ri(1, 4) / 10, 1);
  const ans = round(a - b, 1);
  const choices = shuffle([
    { n: String(ans), d: null, isNum: true },
    { n: String(round(a + b, 1)), d: null, isNum: true },
    { n: String(round(a - b + 0.1, 1)), d: null, isNum: true },
    { n: String(round(a - b - 0.1, 1)), d: null, isNum: true }
  ]);
  return {
    topic: 'decimals', key: 'dec-line-sub',
    prompt: `روی محور اعداد، از ${faDec(a, 1)} به اندازه‌ی ${faDec(b, 1)} به عقب برگرد. کجا می‌رسیم؟`,
    promptHTML: ShapesAnim.decimalAddOnLine(0, 1, ans, b),
    type: 'choice', choices, correct: { n: String(ans), d: null, isNum: true },
    steps: [`از ${faDec(a, 1)} شروع می‌کنیم.`,
      `${faDec(b, 1)} واحد به چپ می‌رویم.`,
      `نتیجه: ${faDec(ans, 1)}`]
  };
}
genDecSubOnLine.levels = ['medium', 'hard'];

/* ============================================================
   ۲۰) GENERATOR POOL
   ============================================================ */
const Generators = {
  perimeter: [
    genSquarePerimeter, genRectPerimeter, genTrianglePerimeter,
    genCirclePerimeter, genParallelogramPerimeter, genRhombusPerimeter,
    genPolygonPerimeter, genFindSideFromPerimeter,
    genLShapePerimeter, genHousePerimeter, genParkPerimeter
  ],
  area: [
    genSquareArea, genRectArea, genTriangleArea, genCircleArea,
    genParallelogramArea, genRhombusArea, genTrapezoidArea,
    genLShapeArea, genTShapeArea, genUShapeArea,
    genHouseArea, genParkArea, genHouseWithGardenArea
  ],
  volume: [genCubeVolume, genBoxVolume, genFindEdgeFromVolume],
  fractions: [genFracAdd, genFracSub, genFracMul, genFracDiv, genFracSimplify, genFracCompare, genMixedToImproper, genWordFrac],
  decimals: [genDecAdd, genDecSub, genDecMul, genDecDiv, genDecCompare, genFracToDec, genDecToFrac, genDecWord, genDecOnLine, genDecAddOnLine, genDecSubOnLine]
};

const TOPIC_NAMES = { perimeter: 'محیط', area: 'مساحت', volume: 'حجم', fractions: 'کسرها', decimals: 'اعداد اعشاری' };
const TOPIC_EMOJIS = { perimeter: '📏', area: '📐', volume: '🧊', fractions: '🍰', decimals: '🔢' };
const ALL_TOPICS = ['perimeter', 'area', 'volume', 'fractions', 'decimals'];

function generateQuestion(topic, difficulty) {
  const all = Generators[topic] || [];
  let pool = all.filter(g => g.levels && g.levels.includes(difficulty));
  if (!pool.length) pool = all;
  if (!pool.length) return null;
  const q = pick(pool)(difficulty);
  return numericToChoice(q);
}

/* ============================================================
   ۲۱) GAMIFICATION
   ============================================================ */
const BADGES = [
  { id: 'first', emoji: '🎯', name: 'اولین قدم', desc: 'اولین پاسخ درست' },
  { id: 'streak5', emoji: '🔥', name: '۵ تایی', desc: '۵ پاسخ درست پشت‌سرهم' },
  { id: 'streak10', emoji: '⚡', name: '۱۰ تایی', desc: '۱۰ پاسخ درست پشت‌سرهم' },
  { id: 'coin50', emoji: '💰', name: 'کیسه‌ی طلا', desc: '۵۰ سکه' },
  { id: 'star10', emoji: '⭐', name: 'ستاره‌چین', desc: '۱۰ ستاره' },
  { id: 'level3', emoji: '🏅', name: 'سطح ۳', desc: 'رسیدن به سطح ۳' },
  { id: 'master', emoji: '🧠', name: 'استاد', desc: '۲۰ پاسخ درست' },
  { id: 'perfect', emoji: '💎', name: 'بی‌نقص', desc: 'آزمون با نمره‌ی ۱۰۰٪' }
];

function awardCorrect(streak) {
  const s = activeStudent();
  if (!s) return;
  s.stats.xp += 10 + Math.min(streak, 10) * 2;
  s.stats.coins += 1 + Math.floor(streak / 3);
  s.stats.stars += streak >= 3 ? 1 : 0;
  checkLevelUp(); checkBadges(); saveState();
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
function checkBadges() {
  const s = activeStudent();
  if (!s) return;
  let count = 0;
  const add = id => { if (!s.stats.badges.includes(id)) { s.stats.badges.push(id); count++; } };
  if (s.stats.totalCorrect >= 1) add('first');
  if (s.stats.bestStreak >= 5) add('streak5');
  if (s.stats.bestStreak >= 10) add('streak10');
  if (s.stats.coins >= 50) add('coin50');
  if (s.stats.stars >= 10) add('star10');
  if (s.stats.level >= 3) add('level3');
  if (s.stats.totalCorrect >= 20) add('master');
  if (count > 0) showFloat(count === 1 ? '🏆 نشان جدید گرفتی!' : `🏆 ${fa(count)} نشان جدید!`);
}
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
   ۲۲) ROUTER
   ============================================================ */
let route = { name: 'home', params: {} };
let session = null;
let examTimer = null;

function navigate(name, params = {}) {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  if (session && ['students', 'addStudent', 'home', 'profile', 'contact'].includes(name)) session = null;
  route = { name, params };
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ۲۳) COMMON
   ============================================================ */
const app = document.getElementById('app');

function themeIcon() {
  const t = state.settings.theme || 'auto';
  if (t === 'dark') return '🌙';
  if (t === 'light') return '☀️';
  return '🌓';
}
function header(title, showBack = false) {
  return `
  <div class="top-bar">
    ${showBack ? `<button class="icon-btn back-btn" onclick="window.__goBack()" aria-label="بازگشت">➜</button>` : `<span style="width:44px"></span>`}
    <h1>${title}</h1>
    <button class="icon-btn theme-btn" onclick="window.__cycleTheme()" aria-label="تغییر تم" title="روشن / تاریک / خودکار">${themeIcon()}</button>
    <button class="icon-btn" onclick="window.__nav('profile')" aria-label="پروفایل">👤</button>
  </div>`;
}
function bottomNav() {
  const items = [
    { id: 'home', ico: '🏠', label: 'خانه' },
    { id: 'perimeter', ico: '📏', label: 'محیط' },
    { id: 'area', ico: '📐', label: 'مساحت' },
    { id: 'volume', ico: '🧊', label: 'حجم' },
    { id: 'fractions', ico: '🍰', label: 'کسر' },
    { id: 'decimals', ico: '🔢', label: 'اعشار' }
  ];
  return `<nav class="bottom-nav" aria-label="ناوبری">${items.map(it => `
    <button class="nav-btn ${route.name === it.id ? 'active' : ''}" onclick="window.__nav('${it.id}')" aria-label="${it.label}">
      <span class="ico">${it.ico}</span>
      <span>${it.label}</span>
    </button>`).join('')}</nav>`;
}

/* ============================================================
   ۲۴) STUDENTS
   ============================================================ */
function viewStudents() {
  const hasStudents = state.students.length > 0;
  return `
  ${header('👥 دانش‌آموزان')}
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:3.5rem">👨‍🎓</div>
    <h2 style="margin:8px 0">${hasStudents ? 'کدام دانش‌آموز؟' : 'خوش آمدی!'}</h2>
    <p style="color:var(--muted);margin:0">${hasStudents ? 'روی اسم خودت بزن.' : 'اول اسمت را وارد کن.'}</p>
  </div>
  ${hasStudents ? `<div class="grid">
    ${state.students.map(s => `
      <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px">
        <div class="student-avatar" onclick="window.__selectStudent('${s.id}')" role="button" tabindex="0" style="cursor:pointer">${escHtml(s.name[0] || '؟')}</div>
        <div class="student-info" onclick="window.__selectStudent('${s.id}')" role="button" tabindex="0" style="cursor:pointer;flex:1">
          <p class="student-name" style="margin:0">${escHtml(fullName(s))}</p>
          <p class="student-meta" style="margin:2px 0 0">پایه ${fa(s.grade)} — سطح ${fa(s.stats.level)}</p>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation();window.__deleteStudent('${s.id}')" aria-label="حذف">🗑️</button>
      </div>`).join('')}
  </div>` : ''}
  <button class="btn full" style="margin-top:16px" onclick="window.__nav('addStudent')">➕ افزودن دانش‌آموز</button>`;
}

function viewAddStudent() {
  return `
  ${header('➕ دانش‌آموز جدید', true)}
  <div class="card">
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">نام:</span>
      <input type="text" id="stuName" class="num-input" style="text-align:right;font-weight:400;margin-top:6px" placeholder="مثلاً علی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">نام خانوادگی (اختیاری):</span>
      <input type="text" id="stuFamily" class="num-input" style="text-align:right;font-weight:400;margin-top:6px" placeholder="مثلاً نوری" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">پایه تحصیلی:</span>
      <select id="stuGrade" class="num-input" style="text-align:right;margin-top:6px">
        ${[4, 5, 6, 7, 8, 9].map(g => `<option value="${g}" ${g === 4 ? 'selected' : ''}>پایه ${fa(g)}</option>`).join('')}
      </select>
    </label>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__createStudent()">✅ ساخت پروفایل</button>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۵) HOME / PROFILE / TOPIC
   ============================================================ */
function viewHome() {
  return `
  ${header('ریاضی‌یار 🎓')}
  <p style="color:var(--muted);margin:0 0 12px;text-align:center">یک موضوع را انتخاب کن:</p>
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('perimeter')"><span class="icon-big">📏</span><h3 class="card-title">محیط</h3><p class="card-desc">دور شکل‌ها</p></button>
    <button class="card card-btn" onclick="window.__nav('area')"><span class="icon-big">📐</span><h3 class="card-title">مساحت</h3><p class="card-desc">سطح شکل‌ها</p></button>
    <button class="card card-btn" onclick="window.__nav('volume')"><span class="icon-big">🧊</span><h3 class="card-title">حجم</h3><p class="card-desc">داخل شکل‌های ۳بعدی</p></button>
    <button class="card card-btn" onclick="window.__nav('fractions')"><span class="icon-big">🍰</span><h3 class="card-title">کسرها</h3><p class="card-desc">قسمت‌هایی از یک کل</p></button>
    <button class="card card-btn" onclick="window.__nav('decimals')"><span class="icon-big">🔢</span><h3 class="card-title">اعداد اعشاری</h3><p class="card-desc">با ممیز</p></button>
    <button class="card card-btn" onclick="window.__nav('progress')"><span class="icon-big">📊</span><h3 class="card-title">پیشرفت من</h3><p class="card-desc">نمودار یادگیری</p></button>
  </div>
  <div style="margin-top:14px">
    <button class="card card-btn" style="width:100%;text-align:center;background:var(--hint-bg);border:2px solid var(--primary-l)" onclick="window.__nav('multiExamSetup')">
      <span class="icon-big">🎯</span>
      <h3 class="card-title" style="justify-content:center">آزمون جامع</h3>
      <p class="card-desc">از چند درس مختلف</p>
    </button>
  </div>
  ${bottomNav()}`;
}

function viewProfile() {
  const s = activeStudent();
  if (!s) return `<div class="empty">دانش‌آموزی انتخاب نشده</div>`;
  return `
  ${header('👤 پروفایل من', true)}
  <div class="profile-hero">
    <div class="profile-avatar">${escHtml(s.name[0] || '؟')}</div>
    <p class="profile-name">${escHtml(fullName(s))}</p>
    <p class="profile-meta">پایه ${fa(s.grade)}</p>
  </div>
  <div class="card">
    <h3 class="card-title">🏆 دستاوردهای من</h3>
    <div class="stats-row">
      <div class="stat-item"><div class="stat-value">${fa(s.stats.level)}</div><div class="stat-label">سطح</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.coins)}</div><div class="stat-label">🪙 سکه</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.stars)}</div><div class="stat-label">⭐ ستاره</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.bestStreak)}</div><div class="stat-label">🔥 رکورد</div></div>
    </div>
  </div>
  <div class="card">
    <h3 class="card-title">🎖️ نشان‌ها</h3>
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${BADGES.map(b => `<div class="badge ${s.stats.badges.includes(b.id) ? 'earned' : 'locked'}" title="${b.desc}"><span class="emoji">${b.emoji}</span><span class="name">${b.name}</span></div>`).join('')}
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn sec full" onclick="window.__nav('students')">🔄 تغییر دانش‌آموز</button>
    <button class="btn info full" onclick="window.__nav('settings')">⚙️ تنظیمات</button>
  </div>
  <div class="card" style="text-align:center;margin-top:14px">
    <p style="color:var(--muted);font-size:.85rem;margin:0 0 10px">
      ساخته شده با ❤️ توسط <strong style="direction:ltr;display:inline-block">maysam261</strong>
    </p>
    <button class="btn info full" onclick="window.__nav('contact')">📞 ارتباط با تهیه‌کننده</button>
  </div>
  ${bottomNav()}`;
}

function viewTopic(topic) {
  const titles = { perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم', fractions: '🍰 کسرها', decimals: '🔢 اعداد اعشاری' };
  return `
  ${header(titles[topic], true)}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('learn', {topic:'${topic}'})"><span class="icon-big">📚</span><h3 class="card-title">آموزش</h3><p class="card-desc">با انیمیشن و مثال</p></button>
    <button class="card card-btn" onclick="window.__nav('practice', {topic:'${topic}'})"><span class="icon-big">✏️</span><h3 class="card-title">تمرین</h3><p class="card-desc">سوال‌های چهارگزینه‌ای</p></button>
    <button class="card card-btn" onclick="window.__nav('examSetup', {topic:'${topic}'})"><span class="icon-big">🎯</span><h3 class="card-title">آزمون</h3><p class="card-desc">با کارنامه</p></button>
    <button class="card card-btn" onclick="window.__nav('progress')"><span class="icon-big">📊</span><h3 class="card-title">پیشرفت</h3><p class="card-desc">درصد یادگیری</p></button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۶) CONTACT — لوگوهای لوکال
   ============================================================ */
function brandLogo(opts) {
  const { src, alt, fallbackEmoji, bgColor } = opts;
  return `<span style="display:inline-flex;flex-shrink:0;width:64px;height:64px">
    <img src="${src}" alt="${alt || ''}" width="64" height="64" loading="lazy"
      style="width:64px;height:64px;object-fit:contain;border-radius:50%;flex-shrink:0"
      onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">
    <span style="display:none;width:64px;height:64px;flex-shrink:0;border-radius:50%;background:${bgColor || '#eee'};align-items:center;justify-content:center;font-size:2.4rem;line-height:1">${fallbackEmoji || '💬'}</span>
  </span>`;
}

const CONTACT_LINKS = [
  { name: 'تلگرام', url: 'https://t.me/MaySam261', src: 'icons/telegram-logo.png', emoji: '✈️', bg: '#229ED9' },
  { name: 'بله', url: 'https://ble.ir/maysam261', src: 'icons/bale-logo.png', emoji: '💚', bg: '#3BB54A' },
  { name: 'ایتا', url: 'https://eitaa.com/maysam261', src: 'icons/eitaa-logo.png', emoji: '📘', bg: '#E15549' }
];

function viewContact() {
  return `
  ${header('📞 ارتباط با تهیه‌کننده', true)}
  <div class="card" style="text-align:center">
    <div style="font-size:3.5rem;margin-bottom:8px">👨‍💻</div>
    <h2 style="margin:8px 0;direction:ltr">maysam261</h2>
    <p style="color:var(--muted);margin:0">تهیه‌کننده‌ی ریاضی‌یار</p>
  </div>
  <p style="color:var(--muted);margin:20px 0 14px;text-align:center;font-size:.9rem">
    برای ارتباط، روی لوگوی پیام‌رسان مورد نظر بزن:
  </p>
  <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;padding:10px 0">
    ${CONTACT_LINKS.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer"
         aria-label="ارتباط از طریق ${link.name}" title="${link.name}"
         style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:inherit;transition:transform .15s ease"
         onmouseover="this.style.transform='scale(1.08)'"
         onmouseout="this.style.transform='scale(1)'"
         ontouchstart="this.style.transform='scale(0.92)'"
         ontouchend="this.style.transform='scale(1)'">
        ${brandLogo({ src: link.src, alt: 'لوگوی ' + link.name, fallbackEmoji: link.emoji, bgColor: link.bg })}
        <span style="font-size:.85rem;font-weight:600;color:var(--primary-d)">${link.name}</span>
      </a>`).join('')}
  </div>
  <div class="card" style="margin-top:20px;text-align:center;background:var(--hint-bg);border:2px solid var(--primary-l)">
    <p style="margin:0;font-size:.9rem;color:var(--primary-d);font-weight:500">💌 خوشحال می‌شوم نظرات و پیشنهادهایت را بشنوم!</p>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۷) LESSONS
   ============================================================ */
const LESSONS = {
  perimeter: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛', formula: 'محیط = ۴ × ضلع',
      paragraphs: [
        'مربع یک شکل زیبا است که ۴ ضلع مساوی دارد. مثل کاشی، مثل صفحه‌ی شطرنج.',
        'محیط یعنی «دور تا دور» شکل. اگر بخواهیم دور یک باغچه‌ی مربعی نرده بکشیم، به محیط نیاز داریم.',
        'چون هر چهار ضلع مساوی‌اند، کافیست یک ضلع را در ۴ ضرب کنیم.'
      ],
      examples: [
        { text: 'یک کاشی مربعی با ضلع ۳ سانتی‌متر. دور تا دورش چقدر است؟', shape: ShapesAnim.tracingSquare(3),
          steps: ['ضلع = ۳ سانتی‌متر', '۴ × ۳ = ۱۲'], answer: '۱۲ سانتی‌متر' },
        { text: 'زمین بازی مربعی با ضلع ۶ متر. یک دور کامل؟', shape: ShapesAnim.tracingSquare(6),
          steps: ['۴ × ۶ = ۲۴'], answer: '۲۴ متر' },
        { text: 'محیط مربعی ۲۴ سانتی‌متر است. ضلعش؟', shape: Shapes.square('?'),
          steps: ['ضلع = محیط ÷ ۴', '۲۴ ÷ ۴ = ۶'], answer: '۶ سانتی‌متر' }
      ],
      tips: ['محیط یعنی دور تا دور.', 'همیشه واحد را بنویس.'],
      pitfalls: ['اشتباه نکن! مساحت = ضلع × ضلع، محیط = ۴ × ضلع.']
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'محیط = ۲ × (طول + عرض)',
      paragraphs: [
        'مستطیل ۴ ضلع دارد، ولی فقط اضلاع روبه‌رو مساوی‌اند.',
        'برای محیط، اول طول و عرض را جمع می‌کنیم، بعد در ۲ ضرب.'
      ],
      examples: [
        { text: 'دفتری با طول ۵ و عرض ۳ سانتی‌متر. دورش چقدر است؟', shape: ShapesAnim.tracingRect(5, 3),
          steps: ['۵ + ۳ = ۸', '۲ × ۸ = ۱۶'], answer: '۱۶ سانتی‌متر' },
        { text: 'استخر با طول ۱۰ و عرض ۴ متر. دورش؟', shape: ShapesAnim.tracingRect(10, 4),
          steps: ['۱۰ + ۴ = ۱۴', '۲ × ۱۴ = ۲۸'], answer: '۲۸ متر' },
        { text: 'زمین فوتبال با طول ۱۲ و عرض ۷. یک دور؟', shape: ShapesAnim.tracingRect(12, 7),
          steps: ['۱۲ + ۷ = ۱۹', '۲ × ۱۹ = ۳۸'], answer: '۳۸ متر' }
      ],
      tips: ['اضلاع روبه‌رو مساوی‌اند.'],
      pitfalls: ['طول و عرض را جمع نکن؛ اول جمع، بعد ضرب در ۲.']
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'محیط = ضلع۱ + ضلع۲ + ضلع۳',
      paragraphs: [
        'مثلث ۳ ضلع و ۳ گوشه دارد.',
        'برای محیط، سه ضلع را با هم جمع می‌کنیم.'
      ],
      examples: [
        { text: 'مثلثی با اضلاع ۳، ۴، ۵.', shape: ShapesAnim.tracingTriangle(3, 4, 5),
          steps: ['۳ + ۴ = ۷', '۷ + ۵ = ۱۲'], answer: '۱۲ سانتی‌متر' },
        { text: 'مثلثی با اضلاع ۶، ۷، ۸ متر.', shape: ShapesAnim.tracingTriangle(6, 7, 8),
          steps: ['۶ + ۷ + ۸ = ۲۱'], answer: '۲۱ متر' }
      ],
      tips: ['مجموع دو ضلع کوچک باید بزرگ‌تر از ضلع بزرگ باشد.'],
      pitfalls: ['نیازی نیست همه اضلاع مساوی باشند.']
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪', formula: 'محیط = ۲ × π × شعاع',
      paragraphs: [
        'دایره یک شکل گرد. فاصله‌ی مرکز تا لبه = شعاع.',
        'قطر = ۲ × شعاع. π ≈ ۳٫۱۴.'
      ],
      examples: [
        { text: 'دایره با شعاع ۲.', shape: ShapesAnim.circleRadiusAnim(2),
          steps: ['۲ × ۳٫۱۴ × ۲', '= ۱۲٫۵۶'], answer: '۱۲٫۵۶ سانتی‌متر' },
        { text: 'دایره با قطر ۶ متر.', shape: ShapesAnim.circleRadiusAnim(3),
          steps: ['شعاع = ۳', '۲ × ۳٫۱۴ × ۳ = ۱۸٫۸۴'], answer: '۱۸٫۸۴ متر' }
      ],
      tips: ['قطر = ۲ × شعاع.'],
      pitfalls: ['اگر قطر داری، اول بر ۲ تقسیم کن.']
    },
    {
      id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟', formula: 'محیط = تعداد ضلع × ضلع',
      paragraphs: ['همه‌ی ضلع‌ها مساوی و همه‌ی زوایا برابر.'],
      examples: [
        { text: 'شش‌ضلعی با ضلع ۳.', shape: Shapes.regularPolygon(6, 3),
          steps: ['۶ × ۳ = ۱۸'], answer: '۱۸ سانتی‌متر' },
        { text: 'پنج‌ضلعی با ضلع ۴ متر.', shape: Shapes.regularPolygon(5, 4),
          steps: ['۵ × ۴ = ۲۰'], answer: '۲۰ متر' }
      ],
      tips: ['تعداد ضلع را از نام شکل بخوان.'],
      pitfalls: ['تعداد ضلع را فراموش نکن.']
    },
    {
      id: 'lshape', title: 'شکل L', emoji: '🇱', formula: 'محیط = جمع همه‌ی اضلاع بیرونی',
      paragraphs: [
        'شکل L از یک مستطیل بزرگ و یک مستطیل کوچک ساخته می‌شود.',
        'برای محیط، باید همه‌ی اضلاع بیرونی را بشماریم.'
      ],
      examples: [
        { text: 'یک شکل L شکل با اندازه‌های داده‌شده. محیطش چقدر است؟', shape: ShapesAnim.tracingRect(4, 5),
          steps: ['اضلاع بیرونی را یکی‌یکی جمع می‌کنیم.'], answer: 'مجموع اضلاع بیرونی' },
        { text: 'محیط شکل L زیر را حساب کن.', shape: Shapes.lshape(5, 4, 3, 3),
          steps: ['بالا: ۳', 'راست بالا: ۳', 'میان: ۲', 'راست پایین: ۴', 'پایین: ۵', 'چپ: ۷', 'جمع: ۳+۳+۲+۴+۵+۷ = ۲۴'], answer: '۲۴' }
      ],
      tips: ['همه‌ی اضلاع بیرونی را دقیق بشمار.'],
      pitfalls: ['اضلاع داخلی را نشمار.']
    }
  ],
  area: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛', formula: 'مساحت = ضلع × ضلع',
      paragraphs: ['مساحت = چقدر سطح داخل شکل جا می‌شود.', 'برای مساحت مربع، ضلع را در خودش ضرب می‌کنیم.'],
      examples: [
        { text: 'کاشی مربعی با ضلع ۳.', shape: ShapesAnim.gridSquare(3),
          steps: ['۳ × ۳ = ۹'], answer: '۹ سانتی‌متر مربع' },
        { text: 'اتاق مربعی با ضلع ۴ متر.', shape: ShapesAnim.gridSquare(4),
          steps: ['۴ × ۴ = ۱۶'], answer: '۱۶ متر مربع' },
        { text: 'مساحت مربعی ۲۵ سانتی‌متر مربع. ضلعش؟', shape: Shapes.square('?'),
          steps: ['√۲۵ = ۵'], answer: '۵ سانتی‌متر' }
      ],
      tips: ['واحد مساحت «مربع» دارد.'],
      pitfalls: ['اشتباه با محیط نکن.']
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'مساحت = طول × عرض',
      paragraphs: ['طول × عرض = مساحت مستطیل.'],
      examples: [
        { text: 'دفتری با طول ۵ و عرض ۳.', shape: ShapesAnim.gridRect(5, 3),
          steps: ['۵ × ۳ = ۱۵'], answer: '۱۵ سانتی‌متر مربع' },
        { text: 'زمین فوتبال با طول ۱۲ و عرض ۶.', shape: ShapesAnim.gridRect(12, 6),
          steps: ['۱۲ × ۶ = ۷۲'], answer: '۷۲ متر مربع' },
        { text: 'باغچه با طول ۸ و عرض ۳.', shape: ShapesAnim.gridRect(8, 3),
          steps: ['۸ × ۳ = ۲۴'], answer: '۲۴ متر مربع' }
      ],
      tips: ['طول و عرض را جابجا کن، فرقی نمی‌کند.'],
      pitfalls: ['جمع نکن؛ ضرب کن.']
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'مساحت = (قاعده × ارتفاع) ÷ ۲',
      paragraphs: ['مساحت مثلث نصف مستطیلی است که مثلث در آن جا می‌شود.'],
      examples: [
        { text: 'مثلثی با قاعده ۴ و ارتفاع ۳.', shape: ShapesAnim.triangleAreaAnim(4, 3),
          steps: ['۴ × ۳ = ۱۲', '۱۲ ÷ ۲ = ۶'], answer: '۶ سانتی‌متر مربع' },
        { text: 'بیرق مثلثی با قاعده ۶ و ارتفاع ۴.', shape: ShapesAnim.triangleAreaAnim(6, 4),
          steps: ['۶ × ۴ = ۲۴', '۲۴ ÷ ۲ = ۱۲'], answer: '۱۲ سانتی‌متر مربع' }
      ],
      tips: ['ارتفاع همیشه عمود بر قاعده است.'],
      pitfalls: ['فراموش نکن بر ۲ تقسیم کنی.']
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪', formula: 'مساحت = π × شعاع × شعاع',
      paragraphs: ['π ≈ ۳٫۱۴. دقت: شعاع² نه ۲ × شعاع.'],
      examples: [
        { text: 'دایره با شعاع ۲.', shape: Shapes.circle(2),
          steps: ['۳٫۱۴ × ۴ = ۱۲٫۵۶'], answer: '۱۲٫۵۶ سانتی‌متر مربع' },
        { text: 'پیتزا با شعاع ۵.', shape: Shapes.circle(5),
          steps: ['۳٫۱۴ × ۲۵ = ۷۸٫۵'], answer: '۷۸٫۵ سانتی‌متر مربع' }
      ],
      tips: ['π = ۳٫۱۴.'],
      pitfalls: ['شعاع² ≠ ۲ × شعاع.']
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'مساحت = قاعده × ارتفاع',
      paragraphs: ['مانند مستطیل، قاعده × ارتفاع.'],
      examples: [
        { text: 'قاعده ۵ و ارتفاع ۳.', shape: Shapes.parallelogram(5, 8, 3),
          steps: ['۵ × ۳ = ۱۵'], answer: '۱۵ سانتی‌متر مربع' },
        { text: 'قاعده ۹ و ارتفاع ۴ متر.', shape: Shapes.parallelogram(9, 8, 4),
          steps: ['۹ × ۴ = ۳۶'], answer: '۳۶ متر مربع' }
      ],
      tips: ['برای مساحت، فقط قاعده و ارتفاع.'],
      pitfalls: ['ارتفاع عمود بر قاعده است، نه ضلع کج.']
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'مساحت = (قطر۱ × قطر۲) ÷ ۲',
      paragraphs: ['لوزی همه اضلاع مساوی. دو قطر عمود بر هم.'],
      examples: [
        { text: 'لوزی با قطرهای ۴ و ۶.', shape: Shapes.rhombusD(4, 6),
          steps: ['۴ × ۶ = ۲۴', '۲۴ ÷ ۲ = ۱۲'], answer: '۱۲ سانتی‌متر مربع' },
        { text: 'باغچه لوزی با قطرهای ۸ و ۴ متر.', shape: Shapes.rhombusD(8, 4),
          steps: ['۸ × ۴ = ۳۲', '۳۲ ÷ ۲ = ۱۶'], answer: '۱۶ متر مربع' }
      ],
      tips: ['یادت باشد بر ۲ تقسیم کنی.'],
      pitfalls: ['فراموش نکن ÷ ۲.']
    },
    {
      id: 'trap', title: 'ذوزنقه', emoji: '⏢', formula: 'مساحت = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      paragraphs: ['دو ضلع موازی به نام قاعده.'],
      examples: [
        { text: 'قاعده‌ها ۳ و ۵، ارتفاع ۴.', shape: Shapes.trapezoid(5, 3, 4),
          steps: ['۳ + ۵ = ۸', '۸ × ۴ = ۳۲', '۳۲ ÷ ۲ = ۱۶'], answer: '۱۶ سانتی‌متر مربع' },
        { text: 'قاعده‌ها ۶ و ۴، ارتفاع ۵.', shape: Shapes.trapezoid(6, 4, 5),
          steps: ['۱۰ × ۵ = ۵۰', '۵۰ ÷ ۲ = ۲۵'], answer: '۲۵ متر مربع' }
      ],
      tips: ['دو قاعده را جمع کن.'],
      pitfalls: ['فراموش نکن ÷ ۲.']
    },
    {
      id: 'lshape', title: 'شکل‌های ترکیبی', emoji: '🏠', formula: 'مساحت کل = جمع مساحت‌ها',
      paragraphs: [
        'گاهی یک شکل از دو یا چند شکل ساده ساخته می‌شود.',
        'مساحت کل = جمع مساحت اجزا.'
      ],
      examples: [
        { text: 'شکل L شکل با دو مستطیل. مساحتش؟', shape: Shapes.lshape(5, 3, 3, 4),
          steps: ['مستطیل پایین: ۵ × ۳ = ۱۵', 'مستطیل بالا: ۳ × ۴ = ۱۲', 'جمع: ۱۵ + ۱۲ = ۲۷'], answer: '۲۷ سانتی‌متر مربع' },
        { text: 'شکل T شکل با دو مستطیل. مساحتش؟', shape: Shapes.tshape(8, 2, 3, 5),
          steps: ['افقی: ۸ × ۲ = ۱۶', 'عمودی: ۳ × ۵ = ۱۵', 'جمع: ۳۱'], answer: '۳۱ سانتی‌متر مربع' },
        { text: 'خانه‌ای با سقف مثلثی. مساحت کل؟', shape: Shapes.house(6, 4, 3),
          steps: ['مستطیل: ۶ × ۴ = ۲۴', 'مثلث: (۶ × ۳) ÷ ۲ = ۹', 'جمع: ۳۳'], answer: '۳۳ متر مربع' },
        { text: 'اتاقی با باغچه‌ی نیم‌دایره‌ای. مساحت کل؟', shape: Shapes.houseWithGarden(6, 3, 2, 2),
          steps: ['مثلث سقف: (۶×۲)÷۲ = ۶', 'اتاق: ۶ × ۳ = ۱۸', 'نیم‌دایره: (۳٫۱۴ × ۴)÷۲ ≈ ۶٫۲۸', 'جمع ≈ ۳۰٫۲۸'], answer: 'حدود ۳۰٫۲۸ متر مربع' }
      ],
      tips: ['شکل را به اجزای ساده تقسیم کن.'],
      pitfalls: ['مساحت‌ها را جمع کن، نه ابعاد را.']
    }
  ],
  volume: [
    {
      id: 'cube', title: 'مکعب', emoji: '🧊', formula: 'حجم = ضلع × ضلع × ضلع',
      paragraphs: ['حجم = فضای داخل یک شکل سه‌بعدی.', 'مکعب = همه ضلع‌ها مساوی.'],
      examples: [
        { text: 'مکعب با ضلع ۲.', shape: ShapesAnim.cubeBuild(2),
          steps: ['۲ × ۲ × ۲ = ۸'], answer: '۸ سانتی‌متر مکعب' },
        { text: 'تاس با ضلع ۳.', shape: ShapesAnim.cubeBuild(3),
          steps: ['۳ × ۳ × ۳ = ۲۷'], answer: '۲۷ سانتی‌متر مکعب' },
        { text: 'جعبه با ضلع ۴.', shape: ShapesAnim.cubeBuild(4),
          steps: ['۴ × ۴ × ۴ = ۶۴'], answer: '۶۴ سانتی‌متر مکعب' }
      ],
      tips: ['واحد = سانتی‌متر مکعب.'],
      pitfalls: ['مساحت ≠ حجم.']
    },
    {
      id: 'box', title: 'مکعب مستطیل', emoji: '📦', formula: 'حجم = طول × عرض × ارتفاع',
      paragraphs: ['مثل جعبه کفش یا یخچال، سه اندازه دارد.'],
      examples: [
        { text: 'طول ۳، عرض ۲، ارتفاع ۲.', shape: ShapesAnim.boxBuild(3, 2, 2),
          steps: ['۳ × ۲ = ۶', '۶ × ۲ = ۱۲'], answer: '۱۲ سانتی‌متر مکعب' },
        { text: 'طول ۴، عرض ۳، ارتفاع ۵.', shape: ShapesAnim.boxBuild(4, 3, 5),
          steps: ['۴ × ۳ = ۱۲', '۱۲ × ۵ = ۶۰'], answer: '۶۰ سانتی‌متر مکعب' }
      ],
      tips: ['ترتیب ضرب مهم نیست.'],
      pitfalls: ['سه عدد را ضرب کن.']
    }
  ],
  fractions: [
    {
      id: 'concept', title: 'مفهوم کسر', emoji: '🍕', formula: 'صورت / مخرج',
      paragraphs: ['کسر = چند قسمت از یک کل.', 'بالا: صورت، پایین: مخرج.'],
      examples: [
        { text: 'سه‌چهارم دایره رنگی شده. کسر؟', html: ShapesAnim.fracPieAnim(3, 4),
          steps: ['مخرج ۴ = کل به ۴ قسمت', 'صورت ۳ = ۳ قسمت رنگی'], answer: 'سه‌چهارم' },
        { text: '۲ از ۵ یعنی چه؟', html: fracHTML({ n: 2, d: 5 }),
          steps: ['مخرج ۵'], answer: '۲ قسمت از ۵ قسمت مساوی' }
      ],
      tips: ['مخرج ≠ صفر.'],
      pitfalls: ['جای صورت و مخرج را عوض نکن.']
    },
    {
      id: 'equiv', title: 'کسر معادل', emoji: '🟰', formula: 'ضرب صورت و مخرج در یک عدد',
      paragraphs: ['اگر صورت و مخرج را در یک عدد ضرب کنیم، مقدار کسر عوض نمی‌شود.'],
      examples: [
        { text: 'آیا یک‌دوم = سه‌ششم؟',
          html: `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">${ShapesAnim.fracBarAnim(1, 2)}${ShapesAnim.fracBarAnim(3, 6)}</div>`,
          steps: ['۱ × ۳ = ۳ و ۲ × ۳ = ۶'], answer: 'بله، برابرند.' },
        { text: 'کسر معادل با مخرج ۹ برای دو‌سوم؟',
          html: `<span dir="ltr">${fracHTML({ n: 2, d: 3 })} = ? / ۹</span>`,
          steps: ['۲ × ۳ = ۶'], answer: '۶/۹' }
      ],
      tips: ['× یک عدد، مقدار را عوض نمی‌کند.'],
      pitfalls: ['هم صورت هم مخرج را ضرب کن.']
    },
    {
      id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️', formula: 'تقسیم بر ب.م.م',
      paragraphs: ['صورت و مخرج را بر ب.م.م تقسیم کن.'],
      examples: [
        { text: 'دو‌چهارم را ساده کن.', html: fracHTML({ n: 2, d: 4 }),
          steps: ['ب.م.م = ۲', '۲÷۲ = ۱', '۴÷۲ = ۲'], answer: 'یک‌دوم' },
        { text: 'شش‌نهم را ساده کن.', html: fracHTML({ n: 6, d: 9 }),
          steps: ['ب.م.م = ۳', '۶÷۳ = ۲', '۹÷۳ = ۳'], answer: 'دو‌سوم' },
        { text: 'هشت‌دوازدهم را ساده کن.', html: fracHTML({ n: 8, d: 12 }),
          steps: ['ب.م.م = ۴'], answer: 'دو‌سوم' },
        { text: 'ده‌پانزدهم را ساده کن.', html: fracHTML({ n: 10, d: 15 }),
          steps: ['ب.م.م = ۵'], answer: 'دو‌سوم' }
      ],
      tips: ['اگر بزرگ را بلد نیستی، با کوچک شروع کن.'],
      pitfalls: ['فقط یکی را تقسیم نکن.']
    },
    {
      id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️', formula: 'مخرج مشترک',
      paragraphs: ['برای مقایسه، مخرج مشترک.'],
      examples: [
        { text: 'کدام بزرگ‌تر: ۱/۲ یا ۱/۳؟', html: `<span dir="ltr">${fracHTML({n:1,d:2})} ? ${fracHTML({n:1,d:3})}</span>`,
          steps: ['مخرج مشترک: ۶', '۱/۲ = ۳/۶', '۱/۳ = ۲/۶', '۳ > ۲'], answer: '۱/۲ بزرگ‌تر' },
        { text: 'کدام بزرگ‌تر: ۲/۳ یا ۳/۴؟', html: `<span dir="ltr">${fracHTML({n:2,d:3})} ? ${fracHTML({n:3,d:4})}</span>`,
          steps: ['مخرج مشترک: ۱۲', '۸ < ۹'], answer: '۳/۴ بزرگ‌تر' }
      ],
      tips: ['مخرج مشترک اول.'],
      pitfalls: ['مخرج بزرگ‌تر ≠ کسر بزرگ‌تر.']
    },
    {
      id: 'add', title: 'جمع کسرها', emoji: '➕', formula: 'مخرج مشترک بعد جمع',
      paragraphs: ['مخرج مشترک، سپس صورت‌ها را جمع کن.'],
      examples: [
        { text: '۱/۵ + ۲/۵', html: `<span dir="ltr">${fracHTML({n:1,d:5})} + ${fracHTML({n:2,d:5})}</span>`,
          steps: ['مخرج‌ها مساوی.', '۱ + ۲ = ۳'], answer: '۳/۵' },
        { text: '۱/۲ + ۱/۳', html: `<span dir="ltr">${fracHTML({n:1,d:2})} + ${fracHTML({n:1,d:3})}</span>`,
          steps: ['مخرج مشترک: ۶', '۱/۲ = ۳/۶', '۱/۳ = ۲/۶', '۳ + ۲ = ۵'], answer: '۵/۶' }
      ],
      tips: ['اگر مخرج‌ها مساوی، سریع صورت‌ها.'],
      pitfalls: ['مخرج‌ها را جمع نکن!']
    },
    {
      id: 'sub', title: 'تفریق کسرها', emoji: '➖', formula: 'مخرج مشترک بعد تفریق',
      paragraphs: ['مانند جمع.'],
      examples: [
        { text: '۳/۵ − ۱/۵', html: `<span dir="ltr">${fracHTML({n:3,d:5})} − ${fracHTML({n:1,d:5})}</span>`,
          steps: ['۳ − ۱ = ۲'], answer: '۲/۵' },
        { text: '۳/۴ − ۱/۲', html: `<span dir="ltr">${fracHTML({n:3,d:4})} − ${fracHTML({n:1,d:2})}</span>`,
          steps: ['مخرج مشترک: ۴', '۱/۲ = ۲/۴', '۳/۴ − ۲/۴ = ۱/۴'], answer: '۱/۴' }
      ],
      tips: ['نتیجه را ساده کن.'],
      pitfalls: ['فقط صورت‌ها کم می‌شوند.']
    },
    {
      id: 'mul', title: 'ضرب کسرها', emoji: '✖️', formula: 'صورت × صورت، مخرج × مخرج',
      paragraphs: ['نیازی به مخرج مشترک نیست.'],
      examples: [
        { text: '۱/۲ × ۲/۳', html: `<span dir="ltr">${fracHTML({n:1,d:2})} × ${fracHTML({n:2,d:3})}</span>`,
          steps: ['صورت: ۱×۲ = ۲', 'مخرج: ۲×۳ = ۶', 'ساده = ۱/۳'], answer: '۱/۳' }
      ],
      tips: ['قبل ضرب ساده کن.'],
      pitfalls: ['مخرج مشترک لازم نیست.']
    },
    {
      id: 'div', title: 'تقسیم کسرها', emoji: '➗', formula: 'معکوس و ضرب',
      paragraphs: ['کسر دوم را معکوس، سپس ضرب.'],
      examples: [
        { text: '۱/۲ ÷ ۱/۳', html: `<span dir="ltr">${fracHTML({n:1,d:2})} ÷ ${fracHTML({n:1,d:3})}</span>`,
          steps: ['معکوس: ۳/۱', '۱/۲ × ۳/۱ = ۳/۲'], answer: '۳/۲' }
      ],
      tips: ['تقسیم = ضرب در معکوس'],
      pitfalls: ['کسر اول را معکوس نکن.']
    },
    {
      id: 'mixed', title: 'عدد مخلوط', emoji: '🔢', formula: 'عدد صحیح + کسر',
      paragraphs: ['مثال: ۲ و ۱/۳.'],
      examples: [
        { text: 'تبدیل ۲ و ۱/۳ به کسر.', html: mixedHTML({ n: 7, d: 3 }),
          steps: ['(۲×۳)+۱ = ۷'], answer: '۷/۳' }
      ],
      tips: ['عدد صحیح × مخرج + صورت.'],
      pitfalls: ['عدد صحیح را ضرب کن.']
    }
  ],
  decimals: [
    {
      id: 'concept', title: 'مفهوم اعشار', emoji: '🔟', formula: 'دهم، صدم، هزارم',
      paragraphs: ['اعشار برای قسمت‌های کمتر از یک.','بعد از ممیز: دهم، صدم، هزارم.'],
      examples: [
        { text: '۰٫۵ یعنی؟', html: eq('۰٫۵'), steps: ['۵ دهم = نصف'], answer: 'نصف' },
        { text: '۰٫۲۵ یعنی؟', html: eq('۰٫۲۵'), steps: ['۲۵ صدم = یک‌چهارم'], answer: 'یک‌چهارم' }
      ],
      tips: ['قبل ممیز صفر.'],
      pitfalls: ['جایگاه‌ها را اشتباه نکن.']
    },
    {
      id: 'online', title: 'اعشار روی محور', emoji: '📏', formula: 'دهم‌ها روی محور',
      paragraphs: [
        'فاصله‌ی ۰ تا ۱ را به ۱۰ قسمت مساوی تقسیم می‌کنیم. هر قسمت = ۰٫۱.',
        'بین هر دهم، ۱۰ قسمت کوچک‌تر = صدم.'
      ],
      examples: [
        { text: '۰٫۵ روی محور کجاست؟', html: ShapesAnim.decimalLine([], 0.5, 0, 1),
          steps: ['وسط بین ۰ و ۱'], answer: 'وسط دقیق' },
        { text: '۰٫۳ کجاست؟', html: ShapesAnim.decimalLine([], 0.3, 0, 1),
          steps: ['از ۰ سه دهم جلو'], answer: 'سه پله‌ی جلو' },
        { text: '۰٫۲۵ کجاست؟', html: ShapesAnim.decimalLine([], 0.25, 0, 1),
          steps: ['بین ۰٫۲ و ۰٫۳'], answer: 'بین دو دهم و سه دهم' }
      ],
      tips: ['هر ۱۰ خط کوچک = یک دهم.'],
      pitfalls: ['خطوط اصلی را اشتباه نگیر.']
    },
    {
      id: 'compare', title: 'مقایسه اعشار', emoji: '⚖️', formula: 'رقم به رقم',
      paragraphs: ['اول قسمت صحیح، سپس اعشار.'],
      examples: [
        { text: '۰٫۷ یا ۰٫۵؟', html: eq('۰٫۷ ? ۰٫۵'), steps: ['۷ > ۵'], answer: '۰٫۷ بزرگ‌تر' },
        { text: '۲٫۳ یا ۲٫۵؟', html: eq('۲٫۳ ? ۲٫۵'), steps: ['۳ < ۵'], answer: '۲٫۵ بزرگ‌تر' }
      ],
      tips: ['با صفر پر کن اگر تعداد کم است.'],
      pitfalls: ['ارقام بیشتر ≠ عدد بزرگ‌تر.']
    },
    {
      id: 'add', title: 'جمع اعشار', emoji: '➕', formula: 'ممیزها زیر هم',
      paragraphs: ['ممیزها را تراز، سپس جمع.'],
      examples: [
        { text: '۳٫۴ + ۲٫۱', html: eq('۳٫۴ + ۲٫۱'), steps: ['۵٫۵'], answer: '۵٫۵' },
        { text: 'روی محور: ۰٫۳ + ۰٫۴', html: ShapesAnim.decimalAddOnLine(0, 1, 0.3, 0.4),
          steps: ['از ۰٫۳ چهل‌دهم جلو', 'می‌رسیم به ۰٫۷'], answer: '۰٫۷' }
      ],
      tips: ['ممیزها زیر هم.'],
      pitfalls: ['بدون تراز ننویس.']
    },
    {
      id: 'sub', title: 'تفریق اعشار', emoji: '➖', formula: 'ممیزها زیر هم',
      paragraphs: ['مانند جمع.'],
      examples: [
        { text: '۵٫۵ − ۲٫۱', html: eq('۵٫۵ − ۲٫۱'), steps: ['۳٫۴'], answer: '۳٫۴' }
      ],
      tips: ['تراز ممیزها.'],
      pitfalls: ['ترتیب درست.']
    },
    {
      id: 'frac-to-dec', title: 'کسر به اعشار', emoji: '🔄', formula: 'صورت ÷ مخرج',
      paragraphs: ['تقسیم صورت بر مخرج.'],
      examples: [
        { text: '۳/۴ به اعشار', html: fracHTML({ n: 3, d: 4 }), steps: ['۳ ÷ ۴ = ۰٫۷۵'], answer: '۰٫۷۵' }
      ],
      tips: ['بعضی متناوب.'],
      pitfalls: ['برعکس تقسیم نکن.']
    },
    {
      id: 'dec-to-frac', title: 'اعشار به کسر', emoji: '🔄', formula: 'مخرج ۱۰ یا ۱۰۰',
      paragraphs: ['تعداد رقم بعد ممیز = تعداد صفر.'],
      examples: [
        { text: '۰٫۷', html: eq('۰٫۷'), steps: ['۱ رقم → مخرج ۱۰'], answer: '۷/۱۰' },
        { text: '۰٫۷۵', html: eq('۰٫۷۵'), steps: ['۲ رقم → مخرج ۱۰۰', 'ساده: ۳/۴'], answer: '۳/۴' }
      ],
      tips: ['ساده کن.'],
      pitfalls: ['تعداد صفرها.']
    }
  ]
};

/* ============================================================
   ۲۸) LEARN / LESSON
   ============================================================ */
function viewLearn(topic) {
  const lessons = LESSONS[topic] || [];
  return `
  ${header('📚 آموزش', true)}
  <p style="color:var(--muted);margin:0 0 14px">یک موضوع را انتخاب کن:</p>
  <div class="grid grid-2">
    ${lessons.map(l => `
      <button class="card card-btn" onclick="window.__nav('lesson', {topic:'${topic}', id:'${l.id}'})">
        <span class="icon-big">${l.emoji}</span>
        <h3 class="card-title">${l.title}</h3>
      </button>`).join('')}
  </div>
  ${bottomNav()}`;
}

function viewLesson(topic, id) {
  const lessons = LESSONS[topic] || [];
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return `<div class="empty">درس پیدا نشد</div>`;
  const allIds = lessons.map(l => l.id);
  const idx = allIds.indexOf(id);
  const nextId = allIds[idx + 1] || null;
  const prevId = allIds[idx - 1] || null;
  const hint = HINT_BY_TOPIC[topic];
  const proof = proofCard(lesson.id, topic);

  return `
  ${header(lesson.title, true)}
  <div class="lesson-hero">
    <div class="emoji-big">${lesson.emoji}</div>
    <h2>${lesson.title}</h2>
    <div class="formula">${lesson.formula}</div>
  </div>

  ${unitsCard(topic)}

  <div class="lesson-section">
    <h3>📖 توضیح</h3>
    ${lesson.paragraphs.map(p => `<p>${p}</p>`).join('')}
  </div>

  ${proof}

  <div class="lesson-section">
    <h3>📌 مثال‌ها</h3>
    ${lesson.examples.map((ex, i) => `
      <div class="example-card">
        <p class="ex-title">مثال ${fa(i + 1)}:</p>
        <p>${ex.text}</p>
        ${wrapAnim(ex.shape, { hint })}
        ${wrapAnim(ex.html, { wrapClass: '', wrapStyle: 'text-align:center;padding:8px', hint })}
        <ul class="example-steps">${ex.steps.map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="example-answer">✅ ${ex.answer}</div>
      </div>`).join('')}
  </div>

  <div class="lesson-section">
    <h3>💡 نکات مهم</h3>
    <ul class="tips-list">${lesson.tips.map(t => `<li>${t}</li>`).join('')}</ul>
  </div>

  ${lesson.pitfalls && lesson.pitfalls.length ? `
  <div class="lesson-section">
    <h3>⚠️ حواست باشه</h3>
    <ul class="pitfalls-list">${lesson.pitfalls.map(t => `<li>${t}</li>`).join('')}</ul>
  </div>` : ''}

  <div class="lesson-nav">
    ${prevId ? `<button class="btn sec" onclick="window.__nav('lesson',{topic:'${topic}',id:'${prevId}'})">⬅️ قبلی</button>` : ''}
    ${nextId ? `<button class="btn" onclick="window.__nav('lesson',{topic:'${topic}',id:'${nextId}'})">➡️ بعدی</button>` : ''}
  </div>

  <button class="btn success full" style="margin-top:16px" onclick="window.__nav('practice',{topic:'${topic}'})">✏️ بریم تمرین!</button>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۹) PRACTICE
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
    current: null, answered: false, selected: null
  };
  nextPracticeQuestion();
}
function nextPracticeQuestion() {
  const q = generateQuestion(session.topic, session.difficulty);
  session.current = q || null;
  session.answered = false;
  session.selected = null;
}
function renderPractice() {
  const q = session.current;
  if (!q) return `<div class="empty"><span class="emoji-big">😅</span>سوالی پیدا نشد.</div>`;
  const names = { perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم', fractions: '🍰 کسرها', decimals: '🔢 اعشار' };
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
  <div class="answer-area" id="answerArea">${renderChoiceArea(q)}</div>
  <div id="feedbackArea"></div>
  <div style="margin-top:16px">
    <button class="btn full" id="actionBtn" onclick="window.__submitOrNext()">
      ${session.answered ? '➡️ سوال بعدی' : '✅ بررسی پاسخ'}
    </button>
  </div>
  ${bottomNav()}`;
}
function renderChoiceArea(q) {
  if (!q.choices) return '';
  return `<div class="choice-grid">${q.choices.map((c, i) => choiceHTML(c, i, q)).join('')}</div>`;
}
function choiceHTML(c, i, q) {
  const display = displayAnswer(c);
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
  if (a.isNum || b.isNum) {
    if (!(a.isNum && b.isNum)) return false;
    const na = parseFloat(a.n), nb = parseFloat(b.n);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 0.001;
    return String(a.n) === String(b.n);
  }
  if (a.n != null && b.n != null && a.d != null && b.d != null) return fracEq(a, b);
  return false;
}
function submitAnswer() {
  const q = session.current;
  if (session.answered || !q) return;
  if (!session.selected) { showWarn('❗ یکی از گزینه‌ها را انتخاب کن.'); return; }
  finishQuestion(equalAnswer(session.selected, q.correct));
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
  if (stu && stu.progress[q.topic]) {
    stu.stats.totalQuestions++;
    stu.progress[q.topic].attempts++;
  }
  if (correct) {
    session.correct++;
    session.streak++;
    if (stu && stu.progress[q.topic]) {
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
  if (area) area.innerHTML = renderChoiceArea(q);
  const btn = document.getElementById('actionBtn');
  if (btn) btn.textContent = '➡️ سوال بعدی';
  const fb = document.getElementById('feedbackArea');
  if (fb) {
    const correctDisp = displayCorrectWithUnit(q);
    const title = correct ? pick(['🎉 آفرین!', '✨ درست بود!', '💯 عالی!', '🌟 ادامه بده!']) : '❌ اشکالی نداره، با هم ببینیم:';
    fb.innerHTML = `
      <div class="feedback ${correct ? 'good' : 'bad'}">
        <h4>${title}</h4>
        ${!correct ? `<p>پاسخ درست: <strong class="correct-text">${correctDisp}</strong></p>` : ''}
        <strong>راه‌حل:</strong>
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
   ۳۰) EXAM SETUP
   ============================================================ */
function viewExamSetup(topic) {
  const names = { perimeter: 'محیط', area: 'مساحت', volume: 'حجم', fractions: 'کسرها', decimals: 'اعداد اعشاری' };
  return `
  ${header('🎯 آزمون', true)}
  <div class="card">
    <h3 class="card-title">تنظیمات آزمون</h3>
    <p>موضوع: <strong>${names[topic]}</strong></p>
    <label style="display:block;margin-top:12px">تعداد سوال:
      <select id="examCount" class="num-input" style="text-align:right">
        ${[5, 10, 15, 20].map(n => `<option value="${n}" ${n === state.settings.questionCount ? 'selected' : ''}>${fa(n)}</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">زمان:
      <select id="examTime" class="num-input" style="text-align:right">
        ${[60, 180, 300, 600, 900].map(n => `<option value="${n}" ${n === state.settings.examTime ? 'selected' : ''}>${fa(Math.floor(n / 60))} دقیقه</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">سطح:
      <select id="examDiff" class="num-input" style="text-align:right">
        <option value="easy" ${state.settings.difficulty === 'easy' ? 'selected' : ''}>آسان</option>
        <option value="medium" ${state.settings.difficulty === 'medium' ? 'selected' : ''}>متوسط</option>
        <option value="hard" ${state.settings.difficulty === 'hard' ? 'selected' : ''}>سخت</option>
      </select>
    </label>
  </div>
  <div class="card" style="background:var(--hint-bg);border-right:4px solid var(--info)">
    <p style="margin:0;font-size:.9rem">📝 <strong>نکته:</strong> پاسخ‌ها همان لحظه بررسی نمی‌شوند.</p>
  </div>
  <div class="card" style="background:var(--feedback-warn-bg);border-right:4px solid var(--accent)">
    <p style="margin:0;font-size:.9rem">⚠️ <strong>نمره منفی:</strong> هر ۳ پاسخ غلط = ۱ نمره کم.</p>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__startExam('${topic}')">🚀 شروع آزمون</button>
  ${bottomNav()}`;
}
function startExam(topic) {
  const countEl = document.getElementById('examCount');
  const timeEl = document.getElementById('examTime');
  const diffEl = document.getElementById('examDiff');
  const count = parseInt(countEl.value, 10) || 10;
  const time = parseInt(timeEl.value, 10) || 300;
  const diff = diffEl.value || 'medium';
  const questions = [];
  for (let i = 0; i < count; i++) {
    const q = generateQuestion(topic, diff);
    if (q) questions.push(q);
  }
  if (!questions.length) { alert('سوالی پیدا نشد.'); return; }
  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null,
    correct: 0, wrong: 0, unanswered: 0,
    timeLeft: time, totalTime: time, isMulti: false
  };
  navigate('exam');
  startExamTimer();
}

/* ============================================================
   ۳۱) MULTI EXAM
   ============================================================ */
function viewMultiExamSetup() {
  return `
  ${header('🎯 آزمون جامع', true)}
  <p style="color:var(--muted);margin:0 0 14px;text-align:center">درس‌های مورد آزمون را انتخاب کن:</p>
  <div class="card">
    <h3 class="card-title">📚 انتخاب دروس</h3>
    ${ALL_TOPICS.map(t => `
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--card-2);border-radius:12px;margin-bottom:8px;font-weight:600;cursor:pointer">
        <input type="checkbox" class="topic-check" value="${t}" checked style="width:22px;height:22px;accent-color:${'var(--primary)'}">
        <span style="font-size:1.3rem">${TOPIC_EMOJIS[t]}</span>
        <span>${TOPIC_NAMES[t]}</span>
      </label>`).join('')}
  </div>
  <div class="card">
    <h3 class="card-title">⚙️ تنظیمات</h3>
    <label style="display:block;margin-top:12px">تعداد سوال:
      <select id="mExamCount" class="num-input" style="text-align:right">
        ${[5, 10, 15, 20, 25].map(n => `<option value="${n}" ${n === 10 ? 'selected' : ''}>${fa(n)}</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">زمان:
      <select id="mExamTime" class="num-input" style="text-align:right">
        ${[180, 300, 600, 900, 1200].map(n => `<option value="${n}" ${n === 300 ? 'selected' : ''}>${fa(Math.floor(n / 60))} دقیقه</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">سطح:
      <select id="mExamDiff" class="num-input" style="text-align:right">
        <option value="easy">آسان</option>
        <option value="medium" selected>متوسط</option>
        <option value="hard">سخت</option>
      </select>
    </label>
  </div>
  <div class="card" style="background:var(--hint-bg);border-right:4px solid var(--info)">
    <p style="margin:0;font-size:.9rem">📝 پاسخ‌ها در انتها بررسی می‌شوند.</p>
  </div>
  <div class="card" style="background:var(--feedback-warn-bg);border-right:4px solid var(--accent)">
    <p style="margin:0;font-size:.9rem">⚠️ نمره منفی: هر ۳ غلط = ۱ نمره.</p>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__startMultiExam()">🚀 شروع آزمون جامع</button>
  ${bottomNav()}`;
}
function startMultiExam() {
  const checks = document.querySelectorAll('.topic-check:checked');
  const topics = Array.from(checks).map(c => c.value);
  if (!topics.length) { alert('حداقل یک درس را انتخاب کن.'); return; }
  const count = parseInt(document.getElementById('mExamCount').value, 10) || 10;
  const time = parseInt(document.getElementById('mExamTime').value, 10) || 300;
  const diff = document.getElementById('mExamDiff').value || 'medium';

  const topicsPerQ = [];
  const perTopic = Math.floor(count / topics.length);
  const remainder = count % topics.length;
  topics.forEach((t, i) => {
    const n = perTopic + (i < remainder ? 1 : 0);
    for (let j = 0; j < n; j++) topicsPerQ.push(t);
  });
  const shuffledTopics = shuffle(topicsPerQ);
  const questions = [];
  for (const t of shuffledTopics) {
    const q = generateQuestion(t, diff);
    if (q) questions.push(q);
  }
  if (!questions.length) { alert('سوالی پیدا نشد.'); return; }
  session = {
    mode: 'exam', topic: 'comprehensive', difficulty: diff, questions,
    topicsSelected: topics,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null,
    correct: 0, wrong: 0, unanswered: 0,
    timeLeft: time, totalTime: time, isMulti: true
  };
  navigate('exam');
  startExamTimer();
}

/* ============================================================
   ۳۲) EXAM VIEW
   ============================================================ */
function startExamTimer() {
  if (examTimer) clearInterval(examTimer);
  examTimer = setInterval(() => {
    if (!session || session.mode !== 'exam') { clearInterval(examTimer); examTimer = null; return; }
    session.timeLeft--;
    if (session.timeLeft <= 0) {
      clearInterval(examTimer); examTimer = null;
      alert('⏰ زمان تمام شد!');
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
  const title = session.isMulti ? '🎯 آزمون جامع' : '🎯 آزمون ' + TOPIC_NAMES[session.topic];
  const min = Math.floor(session.timeLeft / 60);
  const sec = session.timeLeft % 60;
  const timeColor = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
  return `
  ${header(title)}
  <div class="stats-row">
    <div class="stat-item"><div class="stat-value">${fa(session.index + 1)}/${fa(session.questions.length)}</div><div class="stat-label">سوال</div></div>
    <div class="stat-item"><div class="stat-value" style="color:${timeColor}">⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}</div><div class="stat-label">زمان</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--info)">${fa(session.index)}</div><div class="stat-label">پاسخ‌داده</div></div>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${(session.index / session.questions.length) * 100}%"></div></div>
  <div class="question-box">
    ${session.isMulti ? `<div style="font-size:.85rem;color:var(--muted);margin-bottom:6px">${TOPIC_EMOJIS[q.topic]} ${TOPIC_NAMES[q.topic]}</div>` : ''}
    ${q.promptHTML ? `<p class="q-prompt">${q.promptHTML}</p>` : `<p class="q-prompt">${q.prompt}</p>`}
    ${q.shape ? `<div class="q-shape">${q.shape}</div>` : ''}
  </div>
  <div class="answer-area">${renderChoiceArea(q)}</div>
  <div style="margin-top:16px;display:flex;gap:8px">
    <button class="btn full" onclick="window.__examNext()">
      ${session.index + 1 >= session.questions.length ? '🏁 پایان' : '➡️ بعدی'}
    </button>
    <button class="btn danger" onclick="if(confirm('خروج؟')) window.__nav('home')">خروج</button>
  </div>
  ${bottomNav()}`;
}
function examNext() {
  if (!session || session.mode !== 'exam') return;
  const q = session.current;
  let userAns = null, isCorrect = false, unanswered = false;
  if (session.selected) {
    userAns = session.selected;
    isCorrect = equalAnswer(session.selected, q.correct);
  } else {
    unanswered = true;
  }
  session.answers.push({ q, userAns, isCorrect, unanswered });
  if (isCorrect) session.correct++;
  else if (!unanswered) session.wrong++;
  else session.unanswered++;

  const stu = activeStudent();
  if (stu && stu.progress[q.topic]) {
    stu.stats.totalQuestions++;
    stu.progress[q.topic].attempts++;
    if (isCorrect) {
      stu.stats.totalCorrect++;
      stu.progress[q.topic].correct++;
    } else if (!unanswered) {
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
    render();
  }
}
function endExam() {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  if (!session) return;
  const s = session;
  const penalty = Math.floor(s.wrong / 3);
  const score = Math.max(0, s.correct - penalty);
  const pctv = Math.round((score / s.questions.length) * 100);
  const stu = activeStudent();
  if (stu) {
    stu.history.unshift({
      date: Date.now(), topic: s.topic, score: pctv,
      correct: s.correct, wrong: s.wrong,
      unanswered: s.unanswered || 0, penalty,
      total: s.questions.length,
      isMulti: s.isMulti || false,
      topicsSelected: s.topicsSelected || null
    });
    if (stu.history.length > 40) stu.history.length = 40;
    if (pctv === 100 && !stu.stats.badges.includes('perfect')) {
      stu.stats.badges.push('perfect');
      showFloat('💎 نشان بی‌نقص!');
    }
  }
  saveState();
  sound.win();
  const payload = { pct: pctv, penalty, answers: s.answers, topic: s.topic, isMulti: s.isMulti || false };
  session = null;
  navigate('examResult', payload);
}
function viewExamResult() {
  const params = route.params || {};
  const pctv = params.pct, answers = params.answers, topic = params.topic,
        isMulti = params.isMulti, penalty = params.penalty || 0;
  if (!answers) return `<div class="empty">کارنامه‌ای نیست</div>`;
  const correct = answers.filter(a => a.isCorrect).length;
  const wrong = answers.filter(a => !a.isCorrect && !a.unanswered).length;
  const unanswered = answers.filter(a => a.unanswered).length;
  const emoji = pctv >= 80 ? '🏆' : pctv >= 60 ? '👍' : pctv >= 40 ? '💪' : '📚';
  const msg = pctv >= 80 ? 'فوق‌العاده!' : pctv >= 60 ? 'خوب بود!' : pctv >= 40 ? 'باز تمرین کن!' : 'ناامید نشو!';
  const stu = activeStudent();
  const titleText = isMulti ? '🎯 آزمون جامع' : 'آزمون ' + (TOPIC_NAMES[topic] || '');
  return `
  ${header('📋 کارنامه', true)}
  ${stu ? `<p style="text-align:center;color:var(--muted);margin:0 0 4px">${escHtml(fullName(stu))} — پایه ${fa(stu.grade)}</p>` : ''}
  <p style="text-align:center;color:var(--muted);margin:0 0 12px">${titleText}</p>
  <div class="card" style="text-align:center">
    <div style="font-size:4rem;margin-bottom:8px">${emoji}</div>
    <h2 style="margin:0">${msg}</h2>
    <div style="font-size:2.5rem;font-weight:800;color:var(--primary);margin:12px 0">${fa(pctv)}٪</div>
    ${penalty > 0 ? `<p style="color:var(--danger);font-size:.95rem;margin:4px 0">نمره منفی: ${fa(penalty)} نمره کسر شد</p>` : ''}
    <div class="stats-row" style="margin-top:16px">
      <div class="stat-item"><div class="stat-value" style="color:var(--success)">${fa(correct)}</div><div class="stat-label">درست</div></div>
      <div class="stat-item"><div class="stat-value" style="color:var(--danger)">${fa(wrong)}</div><div class="stat-label">غلط</div></div>
      ${unanswered > 0 ? `<div class="stat-item"><div class="stat-value" style="color:var(--muted)">${fa(unanswered)}</div><div class="stat-label">بی‌پاسخ</div></div>` : ''}
      <div class="stat-item"><div class="stat-value">${fa(answers.length)}</div><div class="stat-label">کل</div></div>
    </div>
  </div>
  <h3 style="margin:20px 0 10px">🔎 مرور پاسخ‌ها</h3>
  <div style="display:grid;gap:10px">
    ${answers.map((a, i) => {
      const correctDisp = displayCorrectWithUnit(a.q);
      let userDisp = '';
      let borderColor = 'var(--danger)', mark = '❌';
      if (a.isCorrect) { borderColor = 'var(--success)'; mark = '✅'; }
      else if (a.unanswered) { borderColor = 'var(--muted)'; mark = '⬜'; }
      if (!a.isCorrect && a.userAns != null) userDisp = displayAnswer(a.userAns);
      return `
      <div class="card" style="border-right:4px solid ${borderColor}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>سوال ${fa(i + 1)}</strong><span>${mark}</span>
        </div>
        ${isMulti ? `<p style="font-size:.8rem;color:var(--muted);margin:4px 0">${TOPIC_EMOJIS[a.q.topic]} ${TOPIC_NAMES[a.q.topic]}</p>` : ''}
        <p style="margin:8px 0">${a.q.promptHTML || a.q.prompt}</p>
        ${a.q.shape ? `<div class="q-shape">${a.q.shape}</div>` : ''}
        <div style="font-size:.9rem;color:var(--muted)">
          ${a.unanswered ? '<div>پاسخ ندادی</div>' : (userDisp ? `<div>پاسخ تو: <span class="${a.isCorrect ? 'correct-text' : 'wrong-text'}">${userDisp}</span></div>` : '')}
          <div>پاسخ درست: <span class="correct-text">${correctDisp}</span></div>
        </div>
        <details style="margin-top:8px">
          <summary style="cursor:pointer;font-size:.9rem;color:var(--primary);font-weight:600">📝 راه‌حل</summary>
          <ul class="steps" style="margin-top:8px">${a.q.steps.map(s => `<li>${s}</li>`).join('')}</ul>
        </details>
      </div>`;
    }).join('')}
  </div>
  <div style="margin-top:16px;display:flex;gap:8px">
    ${isMulti ? `<button class="btn full" onclick="window.__nav('multiExamSetup')">🔁 دوباره</button>`
              : `<button class="btn full" onclick="window.__nav('examSetup',{topic:'${topic}'})">🔁 دوباره</button>`}
    <button class="btn sec" onclick="window.__nav('home')">🏠 خانه</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۳۳) PROGRESS
   ============================================================ */
function viewProgress() {
  const stu = activeStudent();
  if (!stu) return `<div class="empty">دانش‌آموزی انتخاب نشده</div>`;
  const p = stu.progress;
  const topics = ALL_TOPICS.map(t => ({ key: t, name: TOPIC_NAMES[t], emoji: TOPIC_EMOJIS[t] }));
  const totalQ = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].attempts) || 0), 0);
  const totalC = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].correct) || 0), 0);
  const overall = totalQ ? Math.round((totalC / totalQ) * 100) : 0;
  const mistakeList = Object.entries(stu.mistakes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const names = {
    'sq-p':'محیط مربع','rect-p':'محیط مستطیل','tri-p':'محیط مثلث','circ-p':'محیط دایره',
    'para-p':'محیط متوازی','rhom-p':'محیط لوزی','poly-p':'محیط چندضلعی','find-side':'یافتن ضلع',
    'l-p':'محیط L','house-p':'محیط خانه','park-p':'محیط ورزشی',
    'sq-a':'مساحت مربع','rect-a':'مساحت مستطیل','tri-a':'مساحت مثلث','circ-a':'مساحت دایره',
    'para-a':'مساحت متوازی','rhom-a':'مساحت لوزی','trap-a':'مساحت ذوزنقه',
    'comp-l':'شکل L','comp-t':'شکل T','comp-u':'شکل U','comp-house':'مساحت خانه','comp-park':'ورزشی','comp-villa':'ویلا+باغچه',
    'cube-v':'حجم مکعب','box-v':'حجم مکعب مستطیل','find-edge':'یافتن ضلع مکعب',
    'frac-add':'جمع کسر','frac-sub':'تفریق کسر','frac-mul':'ضرب کسر','frac-div':'تقسیم کسر',
    'frac-simplify':'ساده‌کردن','frac-cmp':'مقایسه کسر','mixed-imp':'مخلوط به کسر','frac-word':'مسئله کسری',
    'dec-add':'جمع اعشار','dec-sub':'تفریق اعشار','dec-mul':'ضرب اعشار','dec-div':'تقسیم اعشار',
    'dec-cmp':'مقایسه اعشار','frac-dec':'کسر به اعشار','dec-frac':'اعشار به کسر','dec-word':'مسئله اعشاری',
    'dec-line':'اعشار روی محور','dec-line-add':'جمع روی محور','dec-line-sub':'تفریق روی محور'
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
      <div class="stat-item"><div class="stat-value">${fa(overall)}٪</div><div class="stat-label">تسلط</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalC)}</div><div class="stat-label">درست</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalQ)}</div><div class="stat-label">کل</div></div>
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
        <span style="color:var(--danger);font-weight:700">${fa(v)} بار</span>
      </div>`;
    }).join('')}
    <button class="btn info full" style="margin-top:12px" onclick="window.__nav('practice',{topic:'${mistakeList[0][0].split(':')[0]}'})">💡 تمرین پیشنهادی</button>
  </div>` : ''}
  <h3 style="margin:20px 0 10px">📜 تاریخچه</h3>
  <div class="card">
    ${stu.history.length ? stu.history.slice(0, 10).map(h => {
      const d = new Date(h.date);
      const dateStr = `${fa(d.getFullYear())}/${fa(d.getMonth() + 1)}/${fa(d.getDate())}`;
      const tn = h.isMulti ? 'جامع' : (TOPIC_NAMES[h.topic] || h.topic);
      const color = h.score >= 70 ? 'var(--success)' : h.score >= 40 ? 'var(--accent)' : 'var(--danger)';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border)">
        <span>${dateStr} — ${tn}</span>
        <span style="font-weight:700;color:${color}">${fa(h.score)}٪</span>
      </div>`;
    }).join('') : '<p style="color:var(--muted);text-align:center">هنوز آزمونی نداده‌ای</p>'}
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۳۴) SETTINGS
   ============================================================ */
function viewSettings() {
  const s = state.settings;
  return `
  ${header('⚙️ تنظیمات', true)}
  <div class="card">
    <h3 class="card-title">🎨 حالت نمایش</h3>
    <div class="pill-row">
      <button class="pill ${s.theme === 'light' ? 'active' : ''}" onclick="window.__setSetting('theme','light')">☀️ روشن</button>
      <button class="pill ${s.theme === 'dark' ? 'active' : ''}" onclick="window.__setSetting('theme','dark')">🌙 تاریک</button>
      <button class="pill ${(s.theme === 'auto' || !s.theme) ? 'active' : ''}" onclick="window.__setSetting('theme','auto')">🌓 خودکار</button>
    </div>
  </div>
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
    <h3 class="card-title">👥 دانش‌آموزان</h3>
    <button class="btn info full" onclick="window.__nav('students')">مدیریت دانش‌آموزان</button>
  </div>
  <div class="card" style="text-align:center">
    <h3 class="card-title" style="justify-content:center">💬 ارتباط با تهیه‌کننده</h3>
    <p class="card-desc" style="margin:0 0 12px">
      ساخته شده با ❤️ توسط <strong style="direction:ltr;display:inline-block">maysam261</strong>
    </p>
    <button class="btn info full" onclick="window.__nav('contact')">📞 ارتباط</button>
  </div>
  <div class="card">
    <h3 class="card-title">⚠️ خطرناک</h3>
    <p class="card-desc">پیشرفت دانش‌آموز فعلی پاک می‌شود.</p>
    <button class="btn danger full" style="margin-top:10px" onclick="window.__resetActiveStudent()">🗑️ پاک کردن پیشرفت</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۳۵) TEACHER
   ============================================================ */
function viewTeacher() {
  const stu = activeStudent();
  return `
  ${header('👨‍🏫 معلم / والد', true)}
  <div class="card">
    <h3 class="card-title">🎯 آزمون سفارشی</h3>
    <label style="display:block;margin-top:12px">موضوع:
      <select id="tchTopic" class="num-input" style="text-align:right">
        ${ALL_TOPICS.map(t => `<option value="${t}">${TOPIC_NAMES[t]}</option>`).join('')}
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
    <p>درست: <strong>${fa(stu.stats.totalCorrect)} / ${fa(stu.stats.totalQuestions)}</strong></p>
    <p>آزمون‌ها: <strong>${fa(stu.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها</button>
  </div>` : ''}
  ${bottomNav()}`;
}

/* ============================================================
   ۳۶) RENDER
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
    case 'profile': html = viewProfile(); break;
    case 'contact': html = viewContact(); break;
    case 'perimeter':
    case 'area':
    case 'volume':
    case 'fractions':
    case 'decimals': html = viewTopic(route.name); break;
    case 'learn': html = viewLearn(route.params.topic); break;
    case 'lesson': html = viewLesson(route.params.topic, route.params.id); break;
    case 'practice': html = viewPractice(route.params.topic); break;
    case 'examSetup': html = viewExamSetup(route.params.topic); break;
    case 'multiExamSetup': html = viewMultiExamSetup(); break;
    case 'exam': html = viewExam(); break;
    case 'examResult': html = viewExamResult(); break;
    case 'progress': html = viewProgress(); break;
    case 'settings': html = viewSettings(); break;
    case 'teacher': html = viewTeacher(); break;
    default: html = activeStudent() ? viewHome() : viewStudents();
  }
  app.innerHTML = html;
  window.__currentRoute = route.name;
  if (typeof window.__updateInstallBtn === 'function') window.__updateInstallBtn();
}

/* ============================================================
   ۳۷) GLOBAL FUNCTIONS
   ============================================================ */
window.__nav = (name, params = {}) => { sound.click(); navigate(name, params); };
window.__goBack = () => {
  sound.click();
  if (route.name === 'home' || route.name === 'students') return;
  if ((route.name === 'practice' || route.name === 'exam') && session) session = null;
  if (route.name === 'addStudent') { navigate('students'); return; }
  if (['perimeter', 'area', 'volume', 'fractions', 'decimals'].includes(route.name)) navigate('home');
  else if (route.name === 'lesson') navigate('learn', { topic: route.params.topic });
  else if (['learn', 'practice', 'examSetup'].includes(route.name)) navigate(route.params.topic || 'home');
  else navigate('home');
};
window.__setDiff = (d) => {
  if (!session || session.mode !== 'practice') return;
  session.difficulty = d; state.settings.difficulty = d;
  saveState(); nextPracticeQuestion(); render();
};
window.__selectChoice = (i) => {
  if (!session || session.answered) return;
  session.selected = session.current.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => el.classList.toggle('selected', idx === i));
};
window.__playAnim = (el) => {
  if (!el) return;
  el.classList.remove('playing');
  void el.offsetWidth;
  el.classList.add('playing');
  sound.click();
};
window.__submitOrNext = () => {
  if (!session) return;
  if (session.answered) nextQuestionAction(); else submitAnswer();
};
window.__examNext = () => { if (session && session.mode === 'exam') examNext(); };
window.__startExam = (topic) => { sound.click(); startExam(topic); };
window.__startMultiExam = () => { sound.click(); startMultiExam(); };
window.__setSetting = (key, val) => {
  state.settings[key] = val;
  saveState();
  if (key === 'animation') document.body.classList.toggle('no-anim', !val);
  if (key === 'theme') applyTheme();
  render();
};
window.__cycleTheme = () => {
  const order = ['auto', 'light', 'dark'];
  const cur = state.settings.theme || 'auto';
  const next = order[(order.indexOf(cur) + 1) % 3];
  state.settings.theme = next;
  saveState();
  applyTheme();
  render();
  sound.click();
};
window.__selectStudent = (id) => {
  sound.click(); session = null;
  state.activeStudentId = id; saveState(); navigate('home');
};
window.__deleteStudent = (id) => {
  const stu = state.students.find(s => s.id === id);
  if (!stu) return;
  if (!confirm(`مطمئنی می‌خواهی «${fullName(stu)}» را کاملاً حذف کنی؟`)) return;
  state.students = state.students.filter(s => s.id !== id);
  if (state.activeStudentId === id) state.activeStudentId = state.students.length ? state.students[0].id : null;
  saveState(); sound.click(); showFloat('🗑️ حذف شد'); render();
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
  state.students.push(stu); state.activeStudentId = stu.id;
  saveState(); sound.win(); showFloat(`🎉 خوش آمدی ${name}!`);
  navigate('home');
};
window.__resetActiveStudent = () => {
  const stu = activeStudent();
  if (!stu) return;
  if (!confirm(`پیشرفت ${fullName(stu)} پاک شود؟`)) return;
  const idx = state.students.findIndex(s => s.id === stu.id);
  if (idx >= 0) {
    const t = newStudentTemplate(stu.name, stu.family, stu.grade);
    t.id = stu.id; t.createdAt = stu.createdAt;
    state.students[idx] = t;
  }
  saveState(); showFloat('🗑️ پاک شد'); navigate('home');
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
  for (let i = 0; i < count; i++) {
    const q = generateQuestion(topic, diff);
    if (q) questions.push(q);
  }
  if (!questions.length) { alert('سوالی پیدا نشد.'); return; }
  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null,
    correct: 0, wrong: 0, unanswered: 0,
    timeLeft: time, totalTime: time, isMulti: false
  };
  navigate('exam'); startExamTimer();
};
window.__exportData = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'riazi-yar-backup.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

/* ============================================================
   ۳۸) KEYBOARD
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && route.name !== 'home' && route.name !== 'students') window.__goBack();
  if (e.key === 'Enter' && route.name === 'addStudent') {
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') window.__createStudent();
  }
  if ((e.key === ' ' || e.key === 'Enter') && document.activeElement &&
      document.activeElement.classList && document.activeElement.classList.contains('anim-wrap')) {
    e.preventDefault();
    window.__playAnim(document.activeElement);
  }
});

/* ============================================================
   ۳۹) INIT
   ============================================================ */
ensureAnimStyles();
applyTheme();

if (state.students.length === 0) {
  route = { name: 'addStudent', params: {} };
} else if (!state.activeStudentId || !activeStudent()) {
  route = { name: 'students', params: {} };
}
render();

})();
