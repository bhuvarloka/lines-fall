import { config } from "./config.js";
import textSource from "./text.txt?raw";
import { pickPalette, TIMES, WEATHERS } from "./palettes.js";

// ---- Palette ---- //
// The palette overrides config colors at runtime. Swap with `setPalette()`.
// Background stays quiet; floor + disc (and the text on top of them) carry
// the color. See src/palettes.js for the full grid + selection rules.

let activePalette = pickPalette(); // derived from system time, weather=clear

function applyPalette(p) {
  activePalette = p;
  config.backgroundColor = p.background;
  config.floorColor      = p.floor;
  config.circleColor     = p.disc ?? p.floor; // hidden via showDisc when null
  config.textColor       = p.text;
}
applyPalette(activePalette);

export function setPalette(time, weather) {
  applyPalette(pickPalette({ time, weather }));
  requestTick();
}

// ---- Simplex noise (2D) ---- //
// Minimal self-contained implementation; no external dependency needed.
const _perm = new Uint8Array(512);
const _grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
(function seedPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
})();

function simplex2(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  for (const [dx, dy, tx, ty] of [
    [x0, y0, ii, jj], [x1, y1, ii + i1, jj + j1], [x2, y2, ii + 1, jj + 1]
  ]) {
    const t2 = 0.5 - dx * dx - dy * dy;
    if (t2 >= 0) {
      const g = _grad[_perm[(tx + _perm[ty & 255]) & 255] & 7];
      n += t2 * t2 * t2 * t2 * (g[0] * dx + g[1] * dy);
    }
  }
  return 70 * n;
}

const canvas = document.createElement("canvas");
const ctx =
  canvas.getContext("2d", { alpha: false, desynchronized: true }) ??
  canvas.getContext("2d");
if (!ctx) throw new Error("Could not acquire 2D canvas context");

const container = document.getElementById("canvas-container");
if (!container) throw new Error("Missing #canvas-container");
container.appendChild(canvas);

// ---- Sizing ---- //

function resize() {
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
}
resize();
let resizeRaf = 0;
new ResizeObserver(() => {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    resize();
    init();
    requestTick();
  });
}).observe(container);

// ---- Physics ---- //

class Point {
  constructor(x, y, noiseOffset) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.noiseOffset = noiseOffset;
  }

  integrate(gravity, damping, tick) {
    const vx = (this.x - this.px) * damping;
    const vy = (this.y - this.py) * damping;
    this.px = this.x;
    this.py = this.y;
    const speed2 = vx * vx + vy * vy;
    const drift = speed2 > 0.01
      ? simplex2(tick * config.noiseTimeScale + this.noiseOffset, this.y * config.noiseSpatialScale) * config.noiseAmplitude
      : 0;
    this.x += vx + drift;
    this.y += vy + gravity;
  }
}

class Chain {
  constructor(text, startX, startY, totalWidth) {
    this.text = text;
    this.chars = Array.from(text);
    this.charWidths = new Float32Array(this.chars.length);
    this.textTotalWidth = 0;
    this.spaceCount = 0;

    // Cache glyph widths once. This avoids expensive per-frame measureText calls.
    for (let i = 0; i < this.chars.length; i++) {
      const ch = this.chars[i];
      if (ch === " ") this.spaceCount++;
      const w = ctx.measureText(ch).width;
      this.charWidths[i] = w;
      this.textTotalWidth += w;
    }

    this.points = [];
    // Unique noise offset per chain so each line drifts independently
    const chainOffset = Math.random() * 100;

    const len = config.linkRestLength;
    const count = Math.ceil(totalWidth / len) + 1;
    for (let i = 0; i < count; i++) {
      this.points.push(new Point(startX + i * len, startY, chainOffset + i * 0.5));
    }

    const segCount = Math.max(0, this.points.length - 1);
    this._segLen = new Float32Array(segCount);
    this._segDx = new Float32Array(segCount);
    this._segDy = new Float32Array(segCount);
    this._segAngle = new Float32Array(segCount);
  }

  draw(ctx) {
    const pts = this.points;
    if (pts.length < 2) return;

    const segCount = pts.length - 1;
    const segLen = this._segLen;
    const segDx = this._segDx;
    const segDy = this._segDy;
    const segAngle = this._segAngle;

    let totalArc = 0;
    for (let i = 0; i < segCount; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      segDx[i] = dx;
      segDy[i] = dy;
      const d = Math.hypot(dx, dy) || 0.0001;
      segLen[i] = d;
      segAngle[i] = Math.atan2(dy, dx);
      totalArc += d;
    }

    const extraPerSpace =
      this.spaceCount > 0
        ? (totalArc - this.textTotalWidth) / this.spaceCount
        : 0;

    const chars = this.chars;
    const charWidths = this.charWidths;

    let cursor = 0;
    let seg = 0;
    let arc = 0;
    let prevPos = -Infinity;

    for (let ci = 0; ci < chars.length; ci++) {
      const ch = chars[ci];
      const cw = charWidths[ci] + (ch === " " ? extraPerSpace : 0);
      const pos = cursor + cw * 0.5;
      cursor += cw;

      if (pos < 0 || pos > totalArc) continue;

      // Cursor should move forward; if it doesn't, fall back to a safe search.
      if (pos < prevPos) {
        seg = 0;
        arc = 0;
      }
      prevPos = pos;

      while (seg < segCount - 1 && arc + segLen[seg] < pos) {
        arc += segLen[seg];
        seg++;
      }

      const t = segLen[seg] > 0 ? (pos - arc) / segLen[seg] : 0;
      const a = pts[seg];
      const gx = a.x + segDx[seg] * t;
      const gy = a.y + segDy[seg] * t;
      const angle = segAngle[seg];

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(angle);
      ctx.fillText(ch, -cw * 0.5, 0);
      ctx.restore();
    }
  }
}

// ---- Unified solver ---- //

// All constraints run together each iteration so they can't fight each other.
function solve(chains, circleX, circleY, circleR, floorY, hasDisc) {
  const linkLen = config.linkRestLength;
  const minDist = config.pointRadius * 2;
  const minDist2 = minDist * minDist;
  const W = canvas.width;
  const iters = config.constraintIterations;
  const halfGlyph = config.fontSize * 0.3;
  const circlePush = circleR + halfGlyph;
  const circlePush2 = circlePush * circlePush;

  for (let iter = 0; iter < iters; iter++) {
    // intra-chain link constraints
    for (const chain of chains) {
      const pts = chain.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = ((dist - linkLen) / dist) * 0.5;
        a.x += dx * diff;
        a.y += dy * diff;
        b.x -= dx * diff;
        b.y -= dy * diff;
      }
    }

    // point separation — both within each chain (self-collision) and between chains
    // skip immediate neighbors (j <= i+1) since the link constraint already handles those
    for (let ci = 0; ci < chains.length; ci++) {
      const pa = chains[ci].points;
      for (let cj = ci; cj < chains.length; cj++) {
        const pb = chains[cj].points;
        for (let i = 0; i < pa.length; i++) {
          const jMin = ci === cj ? i + 2 : 0; // skip self and immediate neighbor
          for (let j = jMin; j < pb.length; j++) {
            const a = pa[i];
            const b = pb[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < minDist2 && d2 > 0) {
              const d = Math.sqrt(d2);
              const push = ((minDist - d) / d) * 0.15;
              a.x -= dx * push;
              a.y -= dy * push;
              b.x += dx * push;
              b.y += dy * push;
            }
          }
        }
      }
    }

    // boundary constraints — last so they're never overridden
    for (const chain of chains)
      for (const p of chain.points) {
        if (hasDisc) {
          const dx = p.x - circleX;
          const dy = p.y - circleY;
          const d2 = dx * dx + dy * dy;
          if (d2 < circlePush2 && d2 > 0) {
            const dist = Math.sqrt(d2);
            p.x = circleX + (dx / dist) * circlePush;
            p.y = circleY + (dy / dist) * circlePush;
            p.px = p.x - (p.x - p.px) * config.circleFriction;
            p.py = p.y - (p.y - p.py) * config.circleFriction;
          }
        }

        if (p.y > floorY - halfGlyph) {
          p.y = floorY - halfGlyph;
          p.py = floorY - halfGlyph;
        }
        if (p.x < 0) {
          p.x = 0;
          p.px = 0;
        }
        if (p.x > W) {
          p.x = W;
          p.px = W;
        }
      }
  }
}

// ---- Scene ---- //

let chains = [];

function wrapText(text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const n = words.length;
  if (n === 0) return [];

  // precompute cumulative widths for O(1) line-width queries
  const wordW = words.map((w) => ctx.measureText(w).width);
  const spaceW = ctx.measureText(" ").width;

  // dp[i] = min cost to place words[0..i-1]; breaks[i] = start word of last line ending at i
  const INF = Infinity;
  const cost = new Array(n + 1).fill(INF);
  const breaks = new Array(n + 1).fill(0);
  cost[0] = 0;

  for (let i = 1; i <= n; i++) {
    let lineW = 0;
    for (let j = i; j >= 1; j--) {
      lineW += wordW[j - 1];
      if (j < i) lineW += spaceW;
      if (lineW > maxWidth && j < i) break; // too wide, no point going further back
      const isLast = i === n;
      const slack = maxWidth - lineW;
      const ratio = slack / maxWidth; // 0 = full, 1 = empty
      // cube penalty: lines below ~85% fill cost disproportionately more,
      // forcing the breaker to reflow neighbours rather than leave sparse lines
      const lineCost = isLast ? 0 : Math.pow(ratio, 3) * 1e7;
      const total = cost[j - 1] + lineCost;
      if (total < cost[i]) {
        cost[i] = total;
        breaks[i] = j - 1; // words[j-1..i-1] go on this line
      }
    }
  }

  // reconstruct lines
  const result = [];
  let end = n;
  while (end > 0) {
    const start = breaks[end];
    result.unshift(words.slice(start, end).join(" "));
    end = start;
  }
  return result;
}

function init() {
  const W = canvas.width;
  const H = canvas.height;
  const maxW = W * (1 - config.textMarginX * 2);

  ctx.font = `${config.fontSize}px ${config.fontFamily}`;

  const words = textSource.replace(/\n/g, " ");
  const lines = wrapText(words, maxW);

  const marginX = W * config.textMarginX;
  chains = lines.map((text, i) => {
    const textW = ctx.measureText(text).width;
    const isLast = i === lines.length - 1;
    const chainW = isLast ? textW : maxW;
    const y = H * config.textStartY + i * H * config.lineSpacingY;
    return new Chain(text, marginX, y, chainW);
  });
}

init();

let frozen = true;
let tick = 0;
let cyclePos = { t: TIMES.indexOf(activePalette.time), w: WEATHERS.indexOf(activePalette.weather) };
function cycle(axis, dir) {
  if (axis === "t") cyclePos.t = (cyclePos.t + dir + TIMES.length) % TIMES.length;
  else              cyclePos.w = (cyclePos.w + dir + WEATHERS.length) % WEATHERS.length;
  const t = TIMES[cyclePos.t];
  const w = WEATHERS[cyclePos.w];
  applyPalette(pickPalette({ time: t, weather: w }));
  console.log(`[palette] ${t} · ${w} · ${activePalette.name}`);
  requestTick();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    frozen = !frozen;
    requestTick();
  }
  if (e.code === "KeyR") {
    frozen = true;
    tick = 0;
    init();
    requestTick();
  }
  if (e.code === "BracketRight") cycle("t", e.shiftKey ? -1 : 1); // ] / Shift+] — time
  if (e.code === "BracketLeft")  cycle("w", e.shiftKey ? -1 : 1); // [ / Shift+[ — weather
});

// ---- Loop ---- //

let rafId = 0;
function requestTick() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    loop();
  });
}

function loop() {
  const W = canvas.width;
  const H = canvas.height;
  const cx = W * config.circleX;
  const cy = H * config.circleY;
  const cr = config.circleDiameter * 0.5;
  const floor = H * config.floorY;

  if (!frozen) {
    tick++;
    for (const chain of chains) {
      for (const p of chain.points) p.integrate(config.gravity, config.damping, tick);
    }

    solve(chains, cx, cy, cr, floor, !!activePalette.disc);
  }

  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = config.floorColor;
  ctx.fillRect(0, floor, W, H - floor);

  if (activePalette.disc) {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = config.circleColor;
    ctx.fill();
  }

  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.fillStyle = config.textColor;
  ctx.textBaseline = "middle";
  for (const chain of chains) chain.draw(ctx);

  if (!frozen) requestTick();
}

requestTick();
