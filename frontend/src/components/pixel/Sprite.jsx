// Draws sprite rectangles (see sprites.js) inside an SVG.

export function Rects({ rects }) {
  return rects.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />);
}

// One sprite placed at (x, y) in its parent SVG, scaled up `scale` times.
export function Sprite({ x, y, scale = 5, rects }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <Rects rects={rects} />
    </g>
  );
}
