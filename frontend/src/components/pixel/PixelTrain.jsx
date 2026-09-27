// The animated pixel steam train: wheels turn (two-frame spokes), the coupling rod bobs,
// and smoke puffs rise from the chimney. Animations live in App.css (px-* classes) and
// switch off for people who prefer reduced motion.

const DARK = "#14202e";
const R = (x, y, w, h, fill) => ({ x, y, w, h, fill });

const LOCO = [
  R(16, 2, 10, 2, DARK), R(18, 4, 6, 8, DARK), R(14, 12, 26, 10, "#129ea5"), R(14, 12, 26, 2, "#80ded9"),
  R(22, 12, 2, 10, "#0b6e73"), R(32, 12, 2, 10, "#0b6e73"), R(28, 9, 4, 3, DARK), R(10, 14, 4, 4, "#f5c46b"),
  R(40, 6, 16, 16, "#2958a3"), R(38, 4, 20, 2, DARK), R(44, 9, 8, 6, "#80ded9"), R(40, 18, 16, 1, "#1e4280"),
  R(10, 22, 48, 2, DARK), R(8, 20, 6, 4, DARK), R(6, 22, 4, 2, DARK),
];
const COACH = [
  R(58, 23, 4, 2, DARK), R(62, 8, 30, 14, "#6d9dc5"), R(60, 6, 34, 2, DARK), R(65, 11, 6, 5, "#faf9f6"),
  R(74, 11, 6, 5, "#faf9f6"), R(83, 11, 6, 5, "#faf9f6"), R(62, 18, 30, 1, "#2958a3"), R(62, 22, 30, 2, DARK),
];
const SPOKES_B = [[-2.5, -2.5], [-1.5, -1.5], [0.5, 0.5], [1.5, 1.5], [1.5, -2.5], [0.5, -1.5], [-1.5, 0.5], [-2.5, 1.5]];

function Box({ r }) {
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />;
}

function Wheel({ cx, cy }) {
  return (
    <g>
      <rect x={cx - 2} y={cy - 4} width={4} height={8} fill={DARK} />
      <rect x={cx - 4} y={cy - 2} width={8} height={4} fill={DARK} />
      <rect x={cx - 3} y={cy - 3} width={6} height={6} fill={DARK} />
      <rect x={cx - 2} y={cy - 2} width={4} height={4} fill="#4f5b69" />
      <g className="px-spin-a">
        <rect x={cx - 0.5} y={cy - 3} width={1} height={6} fill="#cfd6de" />
        <rect x={cx - 3} y={cy - 0.5} width={6} height={1} fill="#cfd6de" />
      </g>
      <g className="px-spin-b">
        {SPOKES_B.map(([dx, dy], i) => (
          <rect key={i} x={cx + dx} y={cy + dy} width={1} height={1} fill="#cfd6de" />
        ))}
      </g>
      <rect x={cx - 1} y={cy - 1} width={2} height={2} fill="#faf9f6" />
    </g>
  );
}

function Puff({ delay }) {
  return (
    <g className="px-puff" style={{ animationDelay: `${delay}s` }}>
      <rect x={18} y={-3} width={6} height={4} fill="#cfd6de" />
      <rect x={19} y={-4} width={4} height={6} fill="#cfd6de" />
      <rect x={20} y={-2} width={2} height={2} fill="#e8edf2" />
    </g>
  );
}

/**
 * coach: add a passenger car behind the engine.
 * faceRight: the art faces left, so this mirrors it.
 * moving: false pauses the wheels (smoke keeps puffing, like an idling engine).
 */
export default function PixelTrain({ coach = false, scale = 1, faceRight = true, moving = true, className = "", style }) {
  const width = coach ? 96 : 62;
  const wheels = coach ? [20, 32, 48, 68, 86] : [20, 32, 48];
  return (
    <svg
      className={`px-train${moving ? "" : " px-idle"}${className ? ` ${className}` : ""}`}
      width={width * scale}
      height={58 * scale}
      viewBox={`0 -26 ${width} 58`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block", transform: faceRight ? "scaleX(-1)" : undefined, ...style }}
    >
      <Puff delay={0} />
      <Puff delay={0.6} />
      <Puff delay={1.2} />
      {LOCO.map((r, i) => <Box key={i} r={r} />)}
      {coach && COACH.map((r, i) => <Box key={`c${i}`} r={r} />)}
      {wheels.map((cx) => <Wheel key={cx} cx={cx} cy={27} />)}
      <g className="px-rod">
        <rect x={20} y={26} width={28} height={1.5} fill="#e1e5ea" />
      </g>
    </svg>
  );
}

// A short stretch of track (sleepers and a rail) for trains to sit on.
export function Track({ className = "", scrolling = false }) {
  return (
    <div className={`px-track${scrolling ? " px-track-scroll" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="px-track-ties" />
      <span className="px-track-rail" />
    </div>
  );
}
