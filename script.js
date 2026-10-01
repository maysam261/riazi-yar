/* =============================================================
   ریاضی‌یار — بازی آموزشی محیط، مساحت و کسرها
   Vanilla JS | RTL | localStorage | بدون بک‌اند | PWA-ready
   ============================================================= */
(function () {
'use strict';

/* ============================================================
   ۱) STATE و ذخیره‌سازی
   ============================================================ */
const STORAGE_KEY = 'riazi-yar-v1';

const defaultState = {
  settings: {
    sound: true,
    animation: true,
    difficulty: 'medium',    // easy | medium | hard
    questionCount: 10,
    examTime: 300,           // ثانیه
    persianNumbers: true,
    grade: 6,
    negativeMark: false
  },
  stats: {
    coins: 0, stars: 0, xp: 0, level: 1,
    streak: 0, bestStreak: 0,
    totalQuestions: 0, totalCorrect: 0,
    badges: []
  },
  progress: {
    perimeter: { attempts: 0, correct: 0 },
    area:      { attempts: 0, correct: 0 },
    fractions: { attempts: 0, correct: 0 }
  },
  history: [],
  mistakes: {}
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(defaultState);
    const saved = JSON.parse(raw);
    return mergeDeep(deepClone(defaultState), saved);
  } catch (e) {
    console.warn('خطا در خواندن داده‌ها', e);
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
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
      t[k] = mergeDeep(t[k] || {}, s[k]);
    } else { t[k] = s[k]; }
  }
  return t;
}

/* ============================================================
   ۲) ابزارهای کمکی
   ============================================================ */
function fa(n) {
  const s = String(n);
  if (!state.settings.persianNumbers) return s;
  return s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function en(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[،,]/g, '.');
}
function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}
function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
function round(n, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function faSafe(n) { return escHtml(fa(n)); }

/* ============================================================
   ۳) صدا (WebAudio — بدون فایل خارجی)
   ============================================================ */
let audioCtx = null;
function beep(freq, dur = 0.12, type = 'sine', gain = 0.08) {
  if (!state.settings.sound) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}
const sound = {
  correct() { beep(880, .12); setTimeout(() => beep(1320, .16), 90); },
  wrong()   { beep(220, .18, 'square', .06); },
  click()   { beep(560, .05, 'triangle', .04); },
  win()     { [660, 880, 1180].forEach((f, i) => setTimeout(() => beep(f, .16), i * 110)); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2), i * 120)); }
};

/* ============================================================
   ۴) کسر — کمک‌کننده‌ها
   ============================================================ */
function simplify(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) {
    return { n: 0, d: 1 };
  }
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function fracEq(a, b) {
  if (!a || !b || a.d == null || b.d == null) return false;
  return a.n * b.d === b.n * a.d;
}
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

/* نمایش امن یک پاسخ (فارسی، کسری، نمادی، اعشاری) */
function displayAnswer(a) {
  if (a == null) return '';
  if (typeof a === 'number') return fa(a);
  if (a.isSym) return a.n === '>' ? '&gt;' : a.n === '<' ? '&lt;' : escHtml(a.n);
  if (a.isNum) return faSafe(a.n);
  if (a.n != null && a.d != null) return fracHTML(a);
  return faSafe(a);
}

/* ============================================================
   ۵) رسم شکل‌ها (SVG)
   ============================================================ */
const SC = {
  fill: '#c7d2fe', stroke: '#4338ca', fill2: '#a5b4fc',
  accent: '#fbbf24', text: '#312e81'
};

function svgWrap(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="shape-svg" role="img" aria-hidden="true">${inner}</svg>`;
}
function label(x, y, txt, anchor = 'middle', cls = 'svg-label') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${txt}</text>`;
}

const svgDefs = `
<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#4338ca"/>
  </marker>
</defs>`;

const Shapes = {
  square(side) {
    const W = 200, H = 180, pad = 40, box = 120;
    return svgWrap(W, H, svgDefs +
      `<rect x="${pad}" y="${(H - box) / 2 - 6}" width="${box}" height="${box}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="4"/>` +
      label(W / 2, H - 8, `${fa(side)}`, 'middle', 'svg-label-lg')
    );
  },
  rectangle(w, h) {
    const W = 240, H = 180;
    const ratio = w / h;
    let rw = 160, rh = rw / ratio;
    if (rh > 110) { rh = 110; rw = rh * ratio; }
    const x = (W - rw) / 2, y = (H - rh) / 2 - 6;
    return svgWrap(W, H, svgDefs +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="4"/>` +
      label(x + rw / 2, H - 8, `${fa(w)}`, 'middle', 'svg-label-lg') +
      label(x - 8, y + rh / 2 + 4, `${fa(h)}`, 'end', 'svg-label-lg')
    );
  },
  triangle(a, b, c) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="120,30 30,150 210,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label(120, 22, `${fa(a)}`) +
      label(60, 168, `${fa(b)}`) +
      label(180, 168, `${fa(c)}`)
    );
  },
  triangleBH(b, h) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="120,30 30,150 210,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="120" y1="30" x2="120" y2="150" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
      `<rect x="112" y="140" width="8" height="8" fill="none" stroke="${SC.accent}" stroke-width="1.5"/>` +
      label(120, 22, `h=${fa(h)}`) +
      label(120, 168, `b=${fa(b)}`)
    );
  },
  circle(r) {
    const W = 200, H = 180;
    return svgWrap(W, H, svgDefs +
      `<circle cx="${W / 2}" cy="${H / 2 - 8}" r="60" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3"/>` +
      `<line x1="${W / 2}" y1="${H / 2 - 8}" x2="${W / 2 + 60}" y2="${H / 2 - 8}" stroke="${SC.accent}" stroke-width="2.5"/>` +
      `<circle cx="${W / 2}" cy="${H / 2 - 8}" r="3" fill="${SC.stroke}"/>` +
      label(W / 2 + 30, H / 2 - 14, `r=${fa(r)}`)
    );
  },
  parallelogram(a, b, h) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="70,40 210,40 170,150 30,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="70" y1="40" x2="70" y2="150" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
      label(120, 32, `${fa(a)}`) +
      label(200, 165, `${fa(b)}`)
    );
  },
  rhombus(d1, d2) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="120,25 210,95 120,165 30,95" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="30" y1="95" x2="210" y2="95" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="5 4"/>` +
      `<line x1="120" y1="25" x2="120" y2="165" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="5 4"/>` +
      label(75, 88, `${fa(d1)}`) +
      label(128, 55, `${fa(d2)}`, 'start')
    );
  },
  trapezoid(a, b, h) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="80,40 180,40 210,150 30,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="130" y1="40" x2="130" y2="150" stroke="${SC.accent}" stroke-width="2" stroke-dasharray="5 4"/>` +
      label(130, 32, `${fa(b)}`) +
      label(120, 168, `${fa(a)}`) +
      label(140, 100, `h=${fa(h)}`, 'start')
    );
  },
  regularPolygon(n, s) {
    const W = 220, H = 200, cx = W / 2, cy = H / 2 - 4, R = 75;
    const start = -Math.PI / 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * 2 * Math.PI / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const polyStr = pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ');
    return svgWrap(W, H, svgDefs +
      `<polygon points="${polyStr}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label(cx, H - 8, `${fa(n)} ضلع — هر ضلع ${fa(s)}`)
    );
  },
  composite(w, h, w2, h2) {
    const W = 240, H = 200;
    const rw1 = 140, rh1 = 90, rw2 = 80, rh2 = 60;
    return svgWrap(W, H, svgDefs +
      `<rect x="30" y="40" width="${rw1}" height="${rh1}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="3"/>` +
      `<rect x="30" y="${40 + rh1}" width="${rw2}" height="${rh2}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3" rx="3"/>` +
      label(100, 30, `${fa(w)} × ${fa(h)}`) +
      label(70, 190, `${fa(w2)} × ${fa(h2)}`)
    );
  }
};

/* ============================================================
   ۶) تولید سوال
   ============================================================ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 10];
  if (diff === 'hard') return [8, 30];
  return [3, 20];
}

/* --- محیط --- */
function genSquarePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  return {
    topic: 'perimeter', key: 'sq-p',
    prompt: `محیط مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.square(s),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `فرمول محیط مربع: P = ۴ × ضلع`,
      `P = ۴ × ${fa(s)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genRectPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = 2 * (w + h);
  return {
    topic: 'perimeter', key: 'rect-p',
    prompt: `محیط مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rectangle(w, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `فرمول: P = ۲ × (طول + عرض)`,
      `P = ۲ × (${fa(w)} + ${fa(h)}) = ۲ × ${fa(w + h)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genTrianglePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b), z = ri(a, b);
  const ans = x + y + z;
  return {
    topic: 'perimeter', key: 'tri-p',
    prompt: `محیط مثلثی با اضلاع ${fa(x)}، ${fa(y)} و ${fa(z)} سانتی‌متر چقدر است؟`,
    shape: Shapes.triangle(x, y, z),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `محیط مثلث = مجموع سه ضلع`,
      `P = ${fa(x)} + ${fa(y)} + ${fa(z)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genCirclePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const r = ri(a, Math.min(b, 12));
  const ans = round(2 * 3.14 * r, 2);
  return {
    topic: 'perimeter', key: 'circ-p',
    prompt: `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`,
    shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `فرمول محیط دایره: C = ۲ × π × r`,
      `C = ۲ × ۳٫۱۴ × ${fa(r)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b);
  const ans = 2 * (x + y);
  return {
    topic: 'perimeter', key: 'para-p',
    prompt: `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(x, y, 10),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `محیط متوازی‌الاضلاع = ۲ × (ضلع بزرگ + ضلع کوچک)`,
      `P = ۲ × (${fa(x)} + ${fa(y)}) = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  return {
    topic: 'perimeter', key: 'rhom-p',
    prompt: `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombus(80, 100),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `هر چهار ضلع لوزی برابرند؛ P = ۴ × ضلع`,
      `P = ۴ × ${fa(s)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genPolygonPerimeter(diff) {
  const ns = [3, 4, 5, 6, 8];
  const n = pick(ns);
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = n * s;
  const nameMap = { 3: 'مثلث', 4: 'مربع', 5: 'پنج‌ضلعی', 6: 'شش‌ضلعی', 8: 'هشت‌ضلعی' };
  return {
    topic: 'perimeter', key: 'poly-p',
    prompt: `محیط یک ${nameMap[n]} منتظم با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.regularPolygon(n, s),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `محیط چندضلعی منتظم = تعداد ضلع × طول ضلع`,
      `P = ${fa(n)} × ${fa(s)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
function genFindSideFromPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const p = 4 * s;
  return {
    topic: 'perimeter', key: 'find-side',
    prompt: `محیط مربعی ${fa(p)} سانتی‌متر است. طول ضلع آن چقدر است؟`,
    shape: Shapes.square('?'),
    type: 'numeric', answer: s, unit: 'سانتی‌متر',
    steps: [
      `P = ۴ × ضلع  ⇒  ضلع = P ÷ ۴`,
      `ضلع = ${fa(p)} ÷ ۴ = ${fa(s)} سانتی‌متر`
    ]
  };
}

/* --- مساحت --- */
function genSquareArea(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = s * s;
  return {
    topic: 'area', key: 'sq-a',
    prompt: `مساحت مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.square(s),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت مربع = ضلع × ضلع`,
      `S = ${fa(s)} × ${fa(s)} = ${fa(ans)} سانتی‌متر مربع`
    ]
  };
}
function genRectArea(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b);
  const ans = w * h;
  return {
    topic: 'area', key: 'rect-a',
    prompt: `مساحت مستطیلی با طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rectangle(w, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت مستطیل = طول × عرض`,
      `S = ${fa(w)} × ${fa(h)} = ${fa(ans)} سانتی‌متر مربع`
    ]
  };
}
function genTriangleArea(diff) {
  const [a, b] = diffRange(diff);
  let base = ri(a, b), h = ri(a, b);
  if ((base * h) % 2 !== 0) h += 1;
  const ans = (base * h) / 2;
  return {
    topic: 'area', key: 'tri-a',
    prompt: `مساحت مثلثی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.triangleBH(base, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت مثلث = (قاعده × ارتفاع) ÷ ۲`,
      `S = (${fa(base)} × ${fa(h)}) ÷ ۲ = ${fa(base * h)} ÷ ۲ = ${fa(ans)}`
    ]
  };
}
function genCircleArea(diff) {
  const [a, b] = diffRange(diff);
  const r = ri(a, Math.min(b, 10));
  const ans = round(3.14 * r * r, 2);
  return {
    topic: 'area', key: 'circ-a',
    prompt: `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`,
    shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت دایره = π × r²`,
      `S = ۳٫۱۴ × ${fa(r)}² = ۳٫۱۴ × ${fa(r * r)} = ${fa(ans)}`
    ]
  };
}
function genParallelogramArea(diff) {
  const [a, b] = diffRange(diff);
  const base = ri(a, b), h = ri(a, b);
  const ans = base * h;
  return {
    topic: 'area', key: 'para-a',
    prompt: `مساحت متوازی‌الاضلاعی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(base, 12, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت متوازی‌الاضلاع = قاعده × ارتفاع`,
      `S = ${fa(base)} × ${fa(h)} = ${fa(ans)}`
    ]
  };
}
function genRhombusArea(diff) {
  const [a, b] = diffRange(diff);
  let d1 = ri(a, b), d2 = ri(a, b);
  if ((d1 * d2) % 2 !== 0) d2 += 1;
  const ans = (d1 * d2) / 2;
  return {
    topic: 'area', key: 'rhom-a',
    prompt: `مساحت لوزی با قطرهای ${fa(d1)} و ${fa(d2)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombus(d1, d2),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲`,
      `S = (${fa(d1)} × ${fa(d2)}) ÷ ۲ = ${fa(ans)}`
    ]
  };
}
function genTrapezoidArea(diff) {
  const [a, b] = diffRange(diff);
  let base1 = ri(a, b), base2 = ri(a, b), h = ri(a, b);
  if (((base1 + base2) * h) % 2 !== 0) h += 1;
  const ans = ((base1 + base2) * h) / 2;
  return {
    topic: 'area', key: 'trap-a',
    prompt: `مساحت ذوزنقه‌ای با دو قاعده ${fa(base1)} و ${fa(base2)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.trapezoid(base1, base2, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲`,
      `S = ((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲ = ${fa(ans)}`
    ]
  };
}
function genCompositeArea(diff) {
  const [a, b] = diffRange(diff);
  const w1 = ri(a, b), h1 = ri(a, b), w2 = ri(a, b), h2 = ri(a, b);
  const ans = w1 * h1 + w2 * h2;
  return {
    topic: 'area', key: 'comp-a',
    prompt: `مساحت شکل ترکیبی زیر (مجموع دو مستطیل) چقدر است؟`,
    shape: Shapes.composite(w1, h1, w2, h2),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت کل = مساحت مستطیل اول + مساحت مستطیل دوم`,
      `S₁ = ${fa(w1)} × ${fa(h1)} = ${fa(w1 * h1)}`,
      `S₂ = ${fa(w2)} × ${fa(h2)} = ${fa(w2 * h2)}`,
      `S = ${fa(w1 * h1)} + ${fa(w2 * h2)} = ${fa(ans)}`
    ]
  };
}

/* --- کسرها --- */
function makeFracChoices(correct, genWrong, count = 3) {
  const opts = [correct];
  let attempts = 0;
  while (opts.length < count + 1 && attempts < 40) {
    attempts++;
    const w = genWrong();
    if (w && w.d != null && w.d !== 0 && !opts.some(o => fracEq(o, w)) && fracVal(w) >= 0) {
      opts.push(w);
    }
  }
  // اگر کمتر از ۴ گزینه شد، به‌زور اضافه کن
  while (opts.length < count + 1) {
    const nn = ri(1, 12), dd = ri(2, 12);
    const w = { n: nn, d: dd };
    if (!opts.some(o => fracEq(o, w))) opts.push(w);
  }
  return shuffle(opts);
}

function genFracAdd(diff) {
  const maxD = diff === 'easy' ? 6 : diff === 'hard' ? 12 : 8;
  const d1 = ri(2, maxD), d2 = ri(2, maxD);
  const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  const a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  const ans = fracAdd(a, b);
  const choices = makeFracChoices(ans, () => {
    const dd1 = ri(2, maxD), dd2 = ri(2, maxD);
    return fracAdd({ n: ri(1, dd1 - 1), d: dd1 }, { n: ri(1, dd2 - 1), d: dd2 });
  });
  return {
    topic: 'fractions', key: 'frac-add',
    prompt: `حاصل جمع مقابل کدام است؟`,
    promptHTML: `${fracHTML(a)} + ${fracHTML(b)} = ?`,
    type: 'choice', choices, correct: ans,
    steps: [
      `برای جمع، مخرج‌ها را مشترک می‌کنیم.`,
      `مخرج مشترک: ${fa(lcm(a.d, b.d))}`,
      `${fracHTML(a)} + ${fracHTML(b)} = ${fracHTML({ n: a.n * (lcm(a.d, b.d) / a.d), d: lcm(a.d, b.d) })} + ${fracHTML({ n: b.n * (lcm(a.d, b.d) / b.d), d: lcm(a.d, b.d) })}`,
      `= ${fracHTML(ans)}`
    ]
  };
}
function genFracSub(diff) {
  const maxD = diff === 'easy' ? 6 : diff === 'hard' ? 12 : 8;
  let d1 = ri(2, maxD), d2 = ri(2, maxD);
  let n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  let a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  if (fracVal(a) < fracVal(b)) [a, b] = [b, a];
  const ans = fracSub(a, b);
  const choices = makeFracChoices(ans, () => {
    const dd1 = ri(2, maxD), dd2 = ri(2, maxD);
    const f1 = { n: ri(1, dd1 - 1), d: dd1 }, f2 = { n: ri(1, dd2 - 1), d: dd2 };
    return fracVal(f1) > fracVal(f2) ? fracSub(f1, f2) : fracSub(f2, f1);
  });
  return {
    topic: 'fractions', key: 'frac-sub',
    prompt: `حاصل تفریق مقابل کدام است؟`,
    promptHTML: `${fracHTML(a)} − ${fracHTML(b)} = ?`,
    type: 'choice', choices, correct: ans,
    steps: [
      `مخرج مشترک: ${fa(lcm(a.d, b.d))}`,
      `${fracHTML(a)} − ${fracHTML(b)} = ${fracHTML(ans)}`
    ]
  };
}
function genFracMul(diff) {
  const maxD = diff === 'easy' ? 6 : diff === 'hard' ? 10 : 8;
  const a = { n: ri(1, 8), d: ri(2, maxD) };
  const b = { n: ri(1, 8), d: ri(2, maxD) };
  const ans = fracMul(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 12), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-mul',
    prompt: `حاصل ضرب کسرها کدام است؟`,
    promptHTML: `${fracHTML(a)} × ${fracHTML(b)} = ?`,
    type: 'choice', choices, correct: ans,
    steps: [
      `در ضرب کسرها، صورت‌ها در هم و مخرج‌ها در هم ضرب می‌شوند.`,
      `= ${fracHTML({ n: a.n * b.n, d: a.d * b.d })}`,
      `ساده‌شده: ${fracHTML(ans)}`
    ]
  };
}
function genFracDiv(diff) {
  const maxD = diff === 'easy' ? 6 : diff === 'hard' ? 10 : 8;
  const a = { n: ri(1, 8), d: ri(2, maxD) };
  const b = { n: ri(1, 8), d: ri(2, maxD) };
  const ans = fracDiv(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 12), d: ri(2, maxD) }));
  return {
    topic: 'fractions', key: 'frac-div',
    prompt: `حاصل تقسیم کسرها کدام است؟`,
    promptHTML: `${fracHTML(a)} ÷ ${fracHTML(b)} = ?`,
    type: 'choice', choices, correct: ans,
    steps: [
      `در تقسیم، کسر دوم را معکوس کرده و ضرب می‌کنیم.`,
      `${fracHTML(a)} ÷ ${fracHTML(b)} = ${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })}`,
      `= ${fracHTML(ans)}`
    ]
  };
}
function genFracSimplify(diff) {
  const base = { n: ri(2, 8), d: ri(2, 9) };
  const k = ri(2, 5);
  const a = { n: base.n * k, d: base.d * k };
  const ans = simplify(a.n, a.d);
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
function genFracCompare(diff) {
  let d1, d2, n1, n2, a, b, guard = 0;
  do {
    d1 = ri(3, 10); d2 = ri(3, 10);
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
      `با مخرج مشترک: ${fracHTML({ n: a.n * L / d1, d: L })} و ${fracHTML({ n: b.n * L / d2, d: L })}`,
      `${fracHTML(a)} ${correct === '>' ? '&gt;' : '&lt;'} ${fracHTML(b)}`
    ]
  };
}
function genFracToDecimal(diff) {
  const options = [
    { n: 1, d: 2, v: 0.5 }, { n: 1, d: 4, v: 0.25 }, { n: 3, d: 4, v: 0.75 },
    { n: 1, d: 5, v: 0.2 }, { n: 2, d: 5, v: 0.4 }, { n: 3, d: 5, v: 0.6 },
    { n: 1, d: 8, v: 0.125 }, { n: 1, d: 10, v: 0.1 }
  ];
  const f = pick(options);
  const wrongPool = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3);
  const choices = shuffle([
    { n: String(f.v), d: null, isNum: true },
    ...wrongPool.map(o => ({ n: String(o.v), d: null, isNum: true }))
  ]);
  return {
    topic: 'fractions', key: 'frac-dec',
    prompt: `کسر مقابل را به عدد اعشاری تبدیل کنید:`,
    promptHTML: fracHTML(f),
    type: 'choice', choices,
    correct: { n: String(f.v), d: null, isNum: true },
    steps: [
      `صورت را بر مخرج تقسیم می‌کنیم: ${fa(f.n)} ÷ ${fa(f.d)}`,
      `= ${fa(f.v)}`
    ]
  };
}
function genMixedToImproper(diff) {
  const whole = ri(1, 4), d = ri(2, 8), n = ri(1, d - 1);
  const imp = { n: whole * d + n, d };
  const choices = makeFracChoices(imp, () => ({ n: ri(2, 40), d: ri(2, 9) }));
  return {
    topic: 'fractions', key: 'mixed-imp',
    prompt: `عدد مخلوط زیر را به کسر تبدیل کنید:`,
    promptHTML: `${fa(whole)}${fracHTML({ n, d })}`,
    type: 'choice', choices, correct: imp,
    steps: [
      `صورت = (عدد صحیح × مخرج) + صورت`,
      `= (${fa(whole)} × ${fa(d)}) + ${fa(n)} = ${fa(whole * d + n)}`,
      `کسر: ${fracHTML(imp)}`
    ]
  };
}
function genWordFrac(diff) {
  const d = ri(3, 8);
  const n = ri(1, d - 1);
  const total = d * ri(2, 6);
  const ans = (total / d) * n;
  return {
    topic: 'fractions', key: 'frac-word',
    prompt: `علی ${fracHTML({ n, d })} از ${fa(total)} تومان پول خود را خرج کرد. چقدر خرج کرد؟`,
    type: 'numeric', answer: ans, unit: 'تومان',
    steps: [
      `ابتدا یک‌دانه از ${fa(d)} قسمت: ${fa(total)} ÷ ${fa(d)} = ${fa(total / d)}`,
      `حالا ${fa(n)} قسمت: ${fa(n)} × ${fa(total / d)} = ${fa(ans)} تومان`
    ]
  };
}

/* --- مخزن سوالات --- */
const Generators = {
  perimeter: [
    genSquarePerimeter, genRectPerimeter, genTrianglePerimeter,
    genCirclePerimeter, genParallelogramPerimeter, genRhombusPerimeter,
    genPolygonPerimeter, genFindSideFromPerimeter
  ],
  area: [
    genSquareArea, genRectArea, genTriangleArea, genCircleArea,
    genParallelogramArea, genRhombusArea, genTrapezoidArea, genCompositeArea
  ],
  fractions: [
    genFracAdd, genFracSub, genFracMul, genFracDiv,
    genFracSimplify, genFracCompare, genFracToDecimal,
    genMixedToImproper, genWordFrac
  ]
};

function generateQuestion(topic, difficulty) {
  const pool = Generators[topic];
  const gen = pick(pool);
  return gen(difficulty);
}

/* ============================================================
   ۷) گیمیفیکیشن
   ============================================================ */
const BADGES = [
  { id: 'first',    emoji: '🎯', name: 'اولین قدم',  desc: 'اولین سوال را درست پاسخ بده' },
  { id: 'streak5',  emoji: '🔥', name: '۵ تایی',     desc: '۵ پاسخ درست پشت‌سرهم' },
  { id: 'streak10', emoji: '⚡', name: '۱۰ تایی',     desc: '۱۰ پاسخ درست پشت‌سرهم' },
  { id: 'coin100',  emoji: '💰', name: 'پولدار',      desc: '۱۰۰ سکه جمع کن' },
  { id: 'star20',   emoji: '⭐', name: 'ستاره‌چین',   desc: '۲۰ ستاره بگیر' },
  { id: 'level5',   emoji: '🏅', name: 'سطح ۵',      desc: 'به سطح ۵ برس' },
  { id: 'master',   emoji: '🧠', name: 'استاد',      desc: '۲۰ پاسخ درست' },
  { id: 'perfect',  emoji: '💎', name: 'بی‌نقص',     desc: 'یک آزمون با نمره کامل' }
];

function awardCorrect(streak) {
  const base = 10;
  const bonus = Math.min(streak, 10) * 2;
  state.stats.xp += base + bonus;
  state.stats.coins += 1 + Math.floor(streak / 3);
  state.stats.stars += streak >= 3 ? 1 : 0;
  checkLevelUp();
  checkBadges();
  saveState();
}
function checkLevelUp() {
  const newLevel = Math.floor(state.stats.xp / 100) + 1;
  if (newLevel > state.stats.level) {
    state.stats.level = newLevel;
    sound.levelUp();
    showFloat(`🎉 تبریک! به سطح ${fa(newLevel)} رسیدی!`);
  }
}
function checkBadges() {
  const s = state.stats;
  const add = id => {
    if (!s.badges.includes(id)) {
      s.badges.push(id);
      showFloat('🏆 نشان جدید گرفتی!');
    }
  };
  if (s.totalCorrect >= 1) add('first');
  if (s.bestStreak >= 5) add('streak5');
  if (s.bestStreak >= 10) add('streak10');
  if (s.coins >= 100) add('coin100');
  if (s.stars >= 20) add('star20');
  if (s.level >= 5) add('level5');
  if (s.totalCorrect >= 20) add('master');
}
function showFloat(text) {
  const el = document.createElement('div');
  el.className = 'float-reward';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

/* ============================================================
   ۸) روتر و حالت
   ============================================================ */
let route = { name: 'home', params: {} };
let session = null;
let examTimer = null;

function navigate(name, params = {}) {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  route = { name, params };
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   ۹) قالب‌های عمومی
   ============================================================ */
const app = document.getElementById('app');

function header(title, showBack = false) {
  return `
  <div class="top-bar">
    ${showBack
      ? `<button class="icon-btn back-btn" onclick="window.__goBack()" aria-label="بازگشت">➜</button>`
      : `<span style="width:44px"></span>`}
    <h1>${title}</h1>
    <div class="chips">
      <span class="chip" title="سکه">🪙 ${fa(state.stats.coins)}</span>
      <span class="chip" title="ستاره">⭐ ${fa(state.stats.stars)}</span>
    </div>
  </div>`;
}

function bottomNav() {
  const items = [
    { id: 'home', ico: '🏠', label: 'خانه' },
    { id: 'perimeter', ico: '📏', label: 'محیط' },
    { id: 'area', ico: '📐', label: 'مساحت' },
    { id: 'fractions', ico: '🍰', label: 'کسر' },
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
   ۱۰) صفحات
   ============================================================ */
function viewHome() {
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
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="گزارش پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت من</h3>
      <p class="card-desc">نمودار و نشان‌ها</p>
    </button>
  </div>
  <div style="margin-top:14px" class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('teacher')" aria-label="حالت معلم">
      <span class="icon-big">👨‍🏫</span>
      <h3 class="card-title">معلم / والد</h3>
      <p class="card-desc">آزمون سفارشی</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('settings')" aria-label="تنظیمات">
      <span class="icon-big">⚙️</span>
      <h3 class="card-title">تنظیمات</h3>
      <p class="card-desc">صدا، سختی، پایه</p>
    </button>
  </div>
  ${bottomNav()}`;
}

function viewTopic(topic) {
  const titles = { perimeter: '📏 محیط', area: '📐 مساحت', fractions: '🍰 کسرها' };
  return `
  ${header(titles[topic], true)}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('learn', {topic:'${topic}'})" aria-label="آموزش">
      <span class="icon-big">📚</span>
      <h3 class="card-title">آموزش</h3>
      <p class="card-desc">درسنامه تعاملی و مثال</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('practice', {topic:'${topic}'})" aria-label="تمرین">
      <span class="icon-big">✏️</span>
      <h3 class="card-title">تمرین</h3>
      <p class="card-desc">سوال بی‌نهایت + پاداش</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('examSetup', {topic:'${topic}'})" aria-label="آزمون">
      <span class="icon-big">🎯</span>
      <h3 class="card-title">آزمون</h3>
      <p class="card-desc">با زمان‌سنج و کارنامه</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت</h3>
      <p class="card-desc">درصد تسلط شما</p>
    </button>
  </div>
  ${bottomNav()}`;
}

/* ---------- آموزش ---------- */
function fracVisual(n, d) {
  const W = 160, H = 160, cx = 80, cy = 80, r = 60;
  let paths = '';
  for (let i = 0; i < d; i++) {
    const a1 = (i / d) * 2 * Math.PI - Math.PI / 2;
    const a2 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    const fill = i < n ? '#a5b4fc' : '#e5e7eb';
    if (d === 1) {
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#4338ca" stroke-width="2"/>`;
    } else {
      paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="#4338ca" stroke-width="1.5"/>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="shape-svg" aria-hidden="true">${paths}</svg>`;
}

const LESSONS = {
  perimeter: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛',
      formula: 'P = ۴ × ضلع',
      desc: 'محیط مربع یعنی جمع طول چهار ضلع آن. چون همه ضلع‌های مربع برابرند، کافی است یک ضلع را در ۴ ضرب کنیم.',
      example: { shape: Shapes.square(5), text: 'مربعی با ضلع ۵ سانتی‌متر.', calc: 'P = ۴ × ۵ = ۲۰ سانتی‌متر' }
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭',
      formula: 'P = ۲ × (طول + عرض)',
      desc: 'در مستطیل ضلع‌های روبه‌رو با هم برابرند. پس محیط برابر است با دو برابر مجموع طول و عرض.',
      example: { shape: Shapes.rectangle(8, 4), text: 'مستطیلی با طول ۸ و عرض ۴.', calc: 'P = ۲ × (۸ + ۴) = ۲۴ سانتی‌متر' }
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺',
      formula: 'P = a + b + c',
      desc: 'محیط مثلث، مجموع سه ضلع آن است.',
      example: { shape: Shapes.triangle(6, 5, 4), text: 'مثلثی با اضلاع ۶، ۵ و ۴.', calc: 'P = ۶ + ۵ + ۴ = ۱۵ سانتی‌متر' }
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪',
      formula: 'C = ۲ × π × r',
      desc: 'محیط دایره را با شعاع و عدد π (تقریباً ۳٫۱۴) حساب می‌کنیم.',
      example: { shape: Shapes.circle(7), text: 'دایره‌ای با شعاع ۷.', calc: 'C = ۲ × ۳٫۱۴ × ۷ = ۴۳٫۹۶' }
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱',
      formula: 'P = ۲ × (a + b)',
      desc: 'ضلع‌های روبه‌رو برابرند؛ پس دو برابر مجموع دو ضلع مجاور.',
      example: { shape: Shapes.parallelogram(9, 6, 5), text: 'متوازی‌الاضلاعی با اضلاع ۹ و ۶.', calc: 'P = ۲ × (۹ + ۶) = ۳۰' }
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆',
      formula: 'P = ۴ × ضلع',
      desc: 'هر چهار ضلع لوزی برابرند.',
      example: { shape: Shapes.rhombus(8, 10), text: 'لوزی با ضلع ۶.', calc: 'P = ۴ × ۶ = ۲۴' }
    },
    {
      id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟',
      formula: 'P = n × ضلع',
      desc: 'در چندضلعی منتظم همه ضلع‌ها برابرند؛ پس محیط = تعداد ضلع × طول یک ضلع.',
      example: { shape: Shapes.regularPolygon(6, 5), text: 'شش‌ضلعی منتظم با ضلع ۵.', calc: 'P = ۶ × ۵ = ۳۰' }
    }
  ],
  area: [
    { id: 'sq', title: 'مربع', emoji: '⬛', formula: 'S = ضلع × ضلع = a²', desc: 'مساحت مربع برابر است با ضرب ضلع در خودش.', example: { shape: Shapes.square(6), text: 'ضلع = ۶', calc: 'S = ۶ × ۶ = ۳۶' } },
    { id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'S = طول × عرض', desc: 'مساحت مستطیل حاصل‌ضرب طول در عرض است.', example: { shape: Shapes.rectangle(7, 4), text: 'طول=۷، عرض=۴', calc: 'S = ۷ × ۴ = ۲۸' } },
    { id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'S = (قاعده × ارتفاع) ÷ ۲', desc: 'مساحت مثلث نصف حاصل‌ضرب قاعده در ارتفاع است.', example: { shape: Shapes.triangleBH(8, 5), text: 'قاعده=۸، ارتفاع=۵', calc: 'S = (۸ × ۵) ÷ ۲ = ۲۰' } },
    { id: 'circ', title: 'دایره', emoji: '⚪', formula: 'S = π × r²', desc: 'مساحت دایره برابر π ضرب‌در مربع شعاع است.', example: { shape: Shapes.circle(3), text: 'r=۳', calc: 'S = ۳٫۱۴ × ۹ = ۲۸٫۲۶' } },
    { id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'S = قاعده × ارتفاع', desc: 'مساحت متوازی‌الاضلاع حاصل‌ضرب قاعده در ارتفاع عمود بر آن است.', example: { shape: Shapes.parallelogram(6, 10, 4), text: 'قاعده=۶، ارتفاع=۴', calc: 'S = ۶ × ۴ = ۲۴' } },
    { id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'S = (d₁ × d₂) ÷ ۲', desc: 'مساحت لوزی نصف حاصل‌ضرب دو قطر آن است.', example: { shape: Shapes.rhombus(8, 6), text: 'قطرها ۸ و ۶', calc: 'S = (۸ × ۶) ÷ ۲ = ۲۴' } },
    { id: 'trap', title: 'ذوزنقه', emoji: '⏢', formula: 'S = ((a + b) × h) ÷ ۲', desc: 'مساحت ذوزنقه برابر است با نصف مجموع دو قاعده ضرب‌در ارتفاع.', example: { shape: Shapes.trapezoid(10, 6, 4), text: 'قاعده‌ها ۱۰ و ۶، ارتفاع ۴', calc: 'S = ((۱۰+۶) × ۴) ÷ ۲ = ۳۲' } }
  ],
  fractions: [
    { id: 'concept', title: 'مفهوم کسر', emoji: '🍕', formula: 'صورت / مخرج', desc: 'کسر یعنی چند قسمت از یک کل. مثلاً ۳/۴ یعنی ۳ قسمت از ۴ قسمت مساوی.', example: { html: fracVisual(3, 4) } },
    { id: 'equiv', title: 'کسر معادل', emoji: '🟰', formula: 'a/b = (a×k)/(b×k)', desc: 'اگر صورت و مخرج را در یک عدد ضرب یا تقسیم کنیم، مقدار کسر تغییر نمی‌کند.', example: { html: `${fracHTML({ n: 1, d: 2 })} = ${fracHTML({ n: 2, d: 4 })} = ${fracHTML({ n: 3, d: 6 })}` } },
    { id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️', formula: 'تقسیم بر ب.م.م', desc: 'صورت و مخرج را بر بزرگ‌ترین مقسوم‌علیه مشترک تقسیم می‌کنیم.', example: { html: `${fracHTML({ n: 6, d: 8 })} = ${fracHTML({ n: 3, d: 4 })}` } },
    { id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️', formula: 'مخرج مشترک', desc: 'برای مقایسه، مخرج‌ها را مشترک می‌کنیم یا از ضرب ضربدری استفاده می‌کنیم.', example: { html: `${fracHTML({ n: 2, d: 3 })} &gt; ${fracHTML({ n: 1, d: 2 })}` } },
    { id: 'add', title: 'جمع کسرها', emoji: '➕', formula: 'مخرج مشترک → جمع صورت‌ها', desc: 'ابتدا مخرج مشترک می‌گیریم، سپس صورت‌ها را جمع می‌کنیم.', example: { html: `${fracHTML({ n: 1, d: 3 })} + ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 7, d: 12 })}` } },
    { id: 'sub', title: 'تفریق کسرها', emoji: '➖', formula: 'مخرج مشترک → تفریق صورت‌ها', desc: 'مثل جمع، با مخرج مشترک.', example: { html: `${fracHTML({ n: 3, d: 4 })} − ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 1, d: 2 })}` } },
    { id: 'mul', title: 'ضرب کسرها', emoji: '✖️', formula: 'صورت×صورت / مخرج×مخرج', desc: 'در ضرب، نیاز به مخرج مشترک نیست.', example: { html: `${fracHTML({ n: 2, d: 3 })} × ${fracHTML({ n: 3, d: 5 })} = ${fracHTML({ n: 2, d: 5 })}` } },
    { id: 'div', title: 'تقسیم کسرها', emoji: '➗', formula: 'کسر دوم را معکوس و ضرب کن', desc: 'برای تقسیم، کسر دوم را برعکس کرده و ضرب می‌کنیم.', example: { html: `${fracHTML({ n: 1, d: 2 })} ÷ ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 2, d: 1 })}` } },
    { id: 'mixed', title: 'عدد مخلوط', emoji: '🔢', formula: 'a + b/c', desc: 'عدد مخلوط ترکیب یک عدد صحیح و یک کسر است. برای تبدیل به کسر: (a×c + b)/c', example: { html: `۲${fracHTML({ n: 1, d: 3 })} = ${fracHTML({ n: 7, d: 3 })}` } },
    { id: 'decimal', title: 'کسر و اعشار', emoji: '🔟', formula: 'صورت ÷ مخرج', desc: 'برای تبدیل کسر به اعشار، صورت را بر مخرج تقسیم می‌کنیم.', example: { html: `${fracHTML({ n: 3, d: 4 })} = ۰٫۷۵` } }
  ]
};

function viewLearn(topic) {
  const lessons = LESSONS[topic];
  return `
  ${header('📚 آموزش', true)}
  <p style="color:var(--muted);margin:0 0 14px">یک موضوع را انتخاب کن تا درسنامه و مثال ببینی:</p>
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
  let exampleHTML = '';
  if (lesson.example.shape) {
    exampleHTML = `
      <div class="card" style="margin-top:10px;background:#faf5ff">
        <strong>📌 مثال حل‌شده:</strong>
        <div class="q-shape">${lesson.example.shape}</div>
        <p>${lesson.example.text}</p>
        <div class="formula">${lesson.example.calc}</div>
      </div>`;
  } else if (lesson.example.html) {
    exampleHTML = `
      <div class="card" style="margin-top:10px;background:#faf5ff">
        <strong>📌 مثال:</strong>
        <div style="font-size:1.4rem;text-align:center;padding:14px">${lesson.example.html}</div>
      </div>`;
  }
  return `
  ${header(lesson.title, true)}
  <div class="card">
    <span class="icon-big">${lesson.emoji}</span>
    <h2 style="margin:6px 0">${lesson.title}</h2>
    <p style="line-height:1.9">${lesson.desc}</p>
    <div class="formula">${lesson.formula}</div>
  </div>
  ${exampleHTML}
  <button class="btn full" style="margin-top:16px" onclick="window.__nav('practice',{topic:'${topic}'})">
    ✏️ بریم تمرین کنیم!
  </button>
  ${bottomNav()}`;
}

/* ---------- تمرین ---------- */
function viewPractice(topic) {
  if (!session || session.mode !== 'practice' || session.topic !== topic) {
    startPractice(topic);
  }
  return renderPractice();
}

function startPractice(topic) {
  session = {
    mode: 'practice',
    topic,
    difficulty: state.settings.difficulty,
    index: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    current: null,
    answered: false,
    selected: null,
    inputValue: ''
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
  const topicNames = { perimeter: '📏 محیط', area: '📐 مساحت', fractions: '🍰 کسرها' };

  return `
  ${header(topicNames[session.topic], true)}
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

  <div class="answer-area" id="answerArea">
    ${renderAnswerInput(q)}
  </div>

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
    if (q.type === 'numeric') {
      return `<input class="num-input" value="${faSafe(session.inputValue)}" disabled aria-label="پاسخ تو">`;
    } else {
      return `<div class="choice-grid">${q.choices.map((c, i) => choiceHTML(c, i, q)).join('')}</div>`;
    }
  }
  if (q.type === 'numeric') {
    return `
      <div class="input-row">
        <input type="text" inputmode="decimal" class="num-input" id="numInput"
          placeholder="پاسخ (${q.unit || ''})" value="${faSafe(session.inputValue)}"
          aria-label="پاسخ عددی"
          oninput="window.__onInput(this.value)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();window.__submitOrNext();}">
      </div>
      <p style="color:var(--muted);font-size:.85rem;margin:0">💡 فقط عدد را وارد کن. ${q.unit ? `واحد: ${q.unit}` : ''}</p>`;
  } else {
    return `<div class="choice-grid">${q.choices.map((c, i) => choiceHTML(c, i, q)).join('')}</div>`;
  }
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
  } else if (session.selected && equalAnswer(session.selected, c)) {
    cls += ' selected';
  }
  return `<button class="${cls}" ${session.answered ? 'disabled' : ''} onclick="window.__selectChoice(${i})" aria-label="گزینه">${display}</button>`;
}

function equalAnswer(a, b) {
  if (!a || !b) return false;
  if (a.isSym || b.isSym) return a.isSym && b.isSym && a.n === b.n;
  if (a.isNum || b.isNum) return a.isNum && b.isNum && String(a.n) === String(b.n);
  if (a.n != null && b.n != null && a.d != null && b.d != null) return fracEq(a, b);
  return false;
}

/* ---------- بررسی پاسخ ---------- */
function submitAnswer() {
  const q = session.current;
  if (session.answered || !q) return;

  if (q.type === 'numeric') {
    const raw = en(session.inputValue).trim();
    const num = parseFloat(raw);
    if (isNaN(num)) {
      showWarnFeedback('❗ لطفاً یک عدد وارد کن.');
      return;
    }
    const correct = Math.abs(num - q.answer) < 0.01;
    finishQuestion(correct);
  } else {
    if (!session.selected) {
      showWarnFeedback('❗ یکی از گزینه‌ها را انتخاب کن.');
      return;
    }
    const correct = equalAnswer(session.selected, q.correct);
    finishQuestion(correct);
  }
}

function showWarnFeedback(msg) {
  const fb = document.getElementById('feedbackArea');
  if (!fb) return;
  fb.innerHTML = `<div class="feedback warn"><h4 style="margin:0">${msg}</h4></div>`;
  setTimeout(() => {
    if (fb.firstChild && fb.firstChild.classList && fb.firstChild.classList.contains('warn')) {
      fb.innerHTML = '';
    }
  }, 2200);
}

function finishQuestion(correct) {
  const q = session.current;
  session.answered = true;
  state.stats.totalQuestions++;
  state.progress[q.topic].attempts++;

  if (correct) {
    session.correct++;
    session.streak++;
    state.stats.totalCorrect++;
    if (session.streak > state.stats.bestStreak) state.stats.bestStreak = session.streak;
    state.progress[q.topic].correct++;
    awardCorrect(session.streak);
    sound.correct();
  } else {
    session.wrong++;
    session.streak = 0;
    const mk = q.topic + ':' + q.key;
    state.mistakes[mk] = (state.mistakes[mk] || 0) + 1;
    sound.wrong();
  }
  saveState();

  // بروزرسانی استایل ناحیه پاسخ
  const area = document.getElementById('answerArea');
  if (area) area.innerHTML = renderAnswerInput(q);

  // دکمه
  const btn = document.getElementById('actionBtn');
  if (btn) btn.textContent = '➡️ سوال بعدی';

  // نمایش بازخورد یک‌جا (بدون تکرار)
  const fb = document.getElementById('feedbackArea');
  if (fb) {
    const correctDisp = q.type === 'numeric'
      ? `${fa(q.answer)}${q.unit ? ' ' + q.unit : ''}`
      : displayAnswer(q.correct);

    const title = correct
      ? pick(['🎉 آفرین!', '✨ درست بود!', '💯 عالی!', '🌟 ادامه بده!'])
      : '❌ اشکالی نداره، ببین کجا اشتباه کردی:';

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
  } else if (session.mode === 'exam') {
    // در آزمون این مسیر استفاده نمی‌شود
    examNext();
  }
}

/* ---------- آزمون ---------- */
function viewExamSetup(topic) {
  return `
  ${header('🎯 آزمون', true)}
  <div class="card">
    <h3 class="card-title">تنظیمات آزمون</h3>
    <p>موضوع: <strong>${topic === 'perimeter' ? 'محیط' : topic === 'area' ? 'مساحت' : 'کسرها'}</strong></p>
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
  const countEl = document.getElementById('examCount');
  const timeEl = document.getElementById('examTime');
  const diffEl = document.getElementById('examDiff');
  const negEl = document.getElementById('examNeg');

  const count = parseInt(countEl.value, 10) || 10;
  const time = parseInt(timeEl.value, 10) || 300;
  const diff = diffEl.value || 'medium';
  const neg = negEl.checked;

  const questions = [];
  for (let i = 0; i < count; i++) questions.push(generateQuestion(topic, diff));

  session = {
    mode: 'exam', topic, difficulty: diff, questions,
    index: 0, current: questions[0], answers: [],
    answered: false, selected: null, inputValue: '',
    correct: 0, wrong: 0, negativeMark: neg,
    timeLeft: time, totalTime: time
  };

  navigate('exam');       // این خودش examTimer را پاک می‌کند
  startExamTimer();       // بعد از navigate تایمر را شروع می‌کنیم
}

function startExamTimer() {
  if (examTimer) clearInterval(examTimer);
  examTimer = setInterval(() => {
    if (!session || session.mode !== 'exam') {
      clearInterval(examTimer); examTimer = null; return;
    }
    session.timeLeft--;
    if (session.timeLeft <= 0) {
      clearInterval(examTimer); examTimer = null;
      alert('⏰ زمان آزمون به پایان رسید!');
      endExam();
      return;
    }
    // بروزرسانی سبک عنصر زمان
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
  if (!q) return `<div class="empty">خطا در بارگذاری سوال</div>`;

  const topicNames = { perimeter: 'محیط', area: 'مساحت', fractions: 'کسرها' };
  const min = Math.floor(session.timeLeft / 60);
  const sec = session.timeLeft % 60;
  const timeColor = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';

  return `
  ${header('🎯 آزمون ' + topicNames[session.topic])}
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

  <div class="answer-area">
    ${renderExamAnswerInput(q)}
  </div>

  <div style="margin-top:16px;display:flex;gap:8px">
    <button class="btn full" onclick="window.__examNext()">
      ${session.index + 1 >= session.questions.length ? '🏁 پایان آزمون' : '➡️ بعدی'}
    </button>
    <button class="btn danger" onclick="if(confirm('از آزمون خارج شوی؟')) window.__nav('home')">خروج</button>
  </div>
  ${bottomNav()}`;
}

function renderExamAnswerInput(q) {
  if (q.type === 'numeric') {
    return `
      <input type="text" inputmode="decimal" class="num-input" id="numInput"
        placeholder="پاسخ (${q.unit || ''})" value="${faSafe(session.inputValue || '')}"
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
    if (!isNaN(num)) {
      userAns = num;
      isCorrect = Math.abs(num - q.answer) < 0.01;
    }
  } else {
    if (session.selected) {
      userAns = session.selected;
      isCorrect = equalAnswer(session.selected, q.correct);
    }
  }

  session.answers.push({ q, userAns, isCorrect });
  if (isCorrect) session.correct++;
  else session.wrong++;

  state.stats.totalQuestions++;
  state.progress[q.topic].attempts++;
  if (isCorrect) {
    state.stats.totalCorrect++;
    state.progress[q.topic].correct++;
  } else {
    const mk = q.topic + ':' + q.key;
    state.mistakes[mk] = (state.mistakes[mk] || 0) + 1;
  }
  saveState();

  session.index++;
  if (session.index >= session.questions.length) {
    endExam();
  } else {
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
  const pct = Math.round((score / s.questions.length) * 100);

  state.history.unshift({
    date: Date.now(),
    topic: s.topic,
    score: pct,
    correct: s.correct,
    total: s.questions.length
  });
  if (state.history.length > 40) state.history.length = 40;

  if (pct === 100 && !state.stats.badges.includes('perfect')) {
    state.stats.badges.push('perfect');
    showFloat('💎 نشان بی‌نقص!');
  }
  saveState();
  sound.win();

  const payload = { pct, answers: s.answers, topic: s.topic };
  session = null;
  navigate('examResult', payload);
}

function viewExamResult() {
  const { pct, answers, topic } = route.params || {};
  if (!answers) return `<div class="empty">کارنامه‌ای موجود نیست</div>`;
  const correct = answers.filter(a => a.isCorrect).length;
  const wrong = answers.length - correct;
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '💪' : '📚';
  const msg = pct >= 80 ? 'فوق‌العاده بود!' : pct >= 60 ? 'خوب بود، ادامه بده!' : pct >= 40 ? 'باز هم تمرین کن!' : 'ناامید نشو، دوباره تلاش کن!';

  return `
  ${header('📋 کارنامه', true)}
  <div class="card" style="text-align:center">
    <div style="font-size:4rem;margin-bottom:8px">${emoji}</div>
    <h2 style="margin:0">${msg}</h2>
    <div style="font-size:2.5rem;font-weight:800;color:var(--primary);margin:12px 0">${fa(pct)}٪</div>
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
        ? `${fa(a.q.answer)}${a.q.unit ? ' ' + a.q.unit : ''}`
        : displayAnswer(a.q.correct);
      let userDisp = '';
      if (!a.isCorrect && a.userAns != null) {
        if (typeof a.userAns === 'number') userDisp = fa(a.userAns);
        else userDisp = displayAnswer(a.userAns);
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

/* ---------- پیشرفت ---------- */
function viewProgress() {
  const p = state.progress;
  const topics = [
    { key: 'perimeter', name: 'محیط', emoji: '📏' },
    { key: 'area', name: 'مساحت', emoji: '📐' },
    { key: 'fractions', name: 'کسرها', emoji: '🍰' }
  ];
  const totalQ = p.perimeter.attempts + p.area.attempts + p.fractions.attempts;
  const totalC = p.perimeter.correct + p.area.correct + p.fractions.correct;
  const overall = totalQ ? Math.round((totalC / totalQ) * 100) : 0;

  const mistakeList = Object.entries(state.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const names = {
    'sq-p': 'محیط مربع', 'rect-p': 'محیط مستطیل', 'tri-p': 'محیط مثلث', 'circ-p': 'محیط دایره',
    'para-p': 'محیط متوازی‌الاضلاع', 'rhom-p': 'محیط لوزی', 'poly-p': 'محیط چندضلعی', 'find-side': 'یافتن ضلع',
    'sq-a': 'مساحت مربع', 'rect-a': 'مساحت مستطیل', 'tri-a': 'مساحت مثلث', 'circ-a': 'مساحت دایره',
    'para-a': 'مساحت متوازی‌الاضلاع', 'rhom-a': 'مساحت لوزی', 'trap-a': 'مساحت ذوزنقه', 'comp-a': 'شکل ترکیبی',
    'frac-add': 'جمع کسر', 'frac-sub': 'تفریق کسر', 'frac-mul': 'ضرب کسر', 'frac-div': 'تقسیم کسر',
    'frac-simplify': 'ساده‌کردن', 'frac-cmp': 'مقایسه کسر', 'frac-dec': 'کسر→اعشار',
    'mixed-imp': 'مخلوط→کسر', 'frac-word': 'مسئله کلامی'
  };

  return `
  ${header('📊 پیشرفت من', true)}
  <div class="card">
    <div class="stats-row">
      <div class="stat-item"><div class="stat-value">${fa(state.stats.level)}</div><div class="stat-label">سطح</div></div>
      <div class="stat-item"><div class="stat-value">${fa(overall)}٪</div><div class="stat-label">تسلط کلی</div></div>
      <div class="stat-item"><div class="stat-value">${fa(state.stats.bestStreak)}</div><div class="stat-label">رکورد</div></div>
      <div class="stat-item"><div class="stat-value">${fa(totalC)}</div><div class="stat-label">پاسخ درست</div></div>
    </div>
  </div>

  <h3 style="margin:20px 0 10px">📈 تسلط در هر مبحث</h3>
  <div class="card">
    ${topics.map(t => {
      const tp = p[t.key];
      const pct = tp.attempts ? Math.round((tp.correct / tp.attempts) * 100) : 0;
      return `
      <div class="bar-row">
        <div class="lbl">${t.emoji} ${t.name}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%">${pct > 10 ? fa(pct) + '٪' : ''}</div></div>
        <div class="pct">${fa(pct)}٪</div>
      </div>`;
    }).join('')}
  </div>

  ${mistakeList.length ? `
  <h3 style="margin:20px 0 10px">🎯 نقاط ضعف (پرتکرار)</h3>
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
        <div class="badge ${state.stats.badges.includes(b.id) ? 'earned' : 'locked'}" title="${b.desc}">
          <span class="emoji">${b.emoji}</span>
          <span class="name">${b.name}</span>
        </div>`).join('')}
    </div>
  </div>

  <h3 style="margin:20px 0 10px">📜 تاریخچه آزمون‌ها</h3>
  <div class="card">
    ${state.history.length ? state.history.slice(0, 10).map(h => {
      const d = new Date(h.date);
      const dateStr = `${fa(d.getFullYear())}/${fa(d.getMonth() + 1)}/${fa(d.getDate())}`;
      const topicName = h.topic === 'perimeter' ? 'محیط' : h.topic === 'area' ? 'مساحت' : 'کسرها';
      const color = h.score >= 70 ? 'var(--success)' : h.score >= 40 ? 'var(--accent)' : 'var(--danger)';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border)">
        <span>${dateStr} — ${topicName}</span>
        <span style="font-weight:700;color:${color}">${fa(h.score)}٪</span>
      </div>`;
    }).join('') : '<p style="color:var(--muted);text-align:center">هنوز آزمونی نداده‌ای</p>'}
  </div>
  ${bottomNav()}`;
}

/* ---------- تنظیمات ---------- */
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
    <h3 class="card-title">🎚️ سطح دشواری پیش‌فرض</h3>
    <div class="pill-row">
      ${['easy', 'medium', 'hard'].map(d => `<button class="pill ${s.difficulty === d ? 'active' : ''}" onclick="window.__setSetting('difficulty','${d}')">${d === 'easy' ? 'آسان' : d === 'medium' ? 'متوسط' : 'سخت'}</button>`).join('')}
    </div>
  </div>

  <div class="card">
    <h3 class="card-title">🎓 پایه تحصیلی</h3>
    <div class="pill-row">
      ${[4, 5, 6, 7, 8, 9].map(g => `<button class="pill ${s.grade === g ? 'active' : ''}" onclick="window.__setSetting('grade',${g})">پایه ${fa(g)}</button>`).join('')}
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
    <h3 class="card-title">⚠️ منطقه خطر</h3>
    <p class="card-desc">همه داده‌های پیشرفت پاک می‌شوند.</p>
    <button class="btn danger full" style="margin-top:10px" onclick="window.__resetData()">🗑️ پاک کردن همه داده‌ها</button>
  </div>
  ${bottomNav()}`;
}

/* ---------- معلم / والد ---------- */
function viewTeacher() {
  return `
  ${header('👨‍🏫 حالت معلم / والد', true)}
  <div class="card">
    <h3 class="card-title">🎯 آزمون سفارشی</h3>
    <p class="card-desc">آزمون مخصوص برای دانش‌آموز بساز.</p>
    <label style="display:block;margin-top:12px">موضوع:
      <select id="tchTopic" class="num-input" style="text-align:right">
        <option value="perimeter">محیط</option>
        <option value="area">مساحت</option>
        <option value="fractions">کسرها</option>
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

  <div class="card">
    <h3 class="card-title">📊 خلاصه وضعیت</h3>
    <p>پایه: <strong>${fa(state.settings.grade)}</strong></p>
    <p>سطح: <strong>${fa(state.stats.level)}</strong></p>
    <p>پاسخ‌های درست: <strong>${fa(state.stats.totalCorrect)} / ${fa(state.stats.totalQuestions)}</strong></p>
    <p>تعداد آزمون‌ها: <strong>${fa(state.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها (JSON)</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۱۱) رندر اصلی
   ============================================================ */
function render() {
  document.body.classList.toggle('no-anim', !state.settings.animation);
  let html = '';
  switch (route.name) {
    case 'home': html = viewHome(); break;
    case 'perimeter':
    case 'area':
    case 'fractions': html = viewTopic(route.name); break;
    case 'learn': html = viewLearn(route.params.topic); break;
    case 'lesson': html = viewLesson(route.params.topic, route.params.id); break;
    case 'practice': html = viewPractice(route.params.topic); break;
    case 'examSetup': html = viewExamSetup(route.params.topic); break;
    case 'exam': html = viewExam(); break;
    case 'examResult': html = viewExamResult(); break;
    case 'progress': html = viewProgress(); break;
    case 'settings': html = viewSettings(); break;
    case 'teacher': html = viewTeacher(); break;
    default: html = viewHome();
  }
  app.innerHTML = html;
}

/* ============================================================
   ۱۲) توابع جهانی
   ============================================================ */
window.__nav = (name, params = {}) => {
  sound.click();
  navigate(name, params);
};

window.__goBack = () => {
  sound.click();
  if (route.name === 'home') return;
  if ((route.name === 'practice' || route.name === 'exam') && session) session = null;
  if (['perimeter', 'area', 'fractions'].includes(route.name)) navigate('home');
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
  const q = session.current;
  session.selected = q.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => {
    el.classList.toggle('selected', idx === i);
  });
};

window.__examSelect = (i) => {
  if (!session || session.mode !== 'exam') return;
  const q = session.current;
  session.selected = q.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => {
    el.classList.toggle('selected', idx === i);
  });
};

window.__submitOrNext = () => {
  if (!session) return;
  if (session.answered) nextQuestionAction();
  else submitAnswer();
};

window.__examNext = () => {
  if (!session || session.mode !== 'exam') return;
  examNext();
};

window.__startExam = (topic) => {
  sound.click();
  startExam(topic);
};

window.__setSetting = (key, val) => {
  state.settings[key] = val;
  saveState();
  if (key === 'animation') document.body.classList.toggle('no-anim', !val);
  render();
};

window.__resetData = () => {
  if (!confirm('همه داده‌ها پاک شوند؟ این کار قابل بازگشت نیست.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = deepClone(defaultState);
  saveState();
  showFloat('🗑️ داده‌ها پاک شد');
  navigate('home');
};

window.__teacherStartExam = () => {
  const topic = document.getElementById('tchTopic').value;
  const count = Math.max(1, Math.min(50, parseInt(document.getElementById('tchCount').value, 10) || 10));
  const timeMin = Math.max(1, Math.min(60, parseInt(document.getElementById('tchTime').value, 10) || 5));
  const time = timeMin * 60;
  const diff = document.getElementById('tchDiff').value;

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
   ۱۳) صفحه‌کلید
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && route.name !== 'home') window.__goBack();
});

/* ============================================================
   ۱۴) راه‌اندازی
   ============================================================ */
render();

})();