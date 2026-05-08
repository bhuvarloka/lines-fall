import { config } from "./config.js";
import textSource from "./text.txt?raw";

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
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
  }

  integrate(gravity, damping) {
    const vx = (this.x - this.px) * damping;
    const vy = (this.y - this.py) * damping;
    this.px = this.x;
    this.py = this.y;
    this.x += vx;
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

    const len = config.linkRestLength;
    const count = Math.ceil(totalWidth / len) + 1;
    for (let i = 0; i < count; i++) {
      this.points.push(new Point(startX + i * len, startY));
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
function solve(chains, circleX, circleY, circleR, floorY) {
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
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    frozen = !frozen;
    requestTick();
  }
  if (e.code === "KeyR") {
    frozen = true;
    init();
    requestTick();
  }
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
    for (const chain of chains) {
      for (const p of chain.points) p.integrate(config.gravity, config.damping);
    }

    solve(chains, cx, cy, cr, floor);
  }

  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = config.floorColor;
  ctx.fillRect(0, floor, W, H - floor);

  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fillStyle = config.circleColor;
  ctx.fill();

  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.fillStyle = config.textColor;
  ctx.textBaseline = "middle";
  for (const chain of chains) chain.draw(ctx);

  if (!frozen) requestTick();
}

requestTick();
