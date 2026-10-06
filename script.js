/* =============================================================
   ریاضی‌یار — نسخه ۱۶.۰
   - رفع باگ محاسبه مساحت ترکیب‌ها (هر خانه = ۱ واحد)
   - نمایش شکل از ابتدا کم‌رنگ (نه مخفی)
   - محور اعشار یکپارچه
   - انیمیشن حجم بازطراحی شده با ۹ ضلع
   - شعاع دایره داخل، بعد از محیط
   - زاویه قائمه داخل شکل
   - ارتفاع: اول خط، بعد عدد
   - قطرهای لوزی با دو رنگ
   - اشکال ناهمگون
   - حذف کامل TTS
   - شارژ بی‌خطا، حالت کاوش، کارت مقایسه
   ============================================================= */
(function () {
'use strict';

/* ═════════ ۱) STATE ═════════ */
const STORAGE_KEY = 'riazi-yar-v1';
const APP_VERSION = '16.0';

const defaultState = {
  settings: {
    sound: true, animation: true, persianNumbers: true,
    difficulty: 'easy', questionCount: 10, examTime: 300,
    theme: 'auto', noTimer: false, debug: false
  },
  activeStudentId: null,
  students: [],
  dailyChallenge: { lastDate: null, lastCorrect: null }
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
    if (typeof merged.settings.noTimer !== 'boolean') merged.settings.noTimer = false;
    if (typeof merged.settings.debug !== 'boolean') merged.settings.debug = false;
    // حذف tts از نسخه‌های قبلی
    if (merged.settings.tts !== undefined) delete merged.settings.tts;
    if (!merged.dailyChallenge) merged.dailyChallenge = { lastDate: null, lastCorrect: null };
    return merged;
  } catch (e) { return deepClone(defaultState); }
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
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
    name: name || 'دانش‌آموز', family: family || '', grade: grade || 6, createdAt: Date.now(),
    stats: { coins: 0, stars: 0, xp: 0, level: 1, streak: 0, bestStreak: 0, perfectStreak: 0, totalQuestions: 0, totalCorrect: 0, badges: [] },
    progress: {
      perimeter: { attempts: 0, correct: 0 }, area: { attempts: 0, correct: 0 },
      volume: { attempts: 0, correct: 0 }, fractions: { attempts: 0, correct: 0 },
      decimals: { attempts: 0, correct: 0 }
    },
    history: [], mistakes: {}
  };
}
function fullName(s) { return s ? `${s.name}${s.family ? ' ' + s.family : ''}`.trim() : ''; }

/* ═════════ ۲) HELPERS ═════════ */
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
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

/* ═════════ ۳) THEME ═════════ */
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

/* ═════════ ۴) SOUND ═════════ */
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

/* ═════════ ۵) پیام‌های تشویقی ═════════ */
const GOOD_MSGS = ['🎉 آفرین!', '✨ درست بود!', '💯 عالی!', '🌟 ادامه بده!', '🏆 چه هوشی!', '🎯 دقیق زدی!', '💪 محکم بزن!', '🚀 پرواز کردی!', '🌈 فوق‌العاده!', '⭐ آفرین قهرمان!', '🔥 داری می‌درخشی!', '🧠 مغزت عالی کار می‌کنه!', '😎 حرفه‌ای شدی!'];
const BAD_MSGS = ['❌ اشکالی نداره، با هم ببینیم:', '🤔 نزدیک بود! بیا نگاه کنیم:', '💡 یاد گرفتن مهم‌تر از درست جواب دادنه:', '🧐 بیا با هم یاد بگیریم:', '🌱 هر اشتباه، یه قدم نزدیک‌تر به یادگیریه:', '📖 بریم راه‌حل رو ببینیم:'];
function goodMsg() { return pick(GOOD_MSGS); }
function badMsg() { return pick(BAD_MSGS); }

/* ═════════ ۶) FRACTIONS ═════════ */
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

/* ═════════ ۷) NUMERIC → CHOICE ═════════ */
function fallbackDistractors(correct) {
  const isInt = Number.isInteger(correct);
  const dec = isInt ? 0 : 2;
  const wrongs = [];
  const seen = new Set([correct]);
  const deltas = isInt ? [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10] : [0.1, -0.1, 0.2, -0.2, 0.5, -0.5, 1, -1, 2, -2];
  for (const d of deltas) {
    if (wrongs.length >= 3) break;
    const w = round(correct + d, dec);
    if (w <= 0 || seen.has(w)) continue;
    seen.add(w); wrongs.push(w);
  }
  let n = 1;
  while (wrongs.length < 3 && n < 50) {
    const w = round(correct + n * (isInt ? 1 : 0.5), dec);
    if (w > 0 && !seen.has(w)) { wrongs.push(w); seen.add(w); }
    n++;
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
      if (seen.has(rw) || Math.abs(rw - correct) < 0.001) continue;
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
    ...q, type: 'choice', numericAnswer: correct,
    choices: allOpts.map(v => ({ n: String(v), d: null, isNum: true })),
    correct: { n: String(correct), d: null, isNum: true }
  };
}

/* ═════════ ۸) COLORS ═════════ */
const SC = {
  fill: 'var(--shape-fill)', fill2: 'var(--shape-fill-2)', fill3: 'var(--shape-fill-3)',
  fill4: 'var(--shape-fill-4)', stroke: 'var(--shape-stroke)', accent: 'var(--shape-accent)',
  accent2: 'var(--shape-accent-2)',
  grid: 'var(--shape-grid)', blank: 'var(--shape-blank)', angle: 'var(--shape-angle)',
  unit: 'var(--shape-unit)', unitHalf: 'var(--shape-unit-half)', dashed: 'var(--shape-dashed)'
};

/* ═════════ ۹) SVG HELPERS ═════════ */
function svgWrap(w, h, inner) {
  return `<svg viewBox="0 0 ${w} ${h}" class="shape-svg" role="img" aria-hidden="true">${inner}</svg>`;
}
function label(x, y, txt, anchor = 'middle', cls = 'svg-label') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" direction="rtl">${txt}</text>`;
}
function measureLabel(x, y, txt, anchor = 'middle', cls = 'svg-label-measure') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}" direction="rtl">${txt}</text>`;
}
/* ✅ علامت زاویه قائمه — همیشه داخل شکل، با ضلع عمود بر هم */
function angleMarkInside(cornerX, cornerY, dx, dy, size = 12, delay = 0) {
  /* dx و dy: جهت داخل شکل از گوشه. مثلاً (1, -1) یعنی راست و بالا */
  const sx = Math.sign(dx) * size;
  const sy = Math.sign(dy) * size;
  const p1x = cornerX + sx, p1y = cornerY;
  const p2x = cornerX + sx, p2y = cornerY + sy;
  const p3x = cornerX,       p3y = cornerY + sy;
  return `<polyline points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}" fill="none" stroke="${SC.angle}" stroke-width="2" class="anim-fade-loop" style="animation-delay:${delay}s"/>`;
}
function fitPoints(points, W, H, pad) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
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
function measureOnSegment(P1, P2, centroid, txt, offset = 16) {
  const mx = (P1[0] + P2[0]) / 2, my = (P1[1] + P2[1]) / 2;
  let dx = mx - centroid[0], dy = my - centroid[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  return measureLabel(mx + dx * offset, my + dy * offset + 4, txt);
}
function triangleFromSides(a, b, c) {
  const x = (c * c - b * b + a * a) / (2 * a);
  const y = Math.sqrt(Math.max(0.5, c * c - x * x));
  return { A: [x, y], B: [0, 0], C: [a, 0] };
}
function mathToSvg(points, W, H, pad) {
  const maxY = Math.max(...points.map(p => p[1]));
  const flipped = points.map(p => [p[0], maxY - p[1]]);
  return fitPoints(flipped, W, H, pad);
}

/* ═════════ ۱۰) خط‌کش آموزشی سانتی‌متر ═════════ */
function rulerSVG(cmCount = 5) {
  const W = 400, H = 90, pad = 30;
  const y = 55;
  const seg = (W - 2 * pad) / cmCount;
  let lines = '';
  let labels = '';
  /* خط افقی اصلی */
  lines += `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2"/>`;
  /* تقسیم‌بندی: بین هر سانتی‌متر ۹ خط میلی‌متری + عدد سانتی‌متر */
  for (let cm = 0; cm <= cmCount; cm++) {
    const x = pad + cm * seg;
    /* خط سانتی‌متر (بلند) */
    lines += `<line x1="${x}" y1="${y - 20}" x2="${x}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    labels += `<text x="${x}" y="${y - 26}" text-anchor="middle" class="svg-label-lg" direction="rtl">${fa(cm)}</text>`;
    /* ۹ خط میلی‌متری در بین (به جز انتهایی) */
    if (cm < cmCount) {
      for (let mm = 1; mm < 10; mm++) {
        const mx = x + seg * (mm / 10);
        const len = mm === 5 ? 12 : 8;
        lines += `<line x1="${mx}" y1="${y - len}" x2="${mx}" y2="${y}" stroke="${SC.stroke}" stroke-width="1" opacity="0.5"/>`;
      }
    }
  }
  /* برچسب «میلی‌متر» روی یک تقسیم کوچک */
  const mmX = pad + seg * 0.2;
  labels += `<text x="${mmX}" y="${y + 18}" text-anchor="middle" class="svg-label" direction="rtl" style="font-size:10px">میلی‌متر</text>`;
  /* برچسب «سانتی‌متر» زیر عدد ۱ */
  const cmX = pad + seg;
  labels += `<text x="${cmX + 4}" y="${y + 30}" text-anchor="middle" class="svg-label" direction="rtl" style="font-size:11px">سانتی‌متر</text>`;
  /* براکت زیر فاصله ۰ تا ۱ */
  const bracketY = y + 42;
  lines += `<path d="M ${pad} ${bracketY} L ${pad} ${bracketY + 5} L ${pad + seg} ${bracketY + 5} L ${pad + seg} ${bracketY} " fill="none" stroke="${SC.accent}" stroke-width="1.8"/>`;
  return svgWrap(W, H + 20, lines + labels);
}

/* ═════════ ۱۱) SHAPES (استاتیک) ═════════ */
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
    const wN = numOr(w, 3), hN = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wN, (H - 2 * pad) / hN);
    const rw = wN * s, rh = hN * s;
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
    /* ارتفاع اول کشیده می‌شود، بعد عدد کنارش */
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pA[1]-midBC[1])};animation-delay:1s"/>` +
      angleMarkInside(midBC[0], midBC[1], 1, -1, 11, 1.6) +
      `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(pA[0] + 14, (pA[1] + midBC[1]) / 2 + 4, fa(height), 'start')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:2.4s">${label(midBC[0], midBC[1] + 24, fa(base), 'middle', 'svg-label-lg')}</g>`
    );
  },
  /* ✅ دایره: شعاع داخل، بعد از محیط */
  circle(r) {
    const W = 240, H = 220, cx = W / 2, cy = H / 2, R = 68;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len:${R};animation-delay:0.8s"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      `<g class="anim-label-appear" style="animation-delay:1.6s">${measureLabel(cx + R / 2, cy - 8, fa(r), 'middle')}</g>`
    );
  },
  parallelogram(a, b, h = null) {
    const W = 280, H = 220, pad = 55;
    const aN = numOr(a, 5), bN = numOr(b, 3);
    const showH = h != null && h > 0;
    const hDraw = showH ? h : aN * 0.5;
    const pts = mathToSvg([[0, 0], [aN, 0], [aN + bN * 0.35, -hDraw], [bN * 0.35, -hDraw]], W, H, pad);
    const cent = polyCentroid(pts);
    let heightLine = '';
    if (showH) {
      const xTop = (pts[3][0] + pts[2][0]) / 2;
      heightLine = `<line x1="${xTop}" y1="${pts[2][1]}" x2="${xTop}" y2="${pts[1][1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pts[1][1]-pts[2][1])};animation-delay:1s"/>` +
        angleMarkInside(xTop, pts[1][1], 1, -1, 11, 1.6) +
        `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(xTop + 12, (pts[2][1] + pts[1][1]) / 2 + 4, fa(h), 'start')}</g>`;
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
    const sN = numOr(s, 5);
    const halfW = sN / 2, halfH = (sN * 0.75) / 2;
    const pts = fitPoints([[halfW, 0], [2 * halfW, halfH], [halfW, 2 * halfH], [0, halfH]], W, H, pad);
    const cent = polyCentroid(pts);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 18)
    );
  },
  /* ✅ لوزی: قطرها با دو رنگ متفاوت + برچسب‌ها بعد از ترسیم، بدون تلاقی */
  rhombusD(d1, d2) {
    const W = 300, H = 260, pad = 55;
    const d1N = numOr(d1, 8), d2N = numOr(d2, 6);
    const pts = fitPoints([[d1N / 2, 0], [d1N, d2N / 2], [d1N / 2, d2N], [0, d2N / 2]], W, H, pad);
    /* قطر افقی (بالا-پایین) با رنگ accent، قطر عمودی (چپ-راست) با رنگ accent2 */
    const diagH = `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[2][0]}" y2="${pts[2][1]}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len:${Math.hypot(pts[2][0]-pts[0][0], pts[2][1]-pts[0][1])};animation-delay:0.5s"/>`;
    const diagV = `<line x1="${pts[1][0]}" y1="${pts[1][1]}" x2="${pts[3][0]}" y2="${pts[3][1]}" stroke="${SC.accent2}" stroke-width="2.5" class="anim-draw-loop" style="--len:${Math.hypot(pts[3][0]-pts[1][0], pts[3][1]-pts[1][1])};animation-delay:1.3s"/>`;
    /* برچسب قطر افقی: کنار راس بالا، در سمت راست */
    const labelH = `<g class="anim-label-appear" style="animation-delay:1.8s">${measureLabel(pts[0][0] + 14, pts[0][1] + 8, fa(d2), 'start', 'svg-label-measure')}</g>`;
    /* برچسب قطر عمودی: کنار راس چپ، در بالای آن */
    const labelV = `<g class="anim-label-appear" style="animation-delay:2.2s">${measureLabel(pts[3][0] - 14, pts[3][1] + 4, fa(d1), 'end', 'svg-label-measure-2')}</g>`;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      diagH + diagV + labelH + labelV
    );
  },
  trapezoid(bigBase, smallBase, height) {
    const W = 280, H = 240, pad = 55;
    const bb = numOr(bigBase, 10), sb = numOr(smallBase, 6), h = numOr(height, 4);
    const offset = (bb - sb) / 2;
    const pts = mathToSvg([[offset, h], [offset + sb, h], [bb, 0], [0, 0]], W, H, pad);
    const [pA, pB, pC, pD] = pts;
    const cent = polyCentroid(pts);
    const midTop = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2];
    const footY = (pC[1] + pD[1]) / 2;
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<line x1="${midTop[0]}" y1="${midTop[1]}" x2="${midTop[0]}" y2="${footY}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(midTop[1]-footY)};animation-delay:1s"/>` +
      angleMarkInside(midTop[0], footY, 1, -1, 11, 1.6) +
      `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(midTop[0] + 14, (midTop[1] + footY) / 2 + 4, fa(height), 'start')}</g>` +
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
  house(w, h, roofH) {
    const W = 300, H = 280, pad = 60;
    const wN = numOr(w, 6), hN = numOr(h, 4), rH = numOr(roofH, 3);
    const totalH = hN + rH;
    const s = Math.min((W - 2 * pad) / wN, (H - 2 * pad) / totalH);
    const dw = wN * s, dh = hN * s, drH = rH * s;
    const x0 = (W - dw) / 2, y0 = (H - (dh + drH)) / 2;
    const baseY = y0 + drH, apexX = x0 + dw / 2, apexY = y0;
    return svgWrap(W, H,
      `<polygon points="${x0},${baseY} ${apexX},${apexY} ${x0 + dw},${baseY}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<rect x="${x0}" y="${baseY}" width="${dw}" height="${dh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<line x1="${apexX}" y1="${apexY}" x2="${apexX}" y2="${baseY}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(baseY-apexY)};animation-delay:1s"/>` +
      `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(apexX + 12, (apexY + baseY) / 2 + 4, fa(roofH), 'start')}</g>` +
      label(x0 + dw / 2, baseY + dh + 26, fa(wN), 'middle', 'svg-label-lg') +
      label(x0 - 12, baseY + dh / 2 + 4, fa(hN), 'end', 'svg-label-lg')
    );
  },
  parkWithSemi(w, h, semiR) {
    const W = 320, H = 240, pad = 60;
    const s = Math.min((W - 2 * pad) / (w + 2 * semiR), (H - 2 * pad) / h);
    const dw = w * s, dh = h * s, dr = semiR * s;
    const x0 = (W - (dw + 2 * dr)) / 2, y0 = (H - dh) / 2;
    const cy = y0 + dh / 2;
    return svgWrap(W, H,
      `<rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" fill="${SC.fill}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<path d="M ${x0 + dw} ${y0} A ${dr} ${dh/2} 0 0 1 ${x0 + dw} ${y0 + dh} Z" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      `<path d="M ${x0} ${y0} A ${dr} ${dh/2} 0 0 0 ${x0} ${y0 + dh} Z" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="3.5"/>` +
      label(x0 + dw / 2, y0 + dh + 26, fa(w), 'middle', 'svg-label-lg') +
      `<line x1="${x0 + dw}" y1="${cy}" x2="${x0 + dw + dr}" y2="${cy}" stroke="${SC.accent}" stroke-width="2" stroke-dasharray="5 3" class="anim-draw-loop" style="--len:${dr};animation-delay:1s"/>` +
      `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(x0 + dw + dr / 2, cy - 8, fa(semiR), 'middle')}</g>`
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
  /* ✅ مکعب: ۹ ضلع کامل، اضلاع پشتی با خط چین */
  cube(edge) {
    const W = 240, H = 220, pad = 40, size = 100, offset = 30;
    const x0 = pad + offset, y0 = pad + offset;
    return svgWrap(W, H,
      /* اضلاع پشتی (خط چین) */
      `<line x1="${x0 - offset}" y1="${y0 - offset}" x2="${x0}" y2="${y0}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      `<line x1="${x0 - offset}" y1="${y0 + size - offset}" x2="${x0}" y2="${y0 + size}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      `<line x1="${x0 + size - offset}" y1="${y0 - offset}" x2="${x0 + size}" y2="${y0}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      /* وجه پشتی (شفاف) */
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 + size - offset},${y0 - offset} ${x0 + size - offset},${y0 + size - offset} ${x0 - offset},${y0 + size - offset}" fill="${SC.fill}" fill-opacity="0.2" stroke="${SC.stroke}" stroke-width="2" stroke-linejoin="round"/>` +
      /* وجه جلو */
      `<polygon points="${x0},${y0} ${x0 + size},${y0} ${x0 + size},${y0 + size} ${x0},${y0 + size}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      /* وجه بالا */
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 + size - offset},${y0 - offset} ${x0 + size},${y0} ${x0},${y0}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      /* وجه کنار */
      `<polygon points="${x0 + size},${y0} ${x0 + size - offset},${y0 - offset} ${x0 + size - offset},${y0 + size - offset} ${x0 + size},${y0 + size}" fill="${SC.fill4}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      label(x0 + size / 2, y0 + size + 24, fa(edge), 'middle', 'svg-label-lg')
    );
  },
  box(length, width, height) {
    const W = 280, H = 220, pad = 40;
    const maxDim = Math.max(length, width, height);
    const scale = 90 / maxDim;
    const A = length * scale, B = height * scale, C = width * scale;
    const offset = 25, x0 = pad + offset, y0 = pad + offset;
    /* اضلاع پشتی با خط چین */
    const backEdges =
      `<line x1="${x0 - offset}" y1="${y0 - offset}" x2="${x0}" y2="${y0}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      `<line x1="${x0 - offset}" y1="${y0 + B - offset}" x2="${x0}" y2="${y0 + B}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      `<line x1="${x0 - offset}" y1="${y0 - offset}" x2="${x0 - offset + C}" y2="${y0 - offset - C * 0.6}" stroke="${SC.dashed}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    return svgWrap(W, H,
      backEdges +
      /* وجه پشتی */
      `<rect x="${x0 - offset}" y="${y0 - offset}" width="${A}" height="${B}" fill="${SC.fill}" fill-opacity="0.2" stroke="${SC.stroke}" stroke-width="1.5" stroke-dasharray="4 4"/>` +
      /* وجه جلو */
      `<rect x="${x0}" y="${y0}" width="${A}" height="${B}" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5"/>` +
      /* وجه بالا */
      `<polygon points="${x0 - offset},${y0 - offset} ${x0 - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A - offset},${y0 - offset}" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round"/>` +
      /* وجه راست */
      `<polygon points="${x0 + A},${y0} ${x0 + A - offset},${y0 - offset} ${x0 + A - offset + C},${y0 - offset - C * 0.6} ${x0 + A + C - offset},${y0 - C * 0.6}" fill="${SC.fill4}" stroke="${SC.stroke}" stroke-width="2.5" stroke-linejoin="round" transform="translate(0, ${B})"/>` +
      label(x0 + A / 2, y0 + B + 24, fa(length), 'middle', 'svg-label-lg') +
      label(x0 - 12, y0 + B / 2 + 4, fa(height), 'end', 'svg-label-lg') +
      label(x0 + A + C / 2 + 8, y0 - C * 0.3 - 4 + B, fa(width), 'start', 'svg-label-lg')
    );
  }
};
/* ═════════ ۱۱.۵) SHAPES ANIM — رسم انیمیشن‌ها ═════════ */
const ShapesAnim = {
  /* ─── محیط: کشیدن خط‌به‌خط ─── */
  tracingSquare(side) {
    const W = 240, H = 220, pad = 50;
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    const len = Math.ceil(4 * box);
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill}" fill-opacity="0.25" rx="4"/>` +
      `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="none" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len:${len}"/>` +
      label(x + box / 2, y + box + 24, fa(side), 'middle', 'svg-label-lg')
    );
  },
  tracingRect(w, h) {
    const W = 280, H = 220, pad = 50;
    const wN = numOr(w, 3), hN = numOr(h, 2);
    const s = Math.min((W - 2 * pad) / wN, (H - 2 * pad) / hN);
    const rw = wN * s, rh = hN * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    const len = Math.ceil(2 * (rw + rh));
    return svgWrap(W, H,
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill}" fill-opacity="0.25" rx="4"/>` +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="none" stroke="${SC.stroke}" stroke-width="4" rx="4" class="anim-draw-loop" style="--len:${len}"/>` +
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
    const lAB = Math.hypot(pB[0]-pA[0], pB[1]-pA[1]);
    const lBC = Math.hypot(pC[0]-pB[0], pC[1]-pB[1]);
    const lCA = Math.hypot(pA[0]-pC[0], pA[1]-pC[1]);
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" fill-opacity="0.2"/>` +
      `<line x1="${pA[0]}" y1="${pA[1]}" x2="${pB[0]}" y2="${pB[1]}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(lAB)}"/>` +
      `<line x1="${pB[0]}" y1="${pB[1]}" x2="${pC[0]}" y2="${pC[1]}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(lBC)};animation-delay:.6s"/>` +
      `<line x1="${pC[0]}" y1="${pC[1]}" x2="${pA[0]}" y2="${pA[1]}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(lCA)};animation-delay:1.2s"/>` +
      labelOnSegment(pA, pB, cent, fa(c), 18) +
      labelOnSegment(pB, pC, cent, fa(a), 18) +
      labelOnSegment(pC, pA, cent, fa(b), 18)
    );
  },
  circlePerimeterAnim(r) {
    const W = 240, H = 220, cx = W / 2, cy = H / 2, R = 68;
    const circ = Math.ceil(2 * Math.PI * R);
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" fill-opacity="0.25"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${SC.stroke}" stroke-width="5" stroke-linecap="round" class="anim-draw-loop" style="--len:${circ};transform-origin:${cx}px ${cy}px;transform:rotate(-90deg)"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}" class="anim-fade-loop" style="animation-delay:.2s"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len:${R};animation-delay:1.5s"/>` +
      `<g class="anim-label-appear" style="animation-delay:2.2s">${measureLabel(cx + R / 2, cy - 8, fa(r), 'middle')}</g>`
    );
  },
  circleRadiusAnim(r) {
    const W = 240, H = 220, cx = W / 2, cy = H / 2, R = 68;
    return svgWrap(W, H,
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill}" fill-opacity="0.35" class="anim-fade-loop"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${SC.stroke}" stroke-width="3.5" class="anim-fade-loop"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len:${R};animation-delay:.8s"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      `<g class="anim-label-appear" style="animation-delay:1.6s">${measureLabel(cx + R / 2, cy - 8, fa(r), 'middle')}</g>`
    );
  },
  perimeterPolygon(n, s) {
    const W = 260, H = 240, cx = W / 2, cy = H / 2, R = 82;
    const start = -Math.PI / 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * 2 * Math.PI / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    const pointsStr = pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ');
    let lines = '';
    for (let i = 0; i < n; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % n];
      const len = Math.ceil(Math.hypot(p2[0]-p1[0], p2[1]-p1[1]));
      lines += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${len};animation-delay:${(i * 0.2).toFixed(2)}s"/>`;
    }
    return svgWrap(W, H,
      `<polygon points="${pointsStr}" fill="${SC.fill}" fill-opacity="0.2"/>` + lines +
      labelOnSegment(pts[0], pts[1], [cx, cy], fa(s), 18)
    );
  },
  perimeterParallelogram(a, b) {
    const W = 280, H = 220, pad = 55;
    const aN = numOr(a, 5), bN = numOr(b, 3);
    const pts = fitPoints([[0, 0], [aN, 0], [aN + bN * 0.35, -bN * 0.6], [bN * 0.35, -bN * 0.6]], W, H, pad);
    const cent = polyCentroid(pts);
    let lines = '';
    for (let i = 0; i < 4; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % 4];
      const len = Math.ceil(Math.hypot(p2[0]-p1[0], p2[1]-p1[1]));
      lines += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${len};animation-delay:${(i*0.4).toFixed(2)}s"/>`;
    }
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" fill-opacity="0.2"/>` + lines +
      labelOnSegment(pts[0], pts[1], cent, fa(a), 18) +
      labelOnSegment(pts[1], pts[2], cent, fa(b), 18)
    );
  },
  perimeterRhombus(s) {
    const W = 260, H = 240, pad = 55;
    const sN = numOr(s, 5);
    const halfW = sN / 2, halfH = (sN * 0.75) / 2;
    const pts = fitPoints([[halfW, 0], [2 * halfW, halfH], [halfW, 2 * halfH], [0, halfH]], W, H, pad);
    const cent = polyCentroid(pts);
    let lines = '';
    for (let i = 0; i < 4; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % 4];
      const len = Math.ceil(Math.hypot(p2[0]-p1[0], p2[1]-p1[1]));
      lines += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${len};animation-delay:${(i*0.4).toFixed(2)}s"/>`;
    }
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" fill-opacity="0.2"/>` + lines +
      labelOnSegment(pts[0], pts[1], cent, fa(s), 18)
    );
  },
  perimeterTrapezoid(bigBase, smallBase, height) {
    const W = 280, H = 240, pad = 55;
    const bb = numOr(bigBase, 10), sb = numOr(smallBase, 6), h = numOr(height, 4);
    const offset = (bb - sb) / 2;
    const pts = mathToSvg([[offset, h], [offset + sb, h], [bb, 0], [0, 0]], W, H, pad);
    const cent = polyCentroid(pts);
    let lines = '';
    for (let i = 0; i < 4; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % 4];
      const len = Math.ceil(Math.hypot(p2[0]-p1[0], p2[1]-p1[1]));
      lines += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="${SC.stroke}" stroke-width="4" stroke-linecap="round" class="anim-draw-loop" style="--len:${len};animation-delay:${(i*0.4).toFixed(2)}s"/>`;
    }
    return svgWrap(W, H,
      `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill}" fill-opacity="0.2"/>` + lines +
      labelOnSegment(pts[0], pts[1], cent, fa(smallBase), 22) +
      labelOnSegment(pts[3], pts[2], cent, fa(bigBase), 22)
    );
  },

  /* ─── مساحت ─── */
  areaSquare(side) { return areaStageGeneric({ shape: 'square', W: 240, H: 220, data: { side: numOr(side, 3) }, baseLabel: fa(side) + ' سانتی‌متر' }); },
  areaRectangle(w, h) { return areaStageGeneric({ shape: 'rect', W: 280, H: 220, data: { w: numOr(w, 3), h: numOr(h, 2) } }); },
  areaTriangle(base, height) { return areaStageGeneric({ shape: 'tri', W: 280, H: 240, data: { base: numOr(base, 4), height: numOr(height, 3) }, heightLabel: fa(height), baseLabel: fa(base) }); },
  areaCircle(r) { return areaStageGeneric({ shape: 'circle', W: 260, H: 240, data: { r: numOr(r, 3) }, baseLabel: fa(r) }); },
  areaParallelogram(base, height) { return areaStageGeneric({ shape: 'para', W: 280, H: 240, data: { base: numOr(base, 5), height: numOr(height, 3) }, baseLabel: fa(base), heightLabel: fa(height) }); },
  areaRhombus(d1, d2) { return areaStageGeneric({ shape: 'rhom', W: 280, H: 240, data: { d1: numOr(d1, 6), d2: numOr(d2, 4) }, baseLabel: fa(d2), heightLabel: fa(d1) }); },
  areaTrapezoid(bigBase, smallBase, height) { return areaStageGeneric({ shape: 'trap', W: 280, H: 240, data: { bigBase: numOr(bigBase, 8), smallBase: numOr(smallBase, 5), height: numOr(height, 3) }, heightLabel: fa(height) }); },

  /* ✅ مثلث قائم‌الزاویه — ارتفاع و قاعده دو ضلع قائمه */
  areaRightTriangle(aLeg, bLeg) {
    const W = 280, H = 240, pad = 55;
    const aN = numOr(aLeg, 4), bN = numOr(bLeg, 3);
    const A = [0, bN], B = [0, 0], C = [aN, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    const heightLine = `<line x1="${pA[0]}" y1="${pA[1]}" x2="${pB[0]}" y2="${pB[1]}" stroke="${SC.accent}" stroke-width="3" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pA[1]-pB[1])};animation-delay:0.5s"/>`;
    const baseLine = `<line x1="${pB[0]}" y1="${pB[1]}" x2="${pC[0]}" y2="${pC[1]}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.abs(pC[0]-pB[0])};animation-delay:1.5s"/>`;
    const rightAngle = angleMarkInside(pB[0], pB[1], 1, -1, 12, 2.2);
    return svgWrap(W, H, fill + heightLine + baseLine + rightAngle +
      `<g class="anim-label-appear" style="animation-delay:1.4s">${measureLabel(pA[0] - 12, (pA[1] + pB[1]) / 2 + 4, fa(bN), 'end')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:2.4s">${label((pB[0] + pC[0]) / 2, pB[1] + 24, fa(aN), 'middle', 'svg-label-lg')}</g>`
    );
  },
  /* ✅ مثلث متساوی‌الساقین */
  areaIsoscelesTriangle(base, height) {
    return areaStageGeneric({
      shape: 'tri', W: 280, H: 240,
      data: { base: numOr(base, 4), height: numOr(height, 3) },
      heightLabel: fa(height), baseLabel: fa(base)
    });
  },
  /* ✅ مثلث مختلف‌الاضلاع */
  areaScaleneTriangle(a, b, c) {
    const W = 280, H = 240, pad = 55;
    const v = triangleFromSides(a, b, c);
    const pts = mathToSvg([v.A, v.B, v.C], W, H, pad);
    const [pA, pB, pC] = pts;
    const cent = polyCentroid(pts);
    const fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    const heightLine = `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pA[1]-midBC[1])};animation-delay:0.5s"/>`;
    const baseLine = `<line x1="${pB[0]}" y1="${pB[1]}" x2="${pC[0]}" y2="${pC[1]}" stroke="${SC.stroke}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(Math.hypot(pC[0]-pB[0], pC[1]-pB[1]))};animation-delay:1.5s"/>`;
    const rightAngle = angleMarkInside(midBC[0], midBC[1], 1, -1, 11, 2.2);
    return svgWrap(W, H, fill + heightLine + baseLine + rightAngle +
      labelOnSegment(pA, pB, cent, fa(c), 18) +
      labelOnSegment(pB, pC, cent, fa(a), 18) +
      labelOnSegment(pC, pA, cent, fa(b), 18)
    );
  },

  /* ─── مربع‌های واحد ─── */
  unitSquaresRect(w, h) { return unitSquaresAnim(w, h); },
  unitSquaresSquare(s) { return unitSquaresAnim(s, s); },
  gridRect(w, h) { return unitSquaresAnim(w, h); },
  gridSquare(s) { return unitSquaresAnim(s, s); },
  triangleAreaAnim(base, height) { return ShapesAnim.areaTriangle(base, height); },

  /* ─── حجم: مکعب‌های ۱×۱ ─── */
  cubeBuild(edge) {
    const n = Math.min(6, Math.max(2, Math.round(numOr(edge, 3))));
    return cubeUnitBuild(n);
  },
  boxBuild(length, width, height) {
    const L = Math.min(6, Math.max(2, Math.round(numOr(length, 3))));
    const Wd = Math.min(6, Math.max(2, Math.round(numOr(width, 2))));
    const Hh = Math.min(6, Math.max(2, Math.round(numOr(height, 3))));
    return boxUnitBuild(L, Wd, Hh);
  },

  /* ─── کسرها ─── */
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
      if (d === 1) paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${SC.stroke}" stroke-width="2" class="anim-pop-loop" style="animation-delay:${delay}s"/>`;
      else paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${fill}" stroke="${SC.stroke}" stroke-width="1.5" class="anim-pop-loop" style="animation-delay:${delay}s"/>`;
    }
    return svgWrap(W, H, paths);
  },
  fracBarAnim(n, d) {
    const W = 300, H = 120, pad = 20, barW = W - 2 * pad, segW = barW / d;
    const y = 15, h = 35;
    let rects = '';
    for (let i = 0; i < d; i++) {
      const fill = i < n ? SC.fill2 : SC.blank;
      const delay = (i * 0.12).toFixed(2);
      rects += `<rect x="${(pad + i * segW).toFixed(1)}" y="${y}" width="${segW.toFixed(1)}" height="${h}" fill="${fill}" stroke="${SC.stroke}" stroke-width="1.5" class="anim-pop-loop" style="animation-delay:${delay}s"/>`;
    }
    const cx = W / 2, fy = y + h + 22;
    const fracSvg =
      `<text x="${cx}" y="${fy}" text-anchor="middle" class="svg-label-lg" style="font-weight:700" direction="rtl">${fa(n)}</text>` +
      `<line x1="${cx - 12}" y1="${fy + 5}" x2="${cx + 12}" y2="${fy + 5}" stroke="${SC.stroke}" stroke-width="2"/>` +
      `<text x="${cx}" y="${fy + 24}" text-anchor="middle" class="svg-label-lg" style="font-weight:700" direction="rtl">${fa(d)}</text>`;
    return svgWrap(W, H, rects + fracSvg);
  },
  fracCompareBars(n1, d1, n2, d2) {
    return `<div style="display:flex;flex-direction:column;gap:8px;align-items:center">` +
      ShapesAnim.fracBarAnim(n1, d1) + ShapesAnim.fracBarAnim(n2, d2) + `</div>`;
  },

  /* ─── اعشار ─── */
  numberLineAnim(from, to, value) {
    const W = 340, H = 90, pad = 30, y = 48;
    const step = (W - 2 * pad) / (to - from);
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = from; i <= to; i++) {
      const x = pad + (i - from) * step;
      line += `<line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" stroke="${SC.stroke}" stroke-width="2"/>`;
      line += `<text x="${x}" y="${y + 26}" text-anchor="middle" class="svg-label" direction="rtl">${fa(i)}</text>`;
    }
    const mx = pad + (value - from) * step;
    line += `<circle cx="${mx}" cy="${y}" r="8" fill="${SC.accent}" stroke="var(--card)" stroke-width="2" class="anim-pop-loop" style="animation-delay:.5s"/>`;
    return svgWrap(W, H, line);
  },
  decimalLine(marks, highlight, from, to) {
    const W = 360, H = 110, pad = 30, y = 55;
    const range = to - from, step = (W - 2 * pad) / range;
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = 0; i <= range * 10; i++) {
      const v = from + i / 10, x = pad + (v - from) * step;
      const isMain = i % 10 === 0, isHalf = i % 5 === 0 && !isMain;
      const len = isMain ? 8 : (isHalf ? 5 : 3);
      line += `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="${SC.stroke}" stroke-width="${isMain ? 2 : 1}"/>`;
      if (isMain) line += `<text x="${x}" y="${y + 28}" text-anchor="middle" class="svg-label" direction="rtl">${faDec(i / 10, 1)}</text>`;
    }
    if (highlight != null) {
      const hx = pad + (highlight - from) * step;
      line += `<circle cx="${hx}" cy="${y}" r="9" fill="${SC.accent}" stroke="var(--card)" stroke-width="2" class="anim-pop-loop" style="animation-delay:.5s"/>`;
      line += `<line x1="${hx}" y1="${y - 22}" x2="${hx}" y2="${y - 9}" stroke="${SC.accent}" stroke-width="2.5" stroke-linecap="round" class="anim-draw-loop" style="--len:13;animation-delay:.3s"/>`;
    }
    return svgWrap(W, H, line);
  },
  /* ✅ محور جمع اعشار — قوس یکپارچه از صفر به a، سپس به a+b */
  decimalAddOnLine(from, to, a, b) {
    const W = 400, H = 150, pad = 30, y = 90;
    const range = to - from, step = (W - 2 * pad) / range;
    let line = `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="${SC.stroke}" stroke-width="2.5"/>`;
    for (let i = 0; i <= range * 10; i++) {
      const v = from + i / 10, x = pad + (v - from) * step;
      const isMain = i % 10 === 0, len = isMain ? 8 : 4;
      line += `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="${SC.stroke}" stroke-width="${isMain ? 2 : 1}"/>`;
      if (isMain) line += `<text x="${x}" y="${y + 28}" text-anchor="middle" class="svg-label" direction="rtl">${faDec(i / 10, 1)}</text>`;
    }
    const x0 = pad;
    const ax = pad + (a - from) * step;
    const bx = pad + (a + b - from) * step;
    const arcTopY = y - 55;
    /* قوس اول: ۰ → a */
    line += `<path d="M ${x0} ${y - 8} Q ${(x0 + ax) / 2} ${arcTopY} ${ax} ${y - 8}" fill="none" stroke="${SC.accent}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(Math.hypot((ax-x0)/2, arcTopY - y))};animation-delay:0s"/>`;
    line += `<polygon points="${ax},${y - 8} ${ax - 5},${y - 20} ${ax + 7},${y - 15}" fill="${SC.accent}" class="anim-fade-loop" style="animation-delay:0.7s"/>`;
    line += `<text x="${(x0 + ax) / 2}" y="${arcTopY - 4}" text-anchor="middle" class="svg-label-lg" style="font-weight:800;fill:${SC.accent}" direction="rtl">${faDec(a, 1)}</text>`;
    const arc2TopY = y - 30;
    /* قوس دوم: a → a+b */
    line += `<path d="M ${ax} ${y - 8} Q ${(ax + bx) / 2} ${arc2TopY} ${bx} ${y - 8}" fill="none" stroke="${SC.stroke}" stroke-width="3" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(Math.hypot((bx-ax)/2, arc2TopY - y))};animation-delay:0.8s"/>`;
    line += `<polygon points="${bx},${y - 8} ${bx - 5},${y - 20} ${bx + 7},${y - 15}" fill="${SC.stroke}" class="anim-fade-loop" style="animation-delay:1.5s"/>`;
    line += `<text x="${(ax + bx) / 2}" y="${arc2TopY - 4}" text-anchor="middle" class="svg-label-lg" style="font-weight:800;fill:${SC.stroke}" direction="rtl">${faDec(b, 1)}</text>`;
    line += `<circle cx="${x0}" cy="${y}" r="7" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2.5" class="anim-pop-loop"/>`;
    line += `<text x="${x0}" y="${y + 30}" text-anchor="middle" class="svg-label" direction="rtl">۰</text>`;
    line += `<circle cx="${ax}" cy="${y}" r="7" fill="${SC.accent}" stroke="${SC.stroke}" strok
/* ═════════ ۱۲) COMPOSITES — اشکال ناهمگون ═════════ */
/* هر ترکیب: گرید دوبعدی. هر خانه فعال = ۱ واحد مربع */
/* مساحت = تعداد خانه‌ها × ۱ */
/* محیط = تعداد یال‌های مرزی × ۱ */
/* سلول‌ها فقط برای نمایش بصری */

const COMPOSITES = {
  rocket: {
    name: 'موشک', emoji: '🚀', cols: 5, rows: 6,
    /* بال چپ بلندتر */
    grid: [
      [0,0,1,0,0],
      [0,0,1,1,0],
      [0,1,1,1,1],
      [0,1,1,1,0],
      [1,1,1,1,0],
      [1,0,0,1,0]
    ],
    parts: [
      { label: 'نوک موشک', cells: 1 },
      { label: 'گردن موشک', cells: 2 },
      { label: 'بدنه اصلی', cells: 3 },
      { label: 'بال چپ (بلند)', cells: 2 },
      { label: 'بال راست', cells: 1 },
      { label: 'بال‌های پایین', cells: 2 }
    ]
  },
  robot: {
    name: 'ربات', emoji: '🤖', cols: 5, rows: 8,
    /* دست راست کج، یک پا کوتاه‌تر */
    grid: [
      [0,1,1,1,0],
      [0,1,0,1,0],
      [1,1,1,1,0],
      [0,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,1,0,1,0],
      [0,1,0,1,0]
    ],
    parts: [
      { label: 'سر ربات', cells: 4 },
      { label: 'تنه و دست', cells: 7 },
      { label: 'شکم', cells: 3 },
      { label: 'پای چپ', cells: 1 },
      { label: 'پای راست', cells: 2 }
    ]
  },
  castle: {
    name: 'قلعه', emoji: '🏰', cols: 7, rows: 6,
    /* یک برج بلند، برج دیگر کوتاه */
    grid: [
      [1,0,1,1,1,0,0],
      [1,0,1,1,1,0,1],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,0],
      [1,1,1,0,1,1,0]
    ],
    parts: [
      { label: 'برج بلند چپ', cells: 5 },
      { label: 'برج وسط', cells: 2 },
      { label: 'برج کوتاه راست', cells: 4 },
      { label: 'دیوار و دروازه', cells: 10 }
    ]
  },
  tree: {
    name: 'درخت کریسمس', emoji: '🎄', cols: 5, rows: 8,
    /* کج‌شده به یک سمت */
    grid: [
      [0,1,0,0,0],
      [0,1,1,0,0],
      [1,1,1,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,1,1,0],
      [0,0,1,0,0],
      [0,0,1,0,0]
    ],
    parts: [
      { label: 'نوک درخت', cells: 2 },
      { label: 'طبقه دوم', cells: 3 },
      { label: 'طبقه سوم', cells: 3 },
      { label: 'دو طبقه پهن', cells: 9 },
      { label: 'تنه درخت', cells: 2 }
    ]
  },
  boat: {
    name: 'قایق', emoji: '⛵', cols: 5, rows: 5,
    /* بادبان نامتقارن */
    grid: [
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,1,1,1,1],
      [1,1,1,1,1]
    ],
    parts: [
      { label: 'دکل', cells: 2 },
      { label: 'بادبان چپ', cells: 1 },
      { label: 'بادبان راست', cells: 3 },
      { label: 'بدنه قایق', cells: 5 }
    ]
  },
  house: {
    name: 'خانه', emoji: '🏠', cols: 5, rows: 7,
    /* سقف نامتقارن */
    grid: [
      [0,0,1,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,1,0,1],
      [1,1,1,0,1]
    ],
    parts: [
      { label: 'سقف شیب‌دار', cells: 5 },
      { label: 'دیوار اصلی', cells: 15 },
      { label: 'دروازه و ستون‌ها', cells: 4 }
    ]
  },
  fish: {
    name: 'ماهی', emoji: '🐟', cols: 6, rows: 5,
    /* دُم کج، بدن نامتقارن */
    grid: [
      [0,0,1,1,0,0],
      [0,1,1,1,1,1],
      [1,1,1,1,1,1],
      [0,1,1,1,1,0],
      [0,0,1,1,1,0]
    ],
    parts: [
      { label: 'باله بالا', cells: 2 },
      { label: 'سر ماهی', cells: 4 },
      { label: 'بدن ماهی', cells: 6 },
      { label: 'باله پایین', cells: 3 }
    ]
  }
};

/* ═════════ ۱۳) محاسبات ترکیب ═════════ */
/* ✅ اصلاح اصلی: مساحت = تعداد خانه‌ها (نه × cellSize²) */
function compositeCellCount(composite) {
  let n = 0;
  for (const row of composite.grid) for (const c of row) if (c) n++;
  return n;
}
function compositeEdgeCount(composite) {
  const g = composite.grid;
  const rows = g.length, cols = g[0].length;
  let edges = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!g[r][c]) continue;
      if (r === 0 || !g[r-1][c]) edges++;
      if (r === rows-1 || !g[r+1][c]) edges++;
      if (c === 0 || !g[r][c-1]) edges++;
      if (c === cols-1 || !g[r][c+1]) edges++;
    }
  }
  return edges;
}
/* ✅ هر خانه = ۱ واحد مربع — بدون ضرب در cellSize */
function compositeArea(composite) {
  return compositeCellCount(composite);
}
/* ✅ هر یال = ۱ واحد — بدون ضرب در cellSize */
function compositePerimeter(composite) {
  return compositeEdgeCount(composite);
}

/* رندر SVG ترکیب */
function compositeSVG(composite, cellSize, withPerimeterStroke = false, withAnim = false) {
  const g = composite.grid;
  const rows = g.length, cols = g[0].length;
  const pad = 40;
  const W = cols * cellSize + 2 * pad;
  const H = rows * cellSize + 2 * pad;
  const x0 = pad, y0 = pad;
  let cells = '', edges = '';
  let animIdx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!g[r][c]) continue;
      const x = x0 + c * cellSize;
      const y = y0 + r * cellSize;
      /* ✅ کلاس anim-pop-loop از ابتدا کم‌رنگ است و بعد از کلیک پررنگ می‌شود */
      const animAttr = withAnim ? ` class="anim-pop-loop" style="animation-delay:${(animIdx * 0.04).toFixed(2)}s"` : '';
      cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${SC.fill2}"${animAttr}/>`;
      animIdx++;
    }
  }
  if (withPerimeterStroke) {
    let eIdx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!g[r][c]) continue;
        const x = x0 + c * cellSize;
        const y = y0 + r * cellSize;
        const addEdge = (x1, y1, x2, y2) => {
          const delay = withAnim ? `animation-delay:${(0.3 + eIdx * 0.03).toFixed(2)}s;` : '';
          edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linecap="round" class="${withAnim ? 'anim-draw-loop' : ''}" style="${withAnim ? `--len:${cellSize};` : ''}${delay}"/>`;
          eIdx++;
        };
        if (r === 0 || !g[r-1][c]) addEdge(x, y, x + cellSize, y);
        if (r === rows-1 || !g[r+1][c]) addEdge(x, y + cellSize, x + cellSize, y + cellSize);
        if (c === 0 || !g[r][c-1]) addEdge(x, y, x, y + cellSize);
        if (c === cols-1 || !g[r][c+1]) addEdge(x + cellSize, y, x + cellSize, y + cellSize);
      }
    }
  }
  return svgWrap(W, H, cells + edges);
}

/* ✅ حالت کاوش: دانش‌آموز خودش خانه‌ها را می‌شمارد */
function exploreGridHTML(composite, cellSize = 22) {
  const g = composite.grid;
  const rows = g.length, cols = g[0].length;
  const total = compositeCellCount(composite);
  let cellsHTML = '';
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (g[r][c]) {
        cellsHTML += `<div class="explore-cell" data-idx="${idx}" onclick="window.__toggleExploreCell(this)" style="visibility:visible"></div>`;
        idx++;
      } else {
        cellsHTML += `<div class="explore-cell" style="visibility:hidden"></div>`;
      }
    }
  }
  return `<div class="explore-wrap">
    <p style="font-weight:600;color:var(--primary-d);margin:0 0 8px">👆 روی خانه‌ها بزن و بشمار:</p>
    <div class="explore-grid" style="grid-template-columns: repeat(${cols}, 1fr); grid-auto-rows: 24px; width: max-content; margin: 0 auto;">${cellsHTML}</div>
    <p class="explore-counter"><span id="exploreCount">۰</span> از ${fa(total)} خانه شمرده شد</p>
  </div>`;
}
/* ═════════ ۱۴) AREA GENERIC ═════════ */
/* انیمیشن ۳ مرحله‌ای: ارتفاع → قاعده → زاویه قائمه */
function areaStageGeneric(opts) {
  const { shape, W, H, data, baseLabel, heightLabel } = opts;
  let fill = '', measure = '';
  const pad = 55;

  if (shape === 'square') {
    const box = Math.min(W, H) - 2 * pad;
    const x = (W - box) / 2, y = (H - box) / 2;
    fill = `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${SC.fill2}" rx="4" class="anim-pulse-loop"/>`;
    measure = `<g class="anim-label-appear" style="animation-delay:1.5s">${label(x + box / 2, y + box + 24, baseLabel, 'middle', 'svg-label-lg')}</g>`;
  } else if (shape === 'rect') {
    const w = data.w, h = data.h;
    const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
    const rw = w * s, rh = h * s;
    const x = (W - rw) / 2, y = (H - rh) / 2;
    fill = `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${SC.fill2}" rx="4" class="anim-pulse-loop"/>`;
    measure = `<g class="anim-label-appear" style="animation-delay:1.5s">${label(x + rw / 2, y + rh + 24, fa(w), 'middle', 'svg-label-lg')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:1.8s">${label(x - 12, y + rh / 2 + 4, fa(h), 'end', 'svg-label-lg')}</g>`;
  } else if (shape === 'tri') {
    /* ✅ ترتیب: ارتفاع → قاعده → زاویه → اعداد */
    const base_ = data.base, h = data.height;
    const A = [base_ / 2, h], B = [0, 0], C = [base_, 0];
    const pts = mathToSvg([A, B, C], W, H, pad);
    const [pA, pB, pC] = pts;
    const midBC = [(pB[0] + pC[0]) / 2, (pB[1] + pC[1]) / 2];
    fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    const heightLine = `<line x1="${pA[0]}" y1="${pA[1]}" x2="${midBC[0]}" y2="${midBC[1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pA[1]-midBC[1])};animation-delay:0.5s"/>`;
    const baseLine = `<line x1="${pB[0]}" y1="${pB[1]}" x2="${pC[0]}" y2="${pC[1]}" stroke="${SC.stroke}" stroke-width="3.5" stroke-linecap="round" class="anim-draw-loop" style="--len:${Math.ceil(Math.hypot(pC[0]-pB[0], pC[1]-pB[1]))};animation-delay:1.5s"/>`;
    const rightAngle = angleMarkInside(midBC[0], midBC[1], 1, -1, 12, 2.2);
    measure = heightLine + baseLine + rightAngle +
      `<g class="anim-label-appear" style="animation-delay:1.4s">${measureLabel(pA[0] + 14, (pA[1] + midBC[1]) / 2 + 4, heightLabel || fa(h), 'start')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:2.4s">${label(midBC[0], midBC[1] + 24, baseLabel || fa(base_), 'middle', 'svg-label-lg')}</g>`;
  } else if (shape === 'circle') {
    const cx = W / 2, cy = H / 2, R = 68;
    fill = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    /* ✅ شعاع داخل، بعد از محیط */
    measure = `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="5 4" class="anim-draw-loop" style="--len:${R};animation-delay:1.2s"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${SC.stroke}"/>` +
      `<g class="anim-label-appear" style="animation-delay:2s">${measureLabel(cx + R / 2, cy - 8, baseLabel || fa(R), 'middle')}</g>`;
  } else if (shape === 'para') {
    const b = data.base, h = data.height;
    const pts = mathToSvg([[0, 0], [b, 0], [b + 1.4, -h], [1.4, -h]], W, H, pad);
    const cent = polyCentroid(pts);
    const xTop = (pts[3][0] + pts[2][0]) / 2;
    fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    measure = `<line x1="${xTop}" y1="${pts[2][1]}" x2="${xTop}" y2="${pts[1][1]}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(pts[1][1]-pts[2][1])};animation-delay:0.5s"/>` +
      angleMarkInside(xTop, pts[1][1], 1, -1, 12, 1.2) +
      `<g class="anim-label-appear" style="animation-delay:1.5s">${measureLabel(xTop + 12, (pts[2][1] + pts[1][1]) / 2 + 4, heightLabel || fa(h), 'start')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:1.8s">${labelOnSegment(pts[3], pts[2], cent, baseLabel || fa(b), 18)}</g>`;
  } else if (shape === 'rhom') {
    const d1 = data.d1, d2 = data.d2;
    const pts = fitPoints([[d1 / 2, 0], [d1, d2 / 2], [d1 / 2, d2], [0, d2 / 2]], W, H, pad);
    fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    /* ✅ دو قطر با دو رنگ متفاوت، برچسب‌ها بعد از ترسیم */
    const diagH = `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[2][0]}" y2="${pts[2][1]}" stroke="${SC.accent}" stroke-width="2.5" class="anim-draw-loop" style="--len:${Math.hypot(pts[2][0]-pts[0][0], pts[2][1]-pts[0][1])};animation-delay:0.5s"/>`;
    const diagV = `<line x1="${pts[1][0]}" y1="${pts[1][1]}" x2="${pts[3][0]}" y2="${pts[3][1]}" stroke="${SC.accent2}" stroke-width="2.5" class="anim-draw-loop" style="--len:${Math.hypot(pts[3][0]-pts[1][0], pts[3][1]-pts[1][1])};animation-delay:1.3s"/>`;
    measure = diagH + diagV +
      `<g class="anim-label-appear" style="animation-delay:1.8s">${measureLabel(pts[0][0] + 14, pts[0][1] + 8, baseLabel || fa(d2), 'start', 'svg-label-measure')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:2.3s">${measureLabel(pts[3][0] - 14, pts[3][1] + 4, heightLabel || fa(d1), 'end', 'svg-label-measure-2')}</g>`;
  } else if (shape === 'trap') {
    const bb = data.bigBase, sb = data.smallBase, h = data.height;
    const offset = (bb - sb) / 2;
    const pts = mathToSvg([[offset, h], [offset + sb, h], [bb, 0], [0, 0]], W, H, pad);
    const cent = polyCentroid(pts);
    const midTop = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    const footY = (pts[2][1] + pts[3][1]) / 2;
    fill = `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${SC.fill2}" class="anim-pulse-loop"/>`;
    measure = `<line x1="${midTop[0]}" y1="${midTop[1]}" x2="${midTop[0]}" y2="${footY}" stroke="${SC.accent}" stroke-width="2.5" stroke-dasharray="6 4" class="anim-draw-loop" style="--len:${Math.abs(midTop[1]-footY)};animation-delay:0.5s"/>` +
      angleMarkInside(midTop[0], footY, 1, -1, 12, 1.2) +
      `<g class="anim-label-appear" style="animation-delay:1.5s">${measureLabel(midTop[0] + 12, (midTop[1] + footY) / 2 + 4, heightLabel || fa(h), 'start')}</g>` +
      `<g class="anim-label-appear" style="animation-delay:1.8s">${labelOnSegment(pts[0], pts[1], cent, fa(sb), 22)}</g>` +
      `<g class="anim-label-appear" style="animation-delay:2.1s">${labelOnSegment(pts[3], pts[2], cent, fa(bb), 22)}</g>`;
  }
  return svgWrap(W, H, fill + measure);
}

/* ═════════ ۱۵) UNIT SQUARES ═════════ */
function unitSquaresAnim(w, h) {
  const W = 300, H = 260, pad = 50;
  const wN = Math.max(1, Math.round(numOr(w, 3)));
  const hN = Math.max(1, Math.round(numOr(h, 2)));
  const s = Math.min((W - 2 * pad) / wN, (H - 2 * pad) / hN);
  const rw = wN * s, rh = hN * s;
  const x0 = (W - rw) / 2, y0 = (H - rh) / 2;
  let cells = '';
  const total = wN * hN;
  const delayStep = Math.min(0.08, 1.2 / Math.max(1, total));
  for (let j = 0; j < hN; j++) {
    for (let i = 0; i < wN; i++) {
      const idx = j * wN + i;
      const delay = (idx * delayStep).toFixed(2);
      cells += `<rect x="${(x0 + i * s).toFixed(1)}" y="${(y0 + j * s).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${SC.unit}" stroke="${SC.grid}" stroke-width="1" class="anim-pop-loop" style="animation-delay:${delay}s"/>`;
    }
  }
  const countLabel = `<g class="anim-label-appear" style="animation-delay:${(total * delayStep + 0.3).toFixed(2)}s">${label(W / 2, y0 + rh + 26, `${fa(wN)} × ${fa(hN)} = ${fa(total)} مربع`, 'middle', 'svg-label-lg')}</g>`;
  return svgWrap(W, H, cells + countLabel);
}

/* ═════════ ۱۶) HINTS + WRAP ═════════ */
const HINT_BY_TOPIC = {
  perimeter: 'برای دیدن محیط، روی شکل بزن',
  area: 'برای دیدن مساحت، روی شکل بزن',
  volume: 'برای دیدن حجم، روی شکل بزن',
  fractions: 'برای دیدن کسر، روی شکل بزن',
  decimals: 'برای دیدن اعشار، روی محور بزن'
};
const TAP_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a3 3 0 0 1 6 0v6"/><path d="M9 11a3 3 0 0 0-3 3 6 6 0 0 0 6 6h2a5 5 0 0 0 5-5v-3a2 2 0 0 0-4 0"/></svg>`;

function wrapAnim(html, opts) {
  opts = opts || {};
  if (!html) return '';
  const hasAnim = /anim-(draw|fade|pop|slide|pulse|label)-loop|anim-label-appear/.test(html);
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

/* ═════════ ۱۷) DIFFICULTY ═════════ */
function diffRange(diff) {
  if (diff === 'easy') return [2, 5];
  if (diff === 'hard') return [5, 10];
  return [3, 7];
}
function diffVolumeRange(diff) {
  if (diff === 'easy') return [2, 4];
  if (diff === 'hard') return [4, 6];
  return [3, 5];
}
function diffCellSize(diff) {
  if (diff === 'easy') return 20;
  if (diff === 'hard') return 14;
  return 17;
}

/* ═════════ ۱۸) UNITS CARD — بازنویسی آموزش سانتی‌متر ═════════ */
function unitsCard(topic) {
  if (topic === 'perimeter') {
    return `<div class="units-card">
      <h3>📏 واحد اندازه‌گیری محیط</h3>
      <p>محیط یعنی <strong>دور تا دور</strong> شکل. واحد آن سانتی‌متر یا متر است.</p>
      <div class="highlight">
        <strong>🏷️ با خط‌کش نگاه کن:</strong>
        <div style="text-align:center;margin:10px 0">${rulerSVG(5)}</div>
        <p style="margin-top:8px">
          بین <strong>۰</strong> و <strong>۱</strong>، ده تقسیم کوچک وجود دارد.<br>
          فاصله‌ی ۰ تا ۱ = <strong>۱ سانتی‌متر</strong><br>
          هر تقسیم کوچک = <strong>۱ میلی‌متر</strong><br>
          پس ۱ سانتی‌متر = ۱۰ میلی‌متر.
        </p>
      </div>
      <div class="checklist"><h4>✅ چک‌لیست محیط</h4>
        <ul><li>دور تا دور شکل را می‌پیماییم</li><li>واحد: سانتی‌متر / متر</li></ul>
      </div>
    </div>`;
  }
  if (topic === 'area') {
    return `<div class="units-card">
      <h3>📐 واحد اندازه‌گیری مساحت</h3>
      <p>مساحت یعنی <strong>سطح داخل</strong> شکل. واحد آن سانتی‌متر مربع است.</p>
      <div class="highlight">
        <strong>🟦 سانتی‌متر مربع یعنی چه؟</strong>
        <div style="text-align:center;margin:10px 0">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <rect x="10" y="10" width="60" height="60" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="2"/>
            <text x="40" y="45" text-anchor="middle" font-size="14" font-weight="700" fill="${SC.stroke}" direction="rtl">۱</text>
          </svg>
        </div>
        <p style="margin-top:8px">یک مربع کوچک که هر ضلعش <strong>۱ سانتی‌متر</strong> است.<br>
        اگر ۵ تا از این مربع‌ها را کنار هم بچینیم، مساحت ۵ سانتی‌متر مربع می‌شود.</p>
      </div>
      <div class="checklist"><h4>✅ چک‌لیست مساحت</h4>
        <ul><li>سطح داخل شکل را می‌شماریم</li><li>واحد با «مربع»</li></ul>
      </div>
    </div>`;
  }
  if (topic === 'volume') {
    return `<div class="units-card">
      <h3>🧊 واحد اندازه‌گیری حجم</h3>
      <p>حجم یعنی <strong>فضای داخل</strong> یک شکل سه‌بعدی. واحد آن سانتی‌متر مکعب است.</p>
      <div class="highlight">
        <strong>🧊 سانتی‌متر مکعب یعنی چه؟</strong>
        <div style="text-align:center;margin:10px 0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <polygon points="20,50 50,50 50,80 20,80" fill="${SC.fill2}" stroke="${SC.stroke}" stroke-width="1.5"/>
            <polygon points="20,50 30,40 60,40 50,50" fill="${SC.fill3}" stroke="${SC.stroke}" stroke-width="1.5"/>
            <polygon points="50,50 60,40 60,70 50,80" fill="${SC.fill4}" stroke="${SC.stroke}" stroke-width="1.5"/>
            <text x="40" y="70" text-anchor="middle" font-size="11" font-weight="700" fill="${SC.stroke}" direction="rtl">۱</text>
          </svg>
        </div>
        <p style="margin-top:8px">یک مکعب کوچک که هر ضلعش <strong>۱ سانتی‌متر</strong> است.<br>
        مثل یک تاس خیلی کوچک.</p>
      </div>
    </div>`;
  }
  if (topic === 'fractions') {
    return `<div class="units-card">
      <h3>🍕 مفهوم کسر</h3>
      <p>کسر یعنی <strong>چند قسمت از یک کل</strong>.</p>
      <div class="highlight">
        <strong>🔢 صورت و مخرج:</strong><br>
        - بالا (صورت): چند قسمت برداشته‌ایم<br>
        - پایین (مخرج): کل به چند قسمت مساوی تقسیم شده
      </div>
    </div>`;
  }
  if (topic === 'decimals') {
    return `<div class="units-card">
      <h3>🔟 مفهوم اعشار</h3>
      <p>اعداد اعشاری برای قسمت‌های <strong>کمتر از یک</strong> استفاده می‌شوند.</p>
      <div class="highlight">
        <strong>📍 جایگاه‌ها بعد از ممیز:</strong><br>
        - رقم اول: دهم (۰٫۱ = یک‌دهم)<br>
        - رقم دوم: صدم (۰٫۰۱ = یک‌صدم)
      </div>
    </div>`;
  }
  return '';
}

/* ═════════ ۱۹) COMPARE CARD (جدید — مقایسه محیط و مساحت) ═════════ */
function compareCard(topic) {
  if (topic !== 'area' && topic !== 'perimeter') return '';
  return `<div class="compare-card">
    <h3>🔍 فرق محیط و مساحت</h3>
    <p>همین مربع را با دو نگاه می‌بینیم:</p>
    <div class="compare-grid">
      <div class="compare-item">
        <div class="label">📏 محیط</div>
        <div class="val" style="color:${SC.stroke}">۴ × ضلع</div>
        <p style="font-size:.82rem;color:var(--muted);margin:6px 0 0">دور تا دور</p>
      </div>
      <div class="compare-item">
        <div class="label">📐 مساحت</div>
        <div class="val" style="color:${SC.accent}">ضلع × ضلع</div>
        <p style="font-size:.82rem;color:var(--muted);margin:6px 0 0">سطح داخل</p>
      </div>
    </div>
    <p style="margin-top:10px;font-size:.88rem;color:var(--muted)">
      💡 یک شکل می‌تواند محیط بزرگ ولی مساحت کوچک داشته باشد (یا برعکس).
    </p>
  </div>`;
}

/* ═════════ ۲۰) PROOF CARD ═════════ */
function proofCard(shapeKey, topic) {
  if (topic !== 'area') return '';
  if (shapeKey === 'tri') return `<div class="proof-card"><h3>🎨 چرا فرمول مثلث نصف است؟</h3><p>اگر یک مثلث دقیقاً مثل خودش را برعکس کنارش بگذاری، با هم مستطیل می‌شوند. پس مساحت مثلث نصف آن مستطیل است.</p><div class="conclusion">مساحت مثلث = (قاعده × ارتفاع) ÷ ۲</div></div>`;
  if (shapeKey === 'circ') return `<div class="proof-card"><h3>🎨 چرا π در فرمول دایره است؟</h3><p>π عددی است حدود ۳٫۱۴ که نسبت محیط دایره به قطر آن است.</p><div class="conclusion">مساحت دایره = π × شعاع × شعاع</div></div>`;
  if (shapeKey === 'para') return `<div class="proof-card"><h3>🎨 چرا فرمول متوازی‌الاضلاع مثل مستطیل است؟</h3><p>با یک بُرش و جابجایی، تبدیل به مستطیل می‌شود.</p><div class="conclusion">مساحت = قاعده × ارتفاع</div></div>`;
  if (shapeKey === 'rhom') return `<div class="proof-card"><h3>🎨 چرا لوزی تقسیم بر ۲ دارد؟</h3><p>لوزی را با قطرهایش به ۴ مثلث کوچک تقسیم می‌کنیم که با کنار هم گذاشتنشان یک مستطیل درست می‌شود.</p><div class="conclusion">مساحت لوزی = (قطر بزرگ × قطر کوچک) ÷ ۲</div></div>`;
  if (shapeKey === 'trap') return `<div class="proof-card"><h3>🎨 چرا ذوزنقه این فرمول را دارد؟</h3><p>دو ذوزنقه یکسان را برعکس هم بچسبان، مستطیل می‌شود. پس مساحت یک ذوزنقه نصف آن است.</p><div class="conclusion">مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲</div></div>`;
  return '';
}

/* ═════════ ۲۱) CONTEXTS ═════════ */
const CTX_P = {
  square: [
    { story: 'یک کاشی مربعی داریم که هر ضلعش', u: 'سانتی‌متر', ask: 'دور تا دور این کاشی چقدر است؟' },
    { story: 'زمین بازی مربعی است، هر ضلعش', u: 'متر', ask: 'یک دور کامل چند متر است؟' }
  ],
  rectangle: [
    { story: 'استخر مستطیلی داریم به طول', u: 'متر', ask: 'حفاظ دور آن چقدر است؟' },
    { story: 'جلد کتاب مستطیلی به طول', u: 'سانتی‌متر', ask: 'دور تا دور جلد چقدر است؟' }
  ],
  triangle: [{ story: 'یک زمین مثلثی با اضلاع', u: 'متر', ask: 'نرده دور آن چقدر است؟' }],
  circle: [{ story: 'استخر دایره‌ای با شعاع', u: 'متر', ask: 'نرده دور آن چقدر است؟ (π = ۳٫۱۴)' }],
  parallelogram: [{ story: 'زمین متوازی‌الاضلاع با اضلاع', u: 'متر', ask: 'نرده دور آن چقدر است؟' }],
  rhombus: [{ story: 'باغچه لوزی‌شکل، هر ضلعش', u: 'متر', ask: 'نرده دور آن چقدر است؟' }]
};
const CTX_A = {
  square: [{ story: 'اتاق مربعی با ضلع', u: 'متر', ask: 'مساحت آن چقدر است؟' }],
  rectangle: [{ story: 'زمین فوتبال به طول', u: 'متر', ask: 'مساحت آن چقدر است؟' }],
  triangle: [{ story: 'بیرق مثلثی با قاعده', u: 'سانتی‌متر', ask: 'مساحتش چقدر است؟' }],
  circle: [{ story: 'پیتزای دایره‌ای با شعاع', u: 'سانتی‌متر', ask: 'مساحتش چقدر است؟ (π = ۳٫۱۴)' }],
  parallelogram: [{ story: 'زمین کشاورزی متوازی به قاعده', u: 'متر', ask: 'مساحتش چقدر است؟' }],
  rhombus: [{ story: 'باغچه لوزی‌شکل با قطرهای', u: 'متر', ask: 'مساحتش چقدر است؟' }]
};
const CTX_V = {
  cube: [{ story: 'جعبه مکعبی که هر ضلعش', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }],
  box: [{ story: 'جعبه کفش به طول', u: 'سانتی‌متر', ask: 'حجم آن چقدر است؟' }]
};
const CTX_FR = [
  { name: 'علی', u: 'تومان', verb: 'خرج کرد', q: 'چقدر خرج کرد؟' },
  { name: 'مریم', u: 'صفحه', verb: 'خواند', q: 'چند صفحه خواند؟' },
  { name: 'رضا', u: 'لیتر', verb: 'نوشید', q: 'چند لیتر نوشید؟' }
];

/* ═════════ ۲۲) PERIMETER GENERATORS ═════════ */
function genSquarePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  const ctx = diff === 'easy' ? null : pick(CTX_P.square);
  const prompt = ctx ? `${ctx.story} ${fa(s)} ${ctx.u}. ${ctx.ask}` : `محیط مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`;
  return { topic: 'perimeter', key: 'sq-p', prompt, shape: Shapes.square(s), type: 'numeric', answer: ans, unit: ctx ? ctx.u : 'سانتی‌متر', distractors,
    steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', `${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}`] };
}
genSquarePerimeter.levels = ['easy', 'medium', 'hard'];

function genRectPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b); const ans = 2 * (w + h);
  const distractors = [w * h, w + h, 4 * (w + h), w + h + 2];
  const ctx = diff === 'easy' ? null : pick(CTX_P.rectangle);
  const prompt = ctx ? `${ctx.story} ${fa(w)} ${ctx.u} و عرض ${fa(h)} ${ctx.u} است. ${ctx.ask}` : `محیط مستطیلی به طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`;
  return { topic: 'perimeter', key: 'rect-p', prompt, shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: ctx ? ctx.u : 'سانتی‌متر', distractors,
    steps: ['مستطیل ۴ ضلع دارد.', 'محیط = ۲ × (طول + عرض)', `${eq(`۲ × (${fa(w)} + ${fa(h)})`)} = ${fa(ans)}`] };
}
genRectPerimeter.levels = ['easy', 'medium', 'hard'];

function genTrianglePerimeter(diff) {
  const [a, b] = diffRange(diff);
  let x, y, z, g = 0;
  do { x = ri(a, b); y = ri(a, b); z = ri(a, b); g++; } while ((x+y<=z||x+z<=y||y+z<=x) && g < 40);
  if (g >= 40) { x = a; y = a + 1; z = a + 2; }
  const ans = x + y + z;
  const distractors = [x * y * z, x + y, 2 * (x + y + z), x * y];
  return { topic: 'perimeter', key: 'tri-p', prompt: `محیط مثلثی با اضلاع ${fa(x)}، ${fa(y)} و ${fa(z)} سانتی‌متر چقدر است؟`,
    shape: Shapes.triangle(x, y, z), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['محیط مثلث = جمع سه ضلع', `${eq(`${fa(x)} + ${fa(y)} + ${fa(z)}`)} = ${fa(ans)}`] };
}
genTrianglePerimeter.levels = ['easy', 'medium', 'hard'];

function genCirclePerimeter(diff) {
  const r = ri(2, diff === 'hard' ? 5 : 4);
  const ans = round(2 * 3.14 * r, 2);
  const distractors = [round(3.14 * r * r, 2), round(3.14 * r, 2), round(4 * 3.14 * r, 2), r * r];
  return { topic: 'perimeter', key: 'circ-p', prompt: `محیط دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`,
    shape: Shapes.circle(r), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['محیط دایره = ۲ × π × شعاع', `${eq(`۲ × ۳٫۱۴ × ${fa(r)}`)} = ${faDec(ans)}`] };
}
genCirclePerimeter.levels = ['medium', 'hard'];

function genParallelogramPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const x = ri(a, b), y = ri(a, b); const ans = 2 * (x + y);
  const distractors = [x * y, x + y, 4 * (x + y), 2 * x + y];
  return { topic: 'perimeter', key: 'para-p', prompt: `محیط متوازی‌الاضلاعی با اضلاع ${fa(x)} و ${fa(y)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(x, y), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['اضلاع روبه‌رو مساوی‌اند.', 'محیط = ۲ × (a + b)', `${eq(`۲ × (${fa(x)} + ${fa(y)})`)} = ${fa(ans)}`] };
}
genParallelogramPerimeter.levels = ['medium', 'hard'];

function genRhombusPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = 4 * s;
  const distractors = [s * s, s + 4, 8 * s, 2 * s];
  return { topic: 'perimeter', key: 'rhom-p', prompt: `محیط لوزی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombusSide(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: ['لوزی ۴ ضلع مساوی دارد.', `محیط = ۴ × ضلع = ${eq(`۴ × ${fa(s)}`)} = ${fa(ans)}`] };
}
genRhombusPerimeter.levels = ['medium', 'hard'];

function genPolygonPerimeter(diff) {
  const ns = diff === 'easy' ? [3, 4] : diff === 'medium' ? [5, 6] : [6, 8];
  const n = pick(ns);
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = n * s;
  const distractors = [s * s, (n - 1) * s, (n + 1) * s, n + s];
  const nameMap = { 3: 'مثلث', 4: 'مربع', 5: 'پنج‌ضلعی', 6: 'شش‌ضلعی', 8: 'هشت‌ضلعی' };
  return { topic: 'perimeter', key: 'poly-p', prompt: `محیط ${nameMap[n]} منتظم با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.regularPolygon(n, s), type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
    steps: [`${nameMap[n]} منتظم یعنی همه اضلاع مساوی.`, `${eq(`${fa(n)} × ${fa(s)}`)} = ${fa(ans)}`] };
}
genPolygonPerimeter.levels = ['medium', 'hard'];

function genFindSideFromPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b), p = 4 * s;
  const distractors = [round(p / 2, 2), p, 4 * p, s + 2];
  return { topic: 'perimeter', key: 'find-side', prompt: `محیط مربعی ${fa(p)} سانتی‌متر است. طول ضلع آن چقدر است؟`,
    shape: Shapes.square('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر', distractors,
    steps: ['محیط = ۴ × ضلع', 'ضلع = محیط ÷ ۴', `${eq(`${fa(p)} ÷ ۴`)} = ${fa(s)}`] };
}
genFindSideFromPerimeter.levels = ['hard'];

function genHousePerimeter(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(4, a), b), H = ri(a, Math.min(6, b)), roofH = ri(2, 4);
  const slant = Math.sqrt((W/2)**2 + roofH**2);
  const perim = round(2 * slant + 2 * H + W, 2);
  const distractors = [2*(W+H) + W, W + H + roofH, W + 2*H, round(slant * 4 + W, 2)];
  return { topic: 'perimeter', key: 'house-p', prompt: `این خانه از یک مستطیل و یک مثلث ساخته شده. محیط کل (سقف + دیوارها + کف) چقدر است؟`,
    shape: Shapes.house(W, H, roofH), type: 'numeric', answer: perim, unit: 'سانتی‌متر', distractors,
    steps: [`سقف دو ضلع شیب‌دار دارد. هر شیب ≈ ${faDec(slant, 2)}`, `دیوارها: ۲ × ${fa(H)}`, `کف: ${fa(W)}`, `جمع ≈ ${faDec(perim, 2)}`] };
}
genHousePerimeter.levels = ['hard'];

function genParkPerimeter(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(5, a), Math.min(9, b)), H = ri(a, Math.min(5, b));
  const r = H / 2;
  const perim = round(2 * W + 2 * 3.14 * r, 2);
  const distractors = [2 * W + H, 2*(W+H), W + 2*H, round(2*W + 3.14*r, 2)];
  return { topic: 'perimeter', key: 'park-p', prompt: `این زمین ورزشی از یک مستطیل + دو نیم‌دایره ساخته شده. محیط کل چقدر است؟`,
    shape: Shapes.parkWithSemi(W, H, r), type: 'numeric', answer: perim, unit: 'متر', distractors,
    steps: [`دو ضلع مستقیم بالا و پایین: ۲ × ${fa(W)} = ${fa(2*W)}`, `دو نیم‌دایره با هم = یک دایره با شعاع ${faDec(r, 2)}`, `محیط ≈ ${faDec(perim, 2)} متر`] };
}
genParkPerimeter.levels = ['hard'];

/* ─── محیط ترکیب‌ها ─── */
function makeCompositePerimeterGen(key) {
  function gen(diff) {
    const comp = COMPOSITES[key];
    const cellSize = diffCellSize(diff);
    const ans = compositePerimeter(comp);
    const cellCount = compositeCellCount(comp);
    const distractors = [ans + 2, ans - 1, ans + 4, cellCount];
    return {
      topic: 'perimeter',
      key: `comp-${key}-p`,
      prompt: `این شکل یک ${comp.name} است که از چند خانه‌ی ۱×۱ ساخته شده. محیط کل (دور تا دور) چقدر است؟`,
      shape: ShapesAnim.compositePerimeter(key, cellSize),
      type: 'numeric', answer: ans, unit: 'سانتی‌متر', distractors,
      steps: [
        'برای محیط، فقط ضلع‌های بیرونی را می‌شماریم.',
        `هر ضلع = ۱ سانتی‌متر. تعداد کل ضلع‌های بیرونی = ${fa(ans)}`,
        `محیط = ${fa(ans)} سانتی‌متر`
      ]
    };
  }
  return gen;
}
const compositePerimeterGens = Object.keys(COMPOSITES).map(k => {
  const g = makeCompositePerimeterGen(k);
  g.levels = ['easy', 'medium', 'hard'];
  return g;
});

/* ═════════ ۲۳) AREA GENERATORS ═════════ */
function genSquareArea(diff) {
  const [a, b] = diffRange(diff);
  const s = ri(a, b); const ans = s * s;
  const distractors = [4 * s, 2 * s, s + s, s + 4];
  return { topic: 'area', key: 'sq-a', prompt: `مساحت مربعی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.square(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مربع = ضلع × ضلع', `${eq(`${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`] };
}
genSquareArea.levels = ['easy', 'medium', 'hard'];

function genRectArea(diff) {
  const [a, b] = diffRange(diff);
  const w = ri(a, b), h = ri(a, b); const ans = w * h;
  const distractors = [2 * (w + h), w + h, w * h * 2, w + h + 2];
  return { topic: 'area', key: 'rect-a', prompt: `مساحت مستطیلی به طول ${fa(w)} و عرض ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rectangle(w, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مستطیل = طول × عرض', `${eq(`${fa(w)} × ${fa(h)}`)} = ${fa(ans)}`] };
}
genRectArea.levels = ['easy', 'medium', 'hard'];

function genTriangleArea(diff) {
  const [a, b] = diffRange(diff);
  let base = ri(a, b), h = ri(a, b);
  if ((base * h) % 2 !== 0) h += 1;
  const ans = (base * h) / 2;
  const distractors = [base * h, base + h, base * h * 2, base + h + 2];
  /* ✅ سه نوع مثلث: مختلف‌الاضلاع (bh)، متساوی‌الساقین (iso)، قائم‌الزاویه (right) */
  const variants = [
    { type: 'bh', shape: Shapes.triangleBH(base, h), prompt: `مساحت مثلثی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟` },
    { type: 'iso', shape: ShapesAnim.areaIsoscelesTriangle(base, h), prompt: `مساحت مثلث متساوی‌الساقینی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟` }
  ];
  if (diff !== 'easy') {
    const aLeg = base, bLeg = h;
    variants.push({ type: 'right', shape: ShapesAnim.areaRightTriangle(aLeg, bLeg), prompt: `مساحت مثلث قائم‌الزاویه‌ای با دو ضلع قائمه‌ی ${fa(aLeg)} و ${fa(bLeg)} سانتی‌متر چقدر است؟` });
  }
  const variant = pick(variants);
  return { topic: 'area', key: 'tri-a', prompt: variant.prompt,
    shape: variant.shape, type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت مثلث = (قاعده × ارتفاع) ÷ ۲', `${eq(`(${fa(base)} × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`] };
}
genTriangleArea.levels = ['medium', 'hard'];

function genCircleArea(diff) {
  const r = ri(2, diff === 'hard' ? 5 : 4);
  const ans = round(3.14 * r * r, 2);
  const distractors = [round(2 * 3.14 * r, 2), round(3.14 * r, 2), r * r, round(3.14 * r * r * 2, 2)];
  return { topic: 'area', key: 'circ-a', prompt: `مساحت دایره‌ای با شعاع ${fa(r)} سانتی‌متر چقدر است؟ (π = ۳٫۱۴)`,
    shape: Shapes.circle(r), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت دایره = π × شعاع × شعاع', `${eq(`۳٫۱۴ × ${fa(r)} × ${fa(r)}`)} = ${faDec(ans)}`] };
}
genCircleArea.levels = ['medium', 'hard'];

function genParallelogramArea(diff) {
  const [a, b] = diffRange(diff);
  const base = ri(a, b), h = ri(a, b); const ans = base * h;
  const distractors = [2 * (base + h), base + h, base * h * 2, base + h + 2];
  return { topic: 'area', key: 'para-a', prompt: `مساحت متوازی‌الاضلاعی با قاعده ${fa(base)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.parallelogram(base, 8, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت = قاعده × ارتفاع', `${eq(`${fa(base)} × ${fa(h)}`)} = ${fa(ans)}`] };
}
genParallelogramArea.levels = ['medium', 'hard'];

function genRhombusArea(diff) {
  const [a, b] = diffRange(diff);
  let d1 = ri(a, b), d2 = ri(a, b);
  if ((d1 * d2) % 2 !== 0) d2 += 1;
  const ans = (d1 * d2) / 2;
  const distractors = [d1 * d2, d1 + d2, d1 * d2 * 2, (d1 + d2) * 2];
  return { topic: 'area', key: 'rhom-a', prompt: `مساحت لوزی با قطرهای ${fa(d1)} و ${fa(d2)} سانتی‌متر چقدر است؟`,
    shape: Shapes.rhombusD(d1, d2), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت لوزی = (قطر۱ × قطر۲) ÷ ۲', `${eq(`(${fa(d1)} × ${fa(d2)}) ÷ ۲`)} = ${fa(ans)}`] };
}
genRhombusArea.levels = ['medium', 'hard'];

function genTrapezoidArea(diff) {
  const [a, b] = diffRange(diff);
  let base1 = ri(a, b), base2 = ri(a, b), h = ri(a, b);
  if (((base1 + base2) * h) % 2 !== 0) h += 1;
  const ans = ((base1 + base2) * h) / 2;
  const distractors = [(base1 + base2) * h, base1 + base2 + h, base1 * base2 * h, (base1 + base2) * 2];
  return { topic: 'area', key: 'trap-a', prompt: `مساحت ذوزنقه‌ای با دو قاعده ${fa(base1)} و ${fa(base2)} و ارتفاع ${fa(h)} سانتی‌متر چقدر است؟`,
    shape: Shapes.trapezoid(base1, base2, h), type: 'numeric', answer: ans, unit: 'سانتی‌متر مربع', distractors,
    steps: ['مساحت ذوزنقه = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      `${eq(`((${fa(base1)} + ${fa(base2)}) × ${fa(h)}) ÷ ۲`)} = ${fa(ans)}`] };
}
genTrapezoidArea.levels = ['hard'];

function genHouseArea(diff) {
  const [a, b] = diffRange(diff);
  const W = ri(Math.max(4, a), Math.min(8, b)), H = ri(a, Math.min(6, b));
  let triH = ri(2, 4);
  if ((W * triH) % 2 !== 0) triH += 1;
  const rectArea = W * H, triArea = (W * triH) / 2;
  const ans = rectArea + triArea;
  const distractors = [Math.abs(rectArea - triArea) + 2, W + H + triH, ans * 2, rectArea * 2];
  return { topic: 'area', key: 'comp-house', prompt: `این خانه از یک مستطیل (اتاق) + یک مثلث (سقف) ساخته شده. مساحت کل چقدر است؟`,
    shape: Shapes.house(W, H, triH), type: 'numeric', answer: ans, unit: 'متر مربع', distractors,
    steps: [`مستطیل: ${eq(`${fa(W)} × ${fa(H)}`)} = ${fa(rectArea)}`, `مثلث: ${eq(`(${fa(W)} × ${fa(triH)}) ÷ ۲`)} = ${fa(triArea)}`, `جمع = ${fa(ans)}`] };
}
genHouseArea.levels = ['medium', 'hard'];

/* ─── مساحت ترکیب‌ها (جمع مساحت اجزا) ─── */
function makeCompositeAreaGen(key) {
  function gen(diff) {
    const comp = COMPOSITES[key];
    const cellSize = diffCellSize(diff);
    /* ✅ هر خانه = ۱ واحد مربع */
    const ans = compositeArea(comp);
    const distractors = [ans + 1, ans - 1, ans * 2, ans + 3];
    const unit = 'سانتی‌متر مربع';
    /* ✅ ساخت steps با جمع مساحت اجزا */
    const steps = ['شکل از چند بخش ساخته شده. مساحت هر بخش را جدا می‌شماریم:'];
    comp.parts.forEach((p) => {
      steps.push(`${p.label} = ${fa(p.cells)} خانه`);
    });
    const sum = comp.parts.reduce((s, p) => s + p.cells, 0);
    steps.push(`مساحت کل = ${comp.parts.map(p => fa(p.cells)).join(' + ')} = ${fa(sum)} ${unit}`);
    return {
      topic: 'area',
      key: `comp-${key}-a`,
      prompt: `این شکل یک ${comp.name} است که از خانه‌های ۱×۱ ساخته شده. مساحت کل چقدر است؟`,
      shape: ShapesAnim.compositeShape(key, cellSize),
      type: 'numeric', answer: ans, unit, distractors,
      steps
    };
  }
  return gen;
}
const compositeAreaGens = Object.keys(COMPOSITES).map(k => {
  const g = makeCompositeAreaGen(k);
  g.levels = ['easy', 'medium', 'hard'];
  return g;
});

/* ═════════ ۲۴) VOLUME GENERATORS ═════════ */
function genCubeVolume(diff) {
  const [a, b] = diffVolumeRange(diff);
  const s = ri(a, b); const ans = s * s * s;
  const distractors = [s * s, 6 * s * s, 3 * s, s * s * 2];
  return { topic: 'volume', key: 'cube-v', prompt: `حجم مکعبی با ضلع ${fa(s)} سانتی‌متر چقدر است؟`,
    shape: Shapes.cube(s), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب', distractors,
    steps: ['حجم مکعب = ضلع × ضلع × ضلع', `${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(ans)}`] };
}
genCubeVolume.levels = ['easy', 'medium', 'hard'];

function genBoxVolume(diff) {
  const [a, b] = diffVolumeRange(diff);
  const L = ri(a, b), W = ri(a, Math.max(a, b - 1)), H = ri(a, b);
  const ans = L * W * H;
  const distractors = [L * W, L + W + H, 2 * (L + W + H), L * W * 2];
  return { topic: 'volume', key: 'box-v', prompt: `حجم مکعب مستطیلی به طول ${fa(L)}، عرض ${fa(W)} و ارتفاع ${fa(H)} سانتی‌متر چقدر است؟`,
    shape: Shapes.box(L, W, H), type: 'numeric', answer: ans, unit: 'سانتی‌متر مکعب', distractors,
    steps: ['حجم = طول × عرض × ارتفاع', `${eq(`${fa(L)} × ${fa(W)} × ${fa(H)}`)} = ${fa(ans)}`] };
}
genBoxVolume.levels = ['easy', 'medium', 'hard'];

function genFindEdgeFromVolume(diff) {
  const s = ri(2, 4);
  const v = s * s * s;
  const distractors = [round(v / 3, 2), round(v / 2, 2), round(v * 2, 2), s + 2];
  return { topic: 'volume', key: 'find-edge', prompt: `حجم مکعبی ${fa(v)} سانتی‌متر مکعب است. ضلع آن چقدر است؟`,
    shape: Shapes.cube('?'), type: 'numeric', answer: s, unit: 'سانتی‌متر', distractors,
    steps: [`چون ${eq(`${fa(s)} × ${fa(s)} × ${fa(s)}`)} = ${fa(v)}، پس ضلع = ${fa(s)}`] };
}
genFindEdgeFromVolume.levels = ['hard'];

/* ═════════ ۲۵) FRACTION GENERATORS ═════════ */
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
  const maxD = diff === 'hard' ? 8 : 6;
  const d1 = sameDen ? ri(3, maxD) : ri(2, maxD);
  const d2 = sameDen ? d1 : ri(2, maxD);
  const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
  const a = { n: n1, d: d1 }, b = { n: n2, d: d2 };
  const ans = fracAdd(a, b);
  const choices = makeFracChoices(ans, () => fracAdd({ n: ri(1, 5), d: ri(2, maxD) }, { n: ri(1, 5), d: ri(2, maxD) }));
  let steps;
  if (sameDen) {
    steps = [`مخرج‌ها مساوی‌اند: ${fa(d1)}`,
      `صورت‌ها را جمع می‌کنیم: ${eq(`${fa(n1)} + ${fa(n2)}`)} = ${fa(n1+n2)}`,
      `نتیجه: ${fracHTML(ans)}`];
  } else {
    const L = lcm(d1, d2);
    const k1 = L / d1, k2 = L / d2;
    steps = [`مخرج‌ها فرق دارند. ک.م.م مخرج‌ها: ${fa(L)}`,
      `${fracHTML(a)} = ${fracHTML({ n: n1 * k1, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: n2 * k2, d: L })}`,
      `حالا صورت‌ها را جمع می‌کنیم: ${eq(`${fa(n1*k1)} + ${fa(n2*k2)}`)} = ${fa(n1*k1 + n2*k2)}`,
      `نتیجه: ${fracHTML(ans)}`];
  }
  return { topic: 'fractions', key: 'frac-add', prompt: 'حاصل جمع این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr" style="font-size:1.3rem">${fracHTML(a)} + ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans, steps };
}
genFracAdd.levels = ['easy', 'medium', 'hard'];

function genFracSub(diff) {
  const sameDen = diff === 'easy';
  const maxD = diff === 'hard' ? 8 : 6;
  const d1 = sameDen ? ri(3, maxD) : ri(2, maxD);
  const d2 = sameDen ? d1 : ri(2, maxD);
  let n1raw = ri(1, d1 - 1), n2raw = ri(1, d2 - 1);
  let a = { n: n1raw, d: d1 }, b = { n: n2raw, d: d2 };
  if (fracVal(a) < fracVal(b)) [a, b] = [b, a];
  if (fracVal(a) === fracVal(b)) a = { n: Math.min(d1 - 1, a.n + 1), d: a.d };
  const ans = fracSub(a, b);
  const choices = makeFracChoices(ans, () => {
    const f1 = { n: ri(1, 5), d: ri(2, maxD) }, f2 = { n: ri(1, 5), d: ri(2, maxD) };
    return fracVal(f1) > fracVal(f2) ? fracSub(f1, f2) : fracSub(f2, f1);
  });
  let steps;
  if (sameDen) {
    steps = [`مخرج‌ها مساوی‌اند: ${fa(a.d)}`,
      `صورت‌ها را کم می‌کنیم: ${eq(`${fa(a.n)} − ${fa(b.n)}`)} = ${fa(a.n - b.n)}`,
      `نتیجه: ${fracHTML(ans)}`];
  } else {
    const L = lcm(a.d, b.d);
    const k1 = L / a.d, k2 = L / b.d;
    steps = [`مخرج‌ها فرق دارند. ک.م.م مخرج‌ها: ${fa(L)}`,
      `${fracHTML(a)} = ${fracHTML({ n: a.n * k1, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: b.n * k2, d: L })}`,
      `تفریق: ${fracHTML(ans)}`];
  }
  return { topic: 'fractions', key: 'frac-sub', prompt: 'حاصل تفریق این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr" style="font-size:1.3rem">${fracHTML(a)} − ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans, steps };
}
genFracSub.levels = ['easy', 'medium', 'hard'];

function genFracMul(diff) {
  const maxD = diff === 'hard' ? 8 : 6;
  const a = { n: ri(1, 6), d: ri(2, maxD) }, b = { n: ri(1, 6), d: ri(2, maxD) };
  const ans = fracMul(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 10), d: ri(2, maxD) }));
  return { topic: 'fractions', key: 'frac-mul', prompt: 'حاصل ضرب این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr" style="font-size:1.3rem">${fracHTML(a)} × ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans,
    steps: ['در ضرب، مخرج مشترک لازم نیست.',
      `صورت × صورت: ${eq(`${fa(a.n)} × ${fa(b.n)}`)} = ${fa(a.n * b.n)}`,
      `مخرج × مخرج: ${eq(`${fa(a.d)} × ${fa(b.d)}`)} = ${fa(a.d * b.d)}`,
      `نتیجه: ${fracHTML(ans)}`] };
}
genFracMul.levels = ['medium', 'hard'];

function genFracDiv(diff) {
  const maxD = diff === 'hard' ? 8 : 6;
  const a = { n: ri(1, 6), d: ri(2, maxD) }, b = { n: ri(1, 6), d: ri(2, maxD) };
  const ans = fracDiv(a, b);
  const choices = makeFracChoices(ans, () => ({ n: ri(1, 10), d: ri(2, maxD) }));
  return { topic: 'fractions', key: 'frac-div', prompt: 'حاصل تقسیم این دو کسر چقدر است؟',
    promptHTML: `<span dir="ltr" style="font-size:1.3rem">${fracHTML(a)} ÷ ${fracHTML(b)} = ?</span>`,
    type: 'choice', choices, correct: ans,
    steps: ['برای تقسیم کسرها، کسر دوم را معکوس می‌کنیم و در کسر اول ضرب می‌کنیم.',
      `معکوس ${fracHTML(b)} می‌شود ${fracHTML({ n: b.d, d: b.n })}`,
      `${fracHTML(a)} × ${fracHTML({ n: b.d, d: b.n })} = ${fracHTML(ans)}`] };
}
genFracDiv.levels = ['hard'];

function genFracSimplify(diff) {
  let a, ans, g, guard = 0;
  do {
    const base = { n: ri(2, 6), d: ri(2, 8) };
    const k = diff === 'hard' ? ri(3, 5) : ri(2, 3);
    a = { n: base.n * k, d: base.d * k };
    ans = simplify(a.n, a.d);
    g = gcd(a.n, a.d);
    guard++;
  } while ((ans.n === a.n && ans.d === a.d || g < 2) && guard < 30);
  if (g < 2) { a = { n: 4, d: 8 }; ans = { n: 1, d: 2 }; g = 4; }
  const choices = makeFracChoices(ans, () => ({ n: ri(2, 10), d: ri(2, 10) }));
  return {
    topic: 'fractions', key: 'frac-simplify',
    prompt: `این کسر را ساده کن. یعنی صورت و مخرج را بر بزرگ‌ترین مقسوم‌علیه مشترک (ب.م.م) تقسیم کن تا دیگر قابل ساده شدن نباشد.`,
    promptHTML: `<div style="text-align:center;font-size:1.5rem;direction:ltr;margin:8px 0">${fracHTML(a)}</div>
      <div style="text-align:center;font-size:.88rem;color:var(--muted)">صورت = ${fa(a.n)} — مخرج = ${fa(a.d)}</div>`,
    type: 'choice', choices, correct: ans,
    steps: [
      `بزرگ‌ترین مقسوم‌علیه مشترک (ب.م.م) صورت و مخرج: ${fa(g)}`,
      `صورت را تقسیم می‌کنیم: ${eq(`${fa(a.n)} ÷ ${fa(g)}`)} = ${fa(ans.n)}`,
      `مخرج را تقسیم می‌کنیم: ${eq(`${fa(a.d)} ÷ ${fa(g)}`)} = ${fa(ans.d)}`,
      `نتیجه: ${fracHTML(ans)}`,
      `بررسی: آیا ${fracHTML(ans)} دوباره ساده می‌شود؟ ب.م.م ${fa(ans.n)} و ${fa(ans.d)} برابر ۱ است. پس ساده‌ترین شکل است.`
    ]
  };
}
genFracSimplify.levels = ['easy', 'medium', 'hard'];

function genFracCompare(diff) {
  let d1, d2, a, b, guard = 0;
  const maxD = diff === 'hard' ? 8 : 6;
  do {
    d1 = ri(3, maxD); d2 = ri(3, maxD);
    a = { n: ri(1, d1 - 1), d: d1 }; b = { n: ri(1, d2 - 1), d: d2 };
    guard++;
  } while (fracVal(a) === fracVal(b) && guard < 20);
  const correct = fracVal(a) > fracVal(b) ? '>' : '<';
  const L = lcm(a.d, b.d);
  return { topic: 'fractions', key: 'frac-cmp', prompt: 'کدام علامت درست است؟',
    promptHTML: `<span dir="ltr" style="font-size:1.3rem">${fracHTML(a)} ? ${fracHTML(b)}</span>` + ShapesAnim.fracCompareBars(a.n, a.d, b.n, b.d),
    type: 'choice',
    choices: [{ n: '>', isSym: true }, { n: '<', isSym: true }, { n: '=', isSym: true }],
    correct: { n: correct, isSym: true },
    steps: [
      `مخرج مشترک: ک.م.م ${fa(a.d)} و ${fa(b.d)} = ${fa(L)}`,
      `${fracHTML(a)} = ${fracHTML({ n: a.n * L / a.d, d: L })}`,
      `${fracHTML(b)} = ${fracHTML({ n: b.n * L / b.d, d: L })}`,
      `پس ${fracHTML(a)} ${correct === '>' ? '>' : '<'} ${fracHTML(b)}`
    ] };
}
genFracCompare.levels = ['easy', 'medium', 'hard'];

function genMixedToImproper(diff) {
  const whole = ri(1, diff === 'hard' ? 3 : 2), d = ri(2, 5), n = ri(1, d - 1);
  const imp = { n: whole * d + n, d };
  const choices = makeFracChoices(imp, () => ({ n: ri(2, 30), d: ri(2, 8) }));
  return { topic: 'fractions', key: 'mixed-imp', prompt: 'این عدد مخلوط را به کسر تبدیل کن:',
    promptHTML: `<div style="text-align:center;font-size:1.4rem;direction:ltr;margin:8px 0">${mixedHTML(imp)}</div>`,
    type: 'choice', choices, correct: imp,
    steps: [
      `عدد صحیح × مخرج: ${eq(`${fa(whole)} × ${fa(d)}`)} = ${fa(whole * d)}`,
      `به اضافه صورت: ${eq(`${fa(whole * d)} + ${fa(n)}`)} = ${fa(whole * d + n)}`,
      `کسر: ${fracHTML(imp)}`
    ] };
}
genMixedToImproper.levels = ['medium', 'hard'];

function genWordFrac(diff) {
  const d = ri(3, 5), n = ri(1, d - 1);
  const total = d * ri(2, 3);
  const ans = (total / d) * n;
  const distractors = [total, round(total / d, 2), total - ans > 0 ? total - ans : ans + 5, round(total / 2, 2)];
  const ctx = pick(CTX_FR);
  return { topic: 'fractions', key: 'frac-word',
    prompt: `${ctx.name} ${fracHTML({ n, d })} از ${fa(total)} ${ctx.u} را ${ctx.verb}. ${ctx.q}`,
    type: 'numeric', answer: ans, unit: ctx.u, distractors,
    steps: [
      `یعنی باید ${fa(total)} را به ${fa(d)} قسمت مساوی تقسیم کنیم و ${fa(n)} قسمت برداریم.`,
      `یک قسمت: ${eq(`${fa(total)} ÷ ${fa(d)}`)} = ${fa(total / d)}`,
      `${fa(n)} قسمت: ${eq(`${fa(n)} × ${fa(total / d)}`)} = ${fa(ans)}`
    ] };
}
genWordFrac.levels = ['hard'];

/* ═════════ ۲۶) DECIMAL GENERATORS ═════════ */
function genDecAdd(diff) {
  const cfg = { easy: [1, 5, 1], medium: [2, 6, 1], hard: [3, 8, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const n2 = round(ri(a * 10, b * 10) / 10, dec);
  const ans = round(n1 + n2, dec);
  const distractors = [round(ans / 2, dec), round(ans * 2, dec), round(ans + 1, dec), round(Math.abs(n1 - n2), dec)];
  return { topic: 'decimals', key: 'dec-add', prompt: `حاصل جمع ${faDec(n1, dec)} + ${faDec(n2, dec)} چقدر است؟`,
    promptHTML: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(n1, dec)} + ${faDec(n2, dec)} = ?</div>`,
    type: 'numeric', answer: ans, distractors,
    steps: ['ممیزها را زیر هم تراز می‌کنیم، بعد جمع می‌کنیم.',
      `${eq(`${faDec(n1, dec)} + ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`] };
}
genDecAdd.levels = ['easy', 'medium', 'hard'];

function genDecSub(diff) {
  const cfg = { easy: [1, 5, 1], medium: [2, 6, 1], hard: [3, 8, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  let n1 = round(ri(a * 10, b * 10) / 10, dec);
  let n2 = round(ri(a * 10, b * 10) / 10, dec);
  if (n1 < n2) [n1, n2] = [n2, n1];
  if (n1 === n2) n1 = round(n1 + 1, dec);
  const ans = round(n1 - n2, dec);
  const distractors = [round(n1 + n2, dec), round(ans / 2, dec), round(ans + 1, dec), round(n1, dec)];
  return { topic: 'decimals', key: 'dec-sub', prompt: `حاصل تفریق ${faDec(n1, dec)} − ${faDec(n2, dec)} چقدر است؟`,
    promptHTML: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(n1, dec)} − ${faDec(n2, dec)} = ?</div>`,
    type: 'numeric', answer: ans, distractors,
    steps: ['ممیزها را زیر هم تراز می‌کنیم، بعد تفریق می‌کنیم.',
      `${eq(`${faDec(n1, dec)} − ${faDec(n2, dec)}`)} = ${faDec(ans, dec)}`] };
}
genDecSub.levels = ['easy', 'medium', 'hard'];

function genDecMul(diff) {
  const cfg = { medium: [2, 5, 1], hard: [3, 6, 2] };
  const [a, b, dec] = cfg[diff] || cfg.medium;
  const n1 = round(ri(a * 10, b * 10) / 10, dec);
  const whole = ri(2, 5);
  const ans = round(n1 * whole, dec);
  const distractors = [round(n1 + whole, dec), round(ans / 2, dec), round(ans * 2, dec), round(n1, dec)];
  return { topic: 'decimals', key: 'dec-mul', prompt: `حاصل ضرب ${faDec(n1, dec)} در ${fa(whole)} چقدر است؟`,
    promptHTML: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(n1, dec)} × ${fa(whole)} = ?</div>`,
    type: 'numeric', answer: ans, distractors,
    steps: ['بدون ممیز ضرب می‌کنیم، بعد ممیز می‌گذاریم.',
      `${eq(`${faDec(n1, dec)} × ${fa(whole)}`)} = ${faDec(ans, dec)}`] };
}
genDecMul.levels = ['medium', 'hard'];

function genDecDiv(diff) {
  const whole = ri(2, 5);
  const ans = round(ri(5, 20) / 10, 1);
  const n1 = round(ans * whole, 1);
  const distractors = [round(ans * 2, 1), round(ans / 2, 1), round(n1, 1), round(ans + 1, 1)];
  return { topic: 'decimals', key: 'dec-div', prompt: `حاصل تقسیم ${faDec(n1, 1)} بر ${fa(whole)} چقدر است؟`,
    promptHTML: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(n1, 1)} ÷ ${fa(whole)} = ?</div>`,
    type: 'numeric', answer: ans, distractors,
    steps: [`${eq(`${faDec(n1, 1)} ÷ ${fa(whole)}`)} = ${faDec(ans, 1)}`] };
}
genDecDiv.levels = ['hard'];

function genDecCompare(diff) {
  const dec = diff === 'easy' ? 1 : 2;
  const max = diff === 'hard' ? 500 : 99;
  const n1 = round(ri(1, max) / 10, dec);
  let n2 = round(ri(1, max) / 10, dec);
  if (n1 === n2) n2 = round(n1 + 0.1, dec);
  const correct = n1 > n2 ? '>' : '<';
  return { topic: 'decimals', key: 'dec-cmp', prompt: `کدام علامت بین ${faDec(n1, dec)} و ${faDec(n2, dec)} درست است؟`,
    promptHTML: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(n1, dec)} ? ${faDec(n2, dec)}</div>` + ShapesAnim.decCompareBars(n1, n2),
    type: 'choice',
    choices: [{ n: '>', isSym: true }, { n: '<', isSym: true }, { n: '=', isSym: true }],
    correct: { n: correct, isSym: true },
    steps: ['رقم به رقم از چپ مقایسه می‌کنیم.', `${eq(`${faDec(n1, dec)} ${correct === '>' ? '>' : '<'} ${faDec(n2, dec)}`)}`] };
}
genDecCompare.levels = ['easy', 'medium', 'hard'];

function genFracToDec(diff) {
  const options = [
    { n: 1, d: 2, v: 0.5 }, { n: 1, d: 4, v: 0.25 }, { n: 3, d: 4, v: 0.75 },
    { n: 1, d: 5, v: 0.2 }, { n: 2, d: 5, v: 0.4 }, { n: 1, d: 10, v: 0.1 }
  ];
  const f = pick(options);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3);
  const choices = shuffle([
    { n: String(f.v), isNum: true },
    ...wrong.map(o => ({ n: String(o.v), isNum: true }))
  ]);
  return { topic: 'decimals', key: 'frac-dec', prompt: `کسر زیر را به اعشار تبدیل کن:`,
    promptHTML: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${fracHTML(f)}</div>`,
    type: 'choice', choices, correct: { n: String(f.v), isNum: true },
    steps: [`صورت را بر مخرج تقسیم می‌کنیم: ${eq(`${fa(f.n)} ÷ ${fa(f.d)}`)} = ${faDec(f.v, 3)}`] };
}
genFracToDec.levels = ['easy', 'medium', 'hard'];

function genDecToFrac(diff) {
  const options = [
    { n: 1, d: 2, v: '0.5' }, { n: 1, d: 4, v: '0.25' }, { n: 3, d: 4, v: '0.75' },
    { n: 1, d: 5, v: '0.2' }, { n: 2, d: 5, v: '0.4' }, { n: 3, d: 10, v: '0.3' },
    { n: 7, d: 10, v: '0.7' }, { n: 9, d: 10, v: '0.9' }
  ];
  const f = pick(options);
  const wrong = shuffle(options.filter(o => o.v !== f.v)).slice(0, 3).map(o => ({ n: o.n, d: o.d }));
  const choices = shuffle([{ n: f.n, d: f.d }, ...wrong]);
  return { topic: 'decimals', key: 'dec-frac', prompt: `عدد اعشاری زیر را به کسر تبدیل کن:`,
    promptHTML: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${faDec(f.v, 2)}</div>`,
    type: 'choice', choices, correct: { n: f.n, d: f.d },
    steps: [
      `تعداد ارقام بعد از ممیز = تعداد صفرهای مخرج`,
      `${faDec(f.v, 2)} = ${fracHTML({ n: f.n, d: f.d })}`
    ] };
}
genDecToFrac.levels = ['medium', 'hard'];

function genDecWord(diff) {
  const whole = ri(2, 4);
  const price = round(ri(15, 45) / 10, 1);
  const ans = round(whole * price, 1);
  const distractors = [round(ans / 2, 1), round(ans * 2, 1), round(price + whole, 1), round(price, 1)];
  return { topic: 'decimals', key: 'dec-word',
    prompt: `قیمت یک دفتر ${faDec(price, 1)} هزار تومان است. قیمت ${fa(whole)} دفتر چقدر می‌شود؟`,
    type: 'numeric', answer: ans, unit: 'هزار تومان', distractors,
    steps: [`${eq(`${faDec(price, 1)} × ${fa(whole)}`)} = ${faDec(ans, 1)}`] };
}
genDecWord.levels = ['hard'];

function genDecOnLine(diff) {
  const vals = diff === 'easy'
    ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    : [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85];
  const v = pick(vals);
  const wrongs = shuffle(vals.filter(x => x !== v)).slice(0, 3);
  const choices = shuffle([v, ...wrongs].map(x => ({ n: String(x), isNum: true })));
  return { topic: 'decimals', key: 'dec-line',
    prompt: `نشانگر روی محور اعداد چه عددی را نشان می‌دهد؟`,
    promptHTML: ShapesAnim.decimalLine([], v, 0, 1),
    type: 'choice', choices, correct: { n: String(v), isNum: true },
    steps: [
      `هر تقسیم کوچک بین ۰ و ۱ برابر یک‌دهم (۰٫۱) است.`,
      `نشانگر روی ${faDec(v, 2)} قرار دارد.`
    ] };
}
genDecOnLine.levels = ['easy', 'medium'];

/* ✅ محور اعشار جمع — یکپارچه با قوس از صفر به a، سپس به a+b */
function genDecAddOnLine(diff) {
  const a = round(ri(1, 5) / 10, 1);
  const b = round(ri(1, 4) / 10, 1);
  const ans = round(a + b, 1);
  const choices = shuffle([
    { n: String(ans), isNum: true },
    { n: String(round(a + b + 0.1, 1)), isNum: true },
    { n: String(round(Math.abs(a - b), 1)), isNum: true },
    { n: String(round(a + b - 0.1, 1)), isNum: true }
  ]);
  return { topic: 'decimals', key: 'dec-line-add',
    prompt: `روی محور اعداد، از صفر شروع کن، به اندازه‌ی ${faDec(a, 1)} جلو برو، سپس ${faDec(b, 1)} دیگر جلو برو. به چه عددی می‌رسی؟`,
    promptHTML: ShapesAnim.decimalAddOnLine(0, 1.2, a, b),
    type: 'choice', choices, correct: { n: String(ans), isNum: true },
    steps: [
      `از ۰ شروع می‌کنیم و ${faDec(a, 1)} جلو می‌رویم.`,
      `سپس ${faDec(b, 1)} دیگر جلو می‌رویم.`,
      `نتیجه: ${eq(`${faDec(a, 1)} + ${faDec(b, 1)}`)} = ${faDec(ans, 1)}`
    ] };
}
genDecAddOnLine.levels = ['medium', 'hard'];

/* ✅ محور اعشار تفریق — یکپارچه از صفر به a، سپس به a−b */
function genDecSubOnLine(diff) {
  const a = round(ri(5, 9) / 10, 1);
  const b = round(ri(1, 4) / 10, 1);
  const ans = round(a - b, 1);
  const choices = shuffle([
    { n: String(ans), isNum: true },
    { n: String(round(a + b, 1)), isNum: true },
    { n: String(round(a - b + 0.1, 1)), isNum: true },
    { n: String(round(a - b - 0.1, 1)), isNum: true }
  ]);
  return { topic: 'decimals', key: 'dec-line-sub',
    prompt: `روی محور اعداد، از صفر تا ${faDec(a, 1)} جلو برو، سپس به اندازه‌ی ${faDec(b, 1)} به عقب برگرد. کجا می‌رسی؟`,
    promptHTML: ShapesAnim.decimalSubOnLine(0, 1, a, b),
    type: 'choice', choices, correct: { n: String(ans), isNum: true },
    steps: [
      `از ۰ شروع می‌کنیم و ${faDec(a, 1)} جلو می‌رویم.`,
      `سپس ${faDec(b, 1)} به عقب برمی‌گردیم.`,
      `نتیجه: ${eq(`${faDec(a, 1)} − ${faDec(b, 1)}`)} = ${faDec(ans, 1)}`
    ] };
}
genDecSubOnLine.levels = ['medium', 'hard'];

/* ═════════ ۲۷) GENERATOR POOL ═════════ */
const Generators = {
  perimeter: [
    genSquarePerimeter, genRectPerimeter, genTrianglePerimeter,
    genCirclePerimeter, genParallelogramPerimeter, genRhombusPerimeter,
    genPolygonPerimeter, genFindSideFromPerimeter,
    genHousePerimeter, genParkPerimeter,
    ...compositePerimeterGens
  ],
  area: [
    genSquareArea, genRectArea, genTriangleArea, genCircleArea,
    genParallelogramArea, genRhombusArea, genTrapezoidArea,
    genHouseArea,
    ...compositeAreaGens
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
  return numericToChoice(pick(pool)(difficulty));
}
/* ═════════ ۲۸) GAMIFICATION ═════════ */
const BADGES = [
  { id: 'first', emoji: '🎯', name: 'اولین قدم', desc: 'اولین پاسخ درست' },
  { id: 'streak5', emoji: '🔥', name: '۵ تایی', desc: '۵ پاسخ درست پشت‌سرهم' },
  { id: 'streak10', emoji: '⚡', name: '۱۰ تایی', desc: '۱۰ پاسخ درست پشت‌سرهم' },
  { id: 'coin50', emoji: '💰', name: 'کیسه طلا', desc: '۵۰ سکه' },
  { id: 'star10', emoji: '⭐', name: 'ستاره‌چین', desc: '۱۰ ستاره' },
  { id: 'level3', emoji: '🏅', name: 'سطح ۳', desc: 'رسیدن به سطح ۳' },
  { id: 'master', emoji: '🧠', name: 'استاد', desc: '۲۰ پاسخ درست' },
  { id: 'perfect', emoji: '💎', name: 'بی‌نقص', desc: 'آزمون با نمره‌ی ۱۰۰٪' },
  { id: 'daily', emoji: '🌅', name: 'چالش‌گر', desc: 'اولین چالش روزانه' },
  /* ✅ جدید: شارة بی‌خطا */
  { id: 'flawless10', emoji: '🏆', name: 'بی‌خطا', desc: '۱۰ پاسخ درست پشت‌سرهم بدون هیچ خطا' }
];

function awardCorrect(streak) {
  const s = activeStudent();
  if (!s) return;
  s.stats.xp += 10 + Math.min(streak, 10) * 2;
  s.stats.coins += 1 + Math.floor(streak / 3);
  s.stats.stars += streak >= 3 ? 1 : 0;
  /* ✅ بروزرسانی perfectStreak */
  s.stats.perfectStreak = (s.stats.perfectStreak || 0) + 1;
  checkLevelUp(); checkBadges(); saveState();
}
function checkLevelUp() {
  const s = activeStudent();
  if (!s) return;
  const newLevel = Math.floor(s.stats.xp / 100) + 1;
  if (newLevel > s.stats.level) {
    s.stats.level = newLevel;
    sound.levelUp();
    showFloat(`🎉 سطح ${fa(newLevel)}!`);
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
  /* ✅ شارة بی‌خطا */
  if ((s.stats.perfectStreak || 0) >= 10) add('flawless10');
  if (count > 0) showFloat(count === 1 ? '🏆 نشان جدید!' : `🏆 ${fa(count)} نشان!`);
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

/* ═════════ ۲۹) DAILY ═════════ */
function dailyAvailable() { return state.dailyChallenge.lastDate !== todayKey(); }
function startDailyChallenge() {
  const topic = pick(ALL_TOPICS);
  const q = generateQuestion(topic, 'medium');
  if (!q) return;
  session = { mode: 'daily', topic, difficulty: 'medium', index: 0, current: q, answered: false, selected: null, wrongAttempts: 0 };
  navigate('dailyQuestion');
}
function completeDailyChallenge(correct) {
  state.dailyChallenge.lastDate = todayKey();
  state.dailyChallenge.lastCorrect = correct;
  const stu = activeStudent();
  if (stu) {
    if (!stu.stats.badges.includes('daily')) stu.stats.badges.push('daily');
    if (correct) { stu.stats.coins += 5; stu.stats.stars += 2; stu.stats.xp += 30; checkLevelUp(); }
  }
  saveState();
}

/* ═════════ ۳۰) PROGRESSIVE HINT ═════════ */
function getProgressiveHint(q) {
  if (!q || !q.steps || !q.steps.length) return 'دوباره سوال را با دقت بخوان.';
  return `<strong>راهنمایی:</strong> ${q.steps[0]}`;
}

/* ═════════ ۳۱) ROUTER ═════════ */
let route = { name: 'home', params: {} };
let session = null;
let examTimer = null;
let debugLog = [];
function logDebug(msg) {
  const entry = `[${new Date().toLocaleTimeString('fa-IR')}] ${msg}`;
  debugLog.unshift(entry);
  if (debugLog.length > 50) debugLog.length = 50;
  const el = document.getElementById('debugLog');
  if (el) el.textContent = debugLog.join('\n');
}
function navigate(name, params = {}) {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  if (session && ['students', 'addStudent', 'home', 'profile', 'contact'].includes(name)) session = null;
  route = { name, params };
  logDebug(`→ ${name}`);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═════════ ۳۲) COMMON ═════════ */
const app = document.getElementById('app');
function themeIcon() {
  const t = state.settings.theme || 'auto';
  if (t === 'dark') return '🌙';
  if (t === 'light') return '☀️';
  return '🌓';
}
/* ✅ حذف TTS از header */
function header(title, showBack = false) {
  return `<div class="top-bar">
    ${showBack ? `<button class="icon-btn back-btn" onclick="window.__goBack()" aria-label="بازگشت">➜</button>` : `<span style="width:44px"></span>`}
    <h1>${title}</h1>
    <button class="icon-btn theme-btn" onclick="window.__cycleTheme()" aria-label="تغییر تم">${themeIcon()}</button>
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
  return `<nav class="bottom-nav">${items.map(it => `
    <button class="nav-btn ${route.name === it.id ? 'active' : ''}" onclick="window.__nav('${it.id}')">
      <span class="ico">${it.ico}</span><span>${it.label}</span>
    </button>`).join('')}</nav>`;
}

/* ═════════ ۳۳) STUDENTS ═════════ */
function viewStudents() {
  const has = state.students.length > 0;
  return `${header('👥 دانش‌آموزان')}
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:3.5rem">👨‍🎓</div>
    <h2 style="margin:8px 0">${has ? 'کدام دانش‌آموز؟' : 'خوش آمدی!'}</h2>
  </div>
  ${has ? `<div class="grid">
    ${state.students.map(s => `
      <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px">
        <div class="student-avatar" onclick="window.__selectStudent('${s.id}')" style="cursor:pointer">${escHtml(s.name[0] || '؟')}</div>
        <div style="flex:1;cursor:pointer" onclick="window.__selectStudent('${s.id}')">
          <p class="student-name" style="margin:0">${escHtml(fullName(s))}</p>
          <p class="student-meta">پایه ${fa(s.grade)} — سطح ${fa(s.stats.level)}</p>
        </div>
        <button class="delete-btn" onclick="event.stopPropagation();window.__deleteStudent('${s.id}')">🗑️</button>
      </div>`).join('')}
  </div>` : ''}
  <button class="btn full" style="margin-top:16px" onclick="window.__nav('addStudent')">➕ افزودن دانش‌آموز</button>`;
}
function viewAddStudent() {
  return `${header('➕ دانش‌آموز جدید', true)}
  <div class="card">
    <label style="display:block;margin-bottom:14px"><span>نام:</span>
      <input type="text" id="stuName" class="num-input" style="text-align:right;font-weight:400;margin-top:6px" placeholder="مثلاً علی" maxlength="20">
    </label>
    <label style="display:block;margin-bottom:14px"><span>نام خانوادگی (اختیاری):</span>
      <input type="text" id="stuFamily" class="num-input" style="text-align:right;font-weight:400;margin-top:6px" placeholder="مثلاً نوری" maxlength="20">
    </label>
    <label style="display:block"><span>پایه:</span>
      <select id="stuGrade" class="num-input" style="text-align:right;margin-top:6px">
        ${[3, 4, 5, 6, 7, 8, 9].map(g => `<option value="${g}" ${g === 4 ? 'selected' : ''}>پایه ${fa(g)}</option>`).join('')}
      </select>
    </label>
  </div>
  <button class="btn full" style="margin-top:16px" onclick="window.__createStudent()">✅ ساخت پروفایل</button>
  ${bottomNav()}`;
}

/* ═════════ ۳۴) HOME / PROFILE / TOPIC ═════════ */
function viewHome() {
  const daily = dailyAvailable();
  return `${header('ریاضی‌یار 🎓')}
  ${daily ? `<div class="daily-card"><h3>🌅 چالش روزانه</h3><p>یک سوال ویژه با پاداش دوبرابر!</p>
    <button class="daily-btn" onclick="window.__startDaily()">شروع چالش</button></div>` :
    `<div class="card" style="text-align:center;background:var(--feedback-good-bg);border-right:4px solid var(--success)">
      <p style="margin:0;color:var(--success);font-weight:700">✅ چالش امروز انجام شد!</p></div>`}
  <p style="color:var(--muted);margin:12px 0;text-align:center">یک موضوع انتخاب کن:</p>
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('perimeter')"><span class="icon-big">📏</span><h3 class="card-title">محیط</h3><p class="card-desc">دور شکل‌ها</p></button>
    <button class="card card-btn" onclick="window.__nav('area')"><span class="icon-big">📐</span><h3 class="card-title">مساحت</h3><p class="card-desc">سطح شکل‌ها</p></button>
    <button class="card card-btn" onclick="window.__nav('volume')"><span class="icon-big">🧊</span><h3 class="card-title">حجم</h3><p class="card-desc">شکل‌های ۳بعدی</p></button>
    <button class="card card-btn" onclick="window.__nav('fractions')"><span class="icon-big">🍰</span><h3 class="card-title">کسرها</h3><p class="card-desc">قسمت‌های کل</p></button>
    <button class="card card-btn" onclick="window.__nav('decimals')"><span class="icon-big">🔢</span><h3 class="card-title">اعشاری</h3><p class="card-desc">با ممیز</p></button>
    <button class="card card-btn" onclick="window.__nav('progress')"><span class="icon-big">📊</span><h3 class="card-title">پیشرفت من</h3><p class="card-desc">نمودار یادگیری</p></button>
  </div>
  <div style="margin-top:14px">
    <button class="card card-btn" style="width:100%;text-align:center;background:var(--hint-bg);border:2px solid var(--primary-l)" onclick="window.__nav('multiExamSetup')">
      <span class="icon-big">🎯</span><h3 class="card-title" style="justify-content:center">آزمون جامع</h3><p class="card-desc">از چند درس مختلف</p>
    </button>
  </div>
  ${bottomNav()}`;
}
function viewProfile() {
  const s = activeStudent();
  if (!s) return `<div class="empty">دانش‌آموزی انتخاب نشده</div>`;
  const ps = s.stats.perfectStreak || 0;
  return `${header('👤 پروفایل', true)}
  <div class="profile-hero">
    <div class="profile-avatar">${escHtml(s.name[0] || '؟')}</div>
    <p class="profile-name">${escHtml(fullName(s))}</p>
    <p class="profile-meta">پایه ${fa(s.grade)}</p>
  </div>
  <div class="card">
    <h3 class="card-title">🏆 دستاوردها</h3>
    <div class="stats-row">
      <div class="stat-item"><div class="stat-value">${fa(s.stats.level)}</div><div class="stat-label">سطح</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.coins)}</div><div class="stat-label">🪙 سکه</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.stars)}</div><div class="stat-label">⭐ ستاره</div></div>
      <div class="stat-item"><div class="stat-value">${fa(s.stats.bestStreak)}</div><div class="stat-label">🔥 رکورد</div></div>
    </div>
    ${ps > 0 ? `<p style="text-align:center;margin-top:10px;font-size:.9rem;color:var(--muted)">در حال حاضر: <strong style="color:var(--success)">${fa(ps)} پاسخ درست پشت‌سرهم</strong></p>` : ''}
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
    <p style="color:var(--muted);font-size:.85rem;margin:0 0 10px">ساخته شده با ❤️ توسط <strong style="direction:ltr">maysam261</strong></p>
    <p style="margin:0 0 12px"><span class="version-badge">v${APP_VERSION}</span></p>
    <button class="btn info full" onclick="window.__nav('contact')">📞 ارتباط</button>
  </div>
  ${bottomNav()}`;
}
function viewTopic(topic) {
  const titles = { perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم', fractions: '🍰 کسرها', decimals: '🔢 اعداد اعشاری' };
  return `${header(titles[topic], true)}
  <div class="grid grid-2">
    <button class="card card-btn" onclick="window.__nav('learn', {topic:'${topic}'})"><span class="icon-big">📚</span><h3 class="card-title">آموزش</h3><p class="card-desc">با انیمیشن و مثال</p></button>
    <button class="card card-btn" onclick="window.__nav('practice', {topic:'${topic}'})"><span class="icon-big">✏️</span><h3 class="card-title">تمرین</h3><p class="card-desc">سوال‌های چهارگزینه‌ای</p></button>
    <button class="card card-btn" onclick="window.__nav('examSetup', {topic:'${topic}'})"><span class="icon-big">🎯</span><h3 class="card-title">آزمون</h3><p class="card-desc">با کارنامه</p></button>
    <button class="card card-btn" onclick="window.__nav('progress')"><span class="icon-big">📊</span><h3 class="card-title">پیشرفت</h3><p class="card-desc">درصد یادگیری</p></button>
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۳۵) CONTACT ═════════ */
function brandLogo(opts) {
  const { src, alt, fallbackEmoji, bgColor } = opts;
  return `<span style="display:inline-flex;flex-shrink:0;width:64px;height:64px;border-radius:50%;background:#fff;padding:8px;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden">
    <img src="${src}" alt="${alt || ''}" width="48" height="48" loading="lazy" style="width:48px;height:48px;object-fit:contain;display:block"
      onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">
    <span style="display:none;width:48px;height:48px;border-radius:50%;background:${bgColor || '#eee'};align-items:center;justify-content:center;font-size:1.8rem;line-height:1">${fallbackEmoji || '💬'}</span>
  </span>`;
}
const CONTACT_LINKS = [
  { name: 'تلگرام', url: 'https://t.me/MaySam261', src: 'icons/telegram-logo.png', emoji: '✈️', bg: '#229ED9' },
  { name: 'بله', url: 'https://ble.ir/maysam261', src: 'icons/bale-logo.png', emoji: '💚', bg: '#3BB54A' },
  { name: 'ایتا', url: 'https://eitaa.com/maysam261', src: 'icons/eitaa-logo.png', emoji: '📘', bg: '#E15549' }
];
function viewContact() {
  return `${header('📞 ارتباط', true)}
  <div class="card" style="text-align:center">
    <div style="font-size:3.5rem">👨‍💻</div>
    <h2 style="margin:8px 0;direction:ltr">maysam261</h2>
    <p style="color:var(--muted)">تهیه‌کننده ریاضی‌یار</p>
    <p style="margin:8px 0 0"><span class="version-badge">v${APP_VERSION}</span></p>
  </div>
  <p style="color:var(--muted);margin:20px 0 14px;text-align:center;font-size:.9rem">برای ارتباط، روی لوگوی پیام‌رسان مورد نظر بزن:</p>
  <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;padding:10px 0">
    ${CONTACT_LINKS.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;text-decoration:none;color:inherit">
        ${brandLogo({ src: link.src, alt: 'لوگوی ' + link.name, fallbackEmoji: link.emoji, bgColor: link.bg })}
        <span style="font-size:.85rem;font-weight:600;color:var(--primary-d)">${link.name}</span>
      </a>`).join('')}
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۳۶) LESSONS (بازنویسی با مثال‌های بیشتر + تمرین جدا) ═════════ */
const LESSONS = {
  perimeter: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛', formula: 'محیط = ۴ × ضلع',
      paragraphs: [
        'مربع ۴ ضلع مساوی دارد و همه زوایایش قائمه است.',
        'محیط یعنی «دور تا دور» شکل.',
        'چون هر چهار ضلع مساوی‌اند، کافیست یک ضلع را در ۴ ضرب کنیم.'
      ],
      examples: [
        { text: 'یک کاشی مربعی با ضلع ۳ سانتی‌متر. دور تا دورش چقدر است؟',
          shape: ShapesAnim.tracingSquare(3),
          steps: ['مربع ۴ ضلع مساوی دارد.', 'محیط = ۴ × ضلع', '۴ × ۳ = ۱۲'], answer: '۱۲ سانتی‌متر' },
        { text: 'زمین بازی مربعی با ضلع ۶ متر. یک دور کامل چند متر است؟',
          shape: ShapesAnim.tracingSquare(6),
          steps: ['۴ × ۶ = ۲۴'], answer: '۲۴ متر' }
      ],
      tips: ['محیط یعنی دور تا دور.', 'همیشه واحد را بنویس.'],
      pitfalls: ['مساحت = ضلع × ضلع، محیط = ۴ × ضلع.']
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'محیط = ۲ × (طول + عرض)',
      paragraphs: ['مستطیل ۴ ضلع دارد، ولی فقط اضلاع روبه‌رو مساوی‌اند.', 'برای محیط، اول طول و عرض را جمع می‌کنیم، بعد در ۲ ضرب.'],
      examples: [
        { text: 'دفتری با طول ۵ و عرض ۳ سانتی‌متر. دور تا دورش چقدر است؟',
          shape: ShapesAnim.tracingRect(5, 3),
          steps: ['۵ + ۳ = ۸', '۲ × ۸ = ۱۶'], answer: '۱۶ سانتی‌متر' },
        { text: 'استخری مستطیلی به طول ۸ و عرض ۴ متر. حفاظ دور آن چقدر است؟',
          shape: ShapesAnim.tracingRect(8, 4),
          steps: ['۸ + ۴ = ۱۲', '۲ × ۱۲ = ۲۴'], answer: '۲۴ متر' }
      ],
      tips: ['اضلاع روبه‌رو مساوی‌اند.'],
      pitfalls: ['اول جمع، بعد ضرب در ۲.']
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'محیط = ضلع۱ + ضلع۲ + ضلع۳',
      paragraphs: ['مثلث ۳ ضلع دارد.', 'برای محیط، سه ضلع را با هم جمع می‌کنیم.'],
      examples: [
        { text: 'مثلثی با اضلاع ۳، ۴ و ۵ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.tracingTriangle(3, 4, 5),
          steps: ['۳ + ۴ + ۵ = ۱۲'], answer: '۱۲ سانتی‌متر' },
        { text: 'مثلثی با اضلاع ۶، ۷ و ۸ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.tracingTriangle(6, 7, 8),
          steps: ['۶ + ۷ + ۸ = ۲۱'], answer: '۲۱ سانتی‌متر' }
      ],
      tips: ['مجموع دو ضلع کوچک باید بزرگ‌تر از ضلع بزرگ باشد.'],
      pitfalls: ['نیازی نیست همه اضلاع مساوی باشند.']
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪', formula: 'محیط = ۲ × π × شعاع',
      paragraphs: ['دایره یک شکل گرد است.', 'شعاع = فاصله‌ی مرکز تا لبه. π ≈ ۳٫۱۴.'],
      examples: [
        { text: 'دایره‌ای با شعاع ۲ سانتی‌متر. دور تا دورش چقدر است؟',
          shape: ShapesAnim.circlePerimeterAnim(2),
          steps: ['۲ × ۳٫۱۴ × ۲ = ۱۲٫۵۶'], answer: '۱۲٫۵۶ سانتی‌متر' },
        { text: 'دایره‌ای با قطر ۶ متر. محیطش چقدر است؟',
          shape: ShapesAnim.circlePerimeterAnim(3),
          steps: ['شعاع = ۳', '۲ × ۳٫۱۴ × ۳ = ۱۸٫۸۴'], answer: '۱۸٫۸۴ متر' }
      ],
      tips: ['قطر = ۲ × شعاع.'],
      pitfalls: ['اگر قطر داری، اول بر ۲ تقسیم کن.']
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'محیط = ۲ × (a + b)',
      paragraphs: ['اضلاع روبه‌رو مساوی و موازی‌اند.'],
      examples: [
        { text: 'متوازی‌الاضلاعی با اضلاع ۴ و ۶ متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterParallelogram(4, 6),
          steps: ['۲ × (۴ + ۶) = ۲۰'], answer: '۲۰ متر' },
        { text: 'متوازی‌الاضلاعی با اضلاع ۵ و ۳ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterParallelogram(5, 3),
          steps: ['۲ × (۵ + ۳) = ۱۶'], answer: '۱۶ سانتی‌متر' }
      ],
      tips: ['دو جفت ضلع مساوی.'],
      pitfalls: ['ارتفاع ≠ ضلع کج.']
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'محیط = ۴ × ضلع',
      paragraphs: ['لوزی همه اضلاعش مساوی است.'],
      examples: [
        { text: 'لوزی با ضلع ۴ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterRhombus(4),
          steps: ['۴ × ۴ = ۱۶'], answer: '۱۶ سانتی‌متر' },
        { text: 'لوزی با ضلع ۶ متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterRhombus(6),
          steps: ['۴ × ۶ = ۲۴'], answer: '۲۴ متر' }
      ],
      tips: ['مانند مربع محاسبه می‌شود.'],
      pitfalls: ['قطرها محیط نیستند.']
    },
    {
      id: 'poly', title: 'چندضلعی منتظم', emoji: '⬟', formula: 'محیط = تعداد ضلع × ضلع',
      paragraphs: ['همه‌ی ضلع‌ها و زوایا مساوی.'],
      examples: [
        { text: 'شش‌ضلعی منتظم با ضلع ۳ سانتی‌متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterPolygon(6, 3),
          steps: ['۶ × ۳ = ۱۸'], answer: '۱۸ سانتی‌متر' },
        { text: 'پنج‌ضلعی منتظم با ضلع ۴ متر. محیطش چقدر است؟',
          shape: ShapesAnim.perimeterPolygon(5, 4),
          steps: ['۵ × ۴ = ۲۰'], answer: '۲۰ متر' }
      ],
      tips: ['تعداد ضلع را از نام شکل بخوان.'],
      pitfalls: ['تعداد ضلع را فراموش نکن.']
    },
    {
      id: 'comp', title: 'شکل‌های ترکیبی', emoji: '🚀', formula: 'محیط = جمع ضلع‌های بیرونی',
      paragraphs: ['یک شکل می‌تواند از چند مربع ۱×۱ ساخته شود.', 'برای محیط، فقط ضلع‌های بیرونی را جمع می‌کنیم.'],
      examples: [
        { text: 'این شکل که به آن «موشک» می‌گوییم از چند مربع ساخته شده. دور تا دورش را حساب کن.',
          shape: ShapesAnim.compositePerimeter('rocket', 18),
          steps: ['اضلاع بیرونی را می‌شماریم.'], answer: 'محیط = تعداد ضلع‌های بیرونی' },
        { text: 'این شکل که به آن «ربات» می‌گوییم. دور تا دورش چقدر است؟',
          shape: ShapesAnim.compositePerimeter('robot', 16),
          steps: ['خط بیرونی شکل را دنبال می‌کنیم.'], answer: 'محیط = تعداد ضلع‌های بیرونی' }
      ],
      tips: ['فقط خط بیرونی را بشمار.'], pitfalls: ['اضلاع داخلی را نشمار.']
    }
  ],
  area: [
    {
      id: 'sq', title: 'مربع', emoji: '⬛', formula: 'مساحت = ضلع × ضلع',
      paragraphs: ['مساحت یعنی چقدر سطح داخل شکل جا می‌شود.'],
      examples: [
        { text: 'کاشی مربعی با ضلع ۳ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaSquare(3),
          steps: ['روی شکل بزن تا سطحش رنگ شود.', '۳ × ۳ = ۹'], answer: '۹ سانتی‌متر مربع' },
        { text: 'اتاقی مربعی با ضلع ۴ متر. اگر بخواهیم کف آن را با مربع‌های ۱×۱ فرش کنیم، چند مربع لازم است؟',
          shape: ShapesAnim.unitSquaresSquare(4),
          steps: ['روی شکل بزن تا مربع‌ها یکی‌یکی ظاهر شوند.', '۴ × ۴ = ۱۶ مربع'], answer: '۱۶ متر مربع' }
      ],
      tips: ['واحد مساحت همیشه «مربع» دارد.'],
      pitfalls: ['مساحت را با محیط اشتباه نگیر.']
    },
    {
      id: 'rect', title: 'مستطیل', emoji: '▭', formula: 'مساحت = طول × عرض',
      paragraphs: ['مساحت مستطیل = طول × عرض.'],
      examples: [
        { text: 'دفتری با طول ۵ و عرض ۳ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaRectangle(5, 3),
          steps: ['روی شکل بزن تا سطحش رنگ شود.', '۵ × ۳ = ۱۵'], answer: '۱۵ سانتی‌متر مربع' },
        { text: 'باغچه‌ای ۴×۳ متر. اگر بخواهیم کف آن را با مربع‌های ۱×۱ بچینیم، چند مربع لازم است؟',
          shape: ShapesAnim.unitSquaresRect(4, 3),
          steps: ['روی شکل بزن تا مربع‌ها ظاهر شوند.', '۴ × ۳ = ۱۲ مربع'], answer: '۱۲ متر مربع' }
      ],
      tips: ['ترتیب ضرب مهم نیست.'],
      pitfalls: ['جمع نکن؛ ضرب کن.']
    },
    {
      id: 'tri', title: 'مثلث', emoji: '🔺', formula: 'مساحت = (قاعده × ارتفاع) ÷ ۲',
      paragraphs: ['مساحت مثلث نصف مستطیل احاطه‌کننده است.', 'روی شکل بزن تا ارتفاع، سپس قاعده، سپس زاویه قائمه رسم شود.'],
      examples: [
        { text: 'مثلثی با قاعده ۴ و ارتفاع ۳ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaTriangle(4, 3),
          steps: ['اول ارتفاع رسم می‌شود، بعد قاعده، بعد زاویه قائمه.', '(۴ × ۳) ÷ ۲ = ۶'], answer: '۶ سانتی‌متر مربع' },
        { text: 'مثلث متساوی‌الساقینی با قاعده ۶ و ارتفاع ۴ متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaIsoscelesTriangle(6, 4),
          steps: ['(۶ × ۴) ÷ ۲ = ۱۲'], answer: '۱۲ متر مربع' },
        { text: 'مثلث قائم‌الزاویه با دو ضلع قائمه‌ی ۳ و ۵. مساحتش چقدر است؟',
          shape: ShapesAnim.areaRightTriangle(5, 3),
          steps: ['در مثلث قائم‌الزاویه، دو ضلع قائمه همان قاعده و ارتفاع هستند.', '(۵ × ۳) ÷ ۲ = ۷٫۵'], answer: '۷٫۵ سانتی‌متر مربع' }
      ],
      tips: ['ارتفاع همیشه عمود بر قاعده است.'],
      pitfalls: ['فراموش نکن بر ۲ تقسیم کنی.']
    },
    {
      id: 'circ', title: 'دایره', emoji: '⚪', formula: 'مساحت = π × شعاع × شعاع',
      paragraphs: ['π ≈ ۳٫۱۴.', 'دقت کن: شعاع × شعاع، نه ۲ × شعاع.'],
      examples: [
        { text: 'دایره‌ای با شعاع ۲ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaCircle(2),
          steps: ['۳٫۱۴ × ۲ × ۲ = ۱۲٫۵۶'], answer: '۱۲٫۵۶ سانتی‌متر مربع' },
        { text: 'پیتزایی با شعاع ۴ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaCircle(4),
          steps: ['۳٫۱۴ × ۴ × ۴ = ۵۰٫۲۴'], answer: '۵۰٫۲۴ سانتی‌متر مربع' }
      ],
      tips: ['π = ۳٫۱۴.'], pitfalls: ['شعاع به توان ۲ ≠ ۲ × شعاع.']
    },
    {
      id: 'para', title: 'متوازی‌الاضلاع', emoji: '▱', formula: 'مساحت = قاعده × ارتفاع',
      paragraphs: ['مانند مستطیل، قاعده × ارتفاع.'],
      examples: [
        { text: 'متوازی‌الاضلاعی با قاعده ۵ و ارتفاع ۳ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaParallelogram(5, 3),
          steps: ['۵ × ۳ = ۱۵'], answer: '۱۵ سانتی‌متر مربع' },
        { text: 'متوازی‌الاضلاعی با قاعده ۷ و ارتفاع ۴ متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaParallelogram(7, 4),
          steps: ['۷ × ۴ = ۲۸'], answer: '۲۸ متر مربع' }
      ],
      tips: ['برای مساحت، فقط قاعده و ارتفاع.'],
      pitfalls: ['ارتفاع عمود بر قاعده است، نه ضلع کج.']
    },
    {
      id: 'rhom', title: 'لوزی', emoji: '◆', formula: 'مساحت = (قطر۱ × قطر۲) ÷ ۲',
      paragraphs: ['لوزی همه اضلاعش مساوی است. دو قطرش عمود بر هم‌اند.', 'قطر افقی با رنگ بنفش، قطر عمودی با رنگ آبی نمایش داده می‌شود.'],
      examples: [
        { text: 'لوزی با قطرهای ۴ و ۶ سانتی‌متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaRhombus(4, 6),
          steps: ['(۴ × ۶) ÷ ۲ = ۱۲'], answer: '۱۲ سانتی‌متر مربع' },
        { text: 'لوزی با قطرهای ۸ و ۵ متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaRhombus(8, 5),
          steps: ['(۸ × ۵) ÷ ۲ = ۲۰'], answer: '۲۰ متر مربع' }
      ],
      tips: ['یادت باشد بر ۲ تقسیم کنی.'],
      pitfalls: ['فراموش نکن ÷ ۲.']
    },
    {
      id: 'trap', title: 'ذوزنقه', emoji: '⏢', formula: 'مساحت = ((قاعده کوچک + قاعده بزرگ) × ارتفاع) ÷ ۲',
      paragraphs: ['دو ضلع موازی به نام قاعده‌ها.'],
      examples: [
        { text: 'ذوزنقه‌ای با قاعده‌های ۳ و ۵ و ارتفاع ۴. مساحتش چقدر است؟',
          shape: ShapesAnim.areaTrapezoid(5, 3, 4),
          steps: ['(۳ + ۵) × ۴ = ۳۲', '۳۲ ÷ ۲ = ۱۶'], answer: '۱۶ سانتی‌متر مربع' },
        { text: 'ذوزنقه‌ای با قاعده‌های ۴ و ۶ و ارتفاع ۵ متر. مساحتش چقدر است؟',
          shape: ShapesAnim.areaTrapezoid(6, 4, 5),
          steps: ['(۴ + ۶) × ۵ = ۵۰', '۵۰ ÷ ۲ = ۲۵'], answer: '۲۵ متر مربع' }
      ],
      tips: ['دو قاعده را جمع کن.'], pitfalls: ['فراموش نکن ÷ ۲.']
    },
    {
      id: 'comp', title: 'شکل‌های ترکیبی', emoji: '🏰', formula: 'مساحت = جمع مساحت اجزا',
      paragraphs: ['شکل از چند مربع ۱×۱ ساخته می‌شود.', 'مساحت کل = جمع مساحت اجزا.', 'برای شمردن دقیق‌تر، از حالت کاوش پایین صفحه استفاده کن.'],
      examples: [
        { text: 'این ربات از چند مستطیل ساخته شده. مساحت کلش چقدر است؟',
          shape: ShapesAnim.compositeShape('robot', 16),
          steps: ['مساحت هر بخش را جدا می‌شماریم.', 'در انتها همه را با هم جمع می‌کنیم.'], answer: 'مجموع مساحت اجزا' },
        { text: 'این قلعه از چند بخش ساخته شده. مساحتش چقدر است؟',
          shape: ShapesAnim.compositeShape('castle', 14),
          steps: ['برج‌ها + دیوار + دروازه', 'جمع همه'], answer: 'مجموع مساحت اجزا' }
      ],
      tips: ['شکل را به اجزای ساده تقسیم کن.'],
      pitfalls: ['مساحت‌ها را جمع کن، نه ضرب.'],
      /* ✅ حالت کاوش */
      explore: 'robot'
    }
  ],
  volume: [
    {
      id: 'cube', title: 'مکعب', emoji: '🧊', formula: 'حجم = ضلع × ضلع × ضلع',
      paragraphs: ['حجم = فضای داخل یک شکل ۳بعدی.', 'مکعب = همه ضلع‌ها مساوی.'],
      examples: [
        { text: 'مکعبی با ضلع ۲ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.cubeBuild(2),
          steps: ['روی شکل بزن تا مکعب‌های ۱×۱ یکی‌یکی ظاهر شوند.', '۲ × ۲ × ۲ = ۸'], answer: '۸ سانتی‌متر مکعب' },
        { text: 'تاسی با ضلع ۳ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.cubeBuild(3),
          steps: ['۳ × ۳ × ۳ = ۲۷'], answer: '۲۷ سانتی‌متر مکعب' }
      ],
      tips: ['واحد = سانتی‌متر مکعب.'],
      pitfalls: ['مساحت ≠ حجم.']
    },
    {
      id: 'box', title: 'مکعب مستطیل', emoji: '📦', formula: 'حجم = طول × عرض × ارتفاع',
      paragraphs: ['مثل جعبه کفش یا یخچال، سه اندازه دارد.'],
      examples: [
        { text: 'جعبه‌ای به طول ۳، عرض ۲ و ارتفاع ۲ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.boxBuild(3, 2, 2),
          steps: ['۳ × ۲ = ۶', '۶ × ۲ = ۱۲'], answer: '۱۲ سانتی‌متر مکعب' },
        { text: 'جعبه‌ای به طول ۴، عرض ۳ و ارتفاع ۵ سانتی‌متر. حجمش چقدر است؟',
          shape: ShapesAnim.boxBuild(4, 3, 5),
          steps: ['۴ × ۳ = ۱۲', '۱۲ × ۵ = ۶۰'], answer: '۶۰ سانتی‌متر مکعب' }
      ],
      tips: ['ترتیب ضرب مهم نیست.'],
      pitfalls: ['سه عدد را ضرب کن.']
    }
  ],
  fractions: [
    {
      id: 'concept', title: 'مفهوم کسر', emoji: '🍕', formula: 'صورت / مخرج',
      paragraphs: ['کسر = چند قسمت از یک کل.', 'بالا: صورت (چند قسمت برداشته‌ایم). پایین: مخرج (کل به چند قسمت تقسیم شده).'],
      examples: [
        { text: 'در این شکل، ۳ قسمت از ۴ قسمت دایره رنگی شده است. کسر آن چقدر است؟',
          html: ShapesAnim.fracPieAnim(3, 4),
          steps: ['مخرج = ۴ (کل به ۴ قسمت تقسیم شده)', 'صورت = ۳ (۳ قسمت رنگی)'], answer: 'سه‌چهارم' },
        { text: 'در این شکل، ۲ قسمت از ۵ قسمت رنگی شده است. کسر آن چقدر است؟',
          html: ShapesAnim.fracPieAnim(2, 5),
          steps: ['مخرج = ۵', 'صورت = ۲'], answer: 'دو‌پنجم' }
      ],
      tips: ['مخرج هرگز صفر نیست.'],
      pitfalls: ['جای صورت و مخرج را عوض نکن.']
    },
    {
      id: 'equiv', title: 'کسر معادل', emoji: '🟰', formula: 'ضرب صورت و مخرج در یک عدد',
      paragraphs: ['اگر صورت و مخرج را در یک عدد ضرب (یا تقسیم) کنیم، مقدار کسر عوض نمی‌شود.'],
      examples: [
        { text: 'آیا یک‌دوم و سه‌ششم با هم برابرند؟',
          html: `<div style="display:flex;flex-direction:column;gap:12px;align-items:center">
            <div><div style="text-align:center;margin-bottom:4px">${fracHTML({n:1,d:2})}</div>${ShapesAnim.fracBarAnim(1, 2)}</div>
            <div><div style="text-align:center;margin-bottom:4px">${fracHTML({n:3,d:6})}</div>${ShapesAnim.fracBarAnim(3, 6)}</div>
          </div>`,
          steps: ['۱ × ۳ = ۳ و ۲ × ۳ = ۶', 'هر دو نوار به یک اندازه رنگ شده‌اند.'], answer: 'بله، برابرند' },
        { text: 'کسر معادلی بنویس که مخرجش ۹ باشد و با دو‌سوم برابر باشد.',
          html: `<div style="text-align:center;font-size:1.3rem;direction:ltr">${fracHTML({ n: 2, d: 3 })} = ? / ۹</div>`,
          steps: ['چون ۹ = ۳ × ۳، صورت را هم در ۳ ضرب می‌کنیم.', '۲ × ۳ = ۶'], answer: 'شش‌نهم' }
      ],
      tips: ['ضرب در یک عدد، مقدار را عوض نمی‌کند.'],
      pitfalls: ['هم صورت هم مخرج را ضرب کن.']
    },
    {
      id: 'simplify', title: 'ساده کردن کسر', emoji: '✂️', formula: 'تقسیم بر ب.م.م',
      paragraphs: [
        'برای ساده کردن یک کسر، صورت و مخرج را بر بزرگ‌ترین مقسوم‌علیه مشترک (ب.م.م) تقسیم می‌کنیم.',
        'ب.م.م = بزرگ‌ترین عددی که هم صورت و هم مخرج بر آن بخش‌پذیرند.',
        'مثال: ب.م.م ۶ و ۹ می‌شود ۳. یعنی بزرگ‌ترین عددی که هم ۶ و هم ۹ بر آن تقسیم می‌شوند.'
      ],
      examples: [
        { text: 'کسر دو‌چهارم را ساده کن.',
          html: `<div style="text-align:center;font-size:1.4rem;direction:ltr">${fracHTML({ n: 2, d: 4 })}</div>`,
          steps: [
            'عددهایی که هم ۲ و هم ۴ بر آن‌ها بخش‌پذیرند: ۱ و ۲',
            'بزرگ‌ترینشان ب.م.م = ۲',
            'صورت ÷ ۲ = ۱ و مخرج ÷ ۲ = ۲',
            'نتیجه: یک‌دوم'
          ], answer: 'یک‌دوم' },
        { text: 'کسر هشت‌دوازدهم را ساده کن.',
          html: `<div style="text-align:center;font-size:1.4rem;direction:ltr">${fracHTML({ n: 8, d: 12 })}</div>`,
          steps: [
            'ب.م.م ۸ و ۱۲ = ۴',
            '۸ ÷ ۴ = ۲ و ۱۲ ÷ ۴ = ۳',
            'نتیجه: دو‌سوم'
          ], answer: 'دو‌سوم' }
      ],
      tips: ['اگر ب.م.م بزرگ را نمی‌دانی، با اعداد کوچک شروع کن.'],
      pitfalls: ['فقط صورت یا فقط مخرج را تقسیم نکن.']
    },
    {
      id: 'compare', title: 'مقایسه کسرها', emoji: '⚖️', formula: 'مخرج مشترک',
      paragraphs: ['برای مقایسه دو کسر، اول مخرج مشترک می‌سازیم، بعد صورت‌ها را مقایسه می‌کنیم.'],
      examples: [
        { text: 'کدام کسر بزرگ‌تر است: یک‌دوم یا یک‌سوم؟',
          html: ShapesAnim.fracCompareBars(1, 2, 1, 3),
          steps: [
            'مخرج مشترک ۲ و ۳ = ۶',
            'یک‌دوم = سه‌ششم',
            'یک‌سوم = دو‌ششم',
            '۳ > ۲ پس یک‌دوم بزرگ‌تر است.'
          ], answer: 'یک‌دوم بزرگ‌تر است' },
        { text: 'کدام کسر بزرگ‌تر است: دو‌سوم یا سه‌چهارم؟',
          html: ShapesAnim.fracCompareBars(2, 3, 3, 4),
          steps: [
            'مخرج مشترک ۳ و ۴ = ۱۲',
            'دو‌سوم = هشت‌دوازدهم',
            'سه‌چهارم = نه‌دوازدهم',
            '۸ < ۹ پس سه‌چهارم بزرگ‌تر است.'
          ], answer: 'سه‌چهارم بزرگ‌تر است' }
      ],
      tips: ['مخرج بزرگ‌تر به معنی کسر بزرگ‌تر نیست.'],
      pitfalls: ['فقط به مخرج نگاه نکن.']
    },
    {
      id: 'add', title: 'جمع کسرها', emoji: '➕', formula: 'مخرج مشترک، سپس جمع صورت',
      paragraphs: ['اگر مخرج‌ها مساوی باشند، فقط صورت‌ها را جمع می‌کنیم.', 'اگر مخرج‌ها فرق داشته باشند، اول مخرج مشترک می‌سازیم.'],
      examples: [
        { text: 'جمع یک‌دوم و یک‌سوم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:1,d:2})} + ${fracHTML({n:1,d:3})} = ?</span>`,
          steps: [
            'مخرج‌ها فرق دارند. ک.م.م ۲ و ۳ = ۶',
            'یک‌دوم = سه‌ششم',
            'یک‌سوم = دو‌ششم',
            'صورت‌ها: ۳ + ۲ = ۵',
            'نتیجه: پنج‌ششم'
          ], answer: 'پنج‌ششم' },
        { text: 'جمع یک‌پنجم و دو‌پنجم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:1,d:5})} + ${fracHTML({n:2,d:5})} = ?</span>`,
          steps: ['مخرج‌ها مساوی (۵).', 'صورت‌ها: ۱ + ۲ = ۳', 'نتیجه: سه‌پنجم'], answer: 'سه‌پنجم' }
      ],
      tips: ['مخرج‌ها را با هم جمع نکن!'],
      pitfalls: ['فقط صورت‌ها را جمع می‌کنیم.']
    },
    {
      id: 'sub', title: 'تفریق کسرها', emoji: '➖', formula: 'مخرج مشترک، سپس تفریق صورت',
      paragraphs: ['مانند جمع، اول مخرج مشترک بعد صورت‌ها را کم می‌کنیم.'],
      examples: [
        { text: 'تفریق سه‌پنجم و یک‌پنجم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:3,d:5})} − ${fracHTML({n:1,d:5})} = ?</span>`,
          steps: ['مخرج‌ها مساوی (۵).', '۳ − ۱ = ۲', 'نتیجه: دو‌پنجم'], answer: 'دو‌پنجم' },
        { text: 'تفریق سه‌چهارم و یک‌دوم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:3,d:4})} − ${fracHTML({n:1,d:2})} = ?</span>`,
          steps: [
            'مخرج مشترک: ۴',
            'یک‌دوم = دو‌چهارم',
            'سه‌چهارم − دو‌چهارم = یک‌چهارم'
          ], answer: 'یک‌چهارم' }
      ],
      tips: ['نتیجه را ساده کن.'],
      pitfalls: ['فقط صورت‌ها کم می‌شوند.']
    },
    {
      id: 'mul', title: 'ضرب کسرها', emoji: '✖️', formula: 'صورت × صورت، مخرج × مخرج',
      paragraphs: ['در ضرب کسرها به مخرج مشترک نیازی نیست.', 'صورت‌ها را در هم و مخرج‌ها را در هم ضرب می‌کنیم.'],
      examples: [
        { text: 'حاصل ضرب یک‌دوم در دو‌سوم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:1,d:2})} × ${fracHTML({n:2,d:3})} = ?</span>`,
          steps: [
            'صورت × صورت: ۱ × ۲ = ۲',
            'مخرج × مخرج: ۲ × ۳ = ۶',
            'دو‌ششم را ساده می‌کنیم = یک‌سوم'
          ], answer: 'یک‌سوم' },
        { text: 'حاصل ضرب دو‌سوم در سه‌پنجم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:2,d:3})} × ${fracHTML({n:3,d:5})} = ?</span>`,
          steps: [
            '۲ × ۳ = ۶',
            '۳ × ۵ = ۱۵',
            'شش‌پانزدهم را ساده می‌کنیم = دو‌پنجم'
          ], answer: 'دو‌پنجم' }
      ],
      tips: ['قبل از ضرب، ساده کن.'],
      pitfalls: ['مخرج مشترک لازم نیست.']
    },
    {
      id: 'div', title: 'تقسیم کسرها', emoji: '➗', formula: 'معکوس و ضرب',
      paragraphs: ['برای تقسیم، کسر دوم را معکوس می‌کنیم و در کسر اول ضرب می‌کنیم.'],
      examples: [
        { text: 'حاصل تقسیم یک‌دوم بر یک‌سوم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:1,d:2})} ÷ ${fracHTML({n:1,d:3})} = ?</span>`,
          steps: [
            'معکوس یک‌سوم می‌شود سه‌یکم',
            'یک‌دوم × سه‌یکم = سه‌دوم'
          ], answer: 'سه‌دوم' },
        { text: 'حاصل تقسیم دو‌سوم بر یک‌چهارم چقدر است؟',
          html: `<span dir="ltr" style="font-size:1.3rem">${fracHTML({n:2,d:3})} ÷ ${fracHTML({n:1,d:4})} = ?</span>`,
          steps: [
            'معکوس یک‌چهارم = چهار‌یکم',
            'دو‌سوم × چهار‌یکم = هشت‌سوم'
          ], answer: 'هشت‌سوم' }
      ],
      tips: ['تقسیم = ضرب در معکوس.'],
      pitfalls: ['کسر اول را معکوس نکن.']
    },
    {
      id: 'mixed', title: 'عدد مخلوط', emoji: '🔢', formula: 'عدد صحیح + کسر',
      paragraphs: ['عدد مخلوط ترکیبی از یک عدد صحیح و یک کسر است.', 'برای تبدیل به کسر: (عدد صحیح × مخرج) + صورت.'],
      examples: [
        { text: 'عدد مخلوط «۲ و یک‌سوم» را به کسر تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.4rem;direction:ltr">${mixedHTML({ n: 7, d: 3 })}</div>`,
          steps: [
            '(۲ × ۳) + ۱ = ۷',
            'مخرج همان ۳ می‌ماند',
            'کسر: هفت‌سوم'
          ], answer: 'هفت‌سوم' },
        { text: 'عدد مخلوط «۳ و دو‌پنجم» را به کسر تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.4rem;direction:ltr">${mixedHTML({ n: 17, d: 5 })}</div>`,
          steps: [
            '(۳ × ۵) + ۲ = ۱۷',
            'مخرج همان ۵',
            'کسر: هفده‌پنجم'
          ], answer: 'هفده‌پنجم' }
      ],
      tips: ['عدد صحیح را در مخرج ضرب کن، بعد صورت را اضافه کن.'],
      pitfalls: ['عدد صحیح را ضرب نکردن.']
    }
  ],
  decimals: [
    {
      id: 'concept', title: 'مفهوم اعشار', emoji: '🔟', formula: 'دهم، صدم',
      paragraphs: ['اعداد اعشاری برای نمایش قسمت‌های کمتر از یک به کار می‌روند.', 'بعد از ممیز: رقم اول دهم، رقم دوم صدم.'],
      examples: [
        { text: 'عدد ۰٫۵ یعنی چه؟',
          html: `<div style="text-align:center;font-size:1.6rem;direction:ltr">${faDec(0.5, 1)}</div>`,
          steps: ['۵ دهم یعنی نصف.'], answer: 'نصف' },
        { text: 'عدد ۰٫۲۵ یعنی چه؟',
          html: `<div style="text-align:center;font-size:1.6rem;direction:ltr">${faDec(0.25, 2)}</div>`,
          steps: ['۲۵ صدم یعنی یک‌چهارم.'], answer: 'یک‌چهارم' }
      ],
      tips: ['قبل از ممیز صفر می‌گذاریم.'],
      pitfalls: ['جایگاه‌ها را اشتباه نکن.']
    },
    {
      id: 'online', title: 'اعشار روی محور', emoji: '📏', formula: 'دهم‌ها روی محور',
      paragraphs: ['فاصله‌ی ۰ تا ۱ را به ۱۰ قسمت مساوی تقسیم می‌کنیم. هر قسمت یک‌دهم است.'],
      examples: [
        { text: 'عدد ۰٫۵ روی محور کجاست؟',
          html: ShapesAnim.decimalLine([], 0.5, 0, 1),
          steps: ['وسط بین ۰ و ۱'], answer: 'وسط دقیق' },
        { text: 'عدد ۰٫۳ روی محور کجاست؟',
          html: ShapesAnim.decimalLine([], 0.3, 0, 1),
          steps: ['سه پله به سمت راست ۰'], answer: 'سه دهم جلو' },
        { text: 'عدد ۰٫۷۵ روی محور کجاست؟',
          html: ShapesAnim.decimalLine([], 0.75, 0, 1),
          steps: ['بین ۰٫۷ و ۰٫۸', 'دقیقاً وسط آن دو'], answer: 'بین هفت و هشت دهم' }
      ],
      tips: ['هر خط کوچک = یک‌دهم.'],
      pitfalls: ['خطوط اصلی را با فرعی اشتباه نگیر.']
    },
    {
      id: 'compare', title: 'مقایسه اعشار', emoji: '⚖️', formula: 'رقم به رقم',
      paragraphs: ['اول قسمت صحیح، بعد ارقام اعشار را از چپ به راست مقایسه می‌کنیم.'],
      examples: [
        { text: 'کدام بزرگ‌تر است: ۰٫۷ یا ۰٫۵؟',
          html: ShapesAnim.decCompareBars(0.7, 0.5),
          steps: ['۷ > ۵ پس ۰٫۷ بزرگ‌تر است.'], answer: '۰٫۷ بزرگ‌تر' },
        { text: 'کدام بزرگ‌تر است: ۰٫۲۵ یا ۰٫۵؟',
          html: ShapesAnim.decCompareBars(0.25, 0.5),
          steps: [
            'قسمت صحیح هر دو ۰ است.',
            'رقم دهم: ۲ < ۵',
            'پس ۰٫۵ بزرگ‌تر است.'
          ], answer: '۰٫۵ بزرگ‌تر' }
      ],
      tips: ['با صفر پر کن اگر تعداد ارقام کم است.'],
      pitfalls: ['ارقام بیشتر ≠ عدد بزرگ‌تر.']
    },
    {
      id: 'add', title: 'جمع اعشار', emoji: '➕', formula: 'ممیزها تراز',
      paragraphs: ['ممیزها را زیر هم تراز می‌کنیم، بعد جمع می‌کنیم.'],
      examples: [
        { text: 'جمع ۳٫۴ + ۲٫۱ چقدر است؟',
          html: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(3.4,1)} + ${faDec(2.1,1)} = ?</div>`,
          steps: ['ممیزها تراز.', '۳ + ۲ = ۵ و ۴ + ۱ = ۵ دهم.', 'نتیجه: ۵٫۵'], answer: '۵٫۵' },
        { text: 'جمع ۰٫۳ + ۰٫۴ چقدر است؟',
          html: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(0.3,1)} + ${faDec(0.4,1)} = ?</div>`,
          steps: ['۳ دهم + ۴ دهم = ۷ دهم'], answer: '۰٫۷' },
        { text: 'روی محور: از صفر شروع می‌کنیم، ۰٫۳ جلو می‌رویم، بعد ۰٫۴ دیگر جلو می‌رویم. به چه عددی می‌رسیم؟',
          html: ShapesAnim.decimalAddOnLine(0, 1, 0.3, 0.4),
          steps: ['۰٫۳ + ۰٫۴ = ۰٫۷'], answer: '۰٫۷' }
      ],
      tips: ['ممیزها زیر هم.'], pitfalls: ['بدون تراز ننویس.']
    },
    {
      id: 'sub', title: 'تفریق اعشار', emoji: '➖', formula: 'ممیزها تراز',
      paragraphs: ['عدد بزرگ‌تر را بالا می‌نویسیم، ممیزها را تراز می‌کنیم.'],
      examples: [
        { text: 'تفریق ۵٫۵ − ۲٫۱ چقدر است؟',
          html: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(5.5,1)} − ${faDec(2.1,1)} = ?</div>`,
          steps: ['ممیزها تراز.', '۵ − ۲ = ۳ و ۵ − ۱ = ۴ دهم.', 'نتیجه: ۳٫۴'], answer: '۳٫۴' },
        { text: 'تفریق ۰٫۹ − ۰٫۲ چقدر است؟',
          html: `<div style="text-align:center;font-size:1.3rem" dir="ltr">${faDec(0.9,1)} − ${faDec(0.2,1)} = ?</div>`,
          steps: ['۹ دهم − ۲ دهم = ۷ دهم'], answer: '۰٫۷' },
        { text: 'روی محور: از صفر تا ۰٫۹ جلو می‌رویم، سپس ۰٫۴ به عقب برمی‌گردیم. کجا می‌رسیم؟',
          html: ShapesAnim.decimalSubOnLine(0, 1, 0.9, 0.4),
          steps: ['۰٫۹ − ۰٫۴ = ۰٫۵'], answer: '۰٫۵' }
      ],
      tips: ['تراز ممیز.'], pitfalls: ['ترتیب درست.']
    },
    {
      id: 'frac-to-dec', title: 'کسر به اعشار', emoji: '🔄', formula: 'صورت ÷ مخرج',
      paragraphs: ['صورت را بر مخرج تقسیم می‌کنیم.'],
      examples: [
        { text: 'کسر سه‌چهارم را به اعشار تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${fracHTML({ n: 3, d: 4 })}</div>`,
          steps: ['۳ ÷ ۴ = ۰٫۷۵'], answer: '۰٫۷۵' },
        { text: 'کسر یک‌پنجم را به اعشار تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${fracHTML({ n: 1, d: 5 })}</div>`,
          steps: ['۱ ÷ ۵ = ۰٫۲'], answer: '۰٫۲' }
      ],
      tips: ['بعضی کسرها اعشار متناوب می‌دهند.'],
      pitfalls: ['مخرج را بر صورت تقسیم نکن.']
    },
    {
      id: 'dec-to-frac', title: 'اعشار به کسر', emoji: '🔄', formula: 'مخرج ۱۰ یا ۱۰۰',
      paragraphs: ['تعداد ارقام بعد از ممیز = تعداد صفرهای مخرج.'],
      examples: [
        { text: 'عدد اعشاری ۰٫۷ را به کسر تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${faDec(0.7, 1)}</div>`,
          steps: ['۱ رقم بعد از ممیز → مخرج ۱۰', 'نتیجه: هفت‌دهم'], answer: 'هفت‌دهم' },
        { text: 'عدد اعشاری ۰٫۷۵ را به کسر تبدیل کن.',
          html: `<div style="text-align:center;font-size:1.5rem;direction:ltr">${faDec(0.75, 2)}</div>`,
          steps: ['۲ رقم بعد از ممیز → مخرج ۱۰۰', 'هفتادوپنج‌صدم را ساده کن', 'نتیجه: سه‌چهارم'], answer: 'سه‌چهارم' }
      ],
      tips: ['در انتها ساده کن.'], pitfalls: ['تعداد صفرها را درست بشمار.']
    }
  ]
};

/* ═════════ ۳۷) LEARN / LESSON (با کارت مقایسه + حالت کاوش) ═════════ */
function viewLearn(topic) {
  const lessons = LESSONS[topic] || [];
  return `${header('📚 آموزش', true)}
  <p style="color:var(--muted);margin:0 0 14px">یک درس انتخاب کن:</p>
  <div class="grid grid-2">
    ${lessons.map(l => `<button class="card card-btn" onclick="window.__nav('lesson', {topic:'${topic}', id:'${l.id}'})">
      <span class="icon-big">${l.emoji}</span><h3 class="card-title">${l.title}</h3>
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
  const compare = compareCard(topic);
  /* ✅ کارت مقایسه فقط در درس اول هر موضوع نمایش داده شود */
  const showCompare = idx === 0 && (topic === 'area' || topic === 'perimeter');
  /* ✅ حالت کاوش */
  const exploreHTML = lesson.explore ? exploreGridHTML(COMPOSITES[lesson.explore], 22) : '';
  return `${header(lesson.title, true)}
  <div class="lesson-hero">
    <div class="emoji-big">${lesson.emoji}</div>
    <h2>${lesson.title}</h2>
    <div class="formula">${lesson.formula}</div>
  </div>
  ${unitsCard(topic)}
  ${showCompare ? compare : ''}
  <div class="lesson-section">
    <h3>📖 توضیح</h3>
    ${lesson.paragraphs.map(p => `<p>${p}</p>`).join('')}
  </div>
  ${proof}
  <div class="lesson-section">
    <h3>📌 مثال‌های حل شده</h3>
    ${lesson.examples.map((ex, i) => `
      <div class="example-card">
        <p class="ex-title">مثال ${fa(i + 1)}:</p>
        ${ex.text ? `<p>${ex.text}</p>` : ''}
        ${wrapAnim(ex.shape, { hint })}
        ${wrapAnim(ex.html, { wrapClass: '', wrapStyle: 'text-align:center;padding:8px', hint })}
        <ul class="example-steps">${ex.steps.map(s => `<li>${s}</li>`).join('')}</ul>
        <div class="example-answer">✅ ${ex.answer}</div>
      </div>`).join('')}
  </div>
  ${exploreHTML ? `<div class="lesson-section"><h3>🔍 حالت کاوش</h3>${exploreHTML}</div>` : ''}
  <div class="lesson-section">
    <h3>💡 نکات</h3>
    <ul class="tips-list">${lesson.tips.map(t => `<li>${t}</li>`).join('')}</ul>
  </div>
  ${lesson.pitfalls && lesson.pitfalls.length ? `<div class="lesson-section">
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

/* ═════════ ۳۸) PRACTICE ═════════ */
function viewPractice(topic) {
  if (!session || session.mode !== 'practice' || session.topic !== topic) startPractice(topic);
  return renderPractice();
}
function startPractice(topic) {
  session = { mode: 'practice', topic, difficulty: state.settings.difficulty, index: 0, correct: 0, wrong: 0, streak: 0, current: null, answered: false, selected: null, wrongAttempts: 0 };
  nextPracticeQuestion();
}
function nextPracticeQuestion() {
  session.current = generateQuestion(session.topic, session.difficulty) || null;
  session.answered = false;
  session.selected = null;
  session.wrongAttempts = 0;
}
function renderPractice() {
  const q = session.current;
  if (!q) return `<div class="empty"><span class="emoji-big">😅</span>سوالی پیدا نشد</div>`;
  const names = { perimeter: '📏 محیط', area: '📐 مساحت', volume: '🧊 حجم', fractions: '🍰 کسرها', decimals: '🔢 اعشار' };
  return `${header(names[session.topic], true)}
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
    ${q.promptHTML ? `<div class="q-prompt">${q.promptHTML}</div>` : `<p class="q-prompt">${q.prompt}</p>`}
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
  return `<button class="${cls}" ${session.answered ? 'disabled' : ''} onclick="window.__selectChoice(${i})">${display}</button>`;
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
  if (stu && stu.progress[q.topic]) { stu.stats.totalQuestions++; stu.progress[q.topic].attempts++; }
  if (correct) {
    session.correct++; session.streak++;
    if (stu && stu.progress[q.topic]) {
      stu.stats.totalCorrect++;
      if (session.streak > stu.stats.bestStreak) stu.stats.bestStreak = session.streak;
      stu.progress[q.topic].correct++;
    }
    awardCorrect(session.streak); sound.correct();
  } else {
    session.wrong++; session.streak = 0;
    session.wrongAttempts = (session.wrongAttempts || 0) + 1;
    /* ✅ صفر کردن perfectStreak */
    if (stu) {
      stu.stats.perfectStreak = 0;
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
    const title = correct ? goodMsg() : badMsg();
    const hintBlock = !correct && session.wrongAttempts >= 2 ? `<div class="hint-progressive">${getProgressiveHint(q)}</div>` : '';
    fb.innerHTML = `<div class="feedback ${correct ? 'good' : 'bad'}">
      <h4>${title}</h4>
      ${!correct ? `<p>پاسخ درست: <strong class="correct-text">${correctDisp}</strong></p>` : ''}
      <strong>راه‌حل:</strong>
      <ul class="steps">${q.steps.map(s => `<li>${s}</li>`).join('')}</ul>
    </div>${hintBlock}`;
  }
  if (session.mode === 'daily') completeDailyChallenge(correct);
}
function nextQuestionAction() {
  if (!session) return;
  if (!session.answered) { submitAnswer(); return; }
  if (session.mode === 'practice') { session.index++; nextPracticeQuestion(); render(); }
  else if (session.mode === 'daily') navigate('home');
}

/* ═════════ ۳۹) EXAM SETUP ═════════ */
function viewExamSetup(topic) {
  const names = { perimeter: 'محیط', area: 'مساحت', volume: 'حجم', fractions: 'کسرها', decimals: 'اعداد اعشاری' };
  return `${header('🎯 آزمون', true)}
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
    <p style="margin:0;font-size:.9rem">📝 پاسخ‌ها در انتهای آزمون بررسی می‌شوند.</p>
  </div>
  <div class="card" style="background:var(--feedback-warn-bg);border-right:4px solid var(--accent)">
    <p style="margin:0;font-size:.9rem">⚠️ نمره منفی: هر ۳ پاسخ غلط = ۱ نمره کسر می‌شود.</p>
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
  session = { mode: 'exam', topic, difficulty: diff, questions, index: 0, current: questions[0], answers: [], answered: false, selected: null, correct: 0, wrong: 0, unanswered: 0, timeLeft: time, totalTime: time, isMulti: false };
  navigate('exam');
  startExamTimer();
}

/* ═════════ ۴۰) MULTI EXAM ═════════ */
function viewMultiExamSetup() {
  return `${header('🎯 آزمون جامع', true)}
  <p style="color:var(--muted);margin:0 0 14px;text-align:center">درس‌های مورد آزمون:</p>
  <div class="card">
    <h3 class="card-title">📚 انتخاب دروس</h3>
    ${ALL_TOPICS.map(t => `<label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--card-2);border-radius:12px;margin-bottom:8px;font-weight:600;cursor:pointer">
      <input type="checkbox" class="topic-check" value="${t}" checked style="width:22px;height:22px">
      <span style="font-size:1.3rem">${TOPIC_EMOJIS[t]}</span><span>${TOPIC_NAMES[t]}</span>
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
  <button class="btn full" style="margin-top:16px" onclick="window.__startMultiExam()">🚀 شروع آزمون جامع</button>
  ${bottomNav()}`;
}
function startMultiExam() {
  const topics = Array.from(document.querySelectorAll('.topic-check:checked')).map(c => c.value);
  if (!topics.length) { alert('حداقل یک درس را انتخاب کن.'); return; }
  const count = parseInt(document.getElementById('mExamCount').value, 10) || 10;
  const time = parseInt(document.getElementById('mExamTime').value, 10) || 300;
  const diff = document.getElementById('mExamDiff').value || 'medium';
  const topicsPerQ = [];
  const perTopic = Math.floor(count / topics.length);
  const remainder = count % topics.length;
  topics.forEach((t, i) => { const n = perTopic + (i < remainder ? 1 : 0); for (let j = 0; j < n; j++) topicsPerQ.push(t); });
  const shuffledTopics = shuffle(topicsPerQ);
  const questions = [];
  for (const t of shuffledTopics) { const q = generateQuestion(t, diff); if (q) questions.push(q); }
  if (!questions.length) { alert('سوالی پیدا نشد.'); return; }
  session = { mode: 'exam', topic: 'comprehensive', difficulty: diff, questions, topicsSelected: topics, index: 0, current: questions[0], answers: [], answered: false, selected: null, correct: 0, wrong: 0, unanswered: 0, timeLeft: time, totalTime: time, isMulti: true };
  navigate('exam');
  startExamTimer();
}

/* ═════════ ۴۱) EXAM VIEW ═════════ */
function startExamTimer() {
  if (state.settings.noTimer) return;
  if (examTimer) clearInterval(examTimer);
  examTimer = setInterval(() => {
    if (!session || session.mode !== 'exam') { clearInterval(examTimer); examTimer = null; return; }
    session.timeLeft--;
    if (session.timeLeft <= 0) { clearInterval(examTimer); examTimer = null; alert('⏰ زمان تمام شد!'); endExam(); return; }
    const statsRow = document.querySelectorAll('.stat-value');
    if (statsRow.length >= 2) {
      const min = Math.floor(session.timeLeft / 60), sec = session.timeLeft % 60;
      statsRow[1].textContent = `⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}`;
      statsRow[1].style.color = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
    }
  }, 1000);
}
function viewExam() {
  if (!session || session.mode !== 'exam') return `${header('🎯 آزمون')}<div class="empty">آزمونی در جریان نیست</div>${bottomNav()}`;
  const q = session.current;
  if (!q) return `<div class="empty">خطا</div>`;
  const title = session.isMulti ? '🎯 آزمون جامع' : '🎯 آزمون ' + TOPIC_NAMES[session.topic];
  const min = Math.floor(session.timeLeft / 60), sec = session.timeLeft % 60;
  const timeColor = session.timeLeft < 30 ? 'var(--danger)' : 'var(--primary)';
  const timeDisplay = state.settings.noTimer ? '∞' : `⏱ ${fa(min)}:${fa(sec).padStart(2, '0')}`;
  return `${header(title)}
  <div class="stats-row">
    <div class="stat-item"><div class="stat-value">${fa(session.index + 1)}/${fa(session.questions.length)}</div><div class="stat-label">سوال</div></div>
    <div class="stat-item"><div class="stat-value" style="color:${timeColor}">${timeDisplay}</div><div class="stat-label">زمان</div></div>
    <div class="stat-item"><div class="stat-value" style="color:var(--info)">${fa(session.index)}</div><div class="stat-label">پاسخ‌داده</div></div>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${(session.index / session.questions.length) * 100}%"></div></div>
  <div class="question-box">
    ${session.isMulti ? `<div style="font-size:.85rem;color:var(--muted);margin-bottom:6px">${TOPIC_EMOJIS[q.topic]} ${TOPIC_NAMES[q.topic]}</div>` : ''}
    ${q.promptHTML ? `<div class="q-prompt">${q.promptHTML}</div>` : `<p class="q-prompt">${q.prompt}</p>`}
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
  if (session.selected) { userAns = session.selected; isCorrect = equalAnswer(session.selected, q.correct); }
  else unanswered = true;
  session.answers.push({ q, userAns, isCorrect, unanswered });
  if (isCorrect) session.correct++;
  else if (!unanswered) session.wrong++;
  else session.unanswered++;
  const stu = activeStudent();
  if (stu && stu.progress[q.topic]) {
    stu.stats.totalQuestions++; stu.progress[q.topic].attempts++;
    if (isCorrect) { stu.stats.totalCorrect++; stu.progress[q.topic].correct++; }
    else if (!unanswered) { const mk = q.topic + ':' + q.key; stu.mistakes[mk] = (stu.mistakes[mk] || 0) + 1; }
  }
  saveState();
  session.index++;
  if (session.index >= session.questions.length) endExam();
  else { session.current = session.questions[session.index]; session.selected = null; render(); }
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
    stu.history.unshift({ date: Date.now(), topic: s.topic, score: pctv, correct: s.correct, wrong: s.wrong, unanswered: s.unanswered || 0, penalty, total: s.questions.length, isMulti: s.isMulti || false });
    if (stu.history.length > 40) stu.history.length = 40;
    if (pctv === 100 && !stu.stats.badges.includes('perfect')) { stu.stats.badges.push('perfect'); showFloat('💎 بی‌نقص!'); }
  }
  saveState(); sound.win();
  const payload = { pct: pctv, penalty, answers: s.answers, topic: s.topic, isMulti: s.isMulti || false };
  session = null;
  navigate('examResult', payload);
}
function viewExamResult() {
  const params = route.params || {};
  const pctv = params.pct, answers = params.answers, topic = params.topic, isMulti = params.isMulti, penalty = params.penalty || 0;
  if (!answers) return `<div class="empty">کارنامه‌ای نیست</div>`;
  const correct = answers.filter(a => a.isCorrect).length;
  const wrong = answers.filter(a => !a.isCorrect && !a.unanswered).length;
  const unanswered = answers.filter(a => a.unanswered).length;
  const emoji = pctv >= 80 ? '🏆' : pctv >= 60 ? '👍' : pctv >= 40 ? '💪' : '📚';
  const msg = pctv >= 80 ? 'فوق‌العاده!' : pctv >= 60 ? 'خوب بود!' : pctv >= 40 ? 'باز تمرین کن!' : 'ناامید نشو!';
  const stu = activeStudent();
  const titleText = isMulti ? '🎯 آزمون جامع' : 'آزمون ' + (TOPIC_NAMES[topic] || '');
  return `${header('📋 کارنامه', true)}
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
      return `<div class="card" style="border-right:4px solid ${borderColor}">
        <div style="display:flex;justify-content:space-between"><strong>سوال ${fa(i+1)}</strong><span>${mark}</span></div>
        ${isMulti ? `<p style="font-size:.8rem;color:var(--muted)">${TOPIC_EMOJIS[a.q.topic]} ${TOPIC_NAMES[a.q.topic]}</p>` : ''}
        <div>${a.q.promptHTML || a.q.prompt}</div>
        ${a.q.shape ? `<div class="q-shape">${a.q.shape}</div>` : ''}
        <div style="font-size:.9rem;color:var(--muted)">
          ${a.unanswered ? '<div>پاسخ ندادی</div>' : (userDisp ? `<div>پاسخ تو: <span class="${a.isCorrect ? 'correct-text' : 'wrong-text'}">${userDisp}</span></div>` : '')}
          <div>پاسخ درست: <span class="correct-text">${correctDisp}</span></div>
        </div>
        <details style="margin-top:8px"><summary style="cursor:pointer;font-size:.9rem;color:var(--primary);font-weight:600">📝 راه‌حل</summary>
          <ul class="steps">${a.q.steps.map(s => `<li>${s}</li>`).join('')}</ul>
        </details>
      </div>`;
    }).join('')}
  </div>
  <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
    ${isMulti ? `<button class="btn full" onclick="window.__nav('multiExamSetup')">🔁 دوباره</button>` : `<button class="btn full" onclick="window.__nav('examSetup',{topic:'${topic}'})">🔁 دوباره</button>`}
    <button class="btn sec" onclick="window.__nav('home')">🏠 خانه</button>
    ${stu ? `<button class="btn info" onclick="window.__shareReport(${pctv}, ${correct}, ${wrong}, ${answers.length})">📤 اشتراک</button>` : ''}
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۴۲) PROGRESS ═════════ */
function viewProgress() {
  const stu = activeStudent();
  if (!stu) return `<div class="empty">دانش‌آموزی انتخاب نشده</div>`;
  const p = stu.progress;
  const topics = ALL_TOPICS.map(t => ({ key: t, name: TOPIC_NAMES[t], emoji: TOPIC_EMOJIS[t] }));
  const totalQ = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].attempts) || 0), 0);
  const totalC = topics.reduce((s, t) => s + ((p[t.key] && p[t.key].correct) || 0), 0);
  const overall = totalQ ? Math.round((totalC / totalQ) * 100) : 0;
  const mistakeList = Object.entries(stu.mistakes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return `${header('📊 پیشرفت', true)}
  <div class="card" style="text-align:center">
    <div class="student-avatar" style="margin:0 auto 10px">${escHtml(stu.name[0] || '؟')}</div>
    <h2 style="margin:0 0 4px">${escHtml(fullName(stu))}</h2>
    <p style="color:var(--muted)">پایه ${fa(stu.grade)}</p>
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
      return `<div class="bar-row">
        <div class="lbl">${t.emoji} ${t.name}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pctv}%">${pctv > 10 ? fa(pctv) + '٪' : ''}</div></div>
        <div class="pct">${fa(pctv)}٪</div>
      </div>`;
    }).join('')}
  </div>
  ${mistakeList.length ? `<h3 style="margin:20px 0 10px">🎯 نقاط ضعف</h3>
  <div class="card">
    ${mistakeList.map(([k, v]) => {
      const key = k.split(':')[1];
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border)">
        <span>${key}</span><span style="color:var(--danger);font-weight:700">${fa(v)} بار</span>
      </div>`;
    }).join('')}
    <button class="btn info full" style="margin-top:12px" onclick="window.__nav('practice',{topic:'${mistakeList[0][0].split(':')[0]}'})">💡 تمرین پیشنهادی</button>
  </div>` : ''}
  <h3 style="margin:20px 0 10px">📜 تاریخچه آزمون‌ها</h3>
  <div class="card">
    ${stu.history.length ? stu.history.slice(0, 10).map(h => {
      const d = new Date(h.date);
      const dateStr = `${fa(d.getFullYear())}/${fa(d.getMonth() + 1)}/${fa(d.getDate())}`;
      const tn = h.isMulti ? 'جامع' : (TOPIC_NAMES[h.topic] || h.topic);
      const color = h.score >= 70 ? 'var(--success)' : h.score >= 40 ? 'var(--accent)' : 'var(--danger)';
      return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border)">
        <span>${dateStr} — ${tn}</span><span style="font-weight:700;color:${color}">${fa(h.score)}٪</span>
      </div>`;
    }).join('') : '<p style="color:var(--muted);text-align:center">هنوز آزمونی نداده‌ای</p>'}
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۴۳) SETTINGS — حذف TTS ═════════ */
function viewSettings() {
  const s = state.settings;
  return `${header('⚙️ تنظیمات', true)}
  <div class="card" style="text-align:center;background:var(--hint-bg);border:2px solid var(--primary-l)">
    <p style="margin:0 0 6px;color:var(--muted);font-size:.9rem">نسخه نرم‌افزار</p>
    <span class="version-badge">v${APP_VERSION}</span>
  </div>
  <div class="card"><h3 class="card-title">🎨 حالت نمایش</h3>
    <div class="pill-row">
      <button class="pill ${s.theme === 'light' ? 'active' : ''}" onclick="window.__setSetting('theme','light')">☀️ روشن</button>
      <button class="pill ${s.theme === 'dark' ? 'active' : ''}" onclick="window.__setSetting('theme','dark')">🌙 تاریک</button>
      <button class="pill ${(s.theme === 'auto' || !s.theme) ? 'active' : ''}" onclick="window.__setSetting('theme','auto')">🌓 خودکار</button>
    </div>
  </div>
  <div class="card"><h3 class="card-title">🔊 صدا</h3>
    <div class="pill-row">
      <button class="pill ${s.sound ? 'active' : ''}" onclick="window.__setSetting('sound',true)">روشن</button>
      <button class="pill ${!s.sound ? 'active' : ''}" onclick="window.__setSetting('sound',false)">خاموش</button>
    </div>
  </div>
  <div class="card"><h3 class="card-title">🎬 انیمیشن</h3>
    <div class="pill-row">
      <button class="pill ${s.animation ? 'active' : ''}" onclick="window.__setSetting('animation',true)">روشن</button>
      <button class="pill ${!s.animation ? 'active' : ''}" onclick="window.__setSetting('animation',false)">خاموش</button>
    </div>
  </div>
  <div class="card"><h3 class="card-title">⏱ حالت بدون تایمر</h3>
    <p class="card-desc">برای دانش‌آموزانی که استرس زمان دارند.</p>
    <div class="pill-row" style="margin-top:8px">
      <button class="pill ${s.noTimer ? 'active' : ''}" onclick="window.__setSetting('noTimer',true)">روشن</button>
      <button class="pill ${!s.noTimer ? 'active' : ''}" onclick="window.__setSetting('noTimer',false)">خاموش</button>
    </div>
  </div>
  <div class="card"><h3 class="card-title">🎚️ دشواری پیش‌فرض</h3>
    <div class="pill-row">
      ${['easy', 'medium', 'hard'].map(d => `<button class="pill ${s.difficulty === d ? 'active' : ''}" onclick="window.__setSetting('difficulty','${d}')">${d === 'easy' ? 'آسان' : d === 'medium' ? 'متوسط' : 'سخت'}</button>`).join('')}
    </div>
  </div>
  <div class="card"><h3 class="card-title">🔢 نمایش اعداد</h3>
    <div class="pill-row">
      <button class="pill ${s.persianNumbers ? 'active' : ''}" onclick="window.__setSetting('persianNumbers',true)">فارسی ۱۲۳</button>
      <button class="pill ${!s.persianNumbers ? 'active' : ''}" onclick="window.__setSetting('persianNumbers',false)">انگلیسی 123</button>
    </div>
  </div>
  <div class="card"><h3 class="card-title">🔧 حالت Debug</h3>
    <p class="card-desc">نمایش لاگ عملیات و اطلاعات فنی برای توسعه‌دهنده.</p>
    <div class="pill-row" style="margin-top:8px">
      <button class="pill ${s.debug ? 'active' : ''}" onclick="window.__setSetting('debug',true)">روشن</button>
      <button class="pill ${!s.debug ? 'active' : ''}" onclick="window.__setSetting('debug',false)">خاموش</button>
    </div>
    ${s.debug ? `<p style="font-size:.85rem;color:var(--muted);margin-top:10px">دانش‌آموز فعال: ${state.activeStudentId || '—'}</p>
      <div class="debug-panel" id="debugLog">${debugLog.join('\n') || 'لاگی ثبت نشده'}</div>` : ''}
  </div>
  <div class="card"><h3 class="card-title">👥 دانش‌آموزان</h3>
    <button class="btn info full" onclick="window.__nav('students')">مدیریت دانش‌آموزان</button>
  </div>
  <div class="card" style="text-align:center">
    <h3 class="card-title" style="justify-content:center">💬 ارتباط با تهیه‌کننده</h3>
    <p class="card-desc" style="margin:0 0 12px">ساخته شده با ❤️ توسط <strong style="direction:ltr;display:inline-block">maysam261</strong></p>
    <button class="btn info full" onclick="window.__nav('contact')">📞 ارتباط</button>
  </div>
  <div class="card"><h3 class="card-title">⚠️ خطرناک</h3>
    <p class="card-desc">پیشرفت دانش‌آموز فعلی پاک می‌شود.</p>
    <button class="btn danger full" style="margin-top:10px" onclick="window.__resetActiveStudent()">🗑️ پاک کردن پیشرفت</button>
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۴۴) TEACHER ═════════ */
function viewTeacher() {
  const stu = activeStudent();
  return `${header('👨‍🏫 معلم / والد', true)}
  <div class="card">
    <h3 class="card-title">🎯 آزمون سفارشی</h3>
    <label style="display:block;margin-top:12px">موضوع:
      <select id="tchTopic" class="num-input" style="text-align:right">
        ${ALL_TOPICS.map(t => `<option value="${t}">${TOPIC_NAMES[t]}</option>`).join('')}
      </select>
    </label>
    <label style="display:block;margin-top:12px">تعداد سوال: <input type="number" class="num-input" id="tchCount" value="10" min="1" max="50"></label>
    <label style="display:block;margin-top:12px">زمان (دقیقه): <input type="number" class="num-input" id="tchTime" value="5" min="1" max="60"></label>
    <label style="display:block;margin-top:12px">سطح:
      <select id="tchDiff" class="num-input" style="text-align:right">
        <option value="easy">آسان</option><option value="medium" selected>متوسط</option><option value="hard">سخت</option>
      </select>
    </label>
    <button class="btn full" style="margin-top:16px" onclick="window.__teacherStartExam()">🚀 شروع آزمون</button>
  </div>
  ${stu ? `<div class="card">
    <h3 class="card-title">📊 وضعیت ${escHtml(fullName(stu))}</h3>
    <p>پایه: <strong>${fa(stu.grade)}</strong></p>
    <p>سطح: <strong>${fa(stu.stats.level)}</strong></p>
    <p>درست: <strong>${fa(stu.stats.totalCorrect)} / ${fa(stu.stats.totalQuestions)}</strong></p>
    <p>آزمون‌ها: <strong>${fa(stu.history.length)}</strong></p>
    <button class="btn sec full" style="margin-top:10px" onclick="window.__exportData()">📥 خروجی داده‌ها (JSON)</button>
  </div>` : ''}
  ${bottomNav()}`;
}

/* ═════════ ۴۵) DAILY VIEW ═════════ */
function viewDailyQuestion() {
  if (!session || session.mode !== 'daily') return `<div class="empty">چالشی نیست</div>`;
  const q = session.current;
  return `${header('🌅 چالش روزانه', true)}
  <div class="card" style="background:linear-gradient(135deg, var(--accent), #f97316);color:#fff;text-align:center">
    <p style="margin:0;font-weight:700">پاداش دوبرابر — موفق باشی!</p>
  </div>
  <div class="question-box" style="margin-top:14px">
    ${q.promptHTML ? `<div class="q-prompt">${q.promptHTML}</div>` : `<p class="q-prompt">${q.prompt}</p>`}
    ${q.shape ? `<div class="q-shape">${q.shape}</div>` : ''}
  </div>
  <div class="answer-area" id="answerArea">${renderChoiceArea(q)}</div>
  <div id="feedbackArea"></div>
  <div style="margin-top:16px">
    <button class="btn full" id="actionBtn" onclick="window.__submitOrNext()">
      ${session.answered ? '🏠 بازگشت به خانه' : '✅ بررسی پاسخ'}
    </button>
  </div>
  ${bottomNav()}`;
}

/* ═════════ ۴۶) RENDER ═════════ */
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
    case 'perimeter': case 'area': case 'volume': case 'fractions': case 'decimals':
      html = viewTopic(route.name); break;
    case 'learn': html = viewLearn(route.params.topic); break;
    case 'lesson': html = viewLesson(route.params.topic, route.params.id); break;
    case 'practice': html = viewPractice(route.params.topic); break;
    case 'dailyQuestion': html = viewDailyQuestion(); break;
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

/* ═════════ ۴۷) SHARE REPORT ═════════ */
function shareReportImage(pct, correct, wrong, total) {
  try {
    const stu = activeStudent();
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 600, 800);
    grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(40, 80, 520, 640, 30); ctx.fill();
    ctx.fillStyle = '#1e1b4b'; ctx.font = 'bold 36px Vazirmatn, Tahoma';
    ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText('کارنامه ریاضی‌یار', 300, 160);
    ctx.font = 'bold 24px Vazirmatn, Tahoma'; ctx.fillStyle = '#5b21b6';
    if (stu) ctx.fillText(fullName(stu), 300, 210);
    ctx.fillStyle = '#7c3aed'; ctx.font = 'bold 96px Vazirmatn, Tahoma';
    ctx.fillText(`${pct}%`, 300, 380);
    ctx.font = 'bold 22px Vazirmatn, Tahoma'; ctx.fillStyle = '#10b981';
    ctx.fillText(`✅ درست: ${correct}`, 300, 470);
    ctx.fillStyle = '#ef4444'; ctx.fillText(`❌ نادرست: ${wrong}`, 300, 515);
    ctx.fillStyle = '#6b7280'; ctx.fillText(`📊 کل: ${total}`, 300, 560);
    ctx.fillStyle = '#7c3aed'; ctx.font = 'bold 20px Vazirmatn, Tahoma';
    ctx.fillText(`riazi-yar v${APP_VERSION}`, 300, 660);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'riazi-yar-report.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
      showFloat('📤 ذخیره شد!');
    });
  } catch (e) { showFloat('⚠️ پشتیبانی نمی‌شود'); }
}

/* ═════════ ۴۸) GLOBAL FUNCTIONS ═════════ */
window.__nav = (name, params = {}) => { sound.click(); navigate(name, params); };
window.__goBack = () => {
  sound.click();
  if (route.name === 'home' || route.name === 'students') return;
  if ((route.name === 'practice' || route.name === 'exam' || route.name === 'dailyQuestion') && session) session = null;
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
/* ✅ حالت کاوش */
window.__toggleExploreCell = (el) => {
  if (!el) return;
  el.classList.toggle('active');
  const parent = el.parentElement;
  if (!parent) return;
  const count = parent.querySelectorAll('.explore-cell.active').length;
  const counter = document.getElementById('exploreCount');
  if (counter) counter.textContent = fa(count);
  sound.click();
};
window.__submitOrNext = () => { if (session) { if (session.answered) nextQuestionAction(); else submitAnswer(); } };
window.__examNext = () => { if (session && session.mode === 'exam') examNext(); };
window.__startExam = (topic) => { sound.click(); startExam(topic); };
window.__startMultiExam = () => { sound.click(); startMultiExam(); };
window.__startDaily = () => { sound.click(); startDailyChallenge(); };
window.__shareReport = (pct, correct, wrong, total) => shareReportImage(pct, correct, wrong, total);
window.__setSetting = (key, val) => {
  state.settings[key] = val; saveState();
  if (key === 'animation') document.body.classList.toggle('no-anim', !val);
  if (key === 'theme') applyTheme();
  render();
};
window.__cycleTheme = () => {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(state.settings.theme || 'auto') + 1) % 3];
  state.settings.theme = next; saveState(); applyTheme(); render(); sound.click();
};
window.__selectStudent = (id) => { sound.click(); session = null; state.activeStudentId = id; saveState(); navigate('home'); };
window.__deleteStudent = (id) => {
  const stu = state.students.find(s => s.id === id);
  if (!stu) return;
  if (!confirm(`مطمئنی می‌خواهی «${fullName(stu)}» را حذف کنی؟`)) return;
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
  const grade = gradeEl ? (parseInt(gradeEl.value, 10) || 4) : 4;
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
  for (let i = 0; i < count; i++) { const q = generateQuestion(topic, diff); if (q) questions.push(q); }
  if (!questions.length) { alert('سوالی پیدا نشد.'); return; }
  session = { mode: 'exam', topic, difficulty: diff, questions, index: 0, current: questions[0], answers: [], answered: false, selected: null, correct: 0, wrong: 0, unanswered: 0, timeLeft: time, totalTime: time, isMulti: false };
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

/* ═════════ ۴۹) KEYBOARD ═════════ */
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

/* ═════════ ۵۰) INIT ═════════ */
applyTheme();
logDebug(`نسخه ${APP_VERSION} بارگذاری شد`);

if (state.students.length === 0) {
  route = { name: 'addStudent', params: {} };
} else if (!state.activeStudentId || !activeStudent()) {
  route = { name: 'students', params: {} };
}
render();

})();