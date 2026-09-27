import PixelTrain from "./PixelTrain.jsx";

// Pixel station at the bottom of the sign-in panel: hills, a teal-roofed station, a lamp
// post and a train at the platform. phase: "idle" (waiting), "departing" (pulls out to the
// right) or "arriving" (rolls back in after a failed sign-in).

const R = (x, y, w, h, fill) => <rect key={`${x}-${y}-${w}-${h}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />;

const ART = [
  R(0, 22, 30, 23, "#3563ad"), R(6, 18, 16, 4, "#3563ad"), R(10, 15, 8, 3, "#3563ad"),
  R(40, 24, 44, 21, "#3563ad"), R(50, 19, 24, 5, "#3563ad"), R(56, 16, 12, 3, "#3563ad"),
  R(92, 21, 48, 24, "#3563ad"), R(102, 17, 28, 4, "#3563ad"), R(110, 14, 12, 3, "#3563ad"),
  R(0, 34, 140, 11, "#1e4280"),
  R(4, 33, 48, 3, "#cfd6de"), R(4, 36, 48, 1, "#8a97a6"),
  R(12, 22, 26, 11, "#faf9f6"), R(10, 19, 30, 3, "#129ea5"), R(12, 17, 26, 2, "#0b6e73"), R(9, 21, 32, 1, "#14202e"),
  R(22, 26, 5, 7, "#2958a3"), R(15, 25, 4, 4, "#80ded9"), R(31, 25, 4, 4, "#80ded9"),
  R(23, 13, 4, 4, "#faf9f6"), R(24, 14, 2, 1, "#14202e"), R(25, 14, 1, 2, "#14202e"),
  R(46, 21, 1, 12, "#14202e"), R(45, 19, 3, 2, "#f5c46b"),
  ...Array.from({ length: 28 }, (_, i) => R(1 + i * 5, 40, 2, 3, "#14202e")),
  R(0, 39, 140, 1, "#cfd6de"),
];

export default function StationScene({ phase = "idle" }) {
  return (
    <div className="station-scene" aria-hidden="true">
      <svg viewBox="0 0 140 45" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
        {ART}
      </svg>
      <div className={`station-train station-train-${phase}`}>
        <PixelTrain coach scale={2.5} moving={phase !== "idle"} />
      </div>
    </div>
  );
}
