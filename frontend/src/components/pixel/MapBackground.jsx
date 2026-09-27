import { memo } from "react";
import { SPRITES } from "./sprites.js";
import { Sprite } from "./Sprite.jsx";

// A fixed, decorative railroad map behind the whole app: curving tracks with wooden
// sleepers, a river with a bridge, fields, and pixel scenery. It's drawn once from a
// fixed seed, so it looks the same on every load.

const W = 1600;
const H = 1000;
const GROUND = "#e8f3ef";

// Small deterministic random number generator (mulberry32) so the layout never changes.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth curve through the waypoints (Catmull-Rom), returned as points.
function curve(way, steps = 40) {
  const w = [way[0], ...way, way[way.length - 1]];
  const out = [];
  for (let i = 1; i < w.length - 2; i++) {
    const [p0, p1, p2, p3] = [w[i - 1], w[i], w[i + 1], w[i + 2]];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((j) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
          (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3),
      ));
    }
  }
  out.push(way[way.length - 1]);
  return out;
}

const toPath = (pts) => `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;

const RAILS = [
  [[-40, 130], [300, 70], [700, 150], [1100, 80], [1640, 140]],
  [[-40, 900], [400, 960], [800, 880], [1200, 950], [1640, 890]],
  [[150, -20], [80, 300], [190, 620], [110, 1020]],
  [[1450, -20], [1520, 300], [1420, 650], [1510, 1020]],
  [[-40, 560], [140, 480], [320, 530]],
].map((way) => curve(way));

const RIVERS = [[[1640, 420], [1500, 470], [1380, 560], [1300, 720], [1340, 1020]]].map((way) => curve(way));

// Where the river meets a track, lay a bridge along the track.
function findBridges() {
  const bridges = [];
  RIVERS.forEach((river) => {
    RAILS.forEach((rail) => {
      let best = null;
      river.forEach(([rx, ry]) => {
        rail.forEach(([x, y], i) => {
          const d = (x - rx) ** 2 + (y - ry) ** 2;
          if (!best || d < best.d) best = { d, x, y, i, rail };
        });
      });
      if (best && best.d < 12 ** 2) {
        const a = best.rail[Math.max(0, best.i - 2)];
        const b = best.rail[Math.min(best.rail.length - 1, best.i + 2)];
        const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        bridges.push({ x: best.x, y: best.y, angle });
      }
    });
  });
  return bridges;
}

const FIXED = [
  { x: 40, y: 190, rects: SPRITES.field(22, 5) },
  { x: 1300, y: 760, rects: SPRITES.field(26, 6) },
  { x: 1480, y: 160, rects: SPRITES.pond() },
  { x: 20, y: 700, rects: SPRITES.pond() },
  { x: 190, y: 560, rects: SPRITES.station() },
  { x: 1380, y: 20, rects: SPRITES.station() },
];

function scenery() {
  const rand = seeded(7);
  const items = [];
  const pts = [...RAILS, ...RIVERS].flatMap((line) => line.filter((_, i) => i % 2 === 0));
  const near = (x, y, dist) => pts.some(([px, py]) => (x - px) ** 2 + (y - py) ** 2 < dist * dist);
  const underFixed = (x, y) => FIXED.some((f) => x > f.x - 40 && x < f.x + 140 && y > f.y - 40 && y < f.y + 70);
  const roofs = [["#2958a3", "#1e4280"], ["#129ea5", "#0b6e73"], ["#f5c46b", "#c99a3e"], ["#7a6450", "#5a4838"]];

  for (let i = 0; i < 22; i++) {
    items.push({ x: rand() * W, y: rand() * H, scale: 5, rects: SPRITES.patch(12 + Math.floor(rand() * 16), 5 + Math.floor(rand() * 5), ["#d6ebe3", "#dcefe8", "#d9eee0"][i % 3]), ground: true });
  }
  const step = 66;
  for (let gy = -10; gy < H; gy += step) {
    for (let gx = -10; gx < W; gx += step) {
      const skip = rand() > 0.5;
      const x = gx + rand() * step * 0.6;
      const y = gy + rand() * step * 0.6;
      const k = rand();
      // The middle of the page sits under the content column, so leave it quiet.
      if (skip || (x > 330 && x < 1270) || underFixed(x, y)) continue;
      if (k < 0.08 && !near(x + 30, y + 30, 58)) items.push({ x, y, scale: 5, rects: SPRITES.house(...roofs[Math.floor(rand() * 4)]) });
      else if (k < 0.11 && !near(x + 40, y + 32, 64)) items.push({ x, y, scale: 5, rects: SPRITES.barn() });
      else if (k < 0.4 && !near(x + 20, y + 22, 36)) items.push({ x, y, scale: 5, rects: SPRITES.pine(rand() < 0.5 ? "#0b6e73" : "#129ea5") });
      else if (k < 0.62 && !near(x + 20, y + 20, 36)) items.push({ x, y, scale: 5, rects: SPRITES.tree(rand() < 0.5 ? "#129ea5" : "#0b6e73") });
      else if (k < 0.68 && !near(x + 16, y + 8, 24)) items.push({ x, y, scale: 4, rects: SPRITES.bush() });
      else if (k < 0.84 && !near(x + 10, y + 8, 22)) items.push({ x, y, scale: 4, rects: SPRITES.flowers() });
      else if (k < 0.9 && !near(x + 10, y + 8, 22)) items.push({ x, y, scale: 4, rects: SPRITES.rock() });
      else if (k < 0.94 && !near(x + 30, y + 10, 30)) items.push({ x, y, scale: 4, rects: SPRITES.fence(6) });
      else if (!near(x + 6, y + 4, 18)) items.push({ x, y, scale: 4, rects: SPRITES.tuft() });
    }
  }
  return items;
}

const SCENERY = scenery();
const BRIDGES = findBridges();

function MapBackground() {
  const ground = SCENERY.filter((s) => s.ground);
  const things = SCENERY.filter((s) => !s.ground);
  return (
    <div className="map-bg" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
        <rect width={W} height={H} fill={GROUND} />
        {ground.map((s, i) => <Sprite key={`g${i}`} {...s} />)}
        {FIXED.map((s, i) => <Sprite key={`f${i}`} scale={5} {...s} />)}
        <g fill="none" strokeLinecap="round" shapeRendering="auto">
          {RIVERS.map((r, i) => (
            <g key={i}>
              <path d={toPath(r)} stroke="#9fc3e3" strokeWidth="36" />
              <path d={toPath(r)} stroke="#b9d6ee" strokeWidth="16" strokeDasharray="14 22" />
            </g>
          ))}
        </g>
        {BRIDGES.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}>
            <rect x={-38} y={-20} width={76} height={40} fill="#b9a58a" />
            <rect x={-38} y={-20} width={76} height={4} fill="#7a6450" />
            <rect x={-38} y={16} width={76} height={4} fill="#7a6450" />
          </g>
        ))}
        <g fill="none" shapeRendering="auto">
          {RAILS.map((r, i) => (
            <g key={i}>
              <path d={toPath(r)} stroke="#cdbfa9" strokeWidth="30" strokeDasharray="6 10" />
              <path d={toPath(r)} stroke="#8d9aa8" strokeWidth="16" />
              <path d={toPath(r)} stroke={GROUND} strokeWidth="10" />
            </g>
          ))}
        </g>
        {things.map((s, i) => <Sprite key={`s${i}`} {...s} />)}
      </svg>
    </div>
  );
}

// The map never changes, so skip re-rendering it when the app updates.
export default memo(MapBackground);
