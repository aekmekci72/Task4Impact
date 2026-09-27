import { useMemo, useRef, useState, useLayoutEffect } from "react";

/**
 * Renders a task graph's `tasks` array (each with an `id` and `dependencies`
 * list) as an actual node-and-edge diagram: nodes arranged in columns by
 * dependency depth, with arrows drawn from each prerequisite to what it
 * unlocks. Swap in for the plain `.map(task => <TaskCard />)` list.
 *
 * Usage:
 *   <DependencyGraphView tasks={graph.tasks} />
 */

const NODE_WIDTH = 200;
const NODE_MIN_HEIGHT = 88;
const COLUMN_GAP = 96;
const ROW_GAP = 28;
const PADDING = 32;

const DIFFICULTY_COLOR = {
  easy: "#3f9d5c",
  medium: "#c98a1f",
  hard: "#c1473e",
};

/** Longest-path-from-root layering: a node's column = 1 + max(column of its
 * dependencies). Roots (no deps) sit in column 0. This keeps every arrow
 * pointing strictly left-to-right, which is what makes it read as a DAG
 * rather than a tangle. */
function computeLayout(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const columnOf = {};

  function columnFor(id, seen = new Set()) {
    if (columnOf[id] !== undefined) return columnOf[id];
    if (seen.has(id)) return 0; // guards against a cycle slipping through
    seen.add(id);

    const task = byId[id];
    const deps = task?.dependencies ?? [];
    const col = deps.length === 0
      ? 0
      : 1 + Math.max(...deps.map((d) => (byId[d] ? columnFor(d, seen) : 0)));

    columnOf[id] = col;
    return col;
  }

  tasks.forEach((t) => columnFor(t.id));

  const columns = {};
  tasks.forEach((t) => {
    const col = columnOf[t.id];
    (columns[col] ??= []).push(t);
  });

  return { columnOf, columns };
}

export default function DependencyGraphView({ tasks }) {
  const [heights, setHeights] = useState({});
  const nodeRefs = useRef({});
  const [hovered, setHovered] = useState(null);

  const { columnOf, columns } = useMemo(
    () => computeLayout(tasks ?? []),
    [tasks]
  );

  // Measure actual rendered node heights (description length varies) so rows
  // don't overlap — done post-render since text wraps at unknown heights.
  useLayoutEffect(() => {
    const next = {};
    Object.entries(nodeRefs.current).forEach(([id, el]) => {
      if (el) next[id] = el.offsetHeight;
    });
    setHeights(next);
  }, [tasks]);

  const positions = useMemo(() => {
    const pos = {};
    Object.entries(columns).forEach(([col, colTasks]) => {
      let y = PADDING;
      colTasks.forEach((task) => {
        const h = heights[task.id] ?? NODE_MIN_HEIGHT;
        pos[task.id] = {
          x: PADDING + Number(col) * (NODE_WIDTH + COLUMN_GAP),
          y,
          width: NODE_WIDTH,
          height: h,
        };
        y += h + ROW_GAP;
      });
    });
    return pos;
  }, [columns, heights]);

  const width =
    PADDING * 2 +
    (Object.keys(columns).length || 1) * NODE_WIDTH +
    (Math.max(0, Object.keys(columns).length - 1)) * COLUMN_GAP;
  const height =
    PADDING * 2 +
    Math.max(
      0,
      ...Object.values(columns).map((colTasks) =>
        colTasks.reduce(
          (sum, t) => sum + (heights[t.id] ?? NODE_MIN_HEIGHT) + ROW_GAP,
          0
        )
      )
    );

  if (!tasks || tasks.length === 0) return null;

  const edges = [];
  tasks.forEach((task) => {
    (task.dependencies ?? []).forEach((depId) => {
      if (positions[depId] && positions[task.id]) {
        edges.push({ from: depId, to: task.id });
      }
    });
  });

  function isEdgeActive(edge) {
    if (!hovered) return false;
    return edge.from === hovered || edge.to === hovered;
  }

  function isNodeActive(id) {
    if (!hovered) return true;
    if (id === hovered) return true;
    const task = tasks.find((t) => t.id === id);
    if (task?.dependencies?.includes(hovered)) return true;
    const hoveredTask = tasks.find((t) => t.id === hovered);
    if (hoveredTask?.dependencies?.includes(id)) return true;
    return false;
  }

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 8 }}>
      <div style={{ position: "relative", width, height, minWidth: "100%" }}>
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          <defs>
            <marker
              id="dep-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#b5b5b5" />
            </marker>
            <marker
              id="dep-arrow-active"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="#1c1c1c" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            const startX = from.x + from.width;
            const startY = from.y + from.height / 2;
            const endX = to.x;
            const endY = to.y + to.height / 2;
            const midX = (startX + endX) / 2;
            const active = isEdgeActive(edge);
            return (
              <path
                key={i}
                d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                fill="none"
                stroke={active ? "#1c1c1c" : "#d5d5d5"}
                strokeWidth={active ? 2 : 1.5}
                markerEnd={active ? "url(#dep-arrow-active)" : "url(#dep-arrow)"}
              />
            );
          })}
        </svg>

        {tasks.map((task) => {
          const p = positions[task.id];
          if (!p) return null;
          const active = isNodeActive(task.id);
          return (
            <div
              key={task.id}
              ref={(el) => (nodeRefs.current[task.id] = el)}
              onMouseEnter={() => setHovered(task.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: p.width,
                boxSizing: "border-box",
                border: `1px solid ${active ? "#1c1c1c" : "#e3e3e3"}`,
                borderRadius: 6,
                padding: "0.7rem 0.8rem",
                background: "#fff",
                opacity: active ? 1 : 0.4,
                transition: "opacity 120ms ease, border-color 120ms ease",
                fontFamily: "'Inter', system-ui, sans-serif",
                boxShadow: active
                  ? "0 2px 6px rgba(0,0,0,0.08)"
                  : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background:
                      DIFFICULTY_COLOR[task.estimated_difficulty] || "#999",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                  {task.title}
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#666", lineHeight: 1.4 }}>
                {task.description}
              </div>
              {task.suggested_skills?.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginTop: 6,
                  }}
                >
                  {task.suggested_skills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        fontSize: "0.68rem",
                        background: "#f1f1f1",
                        color: "#555",
                        borderRadius: 4,
                        padding: "0.1rem 0.4rem",
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}