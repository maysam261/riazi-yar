/* =============================================================
   ریاضی‌یار — نسخه ۲
   اصلاحات:
   1) حذف حروف لاتین از فرمول‌ها
   2) تفکیک واقعی سطح دشواری
   3) اصلاح محل برچسب اضلاع
   4) تناسب مقیاس شکل ترکیبی
   5) حذف اطلاعات اضافی از سوالات
   6) بخش جدید اعشار
   ============================================================= */
(function () {
'use strict';

/* ============================================================
   ۱) STATE
   ============================================================ */
const STORAGE_KEY = 'riazi-yar-v1';

const defaultState = {
  settings: {
    sound: true,
    animation: true,
    difficulty: 'medium',
    questionCount: 10,
    examTime: 300,
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
    fractions: { attempts: 0, correct: 0 },
    decimals:  { attempts: 0, correct: 0 }
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
    console.warn('خطا در خواندن', e);
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
    .replace(/[،,]/g, '.')
    .replace(/[٫]/g, '.');
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

/* ============================================================
   ۳) SOUND
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
  wrong() { beep(220, .18, 'square', .06); },
  click() { beep(560, .05, 'triangle', .04); },
  win() { [660, 880, 1180].forEach((f, i) => setTimeout(() => beep(f, .16), i * 110)); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .2), i * 120)); }
};

/* ============================================================
   ۴) FRACTION HELPERS
   ============================================================ */
function simplify(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: 0, d: 1 };
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
function displayAnswer(a) {
  if (a == null) return '';
  if (typeof a === 'number') return faDec(a, 2);
  if (a.isSym) return a.n === '>' ? '&gt;' : a.n === '<' ? '&lt;' : escHtml(a.n);
  if (a.isNum) return faSafe(a.n);
  if (a.n != null && a.d != null) return fracHTML(a);
  return faSafe(a);
}

/* ============================================================
   ۵) SHAPES (اصلاح‌شده: محل برچسب‌ها + تناسب)
   ============================================================ */
const SC = {
  fill: '#c7d2fe', stroke: '#4338ca', fill2: '#a5b4fc',
  accent: '#fbbf24', text: '#312e81'
};

function svgWrap(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="shape-svg" role="img" aria-hidden="true">${inner}</svg>`;
}
function label(x, y, txt, anchor = 'middle', cls = 'svg-label') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" direction="rtl">${txt}</text>`;
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
      label(W / 2, H - 8, `ضلع = ${fa(side)}`, 'middle', 'svg-label-lg')
    );
  },
  rectangle(w, h) {
    const W = 240, H = 180;
    // مقیاس‌بندی بر اساس نسبت واقعی
    const maxW = 160, maxH = 110;
    const ratio = w / h;
    let rw = maxW, rh = rw / ratio;
    if (rh > maxH) { rh = maxH; rw = rh * ratio; }
    const x = (W - rw) / 2, y = (H - rh) / 2 - 6;
    return svgWrap(W, H, svgDefs +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="4"/>` +
      label(x + rw / 2, H - 8, `طول = ${fa(w)}`, 'middle', 'svg-label-lg') +
      label(x - 8, y + rh / 2 + 4, `عرض = ${fa(h)}`, 'end', 'svg-label-lg')
    );
  },
  triangle(a, b, c) {
    const W = 240, H = 180;
    const A = [120, 30];
    const B = [30, 150];
    const C = [210, 150];
    // وسط هر ضلع
    const midAB = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const midBC = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    const midCA = [(C[0] + A[0]) / 2, (C[1] + A[1]) / 2];
    return svgWrap(W, H, svgDefs +
      `<polygon points="${A.join(',')} ${B.join(',')} ${C.join(',')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label(midAB[0] - 12, midAB[1] + 4, fa(a), 'end') +
      label(midBC[0], midBC[1] + 22, fa(b), 'middle') +
      label(midCA[0] + 12, midCA[1] + 4, fa(c), 'start')
    );
  },
  triangleBH(b, h) {
    const W = 240, H = 180;
    const A = [120, 30], B = [30, 150], C = [210, 150];
    const midBC = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    const midBH = [(B[0] + A[0]) / 2 - 20, (B[1] + A[1]) / 2];
    return svgWrap(W, H, svgDefs +
      `<polygon points="${A.join(',')} ${B.join(',')} ${C.join(',')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="120" y1="30" x2="120" y2="150" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
      `<rect x="112" y="140" width="8" height="8" fill="none" stroke="${SC.accent}" stroke-width="1.5"/>` +
      label(120 + 8, 92, `ارتفاع = ${fa(h)}`, 'start') +
      label(midBC[0], midBC[1] + 22, `قاعده = ${fa(b)}`, 'middle')
    );
  },
  circle(r) {
    const W = 200, H = 180;
    return svgWrap(W, H, svgDefs +
      `<circle cx="${W / 2}" cy="${H / 2 - 8}" r="60" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3"/>` +
      `<line x1="${W / 2}" y1="${H / 2 - 8}" x2="${W / 2 + 60}" y2="${H / 2 - 8}" stroke="${SC.accent}" stroke-width="2.5"/>` +
      `<circle cx="${W / 2}" cy="${H / 2 - 8}" r="3" fill="${SC.stroke}"/>` +
      label(W / 2 + 30, H / 2 - 14, `شعاع = ${fa(r)}`)
    );
  },
  /* متوازی‌الاضلاع: برای محیط بدون ارتفاع؛ برای مساحت با ارتفاع */
  parallelogram(a, b, h = null) {
    const W = 240, H = 180;
    const showH = h != null;
    const heightLine = showH
      ? `<line x1="70" y1="40" x2="70" y2="150" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4"/>` +
        label(78, 95, `ارتفاع = ${fa(h)}`, 'start')
      : '';
    return svgWrap(W, H, svgDefs +
      `<polygon points="70,40 210,40 170,150 30,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      heightLine +
      label(120, 32, fa(a)) +
      label(200, 165, fa(b))
    );
  },
  /* لوزی از ضلع */
  rhombusSide(s) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="120,25 200,95 120,165 40,95" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      label(170, 55, `ضلع = ${fa(s)}`, 'start')
    );
  },
  /* لوزی از قطرها (برای مساحت) */
  rhombusD(d1, d2) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="120,25 210,95 120,165 30,95" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="30" y1="95" x2="210" y2="95" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="5 4"/>` +
      `<line x1="120" y1="25" x2="120" y2="165" stroke="${SC.accent}" stroke-width="1.8" stroke-dasharray="5 4"/>` +
      label(75, 88, `قطر۱ = ${fa(d1)}`) +
      label(128, 55, `قطر۲ = ${fa(d2)}`, 'start')
    );
  },
  trapezoid(a, b, h) {
    const W = 240, H = 180;
    return svgWrap(W, H, svgDefs +
      `<polygon points="80,40 180,40 210,150 30,150" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="130" y1="40" x2="130" y2="150" stroke="${SC.accent}" stroke-width="2" stroke-dasharray="5 4"/>` +
      label(130, 32, `قاعده کوچک = ${fa(b)}`) +
      label(120, 168, `قاعده بزرگ = ${fa(a)}`) +
      label(138, 100, `ارتفاع = ${fa(h)}`, 'start')
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
  /* شکل ترکیبی: مقیاس‌بندی متناسب */
  composite(w1, h1, w2, h2) {
    const W = 240, H = 220;
    const padX = 40, padY = 30;
    const availW = W - 2 * padX;
    const availH = H - 2 * padY;
    const maxW = Math.max(w1, w2);
    const totalH = h1 + h2;
    const scale = Math.min(availW / maxW, availH / totalH);
    const dw1 = w1 * scale, dh1 = h1 * scale;
    const dw2 = w2 * scale, dh2 = h2 * scale;
    const totalDrawH = dh1 + dh2;
    const startX = (W - maxW * scale) / 2;
    const startY = (H - totalDrawH) / 2 - 5;
    return svgWrap(W, H, svgDefs +
      `<rect x="${startX}" y="${startY}" width="${dw1}" height="${dh1}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3" rx="3"/>` +
      `<rect x="${startX}" y="${startY + dh1}" width="${dw2}" height="${dh2}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="3" rx="3"/>` +
      label(startX + dw1 / 2, startY - 6, `${fa(w1)} × ${fa(h1)}`) +
      label(startX + dw2 / 2, startY + totalDrawH + 18, `${fa(w2)} × ${fa(h2)}`)
    );
  }
};

/* ============================================================
   ۶) DIFFICULTY RANGES (واقعاً متفاوت)
   ============================================================ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 9];
  if (diff === 'hard') return [12, 40];
  return [5, 18]; // medium
}

/* ============================================================
   ۷) PERIMETER GENERATORS
   ============================================================ */
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
      `فرمول محیط مربع: محیط = ۴ × ضلع`,
      `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genSquarePerimeter.levels = ['easy', 'medium', 'hard'];

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
      `فرمول محیط مستطیل: محیط = ۲ × (طول + عرض)`,
      `محیط = ${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${eq(`۲ × ${fa(w + h)}`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genRectPerimeter.levels = ['easy', 'medium', 'hard'];

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
      `محیط = ${eq(`${fa(x)} + ${fa(y)} + ${fa(z)}`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genTrianglePerimeter.levels = ['easy', 'medium', 'hard'];

function genCirclePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const r = ri(a, Math.min(b, 12));
  const ans = round(2 * 3.14 * r, 2);
  return {
    topic: 'perimeter', key: 'circ-p',
    prompt: `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π ≈ ۳٫۱۴)`,
    shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `فرمول محیط دایره: محیط = ۲ × π × شعاع`,
      `محیط = ${eq(`۲ × ۳٫۱۴ × ${fa(r)}`)} = ${faDec(ans)} سانتی‌متر`
    ]
  };
}
genCirclePerimeter.levels = ['medium', 'hard'];

function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b);
  const ans = 2 * (x + y);
  return {
    topic: 'perimeter', key: 'para-p',
    prompt: `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(x, y),   // بدون ارتفاع
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `در متوازی‌الاضلاع، اضلاع روبه‌رو با هم مساوی‌اند.`,
      `محیط = ۲ × (ضلع بزرگ + ضلع کوچک)`,
      `محیط = ${eq(`۲ × (${fa(x)} + ${fa(y)})`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genParallelogramPerimeter.levels = ['medium', 'hard'];

function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b);
  const ans = 4 * s;
  return {
    topic: 'perimeter', key: 'rhom-p',
    prompt: `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombusSide(s),   // بدون قطرها
    type: 'numeric', answer: ans, unit: 'سانتی‌متر',
    steps: [
      `هر چهار ضلع لوزی با هم مساوی‌اند.`,
      `محیط = ۴ × ضلع`,
      `محیط = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genRhombusPerimeter.levels = ['medium', 'hard'];

function genPolygonPerimeter(diff) {
  const ns = diff === 'easy' ? [3, 4] : diff === 'medium' ? [3, 4, 5, 6] : [5, 6, 8];
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
      `در چندضلعی منتظم همه اضلاع مساوی‌اند.`,
      `محیط = تعداد ضلع × طول یک ضلع`,
      `محیط = ${eq(`${fa(n)} × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر`
    ]
  };
}
genPolygonPerimeter.levels = ['medium', 'hard'];

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
      `می‌دانیم: محیط = ۴ × ضلع`,
      `پس: ضلع = محیط ÷ ۴`,
      `ضلع = ${eq(`${fa(p)} ÷ ۴`)} = ${fa(s)} سانتی‌متر`
    ]
  };
}
genFindSideFromPerimeter.levels = ['medium', 'hard'];

/* ============================================================
   ۸) AREA GENERATORS
   ============================================================ */
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
      `فرمول مساحت مربع: مساحت = ضلع × ضلع`,
      `مساحت = ${eq(`${fa(s)} × ${fa(s)}`)} = ${fa(ans)} سانتی‌متر مربع`
    ]
  };
}
genSquareArea.levels = ['easy', 'medium', 'hard'];

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
      `فرمول مساحت مستطیل: مساحت = طول × عرض`,
      `مساحت = ${eq(`${fa(w)} × ${fa(h)}`)} = ${fa(ans)} سانتی‌متر مربع`
    ]
  };
}
genRectArea.levels = ['easy', 'medium', 'hard'];

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
      `فرمول: مساحت = (قاعده × ارتفاع) ÷ ۲`,
      `مساحت = ${eq(`(${fa(base)} × ${fa(h)}) ÷ ۲`)} = ${eq(`${fa(base * h)} ÷ ۲`)} = ${fa(ans)}`
    ]
  };
}
genTriangleArea.levels = ['medium', 'hard'];

function genCircleArea(diff) {
  const [a, b] = diffRange(diff);
  const r = ri(a, Math.min(b, 10));
  const ans = round(3.14 * r * r, 2);
  return {
    topic: 'area', key: 'circ-a',
    prompt: `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π ≈ ۳٫۱۴)`,
    shape: Shapes.circle(r),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `فرمول: مساحت = π × شعاع²`,
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
    shape: Shapes.parallelogram(base, 12, h),  // با ارتفاع
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت متوازی‌الاضلاع = قاعده × ارتفاع`,
      `مساحت = ${eq(`${fa(base)} × ${fa(h)}`)} = ${fa(ans)}`
    ]
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
    shape: Shapes.rhombusD(d1, d2),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲`,
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
    shape: Shapes.trapezoid(base1, base2, h),
    type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع',
    steps: [
      `مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲`,
      `مساحت = ${eq(`((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`
    ]
  };
}
genTrapezoidArea.levels = ['hard'];

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
      `مساحت۱ = ${eq(`${fa(w1)} × ${fa(h1)}`)} = ${fa(w1 * h1)}`,
      `مساحت۲ = ${eq(`${fa(w2)} × ${fa(h2)}`)} = ${fa(w2 * h2)}`,
      `مساحت کل = ${eq(`${fa(w1 * h1)} + ${fa(w2 * h2)}`)} = ${fa(ans)}`
    ]
  };
}
genCompositeArea.levels = ['hard'];

/* ============================================================
   ۹) FRACTIONS GENERATORS
   ============================================================ */
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
  if (sameDen) { d1 = d2 = ri(3, maxD); }
  else { d1 = ri(2, maxD); d2 = ri(2, maxD); }
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
    steps: [
      sameDen ? `مخرج‌ها مساوی‌اند؛ فقط صورت‌ها را جمع می‌کنیم.` : `ابتدا مخرج‌ها را مشترک می‌کنیم.`,
      sameDen ? `${eq(`${fa(n1)} + ${fa(n2)}`)} = ${fa(n1 + n2)} — حاصل ${fracHTML(ans)}` :
                `مخرج مشترک: ${fa(L)}`,
      sameDen ? `نتیجه: ${fracHTML(ans)}` :
                `${fracHTML(a)} + ${fracHTML(b)} = ${eq(`${fracHTML({ n: a.n * L / a.d, d: L })} + ${fracHTML({ n: b.n * L / b.d, d: L })}`)} = ${fracHTML(ans)}`
    ].filter(Boolean)
  };
}
genFracAdd.levels = ['easy', 'medium', 'hard'];

function genFracSub(diff) {
  const sameDen = diff === 'easy';
  const maxD = diff === 'hard' ? 12 : 8;
  let d1, d2;
  if (sameDen) { d1 = d2 = ri(3, maxD); }
  else { d1 = ri(2, maxD); d2 = ri(2, maxD); }
  let n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  let a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  if (sameDen) {
    if (n1 < n2) { [n1, n2] = [n2, n1]; a = { n: n1, d: d1 }; b = { n: n2, d: d2 }; }
  } else {
    if (fracVal(a) < fracVal(b)) [a, b] = [b, a];
  }
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
      `مخرج‌ها مساوی‌اند؛ فقط صورت‌ها را کم می‌کنیم.`,
      `${eq(`${fa(a.n)} − ${fa(b.n)}`)} = ${fa(a.n - b.n)} — حاصل ${fracHTML(ans)}`
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
      `در ضرب، صورت‌ها در هم و مخرج‌ها در هم ضرب می‌شوند.`,
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
      `در تقسیم، کسر دوم را معکوس کرده و ضرب می‌کنیم.`,
      `${fracHTML(a)} ÷ ${fracHTML(b)} = ${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })}`,
      `= ${fracHTML(ans)}`
    ]
  };
}
genFracDiv.levels = ['hard'];

function genFracSimplify(diff) {
  const base = { n: ri(2, 8), d: ri(2, 9) };
  const k = diff === 'hard' ? ri(3, 6) : ri(2, 4);
  const a = { n: base.n * k, d: base.d * k };
  const ans = simplify(a.n, a.d);
  if (ans.n === a.n && ans.d === a.d) {
    // قابل ساده شدن نبود، دوباره تلاش کن
    return genFracSimplify(diff);
  }
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
      `صورت = (عدد صحیح × مخرج) + صورت`,
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
  return {
    topic: 'fractions', key: 'frac-word',
    prompt: `علی ${fracHTML({ n, d })} از ${fa(total)} تومان پول خود را خرج کرد. چقدر خرج کرد؟`,
    type: 'numeric', answer: ans, unit: 'تومان',
    steps: [
      `ابتدا یک قسمت از ${fa(d)}: ${eq(`${fa(total)} ÷ ${fa(d)}`)} = ${fa(total / d)}`,
      `حالا ${fa(n)} قسمت: ${eq(`${fa(n)} × ${fa(total / d)}`)} = ${fa(ans)} تومان`
    ]
  };
}
genWordFrac.levels = ['hard'];

/* ============================================================
   ۱۰) DECIMALS GENERATORS (جدید)
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
      `اعداد را زیر هم می‌نویسیم و ممیزها را تراز می‌کنیم.`,
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
      `اعداد را زیر هم می‌نویسیم و ممیزها را تراز می‌کنیم.`,
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
      `عدد اعشاری را در عدد صحیح ضرب می‌کنیم (بدون ممیز).`,
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
      `عدد اعشاری را بر عدد صحیح تقسیم می‌کنیم.`,
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
      `ابتدا قسمت صحیح را مقایسه می‌کنیم، اگر مساوی بود رقم‌های اعشار را از چپ به راست مقایسه می‌کنیم.`,
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
  const pool = diff === 'easy' ? options.filter(o => o.v === 0.5 || o.v === 0.25 || o.v === 0.2 || o.v === 0.4) : options;
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
    type: 'choice', choices,
    correct: { n: String(f.v), d: null, isNum: true },
    steps: [
      `صورت را بر مخرج تقسیم می‌کنیم:`,
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
  const pool = diff === 'easy' ? options.filter(o => o.v === '0.5' || o.v === '0.1' || o.v === '0.3' || o.v === '0.7' || o.v === '0.9') : options;
  const f = pick(pool);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3).map(o => ({ n: o.n, d: o.d }));
  const choices = shuffle([{ n: f.n, d: f.d }, ...wrong]);
  return {
    topic: 'decimals', key: 'dec-frac',
    prompt: `عدد اعشاری مقابل را به کسر تبدیل کنید:`,
    promptHTML: eq(faDec(f.v, 3)),
    type: 'choice', choices,
    correct: { n: f.n, d: f.d },
    steps: [
      `به‌جای ممیز، مخرج را بر اساس تعداد رقم‌های اعشار می‌نویسیم (یک رقم: ۱۰، دو رقم: ۱۰۰).`,
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
      `برای چند برابر، ضرب می‌کنیم.`,
      `${eq(`${faDec(price, 1)} × ${fa(whole)}`)} = ${faDec(ans, 1)} هزار تومان`
    ]
  };
}
genDecWord.levels = ['hard'];

/* ============================================================
   ۱۱) GENERATOR POOL
   ============================================================ */
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
    genFracSimplify, genFracCompare, genMixedToImproper, genWordFrac
  ],
  decimals: [
    genDecAdd, genDecSub, genDecMul, genDecDiv,
    genDecCompare, genFracToDec, genDecToFrac, genDecWord
  ]
};

function generateQuestion(topic, difficulty) {
  const all = Generators[topic] || [];
  let pool = all.filter(g => g.levels && g.levels.includes(difficulty));
  if (!pool.length) pool = all;
  const gen = pick(pool);
  return gen(difficulty);
}

/* ============================================================
   ۱۲) GAMIFICATION
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
  state.stats.xp += 10 + Math.min(streak, 10) * 2;
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
    if (!s.badges.includes(id)) { s.badges.push(id); showFloat('🏆 نشان جدید گرفتی!'); }
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
   ۱۳) ROUTER
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
   ۱۴) COMMON TEMPLATES
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
   ۱۵) VIEWS — HOME
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
    <button class="card card-btn" onclick="window.__nav('decimals')" aria-label="اعداد اعشاری">
      <span class="icon-big">🔢</span>
      <h3 class="card-title">اعداد اعشاری</h3>
      <p class="card-desc">مفهوم، عملیات و تبدیل</p>
    </button>
  </div>
  <div style="margin-top:14px" class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('progress')" aria-label="گزارش پیشرفت">
      <span class="icon-big">📊</span>
      <h3 class="card-title">پیشرفت من</h3>
      <p class="card-desc">نمودار و نشان‌ها</p>
    </button>
    <button class="card card-btn" onclick="window.__nav('teacher')" aria-label="حالت معلم">
      <span class="icon-big">👨‍🏫</span>
      <h3 class="card-title">معلم / والد</h3>
      <p class="card-desc">آزمون سفارشی</p>
    </button>
  </div>
  <div style="margin-top:14px">
    <button class="card card-btn full" style="width:100%" onclick="window.__nav('settings')" aria-label="تنظیمات">
      <span class="icon-big">⚙️</span>
      <h3 class="card-title">تنظیمات</h3>
      <p class="card-desc">صدا، سختی، پایه</p>
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
      <p class="card-desc">درسنامه تعاملی</p>
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
   ۱۶) LEARN
   ============================================================ */
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
    { id: 'sq', title: 'مربع', emoji: '⬛', formula: 'محیط = ۴ × ضلع', desc: 'محیط مربع یعنی جمع طول چهار ضلع آن. چون همه ضلع‌های مربع برابرند، کافی است یک ضلع را در ۴ ضرب کنیم.', example: { shape: Shapes.square(5), text: 'مربعی با ضلع ۵ سانتی‌متر.', calc: 'محیط = ۴ × ۵ = ۲۰ سانتی‌متر' } },
    { id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'محیط = ۲ × (طول + عرض)', desc: 'در مستطیل ضلع‌های روبه‌رو با هم برابرند. پس محیط برابر است با دو برابر مجموع طول و عرض.', example: { shape: Shapes.rectangle(8, 4), text: 'مستطیلی با طول ۸ و عرض ۴.', calc: 'محیط = ۲ × (۸ + ۴) = ۲۴ سانتی‌متر' } },
    { id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'محیط = ضلع۱ + ضلع۲ + ضلع۳', desc: 'محیط مثلث، مجموع سه ضلع آن است.', example: { shape: Shapes.triangle(6, 5, 4), text: 'مثلثی با اضلاع ۶، ۵ و ۴.', calc: 'محیط = ۶ + ۵ + ۴ = ۱۵ سانتی‌متر' } },
    { id: 'circ', title: 'دایره', emoji: '⚪', formula: 'محیط = ۲ × π × شعاع', desc: 'محیط دایره را با شعاع و عدد π (تقریباً ۳٫۱۴) حساب می‌کنیم.', example: { shape: Shapes.circle(7), text: 'دایره‌ای با شعاع ۷.', calc: 'محیط = ۲ × ۳٫۱۴ × ۷ = ۴۳٫۹۶' } },
    { id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'محیط = ۲ × (ضلع بزرگ + ضلع کوچک)', desc: 'ضلع‌های روبه‌رو برابرند؛ پس دو برابر مجموع دو ضلع مجاور.', example: { shape: Shapes.parallelogram(9, 6), text: 'متوازی‌الاضلاعی با اضلاع ۹ و ۶.', calc: 'محیط = ۲ × (۹ + ۶) = ۳۰' } },
    { id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'محیط = ۴ × ضلع', desc: 'هر چهار ضلع لوزی برابرند.', example: { shape: Shapes.rhombusSide(6), text: 'لوزی با ضلع ۶.', calc: 'محیط = ۴ × ۶ = ۲۴' } },
    { id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟', formula: 'محیط = تعداد ضلع × طول ضلع', desc: 'در چندضلعی منتظم همه ضلع‌ها برابرند.', example: { shape: Shapes.regularPolygon(6, 5), text: 'شش‌ضلعی منتظم با ضلع ۵.', calc: 'محیط = ۶ × ۵ = ۳۰' } }
  ],
  area: [
    { id: 'sq', title: 'مربع', emoji: '⬛', formula: 'مساحت = ضلع × ضلع', desc: 'مساحت مربع برابر است با ضرب ضلع در خودش.', example: { shape: Shapes.square(6), text: 'ضلع = ۶', calc: 'مساحت = ۶ × ۶ = ۳۶' } },
    { id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'مساحت = طول × عرض', desc: 'مساحت مستطیل حاصل‌ضرب طول در عرض است.', example: { shape: Shapes.rectangle(7, 4), text: 'طول=۷، عرض=۴', calc: 'مساحت = ۷ × ۴ = ۲۸' } },
    { id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'مساحت = (قاعده × ارتفاع) ÷ ۲', desc: 'مساحت مثلث نصف حاصل‌ضرب قاعده در ارتفاع است.', example: { shape: Shapes.triangleBH(8, 5), text: 'قاعده=۸، ارتفاع=۵', calc: 'مساحت = (۸ × ۵) ÷ ۲ = ۲۰' } },
    { id: 'circ', title: 'دایره', emoji: '⚪', formula: 'مساحت = π × شعاع²', desc: 'مساحت دایره برابر π ضرب‌در مربع شعاع است.', example: { shape: Shapes.circle(3), text: 'شعاع = ۳', calc: 'مساحت = ۳٫۱۴ × ۹ = ۲۸٫۲۶' } },
    { id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'مساحت = قاعده × ارتفاع', desc: 'مساحت متوازی‌الاضلاع حاصل‌ضرب قاعده در ارتفاع است.', example: { shape: Shapes.parallelogram(6, 10, 4), text: 'قاعده=۶، ارتفاع=۴', calc: 'مساحت = ۶ × ۴ = ۲۴' } },
    { id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'مساحت = (قطر۱ × قطر۲) ÷ ۲', desc: 'مساحت لوزی نصف حاصل‌ضرب دو قطر آن است.', example: { shape: Shapes.rhombusD(8, 6), text: 'قطرها ۸ و ۶', calc: 'مساحت = (۸ × ۶) ÷ ۲ = ۲۴' } },
    { id: 'trap', title: 'ذوزنقه', emoji: '⏢', formula: 'مساحت = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲', desc: 'مساحت ذوزنقه برابر است با نصف مجموع دو قاعده ضرب‌در ارتفاع.', example: { shape: Shapes.trapezoid(10, 6, 4), text: 'قاعده‌ها ۱۰ و ۶، ارتفاع ۴', calc: 'مساحت = ((۱۰+۶) × ۴) ÷ ۲ = ۳۲' } }
  ],
  fractions: [
    { id: 'concept', title: 'مفهوم کسر', emoji: '🍕', formula: 'صورت / مخرج', desc: 'کسر یعنی چند قسمت از یک کل. مثلاً ۳/۴ یعنی ۳ قسمت از ۴ قسمت مساوی.', example: { html: fracVisual(3, 4) } },
    { id: 'equiv', title: 'کسر معادل', emoji: '🟰', formula: 'کسر = (صورت×k) / (مخرج×k)', desc: 'اگر صورت و مخرج را در یک عدد ضرب یا تقسیم کنیم، مقدار کسر تغییر نمی‌کند.', example: { html: `${fracHTML({ n: 1, d: 2 })} = ${fracHTML({ n: 2, d: 4 })} = ${fracHTML({ n: 3, d: 6 })}` } },
    { id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️', formula: 'تقسیم بر ب.م.م', desc: 'صورت و مخرج را بر بزرگ‌ترین مقسوم‌علیه مشترک تقسیم می‌کنیم.', example: { html: `${fracHTML({ n: 6, d: 8 })} = ${fracHTML({ n: 3, d: 4 })}` } },
    { id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️', formula: 'مخرج مشترک', desc: 'برای مقایسه، مخرج‌ها را مشترک می‌کنیم.', example: { html: `${fracHTML({ n: 2, d: 3 })} &gt; ${fracHTML({ n: 1, d: 2 })}` } },
    { id: 'add', title: 'جمع کسرها', emoji: '➕', formula: 'مخرج مشترک → جمع صورت‌ها', desc: 'ابتدا مخرج مشترک می‌گیریم، سپس صورت‌ها را جمع می‌کنیم.', example: { html: `${fracHTML({ n: 1, d: 3 })} + ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 7, d: 12 })}` } },
    { id: 'sub', title: 'تفریق کسرها', emoji: '➖', formula: 'مخرج مشترک → تفریق صورت‌ها', desc: 'مثل جمع، با مخرج مشترک.', example: { html: `${fracHTML({ n: 3, d: 4 })} − ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 1, d: 2 })}` } },
    { id: 'mul', title: 'ضرب کسرها', emoji: '✖️', formula: '(صورت×صورت) / (مخرج×مخرج)', desc: 'در ضرب، نیازی به مخرج مشترک نیست.', example: { html: `${fracHTML({ n: 2, d: 3 })} × ${fracHTML({ n: 3, d: 5 })} = ${fracHTML({ n: 2, d: 5 })}` } },
    { id: 'div', title: 'تقسیم کسرها', emoji: '➗', formula: 'کسر دوم را معکوس و ضرب کن', desc: 'برای تقسیم، کسر دوم را برعکس کرده و ضرب می‌کنیم.', example: { html: `${fracHTML({ n: 1, d: 2 })} ÷ ${fracHTML({ n: 1, d: 4 })} = ${fracHTML({ n: 2, d: 1 })}` } },
    { id: 'mixed', title: 'عدد مخلوط', emoji: '🔢', formula: 'عدد صحیح + کسر', desc: 'عدد مخلوط ترکیب یک عدد صحیح و یک کسر است. برای تبدیل به کسر: (عدد صحیح × مخرج) + صورت', example: { html: `۲${fracHTML({ n: 1, d: 3 })} = ${fracHTML({ n: 7, d: 3 })}` } }
  ],
  decimals: [
    { id: 'concept', title: 'مفهوم اعشار', emoji: '🔟', formula: 'یک‌دهم، صدم، هزارم', desc: 'اعداد اعشاری برای نمایش قسمت‌های کمتر از یک استفاده می‌شوند. مثلاً ۰٫۵ یعنی نیم، و ۰٫۲۵ یعنی یک‌چهارم.', example: { html: `${eq('۰٫۵ = ')} ${fracHTML({ n: 1, d: 2 })}` } },
    { id: 'place', title: 'ارزش مکانی', emoji: '📍', formula: 'یکان ، دهم ، صدم', desc: 'در عدد ۳٫۴۵، رقم ۳ در جای یکان، ۴ در جای دهم و ۵ در جای صدم قرار دارد.', example: { html: `<span style="font-size:1.6rem">۳ <span style="color:#7c3aed">٫</span> <span style="color:#dc2626">۴</span> <span style="color:#059669">۵</span></span>` } },
    { id: 'compare', title: 'مقایسه اعشار', emoji: '⚖️', formula: 'مقایسه رقم به رقم', desc: 'ابتدا قسمت صحیح را مقایسه می‌کنیم، سپس رقم‌های اعشار را از چپ به راست.', example: { html: `${eq('۰٫۷ &gt; ۰٫۵')}` } },
    { id: 'add', title: 'جمع اعشار', emoji: '➕', formula: 'ممیزها زیر هم', desc: 'اعداد را طوری زیر هم می‌نویسیم که ممیزها دقیقاً زیر هم باشند.', example: { html: `${eq('۳٫۴ + ۲٫۱ = ۵٫۵')}` } },
    { id: 'sub', title: 'تفریق اعشار', emoji: '➖', formula: 'ممیزها زیر هم', desc: 'مثل جمع، با تراز کردن ممیزها.', example: { html: `${eq('۵٫۵ − ۲٫۱ = ۳٫۴')}` } },
    { id: 'mul', title: 'ضرب اعشار', emoji: '✖️', formula: 'ضرب بدون ممیز، سپس ممیز', desc: 'اعداد را بدون ممیز ضرب می‌کنیم و در نهایت به تعداد مجموع ارقام اعشار، از راست ممیز می‌گذاریم.', example: { html: `${eq('۰٫۵ × ۳ = ۱٫۵')}` } },
    { id: 'div', title: 'تقسیم اعشار', emoji: '➗', formula: 'حذف ممیز مقسوم‌علیه', desc: 'اگر مقسوم‌علیه اعشاری بود، ممیز را حذف می‌کنیم و ممیز مقسوم را به همان تعداد جابجا می‌کنیم.', example: { html: `${eq('۱٫۵ ÷ ۳ = ۰٫۵')}` } },
    { id: 'frac-to-dec', title: 'کسر ← اعشار', emoji: '🔄', formula: 'صورت ÷ مخرج', desc: 'برای تبدیل کسر به اعشار، صورت را بر مخرج تقسیم می‌کنیم.', example: { html: `${fracHTML({ n: 3, d: 4 })} = ${eq('۰٫۷۵')}` } },
    { id: 'dec-to-frac', title: 'اعشار ← کسر', emoji: '🔄', formula: 'حذف ممیز / توان ۱۰', desc: 'به‌جای ممیز، مخرج را ۱۰ یا ۱۰۰ یا ۱۰۰۰ می‌گذاریم.', example: { html: `${eq('۰٫۷۵')} = ${fracHTML({ n: 75, d: 100 })} = ${fracHTML({ n: 3, d: 4 })}` } }
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

/* ============================================================
   ۱۷) PRACTICE
   ============================================================ */
function viewPractice(topic) {
  if (!session || session.mode !== 'practice' || session.topic !== topic) {
    startPractice(topic);
  }
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
  const topicNames = { perimeter: '📏 محیط', area: '📐 مساحت', fractions: '🍰 کسرها', decimals: '🔢 اعشار' };

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
    if (q.type === 'numeric') {
      return `<input class="num-input" value="${faSafe(session.inputValue)}" disabled aria-label="پاسخ تو">`;
    }
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

function submitAnswer() {
  const q = session.current;
  if (session.answered || !q) return;

  if (q.type === 'numeric') {
    const raw = en(session.inputValue).trim();
    const num = parseFloat(raw);
    if (isNaN(num)) { showWarnFeedback('❗ لطفاً یک عدد وارد کن.'); return; }
    const correct = Math.abs(num - q.answer) < 0.01;
    finishQuestion(correct);
  } else {
    if (!session.selected) { showWarnFeedback('❗ یکی از گزینه‌ها را انتخاب کن.'); return; }
    const correct = equalAnswer(session.selected, q.correct);
    finishQuestion(correct);
  }
}

function showWarnFeedback(msg) {
  const fb = document.getElementById('feedbackArea');
  if (!fb) return;
  fb.innerHTML = `<div class="feedback warn"><h4 style="margin:0">${msg}</h4></div>`;
  setTimeout(() => {
    if (fb.firstChild && fb.firstChild.classList && fb.firstChild.classList.contains('warn')) fb.innerHTML = '';
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
   ۱۸) EXAM
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
    <button class="btn danger" onclick="if(confirm('از آزمون خارج شوی؟')) window.__nav('home')">خروج</button>
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
  const pct = Math.round((score / s.questions.length) * 100);

  state.history.unshift({ date: Date.now(), topic: s.topic, score: pct, correct: s.correct, total: s.questions.length });
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
        ? `${faDec(a.q.answer, 2)}${a.q.unit ? ' ' + a.q.unit : ''}`
        : displayAnswer(a.q.correct);
      let userDisp = '';
      if (!a.isCorrect && a.userAns != null) {
        if (typeof a.userAns === 'number') userDisp = faDec(a.userAns, 2);
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

/* ============================================================
   ۱۹) PROGRESS
   ============================================================ */
function viewProgress() {
  const p = state.progress;
  const topics = [
    { key: 'perimeter', name: 'محیط', emoji: '📏' },
    { key: 'area', name: 'مساحت', emoji: '📐' },
    { key: 'fractions', name: 'کسرها', emoji: '🍰' },
    { key: 'decimals', name: 'اعشار', emoji: '🔢' }
  ];
  const totalQ = topics.reduce((s, t) => s + (p[t.key].attempts || 0), 0);
  const totalC = topics.reduce((s, t) => s + (p[t.key].correct || 0), 0);
  const overall = totalQ ? Math.round((totalC / totalQ) * 100) : 0;
  const mistakeList = Object.entries(state.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const names = {
    'sq-p': 'محیط مربع', 'rect-p': 'محیط مستطیل', 'tri-p': 'محیط مثلث', 'circ-p': 'محیط دایره',
    'para-p': 'محیط متوازی‌الاضلاع', 'rhom-p': 'محیط لوزی', 'poly-p': 'محیط چندضلعی', 'find-side': 'یافتن ضلع',
    'sq-a': 'مساحت مربع', 'rect-a': 'مساحت مستطیل', 'tri-a': 'مساحت مثلث', 'circ-a': 'مساحت دایره',
    'para-a': 'مساحت متوازی‌الاضلاع', 'rhom-a': 'مساحت لوزی', 'trap-a': 'مساحت ذوزنقه', 'comp-a': 'شکل ترکیبی',
    'frac-add': 'جمع کسر', 'frac-sub': 'تفریق کسر', 'frac-mul': 'ضرب کسر', 'frac-div': 'تقسیم کسر',
    'frac-simplify': 'ساده‌کردن کسر', 'frac-cmp': 'مقایسه کسر', 'mixed-imp': 'مخلوط به کسر', 'frac-word': 'مسئله کسری',
    'dec-add': 'جمع اعشار', 'dec-sub': 'تفریق اعشار', 'dec-mul': 'ضرب اعشار', 'dec-div': 'تقسیم اعشار',
    'dec-cmp': 'مقایسه اعشار', 'frac-dec': 'کسر به اعشار', 'dec-frac': 'اعشار به کسر', 'dec-word': 'مسئله اعشاری'
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
      const tn = h.topic === 'perimeter' ? 'محیط' : h.topic === 'area' ? 'مساحت' : h.topic === 'fractions' ? 'کسرها' : 'اعشار';
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
   ۲۰) SETTINGS
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

/* ============================================================
   ۲۱) TEACHER
   ============================================================ */
function viewTeacher() {
  return `
  ${header('👨‍🏫 حالت معلم / والد', true)}
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
  <div class="card">
    <h3 class="card-title">📊 خلاصه وضعیت</h3>
    <p>پایه: <strong>${fa(state.settings.grade)}</strong></p>
    <p>سطح: <strong>${fa(state.stats.level)}</strong></p>
    <p>پاسخ‌های درست: <strong>${fa(state.stats.totalCorrect)} / ${fa(state.stats.totalQuestions)}</strong></p>
    <p>تعداد آزمون‌ها: <strong>${fa(state.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها</button>
  </div>
  ${bottomNav()}`;
}

/* ============================================================
   ۲۲) RENDER
   ============================================================ */
function render() {
  document.body.classList.toggle('no-anim', !state.settings.animation);
  let html = '';
  switch (route.name) {
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
    default: html = viewHome();
  }
  app.innerHTML = html;
}

/* ============================================================
   ۲۳) GLOBAL FUNCTIONS
   ============================================================ */
window.__nav = (name, params = {}) => { sound.click(); navigate(name, params); };
window.__goBack = () => {
  sound.click();
  if (route.name === 'home') return;
  if ((route.name === 'practice' || route.name === 'exam') && session) session = null;
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
  const q = session.current;
  session.selected = q.choices[i];
  document.querySelectorAll('.choice').forEach((el, idx) => el.classList.toggle('selected', idx === i));
};
window.__examSelect = (i) => {
  if (!session || session.mode !== 'exam') return;
  const q = session.current;
  session.selected = q.choices[i];
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
   ۲۴) KEYBOARD
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && route.name !== 'home') window.__goBack();
});

/* ============================================================
   ۲۵) INIT
   ============================================================ */
render();

})();