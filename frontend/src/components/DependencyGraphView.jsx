import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { tagLabel } from "../tags.js";
import Perf from "./pixel/Perf.jsx";
import PixelTrain from "./pixel/PixelTrain.jsx";

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
// Rows and the top edge leave room for the little train that sits on in-progress tasks.
const ROW_GAP = 60;
const PADDING = 32;
const PADDING_TOP = 64;

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
      let y = PADDING_TOP;
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
    PADDING_TOP + PADDING +
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

  const statusOf = Object.fromEntries(tasks.map((t) => [t.id, t.status]));

  // Map-route style edges: a white road casing under a solid line once the prerequisite is
  // done, or a dotted line while it isn't. Corners are rounded right angles, like streets.
  function routePath(from, to) {
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const midX = (startX + endX) / 2;
    const dy = endY - startY;
    if (Math.abs(dy) < 1) return { d: `M ${startX} ${startY} H ${endX}`, startX, startY, endX, endY };
    const dir = Math.sign(dy);
    const r = Math.min(12, Math.abs(dy) / 2, (endX - startX) / 4);
    const d =
      `M ${startX} ${startY} H ${midX - r} Q ${midX} ${startY} ${midX} ${startY + dir * r} ` +
      `V ${endY - dir * r} Q ${midX} ${endY} ${midX + r} ${endY} H ${endX}`;
    return { d, startX, startY, endX, endY };
  }

  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 8 }}>
      <div className="graph-map" style={{ position: "relative", width, height, minWidth: "100%" }}>
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {edges.map((edge, i) => (
              <path key={`casing-${i}`} d={routePath(positions[edge.from], positions[edge.to]).d} stroke="#ffffff" strokeWidth={11} />
            ))}
            {edges.map((edge, i) => {
              const done = statusOf[edge.from] === "done";
              const active = isEdgeActive(edge);
              return (
                <path
                  key={i}
                  d={routePath(positions[edge.from], positions[edge.to]).d}
                  stroke={active ? "#2958a3" : done ? "#129ea5" : "#6d9dc5"}
                  strokeWidth={active ? 6 : 5}
                  strokeDasharray={done ? undefined : "0.1 11"}
                />
              );
            })}
          </g>
          {edges.map((edge, i) => {
            const { startX, startY, endX, endY } = routePath(positions[edge.from], positions[edge.to]);
            const color = statusOf[edge.from] === "done" ? "#129ea5" : "#6d9dc5";
            return (
              <g key={`pins-${i}`}>
                <circle cx={startX} cy={startY} r={4.5} fill="#ffffff" stroke={color} strokeWidth={3} />
                <circle cx={endX} cy={endY} r={4.5} fill="#ffffff" stroke={color} strokeWidth={3} />
              </g>
            );
          })}
        </svg>

        {tasks.map((task) => {
          const p = positions[task.id];
          if (!p) return null;
          const inProgress = task.status === "todo" && task.assignee_ids?.length > 0;
          if (!inProgress) return null;
          // A small train on a strip of track along the top of an in-progress task.
          return (
            <div
              key={`train-${task.id}`}
              className="graph-node-train"
              style={{ left: p.x + p.width - 128, top: p.y - 56 }}
              aria-hidden="true"
            >
              <PixelTrain scale={0.95} />
            </div>
          );
        })}

        {tasks.map((task) => {
          const p = positions[task.id];
          if (!p) return null;
          const active = isNodeActive(task.id);
          const status = task.status === "done" ? "done" : task.assignee_ids?.length ? "active" : "waiting";
          return (
            <div
              key={task.id}
              ref={(el) => (nodeRefs.current[task.id] = el)}
              onMouseEnter={() => setHovered(task.id)}
              onMouseLeave={() => setHovered(null)}
              className={`graph-node graph-node-${task.status ? status : "draft"}`}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: p.width,
                opacity: active ? 1 : 0.4,
              }}
            >
              <div className="graph-node-head">
                <span
                  aria-hidden
                  className="graph-node-dot"
                  style={{ background: DIFFICULTY_COLOR[task.estimated_difficulty] || "#999" }}
                />
                <span className="graph-node-title">{task.title}</span>
              </div>
              <Perf />
              <div className="graph-node-desc">{task.description}</div>
              {task.suggested_skills?.length > 0 && (
                <div className="graph-node-skills">
                  {task.suggested_skills.map((skill) => (
                    <span key={skill} className="graph-node-skill">
                      {tagLabel(skill)}
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
