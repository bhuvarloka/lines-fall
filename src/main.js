import { config } from './config.js';
import textSource from './text.txt?raw';

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.getElementById('canvas-container').appendChild(canvas);

// ---- Sizing ---- //

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', () => { resize(); init(); });

// ---- Physics ---- //

class Point {
  constructor(x, y) {
    this.x  = x;  this.y  = y;
    this.px = x;  this.py = y;
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
    this.text   = text;
    this.points = [];

    const len   = config.linkRestLength;
    const count = Math.ceil(totalWidth / len) + 1;
    for (let i = 0; i < count; i++) {
      this.points.push(new Point(startX + i * len, startY));
    }
  }

  draw(ctx) {
    const pts = this.points;
    if (pts.length < 2) return;

    ctx.font         = `${config.fontSize}px ${config.fontFamily}`;
    ctx.fillStyle    = config.textColor;
    ctx.textBaseline = 'middle';

    const chars         = this.text.split('');
    const charWidths    = chars.map(c => ctx.measureText(c).width);
    const textTotalWidth = charWidths.reduce((s, w) => s + w, 0);

    const segLengths = [];
    let totalArc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      segLengths.push(d);
      totalArc += d;
    }

    let cursor = (totalArc - textTotalWidth) * 0.5;

    for (let ci = 0; ci < chars.length; ci++) {
      const cw  = charWidths[ci];
      const pos = cursor + cw * 0.5;
      cursor += cw;

      if (pos < 0 || pos > totalArc) continue;

      let arc = 0, seg = 0;
      while (seg < segLengths.length - 1 && arc + segLengths[seg] < pos) {
        arc += segLengths[seg++];
      }

      const t     = segLengths[seg] > 0 ? (pos - arc) / segLengths[seg] : 0;
      const a     = pts[seg];
      const b     = pts[Math.min(seg + 1, pts.length - 1)];
      const gx    = a.x + (b.x - a.x) * t;
      const gy    = a.y + (b.y - a.y) * t;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(angle);
      ctx.fillText(chars[ci], -cw * 0.5, 0);
      ctx.restore();
    }
  }
}

// ---- Unified solver ---- //

// All constraints run together each iteration so they can't fight each other.
function solve(chains, circleX, circleY, circleR, floorY) {
  const linkLen    = config.linkRestLength;
  const pointR     = config.pointRadius;
  const minDist    = pointR * 2;
  const minDist2   = minDist * minDist;
  const W          = canvas.width;
  const iters      = config.constraintIterations;

  // flatten all points once for inter-chain pass
  const allPoints = chains.flatMap(c => c.points);

  for (let iter = 0; iter < iters; iter++) {
    // intra-chain link constraints
    for (const chain of chains) {
      const pts = chain.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a  = pts[i];
        const b  = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (dist - linkLen) / dist * 0.5;
        a.x += dx * diff;
        a.y += dy * diff;
        b.x -= dx * diff;
        b.y -= dy * diff;
      }
    }

    // inter-chain point separation
    for (let i = 0; i < allPoints.length - 1; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        const a  = allPoints[i];
        const b  = allPoints[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist2 && d2 > 0) {
          const d    = Math.sqrt(d2);
          const push = (minDist - d) / d * 0.5;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }

    // boundary constraints — last so they're never overridden
    for (const p of allPoints) {
      const dx   = p.x - circleX;
      const dy   = p.y - circleY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < circleR && dist > 0) {
        p.x = circleX + (dx / dist) * circleR;
        p.y = circleY + (dy / dist) * circleR;
      }

      if (p.y > floorY) { p.y = floorY; p.py = floorY; }
      if (p.x < 0)      { p.x = 0;      p.px = 0; }
      if (p.x > W)      { p.x = W;      p.px = W; }
    }
  }
}

// ---- Scene ---- //

let chains = [];

function init() {
  const W       = canvas.width;
  const H       = canvas.height;
  const marginX = W * config.textMarginX;
  const lineW   = W - marginX * 2;

  const lines = textSource
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  chains = lines.map((text, i) => {
    const y = H * config.textStartY + i * H * config.lineSpacingY;
    return new Chain(text, marginX, y, lineW);
  });
}

init();

// ---- Loop ---- //

function loop() {
  const W     = canvas.width;
  const H     = canvas.height;
  const cx    = W * config.circleX;
  const cy    = H * config.circleY;
  const cr    = config.circleDiameter * 0.5;
  const floor = H * config.floorY;

  for (const chain of chains) {
    for (const p of chain.points) p.integrate(config.gravity, config.damping);
  }

  solve(chains, cx, cy, cr, floor);

  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, floor, W, H - floor);

  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.fillStyle = config.circleColor;
  ctx.fill();

  for (const chain of chains) chain.draw(ctx);

  requestAnimationFrame(loop);
}

loop();
