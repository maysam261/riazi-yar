/* =============================================================
   ریاضی‌یار — نسخه ۹.۰ (انیمیشن لوپ‌شونده)
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
    difficulty: 'easy', questionCount: 10, examTime: 300
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
function numOr(v, fallback) { return typeof v === 'number' && v > 0 ? v : fallback; }

/* ============================================================
   ۳) ANIMATION STYLES — Loop-based
   ============================================================ */
function ensureAnimStyles() {
  if (document.getElementById('riazi-anim-styles')) return;
  const s = document.createElement('style');
  s.id = 'riazi-anim-styles';
  s.textContent = `
    /* ============ Keyframes: Loop with long hold phase ============ */
    @keyframes drawStrokeLoop {
      0%   { stroke-dashoffset: var(--len, 500); }
      18%  { stroke-dashoffset: 0; }                /* 0-2.16s draw */
      94%  { stroke-dashoffset: 0; }                /* hold 9.1s */
      100% { stroke-dashoffset: var(--len, 500); }  /* reset */
    }
    @keyframes popInLoop {
      0%   { opacity: 0; transform: scale(0.4); }
      3%   { opacity: 1; transform: scale(1.15); }  /* 0-0.36s pop */
      5%   { opacity: 1; transform: scale(1); }     /* settle */
      94%  { opacity: 1; transform: scale(1); }     /* hold */
      100% { opacity: 0; transform: scale(0.4); }   /* fade */
    }
    @keyframes fadeInLoop {
      0%   { opacity: 0; }
      15%  { opacity: 1; }                          /* 0-1.8s fade in */
      94%  { opacity: 1; }                          /* hold */
      100% { opacity: 0; }                          /* fade out */
    }
    @keyframes slideDownLoop {
      0%   { opacity: 0; transform: translateY(-15px); }
      10%  { opacity: 1; transform: translateY(0); } /* 0-1.2s slide */
      94%  { opacity: 1; transform: translateY(0); } /* hold */
      100% { opacity: 0; transform: translateY(-15px); }
    }

    /* ============ Loop classes ============ */
    .anim-draw-loop {
      stroke-dashoffset: var(--len, 500);
      animation: drawStrokeLoop 12s ease-out infinite;
    }
    .anim-fade-loop {
      opacity: 0;
      animation: fadeInLoop 12s ease infinite;
    }
    .anim-pop-loop {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
      animation: popInLoop 12s cubic-bezier(.34,1.56,.64,1) infinite;
    }
    .anim-slide-loop {
      opacity: 0;
      animation: slideDownLoop 12s cubic-bezier(.34,1.56,.64,1) infinite;
    }

    /* ============ Performance hints ============ */
    .anim-pop-loop,
    .anim-slide-loop {
      will-change: opacity, transform;
    }
    .anim-fade-loop {
      will-change: opacity;
    }
    .anim-draw-loop {
      will-change: stroke-dashoffset;
    }

    /* ============ Reduced motion ============ */
    body.no-anim .anim-draw-loop,
    body.no-anim .anim-fade-loop,
    body.no-anim .anim-pop-loop,
    body.no-anim .anim-slide-loop {
      animation: none !important;
      opacity: 1 !important;
      stroke-dashoffset: 0 !important;
      transform: none !important;
    }
  `;
  document.head.appendChild(s);
}

/* ============================================================
   ۴) SOUND
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
   ۵) FRACTIONS
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
  if (q.numericAnswer != null) {
    return `${faDec(q.numericAnswer, 2)}${q.unit ? ' ' + q.unit : ''}`;
  }
  return displayAnswer(q.correct);
}

/* ============================================================
   ۶) NUMERIC → CHOICE (SMART)
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
    seen.add(w);
    wrongs.push(w);
  }
  let n = 1;
  while (wrongs.length < 3) {
    const w = round(correct + n * (isInt ? 1 : 0.5), dec);
    if (w > 0 && !seen.has(w)) { wrongs.push(w); seen.add(w); }
    n++;
    if (n > 50) break;
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
      seen.add(rw);
      wrongs.push(rw);
    }
  }
  if (wrongs.length < 3) {
    const fb = fallbackDistractors(correct);
    for (const w of fb) {
      if (wrongs.length >= 3) break;
      if (seen.has(w)) continue;
      seen.add(w);
      wrongs.push(w);
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
   ۷) SHAPES (static)
   ============================================================ */
const SC = {
  fill: '#c7d2fe', stroke: '#4338ca', fill2: '#a5b4fc',
  fill3: '#fde68a', fill4: '#bbf7d0', accent: '#fbbf24'
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
    const roofBaseMid = [(pL[0] + pR[0]) / 2, pL[1]];
    return svgWrap(W, H,
      `<polygon points="${pBL.join(',')} ${pBR.join(',')} ${pR.join(',')} ${pL.join(',')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<polygon points="${pL.join(',')} ${pTop.join(',')} ${pR.join(',')}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="${pTop[0]}" y1="${pTop[1]}" x2="${roofBaseMid[0]}" y2="${roofBaseMid[1]}" stroke="${SC.accent}" stroke-width="2.2" stroke-dasharray="5 4"/>` +
      label(pTop[0] + 12, (pTop[1] + roofBaseMid[1]) / 2 + 4, fa(roofH), 'start', 'svg-label-lg') +
      label((pBL[0] + pBR[0]) / 2, pBL[1] + 22, fa(wN), 'middle', 'svg-label-lg') +
      label(pR[0] + 10, (pR[1] + pBR[1]) / 2 + 4, fa(hN), 'start', 'svg-label-lg')
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
      label(x0 + size / 2 - offset / 2, y0 + size - offset + 22, fa(edge), 'middle', 'svg-label-lg')
    );
  },
  box(length, width, height) {
    const W = 260, H = 220, pad = 40;
    const maxDim = Math.max(length, width, height);
    const scale = 90 / maxDim;
    const A = length * scale;
    const B = height * scale;
    const C = width * scale;
    const offset = 25;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      `<rect x="${x0 - offset}" y="${y0 - offset}" width="${A}" height="${B}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" rx="3"/>` +
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset},${y0 - offset}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<polygon points="${x0 + A - offset},${y0 - offset} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 + B - offset - C * 0.6} ${x0 + A - offset},${y0 + B - offset}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      label(x0 - offset + A / 2, y0 - offset + B + 22, fa(length), 'middle', 'svg-label-lg') +
      label(x0 - offset - 12, y0 - offset + B / 2 + 4, fa(height), 'end', 'svg-label-lg') +
      label(x0 + A - offset + C / 2 + 8, y0 - offset - C * 0.3 - 4, fa(width), 'start', 'svg-label-lg')
    );
  }
};

/* ============================================================
   ۸) ANIMATED SHAPES — LOOP version
   ============================================================ */
const ShapesAnim = {
  tracingSquare(side) {
    const W = 220, H = 200, pad = 46;
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    const len = 4 * box;
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill}" fill-opacity="0.35" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len: ${len}; stroke-dasharray: ${len}"/>` +
      label(x + box / 2, y + box + 22, fa(side), 'middle', 'svg-label-lg')
    );
  },
  tracingRect(w, h) {
    const W = 260, H = 200, pad = 46;
    const wNum = numOr(w, 3);
    const hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    const len = 2 * (rw + rh);
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" fill-opacity="0.35" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len: ${len}; stroke-dasharray: ${len}"/>` +
      label(x + rw / 2, y + rh + 22, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  tracingTriangle(a, b, c) {
    const W = 260, H = 220, pad = 46;
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
      labelOnSegment(pA, pB, cent, fa(c), 16) +
      labelOnSegment(pB, pC, cent, fa(a), 16) +
      labelOnSegment(pC, pA, cent, fa(b), 16)
    );
  },
  circleRadiusAnim(r) {
    const W = 220, H = 200;
    const cx = W / 2, cy = H / 2 - 4, R = 62;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" fill-opacity="0.4" stroke="${SC.stroke}" stroke-width="3" class="anim-fade-loop"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len: ${R}; stroke-dasharray: ${R}; animation-delay: 0.3s"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      label(cx + R / 2, cy - 8, fa(r), 'middle', 'svg-label-lg')
    );
  },
  gridRect(w, h) {
    const W = 260, H = 200, pad = 46;
    const wNum = numOr(w, 3);
    const hNum = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wNum, (H - 2 * pad) / hNum);
    const rw = wNum * s, rh = hNum * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    let grid = '';
    const total = wNum * hNum;
    for (let j = 0; j < hNum; j++) {
      for (let i = 0; i < wNum; i++) {
        const idx = j * wNum + i;
        const delay = (idx * 0.05).toFixed(2);
        grid += `<rect x="${(x + i*s).toFixed(1)}" y="${(y + j*s).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="1" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      }
    }
    return svgWrap(W, H,
      grid +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="none" stroke="${SC.stroke}" stroke-width="3" rx="2"/>` +
      label(x + rw / 2, y + rh + 22, fa(w), 'middle', 'svg-label-lg') +
      label(x - 12, y + rh / 2 + 5, fa(h), 'end', 'svg-label-lg')
    );
  },
  gridSquare(side) {
    return ShapesAnim.gridRect(side, side);
  },
  triangleAreaAnim(base, height) {
    const W = 260, H = 220, pad = 46;
    const A = [base / 2, height], B = [0, 0], C = [base, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    const hLen = Math.abs(pA[1] - midBC[1]);
    return svgWrap(W, H,
      `<polygon points="${pB.join(',')} ${pC.join(',')} ${pA[0]},${pC[1]} ${pA[0]},${pB[1]}" fill="none" stroke="${SC.stroke}" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4"/>` +
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round" class="anim-fade-loop"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len: ${hLen}; stroke-dasharray: ${hLen}; animation-delay: 0.5s"/>` +
      `<rect x="${midBC[0] - 5}" y="${midBC[1] - 10}" width="10" height="10" fill="none" stroke="${SC.accent}" stroke-width="1.5" class="anim-fade-loop" style="animation-delay: 0.5s"/>` +
      label(pA[0] + 12, (pA[1] + midBC[1]) / 2 + 4, fa(height), 'start', 'svg-label-lg') +
      label(midBC[0], midBC[1] + 22, fa(base), 'middle', 'svg-label-lg')
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
      label(x0 + size / 2 - offset / 2, y0 + size - offset + 22, fa(edge), 'middle', 'svg-label-lg')
    );
  },
  boxBuild(length, width, height) {
    const W = 260, H = 220, pad = 40;
    const maxDim = Math.max(length, width, height);
    const scale = 90 / maxDim;
    const A = length * scale;
    const B = height * scale;
    const C = width * scale;
    const offset = 25;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      `<polygon points="${x0 + A - offset},${y0 - offset} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 + B - offset - C * 0.6} ${x0 + A - offset},${y0 + B - offset}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0s"/>` +
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset},${y0 - offset}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" class="anim-slide-loop" style="animation-delay: 0.3s"/>` +
      `<rect x="${x0 - offset}" y="${y0 - offset}" width="${A}" height="${B}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="2.5" rx="3" class="anim-slide-loop" style="animation-delay: 0.6s"/>` +
      label(x0 - offset + A / 2, y0 - offset + B + 22, fa(length), 'middle', 'svg-label-lg') +
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
      const fill = i < n ? '#a5b4fc' : '#e5e7eb';
      const delay = (i * 0.15).toFixed(2);
      if (d === 1) {
        paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#4338ca" stroke-width="2" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      } else {
        paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="#4338ca" stroke-width="1.5" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
      }
    }
    return svgWrap(W, H, paths);
  },
  fracBarAnim(n, d) {
    const W = 300, H = 90, pad = 20;
    const barW = W - 2 * pad;
    const segW = barW / d;
    const y = 20;
    const h = 35;
    let rects = '';
    for (let i = 0; i < d; i++) {
      const fill = i < n ? '#a5b4fc' : '#e5e7eb';
      const delay = (i * 0.12).toFixed(2);
      rects += `<rect x="${(pad + i * segW).toFixed(1)}" y="${y}" width="${segW.toFixed(1)}" height="${h}" fill="${fill}" stroke="#4338ca" stroke-width="1.5" class="anim-pop-loop" style="animation-delay: ${delay}s"/>`;
    }
    const fracText = `<text x="${W/2}" y="${y + h + 25}" text-anchor="middle" class="svg-label-lg" direction="rtl">${fracHTML({ n, d })}</text>`;
    return svgWrap(W, H, rects + fracText);
  },
  numberLineAnim(from, to, value) {
    const W = 320, H = 90, pad = 30;
    const y = 48;
    const step = (W - 2 * pad) / (to - from);
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#4338ca" stroke-width="2"/>`;
    for (let i = from; i <= to; i++) {
      const x = pad + (i - from) * step;
      line += `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" stroke="#4338ca" stroke-width="2"/>`;
      line += `<text x="${x}" y="${y + 24}" text-anchor="middle" class="svg-label" direction="rtl">${fa(i)}</text>`;
    }
    const markerX = pad + (value - from) * step;
    line += `<circle cx="${markerX}" cy="${y}" r="7" fill="#fbbf24" stroke="#fff" stroke-width="2" class="anim-pop-loop" style="animation-delay: 0.5s"/>`;
    line += `<line x1="${markerX}" y1="${y - 20}" x2="${markerX}" y2="${y - 7}" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" class="anim-draw-loop" style="--len: 13; stroke-dasharray: 13; animation-delay: 0.3s"/>`;
    return svgWrap(W, H, line);
  }
};

/* ============================================================
   ۹) DIFFICULTY
   ============================================================ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 6];
  if (diff === 'hard') return [6, 12];
  return [4, 9];
}

/* ============================================================
   ۱۰) CONTEXTS
   ============================================================ */
const CTX_P = {
  square: [
    { story: 'یک کاشی مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'دور تا دور این کاشی چند سانتی‌متر است؟' },
    { story: 'زمین بازی مدرسه مربعی است و هر ضلعش', u: 'متر', ask: 'اگر یک دور کامل دور زمین بدویم، چند متر می‌دویم؟' },
    { story: 'سفره‌ی مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'برای دوخت نوار دور سفره چقدر نوار لازم است؟' },
    { story: 'یک باغچه‌ی مربعی داریم که هر ضلعش', u: 'متر', ask: 'برای نرده‌کشی دور باغچه چقدر نرده لازم است؟' },
    { story: 'قاب عکس مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'برای قاب‌گیری دور آن چقدر چوب لازم است؟' }
  ],
  rectangle: [
    { story: 'استخر مستطیلی داریم به طول', u: 'متر', ask: 'برای نصب حفاظ دور آن چقدر حفاظ لازم است؟' },
    { story: 'جلد کتاب ریاضی ما مستطیلی است به طول', u: 'سانتی‌متر', ask: 'دور تا دور جلد کتاب چند سانتی‌متر است؟' },
    { story: 'یک زمین فوتبال مستطیلی داریم به طول', u: 'متر', ask: 'دور تا دور زمین چند متر است؟' },
    { story: 'فرش اتاق ما مستطیلی است به طول', u: 'متر', ask: 'برای دوخت نوار دور فرش چقدر نوار لازم است؟' }
  ],
  triangle: [
    { story: 'یک زمین مثلثی داریم با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' },
    { story: 'تابلوی هشدار مدرسه مثلثی است با اضلاع', u: 'سانتی‌متر', ask: 'برای قاب‌گیری آن چقدر نوار لازم است؟' },
    { story: 'یک قطعه زمین مثلثی داریم با اضلاع', u: 'متر', ask: 'دور تا دور آن چند متر است؟' }
  ],
  circle: [
    { story: 'استخر دایره‌ای داریم با شعاع', u: 'متر', ask: 'برای کشیدن نرده دور آن چقدر نرده لازم است؟ (π را ۳٫۱۴ بگیر)' },
    { story: 'یک باغ گل دایره‌ای داریم با شعاع', u: 'متر', ask: 'دور تا دور آن چند متر است؟ (π را ۳٫۱۴ بگیر)' }
  ],
  parallelogram: [
    { story: 'یک زمین کشاورزی متوازی‌الاضلاع داریم با اضلاع', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ],
  rhombus: [
    { story: 'باغچه‌ای لوزی‌شکل داریم که هر ضلعش', u: 'متر', ask: 'برای نرده‌کشی دور آن چقدر نرده لازم است؟' }
  ]
};

const CTX_A = {
  square: [
    { story: 'اتاق بازی به شکل مربع است و ضلعش', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'یک کاشی مربعی داریم که ضلعش', u: 'سانتی‌متر', ask: 'مساحت این کاشی چقدر است؟' },
    { story: 'آشپزخانه‌ی ما مربعی است و ضلعش', u: 'متر', ask: 'برای سنگ‌فرش کف آن چند متر مربع سنگ لازم است؟' }
  ],
  rectangle: [
    { story: 'زمین فوتبال محله‌ی ما به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'جلد دفتر مشق من به طول', u: 'سانتی‌متر', ask: 'مساحت جلد دفتر چقدر است؟' },
    { story: 'یک زمین کشاورزی به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'پوستر اتاق من به طول', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' }
  ],
  triangle: [
    { story: 'بیرق مثلثی مدرسه با قاعده', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟' },
    { story: 'یک تکه زمین مثلثی با قاعده', u: 'متر', ask: 'مساحت آن چقدر است؟' }
  ],
  circle: [
    { story: 'پیتزای دایره‌ای داریم با شعاع', u: 'سانتی‌متر', ask: 'مساحت آن چقدر است؟ (π را ۳٫۱۴ بگیر)' },
    { story: 'استخر دایره‌ای محله با شعاع', u: 'متر', ask: 'مساحت کف آن چقدر است؟ (π را ۳٫۱۴ بگیر)' }
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
    { story: 'یک تاس بازی مکعبی است و هر ضلعش', u: 'سانتی‌متر', ask: 'حجم این تاس چقدر است؟' },
    { story: 'یک آجر اسباب‌بازی مکعبی است و هر ضلعش', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }
  ],
  box: [
    { story: 'یک جعبه کفش داریم به طول', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' },
    { story: 'یخچال خانه‌ی ما به طول', u: 'سانتی‌متر', ask: 'حجم فضای داخل آن چقدر است؟' },
    { story: 'یک کتابخانه‌ی چوبی داریم به طول', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }
  ]
};

const CTX_FR = [
  { name: 'علی', u: 'تومان', verb: 'خرج کرد', q: 'علی چقدر خرج کرد؟' },
  { name: 'مریم', u: 'صفحه', verb: 'خواند', q: 'مریم چند صفحه خواند؟' },
  { name: 'رضا', u: 'لیتر', verb: 'نوشید', q: 'رضا چند لیتر نوشید؟' },
  { name: 'زهرا', u: 'دقیقه', verb: 'ورزش کرد', q: 'زهرا چند دقیقه ورزش کرد؟' },
  { name: 'حسین', u: 'تومان', verb: 'پس‌انداز کرد', q: 'حسین چقدر پس‌انداز کرد؟' }
];

/* ============================================================
   ۱۱) PERIMETER GENERATORS
   ============================================================ */
function genSquarePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  if (diff === 'easy') {
    return {
      topic: 'perimeter', key: 'sq-p',
      prompt: `محیط مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
      shape: Shapes.square(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر',
      distractors,
      steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`]
    };
  }
  const ctx = pick(CTX_P.square);
  return {
    topic: 'perimeter', key: 'sq-p',
    prompt: `${ctx.story} ${fa(s)} ${ctx.u} است. ${ctx.ask}`,
    shape: Shapes.square(s), type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genSquarePerimeter.levels = ['easy', 'medium', 'hard'];

function genRectPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = 2 * (w + h);
  const distractors = [w * h, w + h, 4 * (w + h), w + h + 2];
  if (diff === 'easy') {
    return {
      topic: 'perimeter', key: 'rect-p',
      prompt: `محیط مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
      shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر',
      distractors,
      steps: ['مستطیل ۴ ضلع دارد: دو طول و دو عرض.', 'محیط = ۲ × (طول + عرض)',
        `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${eq(`۲ × ${fa(w + h)}`)} = ${fa(ans)} سانتی‌متر`]
    };
  }
  const ctx = pick(CTX_P.rectangle);
  return {
    topic: 'perimeter', key: 'rect-p',
    prompt: `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u} است. ${ctx.ask}`,
    shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['مستطیل ۴ ضلع دارد: دو طول و دو عرض.', 'محیط = ۲ × (طول + عرض)',
      `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRectPerimeter.levels = ['easy', 'medium', 'hard'];

function genTrianglePerimeter(diff) {
  const [a, b] = diffRange(diff);
  let x, y, z, guard = 0;
  do {
    x = ri(a, b); y = ri(a, b); z = ri(a, b);
    guard++;
  } while ((x + y <= z || x + z <= y || y + z <= x) && guard < 40);
  if (guard >= 40) { x = a; y = a + 1; z = a + 2; }
  const ans = x + y + z;
  const distractors = [x * y * z, x + y, 2 * (x + y + z), x * y];
  const ctx = diff === 'easy' ? { story: '', u: 'سانتی‌متر', ask: '' } : pick(CTX_P.triangle);
  const prompt = diff === 'easy'
    ? `محیط مثلثی با اضلاع ${fa(x)}، ${fa(y)} و ${fa(z)} سانتی‌متر چقدر است؟`
    : `${ctx.story} ${fa(x)}، ${fa(y)} و ${fa(z)} ${ctx.u}. ${ctx.ask}`;
  return {
    topic: 'perimeter', key: 'tri-p',
    prompt, shape: Shapes.triangle(x, y, z),
    type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['محیط مثلث = جمع سه ضلع',
      `محیط = ${eq(`${fa(x)} + ${fa(y)} + ${fa(z)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genTrianglePerimeter.levels = ['easy', 'medium', 'hard'];

function genCirclePerimeter(diff) {
  const r = ri(2, diff === 'hard' ? 6 : 5);
  const ans = round(2 * 3.14 * r, 2);
  const distractors = [
    round(3.14 * r * r, 2),
    round(3.14 * r, 2),
    round(4 * 3.14 * r, 2),
    r * r
  ];
  const ctx = diff === 'hard' ? pick(CTX_P.circle) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(r)} ${ctx.u}. ${ctx.ask}`
    : `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`;
  return {
    topic: 'perimeter', key: 'circ-p',
    prompt, shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['محیط دایره = ۲ × π × شعاع',
      `محیط = ${eq(`۲ × ۳٫۱۴ × ${fa(r)}`)} = ${faDec(ans)}${pct(ctx.u)}`]
  };
}
genCirclePerimeter.levels = ['medium', 'hard'];

function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b);
  const ans = 2 * (x + y);
  const distractors = [x * y, x + y, 4 * (x + y), 2 * x + y];
  const ctx = diff === 'hard' ? pick(CTX_P.parallelogram) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(x)} و ${fa(y)} ${ctx.u}. ${ctx.ask}`
    : `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'para-p',
    prompt, shape: Shapes.parallelogram(x, y),
    type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['اضلاع روبه‌رو در متوازی‌الاضلاع مساوی‌اند.', 'محیط = ۲ × (ضلع بزرگ + ضلع کوچک)',
      `محیط = ${eq(`۲ × (${fa(x)} + ${fa(y)})`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genParallelogramPerimeter.levels = ['medium', 'hard'];

function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  const ctx = diff === 'hard' ? pick(CTX_P.rhombus) : { story: '', u: 'سانتی‌متر', ask: '' };
  const prompt = diff === 'hard'
    ? `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}`
    : `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'rhom-p',
    prompt, shape: Shapes.rhombusSide(s),
    type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: ['لوزی ۴ ضلع مساوی دارد.', `محیط = ۴ × ضلع = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u)}`]
  };
}
genRhombusPerimeter.levels = ['medium', 'hard'];

function genPolygonPerimeter(diff) {
  const ns = diff === 'easy' ? [3, 4] : diff === 'medium' ? [5, 6] : [6, 8];
  const n = pick(ns);
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = n * s;
  const distractors = [s * s, (n - 1) * s, (n + 1) * s, n + s];
  const nameMap = { 3: 'مثلث', 4: 'مربع', 5: 'پنج‌ضلعی', 6: 'شش‌ضلعی', 8: 'هشت‌ضلعی' };
  const prompt = diff === 'hard'
    ? `باغ گل مدرسه ${nameMap[n]} منتظم است و هر ضلعش ${fa(s)} متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟`
    : `محیط یک ${nameMap[n]} منتظم با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'perimeter', key: 'poly-p',
    prompt, shape: Shapes.regularPolygon(n, s),
    type: 'numeric', answer: ans, unit: diff === 'hard' ? 'متر' : 'سانتی‌متر',
    distractors,
    steps: [`در ${nameMap[n]} منتظم همه‌ی اضلاع مساوی‌اند.`, 'محیط = تعداد ضلع × طول یک ضلع',
      `محیط = ${eq(`${fa(n)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genPolygonPerimeter.levels = ['medium', 'hard'];

function genFindSideFromPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const p = 4 * s;
  const distractors = [round(p / 2, 2), p, 4 * p, s + 2];
  const stories = [
    `محیط یک زمین بازی مربعی ${fa(p)} متر است. طول هر ضلع چقدر است؟`,
    `دور یک سفره مربعی ${fa(p)} سانتی‌متر نوار لازم است. ضلع سفره چقدر است؟`,
    `محیط یک قاب مربعی ${fa(p)} سانتی‌متر است. طول هر ضلع چقدر است؟`
  ];
  return {
    topic: 'perimeter', key: 'find-side',
    prompt: diff === 'hard' ? pick(stories) : `محیط مربعی ${fa(p)} سانتی‌متر است. طول ضلع آن چقدر است؟`,
    shape: Shapes.square('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر',
    distractors,
    steps: ['می‌دانیم: محیط = ۴ × ضلع', 'پس ضلع = محیط ÷ ۴',
      `ضلع = ${eq(`${fa(p)} ÷ ۴`)} = ${fa(s)} سانتی‌متر`]
  };
}
genFindSideFromPerimeter.levels = ['hard'];

/* ============================================================
   ۱۲) AREA GENERATORS
   ============================================================ */
function genSquareArea(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = s * s;
  const distractors = [4 * s, 2 * s, s + s, s + 4];
  const ctx = diff !== 'easy' ? pick(CTX_A.square) : null;
  const prompt = ctx ? `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}` : `مساحت مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'sq-a',
    prompt, shape: Shapes.square(s), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت مربع = ضلع × ضلع', `مساحت = ${eq(`${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`]
  };
}
genSquareArea.levels = ['easy', 'medium', 'hard'];

function genRectArea(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = w * h;
  const distractors = [2 * (w + h), w + h, w * h * 2, w + h + 2];
  const ctx = diff !== 'easy' ? pick(CTX_A.rectangle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u}. ${ctx.ask}`
    : `مساحت مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'rect-a',
    prompt, shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
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
    ? `${ctx.story} ${fa(base)} ${ctx.u} و ارتفاع ${fa(h)} ${ctx.u}. ${ctx.ask}`
    : `مساحت مثلثی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'tri-a',
    prompt, shape: Shapes.triangleBH(base, h), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت مثلث = (قاعده × ارتفاع) ÷ ۲',
      `مساحت = ${eq(`(${fa(base)} × ${fa(h)}) ÷ ۲`)} = ${eq(`${fa(base * h)} ÷ ۲`)} = ${fa(ans)}`]
  };
}
genTriangleArea.levels = ['medium', 'hard'];

function genCircleArea(diff) {
  const r = ri(2, diff === 'hard' ? 6 : 5);
  const ans = round(3.14 * r * r, 2);
  const distractors = [
    round(2 * 3.14 * r, 2),
    round(3.14 * r, 2),
    r * r,
    round(3.14 * r * r * 2, 2)
  ];
  const ctx = diff === 'hard' ? pick(CTX_A.circle) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(r)} ${ctx.u}. ${ctx.ask}`
    : `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`;
  return {
    topic: 'area', key: 'circ-a',
    prompt, shape: Shapes.circle(r), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت دایره = π × شعاع × شعاع',
      `مساحت = ${eq(`۳٫۱۴ × ${fa(r)} × ${fa(r)}`)} = ${faDec(ans)}`]
  };
}
genCircleArea.levels = ['medium', 'hard'];

function genParallelogramArea(diff) {
  const [a, b] = diffRange(diff);
  const base = ri(a, b), h = ri(a, b);
  const ans = base * h;
  const distractors = [2 * (base + h), base + h, base * h * 2, base + h + 2];
  const ctx = diff === 'hard' ? pick(CTX_A.parallelogram) : null;
  const prompt = ctx
    ? `${ctx.story} ${fa(base)} ${ctx.u} و ارتفاع ${fa(h)} ${ctx.u}. ${ctx.ask}`
    : `مساحت متوازی‌الاضلاعی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'para-a',
    prompt, shape: Shapes.parallelogram(base, 12, h), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت متوازی‌الاضلاع = قاعده × ارتفاع',
      `مساحت = ${eq(`${fa(base)} × ${fa(h)}`)} = ${fa(ans)}`]
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
    ? `${ctx.story} ${fa(d1)} و ${fa(d2)} ${ctx.u}. ${ctx.ask}`
    : `مساحت لوزی با قطرهای ${fa(d1)} و ${fa(d2)} سانتی‌متر چقدر است؟`;
  return {
    topic: 'area', key: 'rhom-a',
    prompt, shape: Shapes.rhombusD(d1, d2), type: 'numeric', answer: ans,
    unit: ctx ? ctx.u + ' مربع' : 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲',
      `مساحت = ${eq(`(${fa(d1)} × ${fa(d2)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genRhombusArea.levels = ['medium', 'hard'];

function genTrapezoidArea(diff) {
  const [a, b] = diffRange(diff);
  let base1 = ri(a, b), base2 = ri(a, b), h = ri(a, b);
  if (((base1 + base2) * h) % 2 !== 0) h += 1;
  const ans = ((base1 + base2) * h) / 2;
  const distractors = [
    (base1 + base2) * h,
    base1 + base2 + h,
    base1 * base2 * h,
    (base1 + base2) * 2
  ];
  return {
    topic: 'area', key: 'trap-a',
    prompt: `مساحت ذوزنقه‌ای با دو قاعده ${fa(base1)} و ${fa(base2)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.trapezoid(base1, base2, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    distractors,
    steps: ['مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      `مساحت = ${eq(`((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`]
  };
}
genTrapezoidArea.levels = ['hard'];

function genCompositeArea(diff) {
  const [a, b] = diffRange(diff);
  const variant = pick(['L', 'house', 'T']);

  if (variant === 'L') {
    const W1 = ri(a, b), H1 = ri(a, Math.min(6, b));
    const W2 = ri(Math.max(2, Math.floor(W1 / 2)), Math.max(3, W1 - 1));
    const H2 = ri(a, Math.min(6, b));
    const area1 = W1 * H1, area2 = W2 * H2, ans = area1 + area2;
    const distractors = [
      area1 * area2,
      W1 + H1 + W2 + H2,
      2 * (W1 + H1 + W2 + H2),
      ans * 2
    ];
    return {
      topic: 'area', key: 'comp-a',
      prompt: 'این شکل به شکل حرف L است (از دو مستطیل ساخته شده). مساحتش چقدر است؟',
      shape: Shapes.lshape(W1, H1, W2, H2), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
      distractors,
      steps: ['این شکل از دو مستطیل ساخته شده.',
        `مستطیل بالایی: ${eq(`${fa(W1)} × ${fa(H1)}`)} = ${fa(area1)}`,
        `مستطیل پایینی: ${eq(`${fa(W2)} × ${fa(H2)}`)} = ${fa(area2)}`,
        `مساحت کل = ${eq(`${fa(area1)} + ${fa(area2)}`)} = ${fa(ans)}`]
    };
  }
  if (variant === 'house') {
    const W = ri(Math.max(4, a), Math.min(8, b));
    const H = ri(a, Math.min(6, b));
    let triH = ri(2, 4);
    if ((W * triH) % 2 !== 0) triH += 1;
    const rectArea = W * H;
    const triArea = (W * triH) / 2;
    const ans = rectArea + triArea;
    const distractors = [
      rectArea - triArea > 0 ? rectArea - triArea : rectArea + 2,
      W + H + triH,
      2 * ans,
      rectArea * 2
    ];
    return {
      topic: 'area', key: 'comp-a',
      prompt: 'این شکل مثل یک خانه است: یک مستطیل (اتاق) و یک مثلث (سقف) روی آن. مساحت کل چقدر است؟',
      shape: Shapes.house(W, H, triH), type: 'numeric', answer: ans, unit: 'متر مربع',
      distractors,
      steps: ['مساحت مستطیل (اتاق) = طول × عرض',
        `مساحت مستطیل = ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(rectArea)}`,
        'مساحت مثلث (سقف) = (قاعده × ارتفاع) ÷ ۲',
        `مساحت مثلث = ${eq(`(${fa(W)} × ${fa(triH)}) ÷ ۲`)} = ${fa(triArea)}`,
        `مساحت کل = ${eq(`${fa(rectArea)} + ${fa(triArea)}`)} = ${fa(ans)}`]
    };
  }
  const WT = ri(a, b), HT = ri(2, 3);
  const WB = ri(2, Math.max(3, WT - 1)), HB = ri(a, Math.min(6, b));
  const areaT = WT * HT, areaB = WB * HB, ans = areaT + areaB;
  const distractors = [ans * 2, WT + HT + WB + HB, areaT * areaB, areaT - areaB > 0 ? areaT - areaB : ans + 3];
  return {
    topic: 'area', key: 'comp-a',
    prompt: 'این شکل شبیه حرف T است. مساحتش چقدر است؟',
    shape: Shapes.tshape(WT, HT, WB, HB), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    distractors,
    steps: ['این شکل از دو مستطیل ساخته شده.',
      `مستطیل افقی بالا: ${eq(`${fa(WT)} × ${fa(HT)}`)} = ${fa(areaT)}`,
      `مستطیل عمودی پایین: ${eq(`${fa(WB)} × ${fa(HB)}`)} = ${fa(areaB)}`,
      `مساحت کل = ${eq(`${fa(areaT)} + ${fa(areaB)}`)} = ${fa(ans)}`]
  };
}
genCompositeArea.levels = ['hard'];

/* ============================================================
   ۱۳) VOLUME GENERATORS
   ============================================================ */
function genCubeVolume(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, Math.min(6, b));
  const ans = s * s * s;
  const distractors = [s * s, 6 * s * s, 3 * s, s * s * 2];
  if (diff === 'easy') {
    return {
      topic: 'volume', key: 'cube-v',
      prompt: `حجم مکعبی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
      shape: Shapes.cube(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب',
      distractors,
      steps: ['حجم مکعب = ضلع × ضلع × ضلع',
        `حجم = ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر مکعب`]
    };
  }
  const ctx = pick(CTX_V.cube);
  return {
    topic: 'volume', key: 'cube-v',
    prompt: `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}`,
    shape: Shapes.cube(s), type: 'numeric', answer: ans, unit: ctx.u + ' مکعب',
    distractors,
    steps: ['مکعب است: همه‌ی ضلع‌ها مساوی.', 'حجم = ضلع × ضلع × ضلع',
      `حجم = ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(ans)}${pct(ctx.u + ' مکعب')}`]
  };
}
genCubeVolume.levels = ['easy', 'medium', 'hard'];

function genBoxVolume(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, Math.min(6, b));
  const h = ri(a, Math.min(5, b));
  const d = ri(a, Math.min(5, b));
  const ans = w * h * d;
  const distractors = [w * h, w + h + d, 2 * (w + h + d), w * h * 2];
  if (diff === 'easy') {
    return {
      topic: 'volume', key: 'box-v',
      prompt: `حجم مکعب مستطیلی به طول ${fa(w)}، عرض ${fa(h)} و ارتفاع ${fa(d)} سانتی‌متر چقدر است؟`,
      shape: Shapes.box(w, h, d), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب',
      distractors,
      steps: ['حجم مکعب مستطیل = طول × عرض × ارتفاع',
        `حجم = ${eq(`${fa(w)} × ${fa(h)} × ${fa(d)}`)} = ${fa(ans)} سانتی‌متر مکعب`]
    };
  }
  const ctx = pick(CTX_V.box);
  return {
    topic: 'volume', key: 'box-v',
    prompt: `${ctx.story} ${fa(w)} ${ctx.u}، عرض ${fa(h)} ${ctx.u} و ارتفاع ${fa(d)} ${ctx.u}. ${ctx.ask}`,
    shape: Shapes.box(w, h, d), type: 'numeric', answer: ans, unit: ctx.u + ' مکعب',
    distractors,
    steps: ['مکعب مستطیل سه اندازه دارد: طول، عرض و ارتفاع.', 'حجم = طول × عرض × ارتفاع',
      `حجم = ${eq(`${fa(w)} × ${fa(h)} × ${fa(d)}`)} = ${fa(ans)}${pct(ctx.u + ' مکعب')}`]
  };
}
genBoxVolume.levels = ['easy', 'medium', 'hard'];

function genFindEdgeFromVolume(diff) {
  const s = ri(2, 5);
  const v = s * s * s;
  const distractors = [round(v / 3, 2), round(v / 2, 2), round(v * 2, 2), s + 2];
  const stories = [
    `حجم یک جعبه‌ی مکعبی ${fa(v)} سانتی‌متر مکعب است. هر ضلع آن چقدر است؟`,
    `حجم یک تاس بازی ${fa(v)} سانتی‌متر مکعب است. طول هر ضلعش چقدر است؟`
  ];
  return {
    topic: 'volume', key: 'find-edge',
    prompt: diff === 'hard' ? pick(stories) : `حجم مکعبی ${fa(v)} سانتی‌متر مکعب است. ضلع آن چقدر است؟`,
    shape: Shapes.cube('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر',
    distractors,
    steps: ['حجم مکعب = ضلع × ضلع × ضلع', 'پس ضلع = ریشه‌ی سومِ حجم',
      `چون ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(v)}، پس ضلع = ${fa(s)} سانتی‌متر`]
  };
}
genFindEdgeFromVolume.levels = ['hard'];

/* ============================================================
   ۱۴) FRACTION GENERATORS
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
    steps = [
      `مخرج‌ها هر دو ${fa(d1)} هستند (مساوی‌اند).`,
      'چون مخرج‌ها یکی است، فقط صورت‌ها را جمع می‌کنیم.',
      `صورت: ${eq(`${fa(n1)} + ${fa(n2)}`)} = ${fa(n1 + n2)}`,
      `نتیجه: ${fracHTML({ n: n1 + n2, d: d1 })} که ساده می‌شود به ${fracHTML(ans)}`
    ];
  } else {
    const L = lcm(d1, d2);
    const k1 = L / d1, k2 = L / d2;
    const newN1 = n1 * k1, newN2 = n2 * k2;
    steps = [
      `مخرج‌ها فرق دارند: ${fa(d1)} و ${fa(d2)}`,
      `اول مخرج مشترک می‌گیریم. کوچک‌ترین مضرب مشترک ${fa(d1)} و ${fa(d2)} می‌شود ${fa(L)}.`,
      `کسر اول: هم مخرج و هم صورت را در ${fa(k1)} ضرب می‌کنیم: ${fracHTML(a)} = ${fracHTML({ n: newN1, d: L })}`,
      `کسر دوم: هم مخرج و هم صورت را در ${fa(k2)} ضرب می‌کنیم: ${fracHTML(b)} = ${fracHTML({ n: newN2, d: L })}`,
      'الان مخرج‌ها یکی شده‌اند. صورت‌ها را جمع می‌کنیم:',
      `${eq(`${fa(newN1)} + ${fa(newN2)}`)} = ${fa(newN1 + newN2)}`,
      `نتیجه: ${fracHTML({ n: newN1 + newN2, d: L })} که ساده می‌شود به ${fracHTML(ans)}`
    ];
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
    steps = [
      `مخرج‌ها هر دو ${fa(d1)} هستند (مساوی).`,
      'فقط صورت‌ها را کم می‌کنیم.',
      `صورت: ${eq(`${fa(a.n)} − ${fa(b.n)}`)} = ${fa(a.n - b.n)}`,
      `نتیجه: ${fracHTML({ n: a.n - b.n, d: d1 })} که ساده می‌شود به ${fracHTML(ans)}`
    ];
  } else {
    const L = lcm(a.d, b.d);
    const k1 = L / a.d, k2 = L / b.d;
    const newN1 = a.n * k1, newN2 = b.n * k2;
    steps = [
      `مخرج‌ها فرق دارند: ${fa(a.d)} و ${fa(b.d)}`,
      `اول مخرج مشترک می‌گیریم. کوچک‌ترین مضرب مشترک می‌شود ${fa(L)}.`,
      `کسر اول: هم مخرج و هم صورت را در ${fa(k1)} ضرب می‌کنیم: ${fracHTML(a)} = ${fracHTML({ n: newN1, d: L })}`,
      `کسر دوم: هم مخرج و هم صورت را در ${fa(k2)} ضرب می‌کنیم: ${fracHTML(b)} = ${fracHTML({ n: newN2, d: L })}`,
      'الان مخرج‌ها یکی شده‌اند. صورت‌ها را کم می‌کنیم:',
      `${eq(`${fa(newN1)} − ${fa(newN2)}`)} = ${fa(newN1 - newN2)}`,
      `نتیجه: ${fracHTML({ n: newN1 - newN2, d: L })} که ساده می‌شود به ${fracHTML(ans)}`
    ];
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
    steps: [
      'در ضرب کسرها نیازی به مخرج مشترک نیست!',
      `صورت‌ها را در هم ضرب می‌کنیم: ${eq(`${fa(a.n)} × ${fa(b.n)}`)} = ${fa(a.n * b.n)}`,
      `مخرج‌ها را هم در هم ضرب می‌کنیم: ${eq(`${fa(a.d)} × ${fa(b.d)}`)} = ${fa(a.d * b.d)}`,
      `نتیجه: ${fracHTML({ n: a.n * b.n, d: a.d * b.d })}`,
      `ساده‌شده: ${fracHTML(ans)}`
    ]
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
    steps: [
      'در تقسیم کسرها، کسر دوم را برعکس (معکوس) می‌کنیم.',
      `معکوس ${fracHTML(b)} می‌شود ${fracHTML({ n: b.d, d: b.n })}`,
      `حالا ضرب می‌کنیم: ${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })}`,
      `صورت‌ها: ${eq(`${fa(a.n)} × ${fa(b.d)}`)} = ${fa(a.n * b.d)}`,
      `مخرج‌ها: ${eq(`${fa(a.d)} × ${fa(b.n)}`)} = ${fa(a.d * b.n)}`,
      `نتیجه: ${fracHTML({ n: a.n * b.d, d: a.d * b.n })} که ساده می‌شود به ${fracHTML(ans)}`
    ]
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
    prompt: 'این کسر را ساده کن (تا جای ممکن کوچکش کن):',
    promptHTML: fracHTML(a),
    type: 'choice', choices, correct: ans,
    steps: [
      `بزرگ‌ترین عددی که هم ${fa(a.n)} و هم ${fa(a.d)} بر آن بخش‌پذیرند: ${fa(g)}`,
      `صورت را بر ${fa(g)} تقسیم می‌کنیم: ${eq(`${fa(a.n)} ÷ ${fa(g)}`)} = ${fa(ans.n)}`,
      `مخرج را بر ${fa(g)} تقسیم می‌کنیم: ${eq(`${fa(a.d)} ÷ ${fa(g)}`)} = ${fa(ans.d)}`,
      `نتیجه: ${fracHTML(ans)}`
    ]
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
  const k1 = L / d1, k2 = L / d2;
  return {
    topic: 'fractions', key: 'frac-cmp',
    prompt: 'کدام علامت جای «?» بگذاریم تا درست شود؟',
    promptHTML: `<span dir="ltr">${fracHTML(a)} &nbsp; ? &nbsp; ${fracHTML(b)}</span>`,
    type: 'choice',
    choices: [
      { n: '>', d: null, isSym: true },
      { n: '<', d: null, isSym: true },
      { n: '=', d: null, isSym: true }
    ],
    correct: { n: correct, d: null, isSym: true },
    steps: [
      `برای مقایسه، مخرج مشترک می‌گیریم. مخرج مشترک می‌شود ${fa(L)}.`,
      `کسر اول: ${fracHTML(a)} = ${fracHTML({ n: n1 * k1, d: L })}`,
      `کسر دوم: ${fracHTML(b)} = ${fracHTML({ n: n2 * k2, d: L })}`,
      'حالا مخرج‌ها یکی است. هر کدام صورت بزرگ‌تری دارد، بزرگ‌تر است.',
      `${eq(`${fa(n1 * k1)} ${correct === '>' ? '>' : '<'} ${fa(n2 * k2)}`)}`,
      `پس ${fracHTML(a)} ${correct === '>' ? '&gt;' : '&lt;'} ${fracHTML(b)}`
    ]
  };
}
genFracCompare.levels = ['easy', 'medium', 'hard'];

function genMixedToImproper(diff) {
  const whole = ri(1, diff === 'hard' ? 4 : 3), d = ri(2, 6), n = ri(1, d - 1);
  const imp = { n: whole * d + n, d };
  const choices = makeFracChoices(imp, () => ({ n: ri(2, 30), d: ri(2, 8) }));
  return {
    topic: 'fractions', key: 'mixed-imp',
    prompt: 'این عدد مخلوط را به یک کسر ساده تبدیل کن:',
    promptHTML: mixedHTML(imp),
    type: 'choice', choices, correct: imp,
    steps: [
      `عدد مخلوط یعنی «${fa(whole)} تا کامل، به‌اضافه‌ی ${fracHTML({ n, d })}».`,
      `هر کامل، ${fa(d)} قسمت از ${fa(d)} است. پس ${fa(whole)} کامل می‌شود ${eq(`${fa(whole)} × ${fa(d)}`)} = ${fa(whole * d)} قسمت.`,
      `حالا ${fa(n)} قسمت هم اضافه می‌کنیم: ${eq(`${fa(whole * d)} + ${fa(n)}`)} = ${fa(whole * d + n)}`,
      `پس صورت ${fa(whole * d + n)} و مخرج ${fa(d)} می‌شود: ${fracHTML(imp)}`
    ]
  };
}
genMixedToImproper.levels = ['medium', 'hard'];

function genWordFrac(diff) {
  const d = ri(3, 6);
  const n = ri(1, d - 1);
  const total = d * ri(2, 4);
  const ans = (total / d) * n;
  const distractors = [total, round(total / d, 2), total - ans > 0 ? total - ans : ans + 5, round(total / 2, 2)];
  const ctx = pick(CTX_FR);
  return {
    topic: 'fractions', key: 'frac-word',
    prompt: `${ctx.name} ${fracHTML({ n, d })} از ${fa(total)} ${ctx.u} را ${ctx.verb}. ${ctx.q}`,
    type: 'numeric', answer: ans, unit: ctx.u,
    distractors,
    steps: [
      `کل مقدار ${fa(total)} ${ctx.u} است.`,
      `اول ببینیم یک قسمت از ${fa(d)} چقدر است: ${eq(`${fa(total)} ÷ ${fa(d)}`)} = ${fa(total / d)}`,
      `حالا ${fa(n)} قسمت را برداریم: ${eq(`${fa(n)} × ${fa(total / d)}`)} = ${fa(ans)}${pct(ctx.u)}`
    ]
  };
}
genWordFrac.levels = ['hard'];

/* ============================================================
   ۱۵) DECIMALS GENERATORS
   ============================================================ */
function genDecAdd(diff) {
  const cfg = { easy: [1, 5, 1], medium: [2, 7, 1], hard: [3, 9, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const n2 = round(ri(a * 10, b * 10) / 10, dec);
  const ans = round(n1 + n2, dec);
  const distractors = [
    round(ans / 2, dec),
    round(ans * 2, dec),
    round(ans + 1, dec),
    round(Math.abs(n1 - n2), dec)
  ];
  return {
    topic: 'decimals', key: 'dec-add',
    prompt: 'حاصل جمع زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} + ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans,
    distractors,
    steps: ['اعداد را زیر هم می‌نویسیم، طوری که ممیزها زیر هم باشند.',
      'مثل اعداد عادی جمع می‌کنیم.',
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
  const distractors = [
    round(n1 + n2, dec),
    round(ans / 2, dec),
    round(ans + 1, dec),
    round(n1, dec)
  ];
  return {
    topic: 'decimals', key: 'dec-sub',
    prompt: 'حاصل تفریق زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} − ${faDec(n2, dec)} = ?`),
    type: 'numeric', answer: ans,
    distractors,
    steps: ['اعداد را زیر هم می‌نویسیم، ممیزها روبروی هم.', 'مثل اعداد عادی تفریق می‌کنیم.',
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
  const distractors = [
    round(n1 + whole, dec),
    round(ans / 2, dec),
    round(ans * 2, dec),
    round(n1, dec)
  ];
  return {
    topic: 'decimals', key: 'dec-mul',
    prompt: 'حاصل ضرب زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, dec)} × ${fa(whole)} = ?`),
    type: 'numeric', answer: ans,
    distractors,
    steps: ['اول بدون ممیز ضرب می‌کنیم.', 'بعد به تعداد ارقام اعشار، از راست ممیز می‌گذاریم.',
      `${eq(`${faDec(n1, dec)} × ${fa(whole)}`)} = ${faDec(ans, dec)}`]
  };
}
genDecMul.levels = ['medium', 'hard'];

function genDecDiv(diff) {
  const whole = ri(2, 5);
  const ans = round(ri(5, 20) / 10, 1);
  const n1 = round(ans * whole, 1);
  const distractors = [
    round(ans * 2, 1),
    round(ans / 2, 1),
    round(n1, 1),
    round(ans + 1, 1)
  ];
  return {
    topic: 'decimals', key: 'dec-div',
    prompt: 'حاصل تقسیم زیر را حساب کن:',
    promptHTML: eq(`${faDec(n1, 1)} ÷ ${fa(whole)} = ?`),
    type: 'numeric', answer: ans,
    distractors,
    steps: ['عدد اعشاری را بر عدد صحیح تقسیم می‌کنیم.',
      `${eq(`${faDec(n1, 1)} ÷ ${fa(whole)}`)} = ${faDec(ans, 1)}`]
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
    steps: ['اول عدد صحیح را مقایسه می‌کنیم (قبل از ممیز).',
      'اگر مساوی بودند، رقم‌های بعد از ممیز را از چپ به راست مقایسه می‌کنیم.',
      `نتیجه: ${eq(`${faDec(n1, dec)} ${correct === '>' ? '>' : '<'} ${faDec(n2, dec)}`)}`]
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
    prompt: 'این کسر را به عدد اعشاری تبدیل کن:',
    promptHTML: fracHTML(f),
    type: 'choice', choices, correct: { n: String(f.v), d: null, isNum: true },
    steps: ['صورت را بر مخرج تقسیم می‌کنیم.',
      `${eq(`${fa(f.n)} ÷ ${fa(f.d)}`)} = ${faDec(f.v, 3)}`]
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
    prompt: 'این عدد اعشاری را به کسر تبدیل کن:',
    promptHTML: eq(faDec(f.v, 3)),
    type: 'choice', choices, correct: { n: f.n, d: f.d },
    steps: ['بعد از ممیز چند رقم داریم؟ اگر ۱ رقم باشد مخرج ۱۰، اگر ۲ رقم باشد مخرج ۱۰۰ می‌شود.',
      `نتیجه: ${fracHTML({ n: f.n, d: f.d })}`]
  };
}
genDecToFrac.levels = ['medium', 'hard'];

function genDecWord(diff) {
  const whole = ri(2, 4);
  const price = round(ri(15, 45) / 10, 1);
  const ans = round(whole * price, 1);
  const distractors = [
    round(ans / 2, 1),
    round(ans * 2, 1),
    round(price + whole, 1),
    round(price, 1)
  ];
  return {
    topic: 'decimals', key: 'dec-word',
    prompt: `قیمت یک دفتر ${faDec(price, 1)} هزار تومان است. قیمت ${fa(whole)} دفتر چقدر می‌شود؟ (پاسخ به هزار تومان)`,
    type: 'numeric', answer: ans, unit: 'هزار تومان',
    distractors,
    steps: ['برای چند برابر، ضرب می‌کنیم.',
      `${eq(`${faDec(price, 1)} × ${fa(whole)}`)} = ${faDec(ans, 1)} هزار تومان`]
  };
}
genDecWord.levels = ['hard'];

/* ============================================================
   ۱۶) GENERATOR POOL
   ============================================================ */
const Generators = {
  perimeter: [genSquarePerimeter, genRectPerimeter, genTrianglePerimeter, genCirclePerimeter, genParallelogramPerimeter, genRhombusPerimeter, genPolygonPerimeter, genFindSideFromPerimeter],
  area: [genSquareArea, genRectArea, genTriangleArea, genCircleArea, genParallelogramArea, genRhombusArea, genTrapezoidArea, genCompositeArea],
  volume: [genCubeVolume, genBoxVolume, genFindEdgeFromVolume],
  fractions: [genFracAdd, genFracSub, genFracMul, genFracDiv, genFracSimplify, genFracCompare, genMixedToImproper, genWordFrac],
  decimals: [genDecAdd, genDecSub, genDecMul, genDecDiv, genDecCompare, genFracToDec, genDecToFrac, genDecWord]
};

const TOPIC_NAMES = {
  perimeter: 'محیط', area: 'مساحت', volume: 'حجم',
  fractions: 'کسرها', decimals: 'اعداد اعشاری'
};
const TOPIC_EMOJIS = {
  perimeter: '📏', area: '📐', volume: '🧊',
  fractions: '🍰', decimals: '🔢'
};
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
   ۱۷) GAMIFICATION
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
   ۱۸) ROUTER
   ============================================================ */
let route = { name: 'home', params: {} };
let session = null;
let examTimer = null;

function navigate(name, params = {}) {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  if (session && ['students', 'addStudent', 'home', 'profile'].includes(name)) {
    session = null;
  }
  route = { name, params };
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ۱۹) COMMON
   ============================================================ */
const app = document.getElementById('app');

function header(title, showBack = false) {
  return `
  <div class="top-bar">
    ${showBack
      ? `<button class="icon-btn back-btn" onclick="window.__goBack()" aria-label="بازگشت">➜</button>`
      : `<span style="width:44px"></span>`}
    <h1>${title}</h1>
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
    </button>
  `).join('')}</nav>`;
}

/* ============================================================
   ۲۰) STUDENTS
   ============================================================ */
function viewStudents() {
  const hasStudents = state.students.length > 0;
  return `
  ${header('👥 دانش‌آموزان')}
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:3.5rem">👨‍🎓</div>
    <h2 style="margin:8px 0">${hasStudents ? 'کدام دانش‌آموز؟' : 'خوش آمدی!'}</h2>
    <p style="color:var(--muted);margin:0">${hasStudents ? 'روی اسم خودت بزن تا شروع کنیم.' : 'اول اسمت را وارد کن.'}</p>
  </div>
  ${hasStudents ? `
    <div class="grid">
      ${state.students.map(s => `
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px">
          <div class="student-avatar" onclick="window.__selectStudent('${s.id}')" role="button" tabindex="0" style="cursor:pointer">${escHtml(s.name[0] || '؟')}</div>
          <div class="student-info" onclick="window.__selectStudent('${s.id}')" role="button" tabindex="0" style="cursor:pointer;flex:1">
            <p class="student-name" style="margin:0">${escHtml(fullName(s))}</p>
            <p class="student-meta" style="margin:2px 0 0">پایه ${fa(s.grade)} — سطح ${fa(s.stats.level)}</p>
          </div>
          <button class="delete-btn" onclick="event.stopPropagation();window.__deleteStudent('${s.id}')" aria-label="حذف">🗑️</button>
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
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">نام:</span>
      <input type="text" id="stuName" class="num-input" style="text-align:right;font-size:1.05rem;font-weight:400;margin-top:6px" placeholder="مثلاً علی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">نام خانوادگی (اختیاری):</span>
      <input type="text" id="stuFamily" class="num-input" style="text-align:right;font-size:1.05rem;font-weight:400;margin-top:6px" placeholder="مثلاً محمدی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:14px">
      <span style="font-weight:600;font-size:.95rem">پایه تحصیلی:</span>
      <select id="stuGrade" class="num-input" style="text-align:right;margin-top:6px">
        ${[4, 5, 6, 7, 8, 9].map(g => `<option value="${g}" ${g === 4 ? 'selected' : ''}>پایه ${fa(g)}</option>`).join('')}
      </select>
    </label>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__createStudent()">
    ✅ ساخت پروفایل
  </button>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۱) HOME / PROFILE / TOPIC
   ============================================================ */
function viewHome() {
  return `
  ${header('ریاضی‌یار 🎓')}
  <p style="color:var(--muted);margin:0 0 12px;text-align:center">یک موضوع را انتخاب کن:</p>
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('perimeter')" aria-label="محیط">
      <span class="icon-big">📏</span>
      <h3 class="card-title">محیط</h3>
      <p class="card-desc">دور شکل‌ها</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('area')" aria-label="مساحت">
      <span class="icon-big">📐</span>
      <h3 class="card-title">مساحت</h3>
      <p class="card-desc">سطح شکل‌ها</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('volume')" aria-label="حجم">
      <span class="icon-big">🧊</span>
      <h3 class="card-title">حجم</h3>
      <p class="card-desc">داخل شکل‌های سه‌بعدی</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('fractions')" aria-label="کسرها">
      <span class="icon-big">🍰</span>
      <h3 class="card-title">کسرها</h3>
      <p class="card-desc">قسمت‌هایی از یک کل</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('decimals')" aria-label="اعداد اعشاری">
      <span class="icon-big">🔢</span>
      <h3 class="card-title">اعداد اعشاری</h3>
      <p class="card-desc">با ممیز</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت من</h3>
      <p class="card-desc">نمودار یادگیری</p>
    </button>
  </div>
  <div style="margin-top:14px">
    <button class="card card-btn" style="width:100%;text-align:center;background:linear-gradient(135deg,#ede9fe,#dbeafe);border:2px solid var(--primary-l)" onclick="window.__nav('multiExamSetup')" aria-label="آزمون جامع">
      <span class="icon-big">🎯</span>
      <h3 class="card-title" style="justify-content:center">آزمون جامع</h3>
      <p class="card-desc">از چند درس مختلف با هم</p>
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
    <p style="text-align:center;color:var(--muted);font-size:.85rem;margin-top:12px">
      ${fa(s.stats.totalCorrect)} پاسخ درست از ${fa(s.stats.totalQuestions)} سوال
    </p>
  </div>
  <div class="card">
    <h3 class="card-title">🎖️ نشان‌های من</h3>
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${BADGES.map(b => `
        <div class="badge ${s.stats.badges.includes(b.id) ? 'earned' : 'locked'}" title="${b.desc}">
          <span class="emoji">${b.emoji}</span>
          <span class="name">${b.name}</span>
        </div>`).join('')}
    </div>
  </div>
  <div style="display:flex;gap:8px;margin-top:14px">
    <button class="btn sec full" onclick="window.__nav('students')">🔄 تغییر دانش‌آموز</button>
    <button class="btn info full" onclick="window.__nav('settings')">⚙️ تنظیمات</button>
  </div>
  ${bottomNav()}`;
}

function viewTopic(topic) {
  const titles = {
    perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم',
    fractions: '🍰 کسرها', decimals: '🔢 اعداد اعشاری'
  };
  return `
  ${header(titles[topic], true)}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('learn', {topic:'${topic}'})" aria-label="آموزش">
      <span class="icon-big">📚</span>
      <h3 class="card-title">آموزش</h3>
      <p class="card-desc">با انیمیشن و مثال</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('practice', {topic:'${topic}'})" aria-label="تمرین">
      <span class="icon-big">✏️</span>
      <h3 class="card-title">تمرین</h3>
      <p class="card-desc">سوال‌های چهارگزینه‌ای</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('examSetup', {topic:'${topic}'})" aria-label="آزمون">
      <span class="icon-big">🎯</span>
      <h3 class="card-title">آزمون</h3>
      <p class="card-desc">با کارنامه</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت</h3>
      <p class="card-desc">درصد یادگیری</p>
    </button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۲) LESSONS — همان LESSONS نسخه ۸.۰
   ============================================================ */
const LESSONS = {
  perimeter: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛',
      formula: 'محیط = ۴ × ضلع',
      paragraphs: [
        'مربع یک شکل زیبا است که ۴ ضلع دارد و همه‌ی ضلع‌هایش با هم مساوی‌اند. مثل کاشی، مثل صفحه‌ی شطرنج، مثل بعضی از پنجره‌ها.',
        'وقتی می‌خواهیم دور یک مربع را اندازه بگیریم — مثلاً برای کشیدن نوار دور یک کاشی یا نرده‌کشی دور یک باغچه — به «محیط» احتیاج داریم. محیط یعنی «دور تا دور» شکل.',
        'چون مربع ۴ ضلع مساوی دارد، اگر یک ضلع را بدانیم و آن را در ۴ ضرب کنیم، محیط به دست می‌آید. خیلی راحت!'
      ],
      examples: [
        {
          text: 'یک کاشی مربعی داریم که هر ضلعش ۳ سانتی‌متر است. دور تا دور کاشی چقدر است؟',
          shape: ShapesAnim.tracingSquare(3),
          steps: ['ضلع کاشی = ۳ سانتی‌متر', 'مربع ۴ ضلع دارد، پس: ۴ × ۳', 'جواب: ۴ × ۳ = ۱۲'],
          answer: 'پس دور کاشی ۱۲ سانتی‌متر است.'
        },
        {
          text: 'زمین بازی مدرسه به شکل مربع است و هر ضلعش ۶ متر است. اگر بخواهیم دور زمین را نرده بکشیم، چند متر نرده لازم داریم؟',
          shape: ShapesAnim.tracingSquare(6),
          steps: ['ضلع زمین = ۶ متر', 'محیط = ۴ × ۶', '۴ × ۶ = ۲۴'],
          answer: 'پس ۲۴ متر نرده لازم است.'
        },
        {
          text: 'یک سفره‌ی مربعی داریم که هر ضلعش ۵ سانتی‌متر است. برای دوخت نوار دور آن چقدر نوار لازم است؟',
          shape: ShapesAnim.tracingSquare(5),
          steps: ['ضلع سفره = ۵ سانتی‌متر', 'محیط = ۴ × ۵', '۴ × ۵ = ۲۰'],
          answer: 'پس ۲۰ سانتی‌متر نوار لازم است.'
        },
        {
          text: 'برعکس! اگر محیط مربعی ۲۴ سانتی‌متر باشد، ضلعش چقدر است؟',
          shape: Shapes.square('?'),
          steps: ['می‌دانیم محیط = ۴ × ضلع', 'پس ضلع = محیط ÷ ۴', 'ضلع = ۲۴ ÷ ۴ = ۶'],
          answer: 'پس ضلع = ۶ سانتی‌متر'
        }
      ],
      tips: [
        'محیط یعنی «دور تا دور» شکل. یادت باشد همیشه واحد را در جواب بنویسی.',
        'اگر محیط را داری و ضلع را می‌خواهی، محیط را بر ۴ تقسیم کن.'
      ],
      pitfalls: [
        'اشتباه نکن! مساحت مربع = ضلع × ضلع است، ولی محیط مربع = ۴ × ضلع. این دو با هم فرق دارند!'
      ]
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭',
      formula: 'محیط = ۲ × (طول + عرض)',
      paragraphs: [
        'مستطیل شکلی است که ۴ ضلع دارد، ولی برخلاف مربع همه‌ی ضلع‌هایش با هم مساوی نیستند. مستطیل دو ضلع «طول» و دو ضلع «عرض» دارد.',
        'اضلاع روبه‌رو در مستطیل با هم مساوی‌اند. یعنی طول چپ و راست با هم برابرند و عرض بالا و پایین هم با هم برابرند.',
        'برای محیط مستطیل، اول طول و عرض را با هم جمع می‌کنیم، بعد جواب را در ۲ ضرب می‌کنیم. چرا؟ چون دو طول و دو عرض داریم!'
      ],
      examples: [
        {
          text: 'یک دفتر داریم که طولش ۵ سانتی‌متر و عرضش ۳ سانتی‌متر است. دور تا دور دفتر چقدر است؟',
          shape: ShapesAnim.tracingRect(5, 3),
          steps: ['طول = ۵، عرض = ۳', 'اول جمع: ۵ + ۳ = ۸', 'حالا در ۲ ضرب کن: ۲ × ۸ = ۱۶'],
          answer: 'پس دور دفتر ۱۶ سانتی‌متر است.'
        },
        {
          text: 'استخری مستطیلی است به طول ۱۰ متر و عرض ۴ متر. برای نصب حفاظ دور استخر چقدر حفاظ لازم است؟',
          shape: ShapesAnim.tracingRect(10, 4),
          steps: ['طول = ۱۰، عرض = ۴', 'جمع: ۱۰ + ۴ = ۱۴', '۲ × ۱۴ = ۲۸'],
          answer: 'پس ۲۸ متر حفاظ لازم است.'
        },
        {
          text: 'یک زمین فوتبال به طول ۱۲ متر و عرض ۷ متر. یک دور کامل دور زمین چند متر است؟',
          shape: ShapesAnim.tracingRect(12, 7),
          steps: ['طول + عرض = ۱۲ + ۷ = ۱۹', 'محیط = ۲ × ۱۹ = ۳۸'],
          answer: 'یک دور کامل = ۳۸ متر'
        }
      ],
      tips: [
        'اضلاع روبه‌رو در مستطیل همیشه مساوی‌اند.',
        'می‌شود طول و عرض را جابجا کرد، جواب فرقی نمی‌کند.'
      ],
      pitfalls: [
        'اشتباه رایج: بعضی‌ها همه‌ی اضلاع را با هم جمع می‌کنند. نه! از فرمول ۲ × (طول + عرض) استفاده کن.'
      ]
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺',
      formula: 'محیط = ضلع۱ + ضلع۲ + ضلع۳',
      paragraphs: [
        'مثلث شکلی است با ۳ ضلع و ۳ گوشه (زاویه). مثلث‌ها می‌توانند اندازه‌های مختلفی داشته باشند.',
        'بعضی مثلث‌ها ۳ ضلع مساوی دارند (متساوی‌الاضلاع)، بعضی ۲ ضلع مساوی (متساوی‌الساقین) و بعضی هیچ ضلع مساوی ندارند.',
        'برای محیط مثلث، فقط کافیست هر سه ضلع را با هم جمع کنیم. تمام!'
      ],
      examples: [
        {
          text: 'مثلثی داریم با اضلاع ۳، ۴ و ۵ سانتی‌متر. دور تا دورش چقدر است؟',
          shape: ShapesAnim.tracingTriangle(3, 4, 5),
          steps: ['سه ضلع داریم: ۳، ۴ و ۵', 'با هم جمع می‌کنیم: ۳ + ۴ = ۷، بعد ۷ + ۵ = ۱۲'],
          answer: 'محیط = ۱۲ سانتی‌متر'
        },
        {
          text: 'زمینی مثلثی داریم با اضلاع ۶، ۷ و ۸ متر. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: ShapesAnim.tracingTriangle(6, 7, 8),
          steps: ['۶ + ۷ = ۱۳', '۱۳ + ۸ = ۲۱'],
          answer: '۲۱ متر نرده لازم است.'
        }
      ],
      tips: [
        'همیشه حواست باشد مجموع دو ضلع کوچک از ضلع بزرگ‌تر بیشتر باشد، وگرنه آن مثلث ساخته نمی‌شود.'
      ],
      pitfalls: [
        'اشتباه رایج: فکر کردن که همه‌ی مثلث‌ها باید ۳ ضلع مساوی داشته باشند. نه! اضلاع مثلث می‌توانند فرق کنند.'
      ]
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪',
      formula: 'محیط = ۲ × π × شعاع',
      paragraphs: [
        'دایره یک شکل گرد است. فاصله‌ی مرکز دایره تا لبه‌ی آن را «شعاع» می‌گوییم.',
        'اگر از یک طرف دایره به طرف دیگر از وسط بگذریم، به آن «قطر» می‌گویند. قطر = ۲ × شعاع.',
        'برای محاسبه‌ی محیط دایره، از عدد مخصوصی به نام «پی» (π) استفاده می‌کنیم. مقدار آن تقریباً ۳٫۱۴ است.'
      ],
      examples: [
        {
          text: 'دایره‌ای داریم با شعاع ۲ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.circleRadiusAnim(2),
          steps: ['شعاع = ۲', 'فرمول: ۲ × پی × شعاع', '۲ × ۳٫۱۴ × ۲ = ۱۲٫۵۶'],
          answer: 'محیط ≈ ۱۲٫۵۶ سانتی‌متر'
        },
        {
          text: 'دایره‌ای به قطر ۶ متر. محیطش چقدر است؟',
          shape: ShapesAnim.circleRadiusAnim(3),
          steps: ['قطر = ۶، پس شعاع = ۳', 'محیط = ۲ × ۳٫۱۴ × ۳', '۲ × ۳٫۱۴ × ۳ = ۱۸٫۸۴'],
          answer: 'محیط ≈ ۱۸٫۸۴ متر'
        }
      ],
      tips: ['همیشه به‌جای پی، عدد ۳٫۱۴ را بگذار.'],
      pitfalls: ['اشتباه نکن! اگر قطر داری، اول بر ۲ تقسیم کن تا شعاع به دست آید.']
    },
    {
      id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟',
      formula: 'محیط = تعداد ضلع × ضلع',
      paragraphs: [
        'چندضلعی منتظم یعنی شکلی که همه‌ی ضلع‌هایش مساوی‌اند و همه‌ی زوایایش برابر.',
        'اسم شکل به تو می‌گوید چند ضلع دارد: پنج‌ضلعی یعنی ۵ ضلع، شش‌ضلعی یعنی ۶ ضلع، هشت‌ضلعی یعنی ۸ ضلع.',
        'برای محیط، تعداد ضلع‌ها را در طول یک ضلع ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'شش‌ضلعی منتظمی داریم که هر ضلعش ۳ سانتی‌متر است. محیطش چقدر است؟',
          shape: Shapes.regularPolygon(6, 3),
          steps: ['شش‌ضلعی یعنی ۶ ضلع', 'محیط = ۶ × ۳', '= ۱۸'],
          answer: 'محیط = ۱۸ سانتی‌متر'
        },
        {
          text: 'باغ گلی به شکل پنج‌ضلعی منتظم است و هر ضلعش ۴ متر است. برای نرده‌کشی دور آن چقدر نرده لازم است؟',
          shape: Shapes.regularPolygon(5, 4),
          steps: ['پنج‌ضلعی یعنی ۵ ضلع', 'محیط = ۵ × ۴ = ۲۰'],
          answer: '۲۰ متر نرده لازم است.'
        }
      ],
      tips: ['تعداد ضلع را از روی نام شکل پیدا کن: پنج = ۵، شش = ۶، هشت = ۸.'],
      pitfalls: ['اشتباه نکن! تعداد ضلع را فراموش نکن.']
    }
  ],
  area: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛',
      formula: 'مساحت = ضلع × ضلع',
      paragraphs: [
        'مساحت یعنی چقدر «سطح» در داخل شکل جا می‌شود. مثلاً یک اتاق را در نظر بگیر: مساحت یعنی کف اتاق چقدر بزرگ است.',
        'برای شمارش دقیق مساحت، شکل را به مربع‌های کوچک یک‌در‌یک سانتی‌متری تقسیم می‌کنیم. هر مربع کوچک = یک سانتی‌متر مربع.',
        'برای مساحت مربع، ضلع را در خودش ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'یک کاشی مربعی داریم با ضلع ۳ سانتی‌متر. مساحتش چقدر است؟ ببین مربع‌های کوچک چطور پُر می‌شوند!',
          shape: ShapesAnim.gridSquare(3),
          steps: ['ضلع = ۳', 'مساحت = ضلع × ضلع', '۳ × ۳ = ۹'],
          answer: 'مساحت = ۹ سانتی‌متر مربع'
        },
        {
          text: 'اتاقی مربعی داریم با ضلع ۴ متر. برای سنگ‌فرش کردن کف اتاق چند متر مربع سنگ لازم است؟',
          shape: ShapesAnim.gridSquare(4),
          steps: ['ضلع = ۴', 'مساحت = ۴ × ۴ = ۱۶'],
          answer: '۱۶ متر مربع سنگ لازم است.'
        },
        {
          text: 'برعکس! اگر مساحت مربعی ۲۵ سانتی‌متر مربع باشد، ضلعش چقدر است؟',
          shape: Shapes.square('?'),
          steps: [
            'می‌دانیم مساحت = ضلع × ضلع',
            'پس ضلع = ریشه‌ی دومِ مساحت',
            'چه عددی در خودش ضرب شود ۲۵ می‌شود؟ جواب ۵ است.'
          ],
          answer: 'پس ضلع = ۵ سانتی‌متر'
        }
      ],
      tips: [
        'واحد مساحت همیشه «مربع» دارد: سانتی‌متر مربع، متر مربع.',
        'برای پیدا کردن ضلع از مساحت، جذر بگیر.'
      ],
      pitfalls: ['اشتباه نکن! محیط مربع = ۴ × ضلع، ولی مساحت = ضلع × ضلع.']
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭',
      formula: 'مساحت = طول × عرض',
      paragraphs: [
        'برای مساحت مستطیل، طول را در عرض ضرب می‌کنیم. به همین راحتی!',
        'دقت کن که این ضرب دقیقاً یعنی چقدر مربع کوچک یک‌در‌یک می‌تواند در مستطیل جا شود.'
      ],
      examples: [
        {
          text: 'یک دفتر مشق داریم به طول ۵ و عرض ۳ سانتی‌متر. مساحت جلد آن چقدر است؟',
          shape: ShapesAnim.gridRect(5, 3),
          steps: ['طول = ۵، عرض = ۳', 'مساحت = ۵ × ۳ = ۱۵'],
          answer: 'مساحت = ۱۵ سانتی‌متر مربع'
        },
        {
          text: 'زمین فوتبالی به طول ۱۲ متر و عرض ۶ متر. مساحتش چقدر است؟',
          shape: ShapesAnim.gridRect(12, 6),
          steps: ['مساحت = ۱۲ × ۶', '۱۲ × ۶ = ۷۲'],
          answer: 'مساحت = ۷۲ متر مربع'
        },
        {
          text: 'یک باغچه به طول ۸ و عرض ۳ متر. برای کاشتن گل، چند متر مربع زمین لازم است؟',
          shape: ShapesAnim.gridRect(8, 3),
          steps: ['مساحت = ۸ × ۳', '= ۲۴'],
          answer: '۲۴ متر مربع زمین لازم است.'
        }
      ],
      tips: ['طول و عرض را می‌توانی جابجا کنی، جواب فرقی نمی‌کند.'],
      pitfalls: ['اشتباه نکن! به‌جای ضرب کردن، طول و عرض را جمع نکن.']
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺',
      formula: 'مساحت = (قاعده × ارتفاع) ÷ ۲',
      paragraphs: [
        'مساحت مثلث نصفِ مساحت مستطیلی است که مثلث در آن جا می‌شود. به همین خاطر در آخر کار، تقسیم بر ۲ می‌کنیم.',
        'قاعده یعنی یکی از اضلاع مثلث (معمولاً پایین). ارتفاع یعنی فاصله‌ی عمودی از گوشه‌ی بالایی تا آن قاعده.',
        'برای مساحت: اول قاعده را در ارتفاع ضرب می‌کنیم، بعد بر ۲ تقسیم می‌کنیم.'
      ],
      examples: [
        {
          text: 'مثلثی داریم با قاعده ۴ و ارتفاع ۳. مساحتش چقدر است؟ به مستطیل خط‌چین دورش دقت کن!',
          shape: ShapesAnim.triangleAreaAnim(4, 3),
          steps: ['اول ضرب: ۴ × ۳ = ۱۲', 'حالا بر ۲ تقسیم: ۱۲ ÷ ۲ = ۶'],
          answer: 'مساحت = ۶ سانتی‌متر مربع'
        },
        {
          text: 'یک بیرق مثلثی داریم با قاعده ۶ و ارتفاع ۴ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.triangleAreaAnim(6, 4),
          steps: ['۶ × ۴ = ۲۴', '۲۴ ÷ ۲ = ۱۲'],
          answer: 'مساحت = ۱۲ سانتی‌متر مربع'
        }
      ],
      tips: ['ارتفاع همیشه عمود بر قاعده است (زاویه‌ی ۹۰ درجه).'],
      pitfalls: ['اشتباه رایج: یادت باشد در آخر بر ۲ تقسیم کنی. اگر نکنی، جواب ۲ برابر می‌شود.']
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪',
      formula: 'مساحت = π × شعاع × شعاع',
      paragraphs: [
        'برای مساحت دایره، از فرمول مخصوص استفاده می‌کنیم: پی ضرب‌در شعاع ضرب‌در شعاع.',
        'شعاع همان فاصله‌ی مرکز تا لبه‌ی دایره است. دقت کن که «شعاع × شعاع» نه «۲ × شعاع»!'
      ],
      examples: [
        {
          text: 'دایره‌ای داریم با شعاع ۲ سانتی‌متر. مساحتش چقدر است؟',
          shape: Shapes.circle(2),
          steps: [
            'شعاع = ۲',
            'فرمول: پی × شعاع × شعاع',
            '۳٫۱۴ × ۲ × ۲ = ۳٫۱۴ × ۴ = ۱۲٫۵۶'
          ],
          answer: 'مساحت ≈ ۱۲٫۵۶ سانتی‌متر مربع'
        },
        {
          text: 'یک پیتزای دایره‌ای داریم به شعاع ۵ سانتی‌متر. مساحتش چقدر است؟',
          shape: Shapes.circle(5),
          steps: ['۳٫۱۴ × ۵ × ۵', '۳٫۱۴ × ۲۵ = ۷۸٫۵'],
          answer: 'مساحت ≈ ۷۸٫۵ سانتی‌متر مربع'
        }
      ],
      tips: ['دقت کن! شعاع ضرب‌در شعاع با ۲ × شعاع فرق دارد. مثلاً ۳ × ۳ = ۹، نه ۶!'],
      pitfalls: ['اشتباه نکن! اگر قطر داری، اول بر ۲ تقسیم کن تا شعاع به دست بیاید.']
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱',
      formula: 'مساحت = قاعده × ارتفاع',
      paragraphs: [
        'متوازی‌الاضلاع شبیه مستطیل است، ولی کج شده! اضلاع روبه‌رو موازی و مساوی‌اند.',
        'برای مساحت متوازی‌الاضلاع، از قاعده و ارتفاع استفاده می‌کنیم.'
      ],
      examples: [
        {
          text: 'متوازی‌الاضلاعی داریم با قاعده ۵ و ارتفاع ۳. مساحتش چقدر است؟',
          shape: Shapes.parallelogram(5, 8, 3),
          steps: ['مساحت = قاعده × ارتفاع', '۵ × ۳ = ۱۵'],
          answer: 'مساحت = ۱۵ سانتی‌متر مربع'
        },
        {
          text: 'زمین کشاورزی متوازی‌الاضلاع با قاعده ۹ و ارتفاع ۴ متر. مساحتش چقدر است؟',
          shape: Shapes.parallelogram(9, 8, 4),
          steps: ['مساحت = ۹ × ۴ = ۳۶'],
          answer: 'مساحت = ۳۶ متر مربع'
        }
      ],
      tips: ['برای مساحت، فقط به قاعده و ارتفاع نیاز داری.'],
      pitfalls: ['اشتباه نکن! ارتفاع همیشه عمود بر قاعده است.']
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆',
      formula: 'مساحت = (قطر۱ × قطر۲) ÷ ۲',
      paragraphs: [
        'لوزی یک چهارضلعی است که همه‌ی ضلع‌هایش مساوی‌اند، ولی زوایایش قائمه نیستند.',
        'لوزی دو قطر دارد که عمود بر هم هستند.'
      ],
      examples: [
        {
          text: 'لوزی داریم با قطرهای ۴ و ۶ سانتی‌متر. مساحتش چقدر است؟',
          shape: Shapes.rhombusD(4, 6),
          steps: ['اول ضرب قطرها: ۴ × ۶ = ۲۴', 'حالا بر ۲ تقسیم: ۲۴ ÷ ۲ = ۱۲'],
          answer: 'مساحت = ۱۲ سانتی‌متر مربع'
        },
        {
          text: 'باغچه‌ای لوزی‌شکل داریم با قطرهای ۸ و ۴ متر. مساحتش چقدر است؟',
          shape: Shapes.rhombusD(8, 4),
          steps: ['۸ × ۴ = ۳۲', '۳۲ ÷ ۲ = ۱۶'],
          answer: 'مساحت = ۱۶ متر مربع'
        }
      ],
      tips: ['یادت باشد در انتها بر ۲ تقسیم کنی.'],
      pitfalls: ['اشتباه نکن! فراموش نکن تقسیم بر ۲ را.']
    },
    {
      id: 'trap', title: 'ذوزنقه', emoji: '⏢',
      formula: 'مساحت = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      paragraphs: [
        'ذوزنقه شکلی است که فقط دو ضلعش موازی‌اند. به این دو ضلع، «قاعده‌ی کوچک» و «قاعده‌ی بزرگ» می‌گویند.',
        'برای مساحت، اول دو قاعده را جمع می‌کنیم، بعد در ارتفاع ضرب می‌کنیم، بعد بر ۲ تقسیم می‌کنیم.'
      ],
      examples: [
        {
          text: 'ذوزنقه‌ای داریم با قاعده‌ی کوچک ۳، قاعده‌ی بزرگ ۵ و ارتفاع ۴. مساحتش چقدر است؟',
          shape: Shapes.trapezoid(5, 3, 4),
          steps: ['جمع دو قاعده: ۳ + ۵ = ۸', 'ضرب در ارتفاع: ۸ × ۴ = ۳۲', 'تقسیم بر ۲: ۳۲ ÷ ۲ = ۱۶'],
          answer: 'مساحت = ۱۶ سانتی‌متر مربع'
        },
        {
          text: 'یک تکه زمین ذوزنقه‌ای داریم با قاعده‌های ۶ و ۴ و ارتفاع ۵ متر. مساحتش چقدر است؟',
          shape: Shapes.trapezoid(6, 4, 5),
          steps: ['جمع: ۶ + ۴ = ۱۰', '۱۰ × ۵ = ۵۰', '۵۰ ÷ ۲ = ۲۵'],
          answer: 'مساحت = ۲۵ متر مربع'
        }
      ],
      tips: ['دو قاعده را با هم جمع می‌کنیم (نه تفریق).'],
      pitfalls: ['اشتباه نکن! در آخر یادت باشد تقسیم بر ۲ کنی.']
    },
    {
      id: 'composite', title: 'شکل‌های ترکیبی', emoji: '🏠',
      formula: 'مساحت کل = جمع مساحت‌ها',
      paragraphs: [
        'گاهی اوقات یک شکل از چند شکل ساده‌تر ساخته می‌شود. مثلاً یک خانه از یک مستطیل (اتاق) و یک مثلث (سقف) ساخته می‌شود.',
        'برای پیدا کردن مساحت این‌جور شکل‌ها، آن‌ها را به شکل‌های ساده‌تر تقسیم می‌کنیم و مساحت هر کدام را جدا حساب می‌کنیم.'
      ],
      examples: [
        {
          text: 'یک خانه به شکل زیر: مستطیل با طول ۴ و ارتفاع ۳، و یک سقف مثلثی با همان طول ۴ و ارتفاع ۲. مساحت کل چقدر است؟',
          shape: Shapes.house(4, 3, 2),
          steps: [
            'مساحت مستطیل (اتاق) = ۴ × ۳ = ۱۲',
            'مساحت مثلث (سقف) = (۴ × ۲) ÷ ۲ = ۸ ÷ ۲ = ۴',
            'مساحت کل = ۱۲ + ۴ = ۱۶'
          ],
          answer: 'مساحت کل = ۱۶ متر مربع'
        },
        {
          text: 'یک شکل L شکل داریم که از دو مستطیل ساخته شده. مساحتش چقدر است؟',
          shape: Shapes.lshape(5, 3, 2, 4),
          steps: [
            'مستطیل بالا: ۵ × ۳ = ۱۵',
            'مستطیل پایین: ۲ × ۴ = ۸',
            'جمع: ۱۵ + ۸ = ۲۳'
          ],
          answer: 'مساحت کل = ۲۳ سانتی‌متر مربع'
        }
      ],
      tips: ['اول شکل را به شکل‌های ساده‌تر تقسیم کن.'],
      pitfalls: ['اشتباه نکن! مساحت‌ها را جمع کن، نه ابعاد را.']
    }
  ],
  volume: [
    {
      id: 'cube', title: 'مکعب', emoji: '🧊',
      formula: 'حجم = ضلع × ضلع × ضلع',
      paragraphs: [
        'حجم یعنی چقدر «فضا» داخل یک شکل سه‌بعدی جا می‌شود. مثلاً یک جعبه چقدر می‌تواند وسایل در خودش جا بدهد.',
        'مکعب شکلی است که همه‌ی ضلع‌هایش مساوی‌اند و همه‌ی زوایایش قائمه. مثل تاسِ بازی!',
        'برای حجم مکعب، ضلع را سه بار در خودش ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'یک مکعب داریم که هر ضلعش ۲ سانتی‌متر است. حجمش چقدر است؟ ببین وجه‌های مکعب چطور ساخته می‌شوند!',
          shape: ShapesAnim.cubeBuild(2),
          steps: ['ضلع = ۲', 'حجم = ۲ × ۲ × ۲', '۲ × ۲ = ۴ و ۴ × ۲ = ۸'],
          answer: 'حجم = ۸ سانتی‌متر مکعب'
        },
        {
          text: 'تاس بازی ما مکعبی است و هر ضلعش ۳ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.cubeBuild(3),
          steps: ['حجم = ۳ × ۳ × ۳', '۳ × ۳ = ۹ و ۹ × ۳ = ۲۷'],
          answer: 'حجم = ۲۷ سانتی‌متر مکعب'
        },
        {
          text: 'یک جعبه‌ی مکعبی داریم که هر ضلعش ۴ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.cubeBuild(4),
          steps: ['حجم = ۴ × ۴ × ۴', '۴ × ۴ = ۱۶ و ۱۶ × ۴ = ۶۴'],
          answer: 'حجم = ۶۴ سانتی‌متر مکعب'
        }
      ],
      tips: ['واحد حجم همیشه «مکعب» دارد: سانتی‌متر مکعب، متر مکعب.'],
      pitfalls: ['اشتباه نکن! مساحت مربع = ضلع × ضلع، ولی حجم مکعب = ضلع × ضلع × ضلع.']
    },
    {
      id: 'box', title: 'مکعب مستطیل', emoji: '📦',
      formula: 'حجم = طول × عرض × ارتفاع',
      paragraphs: [
        'مکعب مستطیل شبیه یک جعبه کفش یا یخچال است. سه اندازه دارد: طول، عرض و ارتفاع.',
        'برای حجم مکعب مستطیل، هر سه اندازه را در هم ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'یک جعبه داریم به طول ۳، عرض ۲ و ارتفاع ۲ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.boxBuild(3, 2, 2),
          steps: ['اول دو عدد اول: ۳ × ۲ = ۶', 'بعد در سومی ضرب: ۶ × ۲ = ۱۲'],
          answer: 'حجم = ۱۲ سانتی‌متر مکعب'
        },
        {
          text: 'یک یخچال داریم به طول ۴، عرض ۳ و ارتفاع ۵ سانتی‌متر. حجم داخلی‌اش چقدر است؟',
          shape: ShapesAnim.boxBuild(4, 3, 5),
          steps: ['۴ × ۳ = ۱۲', '۱۲ × ۵ = ۶۰'],
          answer: 'حجم = ۶۰ سانتی‌متر مکعب'
        }
      ],
      tips: ['ترتیب ضرب اهمیتی ندارد.'],
      pitfalls: ['اشتباه نکن! مساحت مستطیل دو عددی است، ولی حجم مکعب مستطیل سه عددی است.']
    }
  ],
  fractions: [
    {
      id: 'concept', title: 'مفهوم کسر', emoji: '🍕',
      formula: 'صورت بالا، مخرج پایین',
      paragraphs: [
        'تصور کن یک پیتزا داری و آن را به ۴ قسمت مساوی تقسیم کرده‌ای. اگر ۱ قسمت را بخوری، چند قسمت از کل را خورده‌ای؟ ۱ از ۴.',
        'برای نشان دادن این، از «کسر» استفاده می‌کنیم. کسر یعنی «چند قسمت از یک کل».',
        'کسر دو عدد دارد: عدد بالا را «صورت» می‌گویند (چند قسمت برداشته‌ایم) و عدد پایین را «مخرج» (کل به چند قسمت تقسیم شده).'
      ],
      examples: [
        {
          text: 'این دایره را نگاه کن. ببین برش‌ها یکی‌یکی ظاهر می‌شوند! چند قسمت رنگی شده؟',
          html: ShapesAnim.fracPieAnim(3, 4),
          steps: ['دایره به ۴ قسمت مساوی تقسیم شده → مخرج = ۴', '۳ قسمت آن رنگی است → صورت = ۳'],
          answer: 'کسر رنگی = سه‌چهارم'
        },
        {
          text: 'کسر «۲ از ۵» یعنی چه؟',
          html: fracHTML({ n: 2, d: 5 }),
          steps: ['مخرج ۵ → کل به ۵ قسمت تقسیم شده', 'صورت ۲ → ۲ قسمت برداشته شده'],
          answer: 'یعنی ۲ قسمت از ۵ قسمت مساوی'
        },
        {
          text: 'اگر یک کیک را به ۸ قسمت مساوی تقسیم کنیم و ۳ قسمت را بخوریم، چند قسمت از کیک را خورده‌ایم؟',
          html: ShapesAnim.fracPieAnim(3, 8),
          steps: ['کل کیک = ۸ قسمت', 'خورده‌ایم = ۳ قسمت'],
          answer: 'سه‌هشتم کیک را خورده‌ایم'
        }
      ],
      tips: [
        'مخرج هرگز نمی‌تواند صفر باشد، چون تقسیم بر صفر معنی ندارد.',
        'همه‌ی قسمت‌ها باید مساوی باشند.'
      ],
      pitfalls: ['اشتباه نکن! جای صورت و مخرج را با هم عوض نکن.']
    },
    {
      id: 'equiv', title: 'کسر معادل', emoji: '🟰',
      formula: 'ضرب صورت و مخرج در یک عدد',
      paragraphs: [
        'گاهی دو کسر با اینکه عددهایشان فرق دارد، اما مقدارشان یکی است. مثلاً نصفِ یک پیتزا با دوچهارمِ یک پیتزا برابر است!',
        'به این کسرها می‌گوییم «کسر معادل». برای ساختن کسر معادل، هم صورت و هم مخرج را در یک عدد ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'آیا یک‌دوم با سه‌ششم برابر است؟ این دو نوار را با هم مقایسه کن:',
          html: `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">
            <div>${fracHTML({n:1,d:2})}</div>
            <div>${ShapesAnim.fracBarAnim(1, 2)}</div>
            <div>${fracHTML({n:3,d:6})}</div>
            <div>${ShapesAnim.fracBarAnim(3, 6)}</div>
          </div>`,
          steps: [
            'صورت و مخرج کسر یک‌دوم را در ۳ ضرب می‌کنیم:',
            '۱ × ۳ = ۳ و ۲ × ۳ = ۶',
            'حالا کسر سه‌ششم به دست آمد که همان کسر اول است.'
          ],
          answer: 'بله! این دو کسر با هم برابرند.'
        },
        {
          text: 'برای کسر دو‌سوم یک کسر معادل با مخرج ۹ بساز.',
          html: `<span dir="ltr">${fracHTML({ n: 2, d: 3 })} = ? / ۹</span>`,
          steps: [
            'از مخرج ۳ به ۹ یعنی ضرب در ۳',
            'پس صورت را هم در ۳ ضرب می‌کنیم: ۲ × ۳ = ۶'
          ],
          answer: `پس کسر ${fracHTML({ n: 6, d: 9 })} همان دو‌سوم است.`
        }
      ],
      tips: ['ضرب صورت و مخرج در یک عدد، مقدار کسر را تغییر نمی‌دهد.'],
      pitfalls: ['اشتباه نکن! باید هم صورت و هم مخرج را در یک عدد ضرب کنی.']
    },
    {
      id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️',
      formula: 'تقسیم صورت و مخرج بر ب.م.م',
      paragraphs: [
        'گاهی کسرها عددهای بزرگی دارند که می‌شود کوچک‌ترشان کرد بدون اینکه مقدارشان عوض شود.',
        'برای ساده کردن، باید بفهمیم بزرگ‌ترین عددی که هم صورت و هم مخرج بر آن بخش‌پذیرند چیست (ب.م.م).',
        'بعد هم صورت و هم مخرج را بر آن ب.م.م تقسیم می‌کنیم.'
      ],
      examples: [
        {
          text: 'کسر دو‌چهارم را ساده کن.',
          html: fracHTML({ n: 2, d: 4 }),
          steps: ['بزرگ‌ترین عددی که هم ۲ و هم ۴ بر آن بخش‌پذیرند: ۲', 'صورت: ۲ ÷ ۲ = ۱', 'مخرج: ۴ ÷ ۲ = ۲', 'نتیجه: یک‌دوم'],
          answer: `پس ${fracHTML({ n: 2, d: 4 })} = ${fracHTML({ n: 1, d: 2 })}`
        },
        {
          text: 'کسر شش‌نهم را ساده کن.',
          html: fracHTML({ n: 6, d: 9 }),
          steps: ['بزرگ‌ترین مقسوم‌علیه مشترک ۶ و ۹: عدد ۳', 'صورت: ۶ ÷ ۳ = ۲', 'مخرج: ۹ ÷ ۳ = ۳', 'نتیجه: دو‌سوم'],
          answer: `پس ${fracHTML({ n: 6, d: 9 })} = ${fracHTML({ n: 2, d: 3 })}`
        },
        {
          text: 'کسر هشت‌دوازدهم را ساده کن.',
          html: fracHTML({ n: 8, d: 12 }),
          steps: ['بزرگ‌ترین مشترک ۸ و ۱۲: عدد ۴', '۸ ÷ ۴ = ۲ و ۱۲ ÷ ۴ = ۳'],
          answer: `پس ${fracHTML({ n: 8, d: 12 })} = ${fracHTML({ n: 2, d: 3 })}`
        },
        {
          text: 'کسر ده‌پانزدهم را ساده کن.',
          html: fracHTML({ n: 10, d: 15 }),
          steps: ['مقسوم‌علیه مشترک ۱۰ و ۱۵: عدد ۵', '۱۰ ÷ ۵ = ۲ و ۱۵ ÷ ۵ = ۳'],
          answer: `پس ${fracHTML({ n: 10, d: 15 })} = ${fracHTML({ n: 2, d: 3 })}`
        }
      ],
      tips: [
        'اگر عدد بزرگ را بلد نبودی، با عددهای کوچک شروع کن.',
        'اگر صورت و مخرج ب.م.م نداشتند (به‌جز ۱)، کسر از قبل ساده بوده.'
      ],
      pitfalls: ['اشتباه نکن! فقط صورت یا فقط مخرج را تقسیم نکن. باید هر دو را تقسیم کنی.']
    },
    {
      id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️',
      formula: 'مخرج مشترک بگیر',
      paragraphs: [
        'برای اینکه بفهمیم کدام کسر بزرگ‌تر است، باید مخرج‌ها را با هم مساوی کنیم.',
        'بعد از اینکه مخرج‌ها یکی شد، کسری که صورت بزرگ‌تری دارد، بزرگ‌تر است.'
      ],
      examples: [
        {
          text: 'کدام بزرگ‌تر است: یک‌دوم یا یک‌سوم؟',
          html: `<span dir="ltr">${fracHTML({ n: 1, d: 2 })} ? ${fracHTML({ n: 1, d: 3 })}</span>`,
          steps: ['مخرج مشترک: ۶', 'یک‌دوم = سه‌ششم', 'یک‌سوم = دو‌ششم', 'مقایسه صورت‌ها: ۳ > ۲'],
          answer: 'پس یک‌دوم بزرگ‌تر است.'
        },
        {
          text: 'کدام بزرگ‌تر است: دو‌سوم یا سه‌چهارم؟',
          html: `<span dir="ltr">${fracHTML({ n: 2, d: 3 })} ? ${fracHTML({ n: 3, d: 4 })}</span>`,
          steps: ['مخرج مشترک: ۱۲', 'دو‌سوم = هشت‌دوازدهم', 'سه‌چهارم = نه‌دوازدهم', '۸ < ۹ پس سه‌چهارم بزرگ‌تر است.'],
          answer: 'پس سه‌چهارم بزرگ‌تر است.'
        }
      ],
      tips: ['اگر مخرج‌ها مساوی بودند، فقط صورت را نگاه کن.'],
      pitfalls: ['اشتباه نکن! کسری که مخرج بزرگ‌تری دارد، همیشه بزرگ‌تر نیست.']
    },
    {
      id: 'add', title: 'جمع کسرها', emoji: '➕',
      formula: 'مخرج مشترک بگیر، بعد جمع کن',
      paragraphs: [
        'برای جمع دو کسر، اول باید مخرج‌هایشان را با هم مساوی کنیم.',
        'بعد از مشترک کردن مخرج‌ها، صورت‌ها را با هم جمع می‌کنیم.'
      ],
      examples: [
        {
          text: 'حاصل جمع یک‌پنجم و دو‌پنجم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 1, d: 5 })} + ${fracHTML({ n: 2, d: 5 })}</span>`,
          steps: ['مخرج‌ها هر دو ۵ هستند (مساوی).', 'فقط صورت‌ها را جمع می‌کنیم: ۱ + ۲ = ۳', 'نتیجه: سه‌پنجم'],
          answer: `= ${fracHTML({ n: 3, d: 5 })}`
        },
        {
          text: 'حاصل جمع یک‌دوم و یک‌سوم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 1, d: 2 })} + ${fracHTML({ n: 1, d: 3 })}</span>`,
          steps: [
            'مخرج‌ها فرق دارند: ۲ و ۳',
            'مخرج مشترک می‌شود ۶',
            'یک‌دوم = سه‌ششم',
            'یک‌سوم = دو‌ششم',
            'حالا مخرج‌ها یکی است: ۳ + ۲ = ۵',
            'نتیجه: پنج‌ششم'
          ],
          answer: `= ${fracHTML({ n: 5, d: 6 })}`
        }
      ],
      tips: ['اگر مخرج‌ها مساوی بودند، فقط صورت‌ها را جمع کن.'],
      pitfalls: ['اشتباه نکن! مخرج‌ها را با هم جمع نکن!']
    },
    {
      id: 'sub', title: 'تفریق کسرها', emoji: '➖',
      formula: 'مخرج مشترک بگیر، بعد کم کن',
      paragraphs: [
        'تفریق کسرها هم دقیقاً مثل جمع است. اول مخرج‌ها را مشترک می‌کنیم، بعد صورت‌ها را کم می‌کنیم.'
      ],
      examples: [
        {
          text: 'حاصل تفریق سه‌پنجم منهای یک‌پنجم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 3, d: 5 })} − ${fracHTML({ n: 1, d: 5 })}</span>`,
          steps: ['مخرج‌ها مساوی (۵).', 'صورت‌ها را کم می‌کنیم: ۳ − ۱ = ۲', 'نتیجه: دو‌پنجم'],
          answer: `= ${fracHTML({ n: 2, d: 5 })}`
        },
        {
          text: 'حاصل تفریق سه‌چهارم منهای یک‌دوم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 3, d: 4 })} − ${fracHTML({ n: 1, d: 2 })}</span>`,
          steps: ['مخرج‌ها فرق دارند: ۴ و ۲', 'مخرج مشترک: ۴', 'یک‌دوم = دو‌چهارم', 'سه‌چهارم − دو‌چهارم = یک‌چهارم'],
          answer: `= ${fracHTML({ n: 1, d: 4 })}`
        }
      ],
      tips: ['در پایان اگر ممکن بود، کسر را ساده کن.'],
      pitfalls: ['اشتباه نکن! مخرج را تغییر نده، فقط صورت‌ها را کم کن.']
    },
    {
      id: 'mul', title: 'ضرب کسرها', emoji: '✖️',
      formula: 'صورت × صورت ، مخرج × مخرج',
      paragraphs: [
        'ضرب کسرها از همه راحت‌تر است! نیازی به مخرج مشترک نیست.',
        'فقط صورت‌ها را در هم ضرب می‌کنیم و مخرج‌ها را در هم.'
      ],
      examples: [
        {
          text: 'حاصل ضرب یک‌دوم و دو‌سوم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 1, d: 2 })} × ${fracHTML({ n: 2, d: 3 })}</span>`,
          steps: ['صورت‌ها: ۱ × ۲ = ۲', 'مخرج‌ها: ۲ × ۳ = ۶', 'نتیجه: دو‌ششم که ساده می‌شود به یک‌سوم'],
          answer: `= ${fracHTML({ n: 1, d: 3 })}`
        }
      ],
      tips: ['در انتها نتیجه را ساده کن.'],
      pitfalls: ['اشتباه نکن! برای ضرب نیازی به مخرج مشترک نیست.']
    },
    {
      id: 'div', title: 'تقسیم کسرها', emoji: '➗',
      formula: 'کسر دوم را برعکس کن، بعد ضرب کن',
      paragraphs: [
        'برای تقسیم دو کسر، اول کسر دوم را برعکس می‌کنیم (معکوس). بعد ضرب می‌کنیم.'
      ],
      examples: [
        {
          text: 'حاصل تقسیم یک‌دوم بر یک‌سوم چقدر است؟',
          html: `<span dir="ltr">${fracHTML({ n: 1, d: 2 })} ÷ ${fracHTML({ n: 1, d: 3 })}</span>`,
          steps: [
            'معکوس یک‌سوم می‌شود سه‌یکم',
            'حالا ضرب: یک‌دوم × سه‌یکم',
            'صورت: ۱ × ۳ = ۳',
            'مخرج: ۲ × ۱ = ۲',
            'نتیجه: سه‌دوم'
          ],
          answer: `= ${fracHTML({ n: 3, d: 2 })}`
        }
      ],
      tips: ['یادت باشد: «تقسیم = ضرب در معکوس»'],
      pitfalls: ['اشتباه نکن! کسر دوم را معکوس کن، نه کسر اول را.']
    },
    {
      id: 'mixed', title: 'عدد مخلوط', emoji: '🔢',
      formula: 'عدد صحیح + کسر',
      paragraphs: [
        'گاهی یک عدد صحیح و یک کسر با هم ترکیب می‌شوند. مثلاً «دو و یک‌سوم» یعنی ۲ کامل به‌اضافه‌ی یک‌سوم.',
        'برای تبدیل به کسر ساده، عدد صحیح را در مخرج ضرب می‌کنیم، بعد صورت را اضافه می‌کنیم.'
      ],
      examples: [
        {
          text: 'عدد مخلوط دو و یک‌سوم را به کسر تبدیل کن.',
          html: mixedHTML({ n: 7, d: 3 }),
          steps: [
            'عدد صحیح = ۲، مخرج = ۳، صورت = ۱',
            'صورت جدید = (۲ × ۳) + ۱ = ۶ + ۱ = ۷',
            'مخرج همان ۳ می‌ماند'
          ],
          answer: `= ${fracHTML({ n: 7, d: 3 })}`
        }
      ],
      tips: ['برای برعکس: صورت را بر مخرج تقسیم کن.'],
      pitfalls: ['اشتباه نکن! عدد صحیح را در مخرج ضرب کن، بعد با صورت جمع کن.']
    }
  ],
  decimals: [
    {
      id: 'concept', title: 'مفهوم اعشار', emoji: '🔟',
      formula: 'یک‌دهم، صدم، هزارم',
      paragraphs: [
        'اعداد اعشاری برای نشان دادن قسمت‌های کوچک‌تر از یک استفاده می‌شوند. مثلاً نصف یک سیب را می‌شود ۰٫۵ نوشت.',
        'بعد از ممیز، اولین رقم نشان می‌دهد چند دهم است، دومی چند صدم، سومی چند هزارم.'
      ],
      examples: [
        {
          text: '۰٫۵ یعنی چه؟ روی محور نگاه کن:',
          html: ShapesAnim.numberLineAnim(0, 5, 2.5),
          steps: ['۵ بعد از ممیز، یعنی ۵ دهم', '۵ دهم = نصف', 'روی محور، بین ۲ و ۳ می‌افتد'],
          answer: '۰٫۵ = نصف'
        },
        {
          text: '۰٫۲۵ چطور؟',
          html: eq('۰٫۲۵'),
          steps: ['۲۵ بعد از ممیز یعنی ۲۵ صدم', '۲۵ صدم = یک‌چهارم'],
          answer: '۰٫۲۵ = یک‌چهارم'
        }
      ],
      tips: ['هر رقم بعد از ممیز یک جایگاه دارد: دهم، صدم، هزارم.'],
      pitfalls: ['اشتباه نکن! فراموش نکن قبل از ممیز صفر بگذاری.']
    },
    {
      id: 'compare', title: 'مقایسه اعشار', emoji: '⚖️',
      formula: 'رقم به رقم مقایسه کن',
      paragraphs: [
        'برای مقایسه‌ی دو عدد اعشاری، اول قسمت صحیح را مقایسه می‌کنیم. اگر مساوی بود، ارقام بعد از ممیز را از چپ به راست.'
      ],
      examples: [
        {
          text: 'کدام بزرگ‌تر است: ۰٫۷ یا ۰٫۵؟',
          html: eq('۰٫۷ ? ۰٫۵'),
          steps: ['قسمت صحیح هر دو = ۰', 'رقم دهم: ۷ > ۵'],
          answer: '۰٫۷ بزرگ‌تر است'
        },
        {
          text: 'کدام بزرگ‌تر است: ۲٫۳ یا ۲٫۵؟',
          html: eq('۲٫۳ ? ۲٫۵'),
          steps: ['قسمت صحیح: هر دو ۲', 'دهم: ۳ < ۵'],
          answer: '۲٫۵ بزرگ‌تر است'
        }
      ],
      tips: ['اگر تعداد رقم‌ها فرق داشت، با صفر پر کن.'],
      pitfalls: ['اشتباه نکن! عددی که ارقام بیشتری دارد همیشه بزرگ‌تر نیست.']
    },
    {
      id: 'add', title: 'جمع اعشار', emoji: '➕',
      formula: 'ممیزها زیر هم',
      paragraphs: [
        'برای جمع اعشاری، اعداد را طوری زیر هم می‌نویسیم که ممیزها روبروی هم باشند.'
      ],
      examples: [
        {
          text: 'حاصل ۳٫۴ + ۲٫۱ چقدر است؟',
          html: eq('۳٫۴ + ۲٫۱'),
          steps: ['۳٫۴ را بنویس', '۲٫۱ را زیرش، ممیزها زیر هم', 'جمع: ۳٫۴ + ۲٫۱ = ۵٫۵'],
          answer: '= ۵٫۵'
        }
      ],
      tips: ['اگر تعداد رقم‌های اعشار فرق داشت، با صفر پر کن.'],
      pitfalls: ['اشتباه نکن! همیشه ممیزها را زیر هم بنویس.']
    },
    {
      id: 'sub', title: 'تفریق اعشار', emoji: '➖',
      formula: 'ممیزها زیر هم',
      paragraphs: [
        'تفریق اعشار هم مثل جمع است: ممیزها را زیر هم می‌گذاریم.'
      ],
      examples: [
        {
          text: 'حاصل ۵٫۵ − ۲٫۱ چقدر است؟',
          html: eq('۵٫۵ − ۲٫۱'),
          steps: ['۵٫۵', '۲٫۱ زیرش، ممیزها روبرو', '۵٫۵ − ۲٫۱ = ۳٫۴'],
          answer: '= ۳٫۴'
        }
      ],
      tips: ['قرض گرفتن از ستون کنار.'],
      pitfalls: ['اشتباه نکن! همیشه کوچکتر را از بزرگتر کم کن.']
    },
    {
      id: 'frac-to-dec', title: 'کسر به اعشار', emoji: '🔄',
      formula: 'صورت ÷ مخرج',
      paragraphs: [
        'برای تبدیل یک کسر به عدد اعشاری، صورت را بر مخرج تقسیم می‌کنیم.'
      ],
      examples: [
        {
          text: 'سه‌چهارم را به اعشار تبدیل کن.',
          html: fracHTML({ n: 3, d: 4 }),
          steps: ['۳ ÷ ۴ = ۰٫۷۵'],
          answer: '= ۰٫۷۵'
        }
      ],
      tips: ['بعضی کسرها اعشار پایان‌پذیر دارند، بعضی متناوب.'],
      pitfalls: ['اشتباه نکن! صورت را بر مخرج تقسیم کن، نه برعکس.']
    },
    {
      id: 'dec-to-frac', title: 'اعشار به کسر', emoji: '🔄',
      formula: 'به‌جای ممیز، ۱۰ یا ۱۰۰ بگذار',
      paragraphs: [
        'برای تبدیل اعشار به کسر: تعداد رقم‌های بعد از ممیز را بشمار. اگر ۱ رقم باشد، مخرج ۱۰ می‌شود؛ اگر ۲ رقم، مخرج ۱۰۰.'
      ],
      examples: [
        {
          text: '۰٫۷ را به کسر تبدیل کن.',
          html: eq('۰٫۷'),
          steps: ['۱ رقم بعد از ممیز → مخرج ۱۰', 'صورت = ۷', 'نتیجه: هفت‌دهم'],
          answer: `= ${fracHTML({ n: 7, d: 10 })}`
        },
        {
          text: '۰٫۷۵ را به کسر تبدیل کن.',
          html: eq('۰٫۷۵'),
          steps: ['۲ رقم بعد از ممیز → مخرج ۱۰۰', 'صورت = ۷۵', 'کسر: هفتادوپنج‌صدم که ساده می‌شود به سه‌چهارم'],
          answer: `= ${fracHTML({ n: 3, d: 4 })}`
        }
      ],
      tips: ['در پایان ساده کن.'],
      pitfalls: ['اشتباه نکن! تعداد رقم‌های اعشار را درست بشمار.']
    }
  ]
};

function viewLearn(topic) {
  const lessons = LESSONS[topic];
  if (!lessons) return `<div class="empty">درسی موجود نیست</div>`;
  return `
  ${header('📚 آموزش', true)}
  <p style="color:var(--muted);margin:0 0 14px">یک موضوع را انتخاب کن تا با انیمیشن یاد بگیری:</p>
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
  const lessons = LESSONS[topic];
  if (!lessons) return `<div class="empty">درس پیدا نشد</div>`;
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) return `<div class="empty">درس پیدا نشد</div>`;
  const allIds = lessons.map(l => l.id);
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
    <h3>📖 بیا یاد بگیریم</h3>
    ${lesson.paragraphs.map(p => `<p>${p}</p>`).join('')}
  </div>

  <div class="lesson-section">
    <h3>📌 مثال‌های تصویری</h3>
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
    <h3>⚠️ حواست باشه</h3>
    <ul class="pitfalls-list">
      ${lesson.pitfalls.map(t => `<li>${t}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="lesson-nav">
    ${prevId ? `<button class="btn sec" onclick="window.__nav('lesson',{topic:'${topic}',id:'${prevId}'})">⬅️ قبلی</button>` : ''}
    ${nextId ? `<button class="btn" onclick="window.__nav('lesson',{topic:'${topic}',id:'${nextId}'})">➡️ بعدی</button>` : ''}
  </div>

  <button class="btn success full" style="margin-top:16px" onclick="window.__nav('practice',{topic:'${topic}'})">
    ✏️ بیا تمرین کنیم!
  </button>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۳) PRACTICE
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
  if (!q) { session.current = null; return; }
  session.current = q;
  session.answered = false;
  session.selected = null;
}
function renderPractice() {
  const q = session.current;
  if (!q) return `<div class="empty"><span class="emoji-big">😅</span>متأسفانه سوالی پیدا نشد.</div>`;
  const names = {
    perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم',
    fractions: '🍰 کسرها', decimals: '🔢 اعشار'
  };
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
  } else if (session.selected && equalAnswer(session.selected, c)) {
    cls += ' selected';
  }
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
    const title = correct ? pick(['🎉 آفرین!', '✨ درست بود!', '💯 عالی!', '🌟 ادامه بده!']) : '❌ اشکالی نداره، بیا با هم ببینیم:';
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
   ۲۴) EXAM SETUP
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
        ${[5, 10, 15, 20].map(n => `<option value="${n}" ${n === state.settings.questionCount ? 'selected' : ''}>${fa(n)} سوال</option>`).join('')}
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
  <div class="card" style="background:#dbeafe;border-right:4px solid var(--info)">
    <p style="margin:0;font-size:.9rem">
      📝 <strong>نکته:</strong> در این آزمون پاسخ‌ها همان لحظه بررسی نمی‌شوند.
    </p>
  </div>
  <div class="card" style="background:#fef3c7;border-right:4px solid var(--accent)">
    <p style="margin:0;font-size:.9rem">
      ⚠️ <strong>نمره منفی:</strong> برای هر ۳ پاسخ غلط، ۱ نمره کم می‌شود. سوالات بی‌پاسخ حساب نمی‌شوند.
    </p>
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
  if (!questions.length) { alert('متأسفانه سوالی پیدا نشد.'); return; }
  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null,
    correct: 0, wrong: 0, unanswered: 0,
    timeLeft: time, totalTime: time,
    isMulti: false
  };
  navigate('exam');
  startExamTimer();
}

/* ============================================================
   ۲۵) MULTI-TOPIC EXAM
   ============================================================ */
function viewMultiExamSetup() {
  return `
  ${header('🎯 آزمون جامع', true)}
  <p style="color:var(--muted);margin:0 0 14px;text-align:center">
    درس‌هایی که می‌خواهی در آزمون باشند را انتخاب کن:
  </p>
  <div class="card">
    <h3 class="card-title">📚 انتخاب دروس</h3>
    ${ALL_TOPICS.map(t => `
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#f9fafb;border-radius:12px;margin-bottom:8px;font-weight:600;cursor:pointer">
        <input type="checkbox" class="topic-check" value="${t}" checked style="width:22px;height:22px;accent-color:#7c3aed">
        <span style="font-size:1.3rem">${TOPIC_EMOJIS[t]}</span>
        <span>${TOPIC_NAMES[t]}</span>
      </label>
    `).join('')}
  </div>
  <div class="card">
    <h3 class="card-title">⚙️ تنظیمات آزمون</h3>
    <label style="display:block;margin-top:12px">تعداد سوال:
      <select id="mExamCount" class="num-input" style="text-align:right">
        ${[5, 10, 15, 20, 25].map(n => `<option value="${n}" ${n === 10 ? 'selected' : ''}>${fa(n)} سوال</option>`).join('')}
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
  <div class="card" style="background:#dbeafe;border-right:4px solid var(--info)">
    <p style="margin:0;font-size:.9rem">
      📝 <strong>نکته:</strong> در این آزمون پاسخ‌ها همان لحظه بررسی نمی‌شوند.
    </p>
  </div>
  <div class="card" style="background:#fef3c7;border-right:4px solid var(--accent)">
    <p style="margin:0;font-size:.9rem">
      ⚠️ <strong>نمره منفی:</strong> برای هر ۳ پاسخ غلط، ۱ نمره کم می‌شود.
    </p>
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

  if (!questions.length) { alert('متأسفانه سوالی پیدا نشد.'); return; }

  session = {
    mode: 'exam', topic: 'comprehensive', difficulty: diff, questions,
    topicsSelected: topics,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null,
    correct: 0, wrong: 0, unanswered: 0,
    timeLeft: time, totalTime: time,
    isMulti: true
  };
  navigate('exam');
  startExamTimer();
}

/* ============================================================
   ۲۶) EXAM VIEW
   ============================================================ */
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
  if (!q) return `<div class="empty">خطا در بارگذاری</div>`;
  const title = session.isMulti ? '🎯 آزمون جامع' : '🎯 آزمون ' + TOPIC_NAMES[session.topic];
  const min = Math.floor(session.timeLeft / 60);
  const sec = session.timeLeft % 60;
  const timeColor = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
  const answeredCount = session.index;
  return `
  ${header(title)}
  <div class="stats-row">
    <div class="stat-item"><div class="stat-value">${fa(session.index + 1)}/${fa(session.questions.length)}</div><div class="stat-label">سوال</div></div>
    <div class="stat-item"><div class="stat-value" style="color:${timeColor}">⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}</div><div class="stat-label">زمان</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--info)">${fa(answeredCount)}</div><div class="stat-label">پاسخ‌داده</div></div>
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
      ${session.index + 1 >= session.questions.length ? '🏁 پایان آزمون' : '➡️ بعدی'}
    </button>
    <button class="btn danger" onclick="if(confirm('از آزمون خارج شوی؟')) window.__nav('home')">خروج</button>
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
  const rawScore = s.correct - penalty;
  const score = Math.max(0, rawScore);
  const pctv = Math.round((score / s.questions.length) * 100);
  const stu = activeStudent();
  if (stu) {
    stu.history.unshift({
      date: Date.now(),
      topic: s.topic,
      score: pctv,
      correct: s.correct,
      wrong: s.wrong,
      unanswered: s.unanswered || 0,
      penalty: penalty,
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
  const payload = {
    pct: pctv,
    penalty: penalty,
    answers: s.answers,
    topic: s.topic,
    isMulti: s.isMulti || false
  };
  session = null;
  navigate('examResult', payload);
}

function viewExamResult() {
  const params = route.params || {};
  const pctv = params.pct, answers = params.answers, topic = params.topic, isMulti = params.isMulti, penalty = params.penalty || 0;
  if (!answers) return `<div class="empty">کارنامه‌ای موجود نیست</div>`;
  const correct = answers.filter(a => a.isCorrect).length;
  const wrong = answers.filter(a => !a.isCorrect && !a.unanswered).length;
  const unanswered = answers.filter(a => a.unanswered).length;
  const emoji = pctv >= 80 ? '🏆' : pctv >= 60 ? '👍' : pctv >= 40 ? '💪' : '📚';
  const msg = pctv >= 80 ? 'فوق‌العاده بود!' : pctv >= 60 ? 'خوب بود، ادامه بده!' : pctv >= 40 ? 'باز هم تمرین کن!' : 'ناامید نشو، دوباره تلاش کن!';
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
    ${penalty > 0 ? `
      <p style="color:var(--danger);font-size:.95rem;margin:4px 0">
        نمره منفی: ${fa(penalty)} نمره کسر شد
      </p>` : ''}
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
      let borderColor = 'var(--danger)';
      let mark = '❌';
      if (a.isCorrect) { borderColor = 'var(--success)'; mark = '✅'; }
      else if (a.unanswered) { borderColor = 'var(--muted)'; mark = '⬜'; }
      if (!a.isCorrect && a.userAns != null) {
        userDisp = displayAnswer(a.userAns);
      }
      return `
      <div class="card" style="border-right:4px solid ${borderColor}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>سوال ${fa(i + 1)}</strong>
          <span>${mark}</span>
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
    ${isMulti
      ? `<button class="btn full" onclick="window.__nav('multiExamSetup')">🔁 آزمون جامع دوباره</button>`
      : `<button class="btn full" onclick="window.__nav('examSetup',{topic:'${topic}'})">🔁 آزمون دوباره</button>`}
    <button class="btn sec" onclick="window.__nav('home')">🏠 خانه</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۷) PROGRESS
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
    'sq-p': 'محیط مربع', 'rect-p': 'محیط مستطیل', 'tri-p': 'محیط مثلث', 'circ-p': 'محیط دایره',
    'para-p': 'محیط متوازی‌الاضلاع', 'rhom-p': 'محیط لوزی', 'poly-p': 'محیط چندضلعی', 'find-side': 'یافتن ضلع',
    'sq-a': 'مساحت مربع', 'rect-a': 'مساحت مستطیل', 'tri-a': 'مساحت مثلث', 'circ-a': 'مساحت دایره',
    'para-a': 'مساحت متوازی‌الاضلاع', 'rhom-a': 'مساحت لوزی', 'trap-a': 'مساحت ذوزنقه', 'comp-a': 'شکل ترکیبی',
    'cube-v': 'حجم مکعب', 'box-v': 'حجم مکعب مستطیل', 'find-edge': 'یافتن ضلع مکعب',
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
      <div class="stat-item"><div class="stat-value">${fa(overall)}٪</div><div class="stat-label">تسلط کلی</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalC)}</div><div class="stat-label">پاسخ درست</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalQ)}</div><div class="stat-label">کل تمرین</div></div>
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
  <h3 style="margin:20px 0 10px">🎯 این‌ها را باید بیشتر تمرین کنی</h3>
  <div class="card">
    ${mistakeList.map(([k, v]) => {
      const key = k.split(':')[1];
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border)">
        <span>${names[key] || key}</span>
        <span style="color:var(--danger);font-weight:700">${fa(v)} بار اشتباه</span>
      </div>`;
    }).join('')}
    <button class="btn info full" style="margin-top:12px" onclick="window.__nav('practice',{topic:'${mistakeList[0][0].split(':')[0]}'})">💡 تمرین پیشنهادی</button>
  </div>` : ''}
  <h3 style="margin:20px 0 10px">📜 تاریخچه آزمون‌ها</h3>
  <div class="card">
    ${stu.history.length ? stu.history.slice(0, 10).map(h => {
      const d = new Date(h.date);
      const dateStr = `${fa(d.getFullYear())}/${fa(d.getMonth() + 1)}/${fa(d.getDate())}`;
      const tn = h.isMulti ? 'آزمون جامع' : (TOPIC_NAMES[h.topic] || h.topic);
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
   ۲۸) SETTINGS
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
    <h3 class="card-title">👥 دانش‌آموزان</h3>
    <button class="btn info full" onclick="window.__nav('students')">مدیریت دانش‌آموزان</button>
  </div>
  <div class="card">
    <h3 class="card-title">⚠️ خطرناک</h3>
    <p class="card-desc">پیشرفت دانش‌آموز فعلی پاک می‌شود.</p>
    <button class="btn danger full" style="margin-top:10px" onclick="window.__resetActiveStudent()">🗑️ پاک کردن پیشرفت</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۹) TEACHER
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
    <p>پاسخ‌های درست: <strong>${fa(stu.stats.totalCorrect)} / ${fa(stu.stats.totalQuestions)}</strong></p>
    <p>تعداد آزمون‌ها: <strong>${fa(stu.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها</button>
  </div>` : ''}
  ${bottomNav()}`;
}

/* ============================================================
   ۳۰) RENDER
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
}

/* ============================================================
   ۳۱) GLOBAL FUNCTIONS
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
  session.difficulty = d;
  state.settings.difficulty = d;
  saveState();
  nextPracticeQuestion();
  render();
};
window.__selectChoice = (i) => {
  if (!session || session.answered) return;
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
window.__startMultiExam = () => { sound.click(); startMultiExam(); };
window.__setSetting = (key, val) => {
  state.settings[key] = val;
  saveState();
  if (key === 'animation') document.body.classList.toggle('no-anim', !val);
  render();
};
window.__selectStudent = (id) => {
  sound.click();
  session = null;
  state.activeStudentId = id;
  saveState();
  navigate('home');
};
window.__deleteStudent = (id) => {
  const stu = state.students.find(s => s.id === id);
  if (!stu) return;
  if (!confirm(`مطمئنی می‌خواهی «${fullName(stu)}» را کاملاً حذف کنی؟ این کار قابل بازگشت نیست.`)) return;
  state.students = state.students.filter(s => s.id !== id);
  if (state.activeStudentId === id) {
    state.activeStudentId = state.students.length ? state.students[0].id : null;
  }
  saveState();
  sound.click();
  showFloat('🗑️ حذف شد');
  render();
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
    timeLeft: time, totalTime: time,
    isMulti: false
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
   ۳۲) KEYBOARD
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && route.name !== 'home' && route.name !== 'students') window.__goBack();
  if (e.key === 'Enter' && route.name === 'addStudent') {
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') window.__createStudent();
  }
});

/* ============================================================
   ۳۳) INIT
   ============================================================ */
ensureAnimStyles();

if (state.students.length === 0) {
  route = { name: 'addStudent', params: {} };
} else if (!state.activeStudentId || !activeStudent()) {
  route = { name: 'students', params: {} };
}
render();

})();
