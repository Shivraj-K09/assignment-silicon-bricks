import { memo } from "react";
import type { Design } from "@/lib/designs";

type FloorRow = Design["floorTable"][number];

/** Drawing space for one building: 100 wide, ground near the bottom. */
export const ELEVATION_W = 100;
export const ELEVATION_H = 100;
export const GROUND_Y = 94;
const ROOF_SPACE = 24;

/** How far a box's depth shows: the side face runs this far right and up. */
const DEPTH_X = 8;
const DEPTH_Y = 5;

/** Shades per use, top to bottom of a face: lighter at the top, as if lit from above. */
const SHADES: Record<FloorRow["use"], [string, string]> = {
  residential: ["#93c5fd", "#3b82f6"],
  hotel: ["#c4b5fd", "#8b5cf6"],
  office: ["#6ee7b7", "#10b981"],
  parking: ["#e4e4e7", "#a1a1aa"],
  lobby: ["#fde68a", "#f59e0b"],
};

/** The ghost colours for the design that is not picked. */
const GHOST: [string, string] = ["#f4f4f5", "#d4d4d8"];

/** Uses whose floors have windows; parking and the lobby get their own fronts. */
const GLAZED = new Set<FloorRow["use"]>(["residential", "hotel", "office"]);

/** Metres to drawing units: the tallest design in the scene fills the height. */
export function elevationScale(tallestM: number) {
  return (GROUND_Y - ROOF_SPACE) / tallestM;
}

const plateWidth = (row: FloorRow, widest: number) => 16 + 52 * (row.areaPerFloorM2 / widest);

/**
 * One design drawn as a stack of small boxes, one per floor-table row: as tall as
 * its floors and as wide as its floor plate, in an oblique view with a lit roof
 * and a shaded side. Flats, rooms and offices get a grid of windows, parking gets
 * open slots, the lobby a glass front and door, and the top a parapet and plant
 * room. Every building in a scene shares `scale`, so they compare at a glance.
 */
export const DesignElevation = memo(function DesignElevation({
  design,
  scale,
  ghost,
}: {
  design: Design;
  /** Drawing units per metre, from `elevationScale`. */
  scale: number;
  /** Draw in pale grey, without the height marker: the design that is not picked. */
  ghost: boolean;
}) {
  const rows = [...design.floorTable].sort((a, b) => a.fromM - b.fromM);
  const widest = Math.max(...rows.map((r) => r.areaPerFloorM2), 1);
  const yFor = (m: number) => GROUND_Y - m * scale;
  const id = `elevation-${design.id}-${ghost ? "ghost" : "colour"}`;
  const baseWidth = Math.max(...rows.map((row) => plateWidth(row, widest)));
  const topRow = rows[rows.length - 1];

  return (
    <svg
      viewBox={`0 0 ${ELEVATION_W} ${ELEVATION_H}`}
      preserveAspectRatio="xMidYMax meet"
      className="block h-full w-full overflow-visible"
      aria-hidden
    >
      <defs>
        {Object.entries(SHADES).map(([use, colours]) => {
          const [top, bottom] = ghost ? GHOST : colours;
          return (
            <linearGradient key={use} id={`${id}-${use}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={top} />
              <stop offset="1" stopColor={bottom} />
            </linearGradient>
          );
        })}
        <radialGradient id={`${id}-shadow`}>
          <stop offset="0" stopColor="#0f172a" stopOpacity={ghost ? 0.06 : 0.16} />
          <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        cx={ELEVATION_W / 2 + DEPTH_X / 2}
        cy={GROUND_Y}
        rx={baseWidth / 2 + 10}
        ry="4"
        fill={`url(#${id}-shadow)`}
      />

      {rows.map((row) => (
        <Box
          key={`${row.label}-${row.fromM}`}
          row={row}
          width={plateWidth(row, widest)}
          yFor={yFor}
          fill={`url(#${id}-${row.use})`}
          ghost={ghost}
        />
      ))}

      {topRow && <Roof width={plateWidth(topRow, widest)} top={yFor(topRow.toM)} ghost={ghost} />}

      {!ghost && (
        <HeightMarker
          left={(ELEVATION_W - baseWidth - DEPTH_X) / 2}
          top={yFor(design.totals.roofM)}
          roofM={design.totals.roofM}
        />
      )}
    </svg>
  );
});

// ---- One block ----------------------------------------------------------------------------

/** One floor-table row as a box in an oblique view: front, shaded side, lit roof. */
function Box({
  row,
  width,
  yFor,
  fill,
  ghost,
}: {
  row: FloorRow;
  width: number;
  yFor: (m: number) => number;
  fill: string;
  ghost: boolean;
}) {
  const x = (ELEVATION_W - width - DEPTH_X) / 2;
  const right = x + width;
  const top = yFor(row.toM);
  const bottom = yFor(row.fromM);
  const height = Math.max(0.8, bottom - top);

  const side = `${right},${top} ${right + DEPTH_X},${top - DEPTH_Y} ${right + DEPTH_X},${bottom - DEPTH_Y} ${right},${bottom}`;
  const roof = `${x},${top} ${x + DEPTH_X},${top - DEPTH_Y} ${right + DEPTH_X},${top - DEPTH_Y} ${right},${top}`;
  const face = { x, right, top, bottom, height, floors: Math.max(1, row.floors) };

  return (
    <g>
      <polygon points={side} fill={fill} />
      <polygon points={side} fill="#0f172a" fillOpacity="0.2" />
      <polygon points={roof} fill={fill} />
      <polygon points={roof} fill="#fff" fillOpacity="0.55" />
      <rect x={x} y={top} width={width} height={height} fill={fill} />

      {GLAZED.has(row.use) && <Windows face={face} ghost={ghost} />}
      {row.use === "parking" && <ParkingSlots face={face} />}
      {row.use === "lobby" && <LobbyFront face={face} ghost={ghost} />}

      {/* A crisp edge where the front meets the side. */}
      <line
        x1={right}
        x2={right}
        y1={top}
        y2={bottom}
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="0.3"
      />
    </g>
  );
}

interface Face {
  x: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
  floors: number;
}

/**
 * A grid of window panes, one row per floor (thinned on very tall towers so the
 * panes stay legible), with narrower darker panes on the side face.
 */
function Windows({ face, ghost }: { face: Face; ghost: boolean }) {
  const floorH = face.height / face.floors;
  const step = Math.max(1, Math.ceil(1.6 / floorH));
  const rowH = floorH * step;
  const paneH = Math.max(0.5, rowH * 0.5);
  const width = face.right - face.x;
  const columns = Math.max(2, Math.floor(width / 4.5));
  const bay = width / columns;
  const paneW = bay * 0.62;
  const sideColumns = 2;
  const sideBay = DEPTH_X / sideColumns;

  const rows: number[] = [];
  for (let floor = 0; floor < face.floors; floor += step) {
    rows.push(face.top + floor * floorH + (rowH - paneH) / 2);
  }
  const glass = ghost ? "#ffffff" : "#eff6ff";

  return (
    <g>
      {rows.map((y) => (
        <g key={`row-${y}`}>
          {Array.from({ length: columns }, (_, c) => (
            <rect
              key={`front-${c}`}
              x={face.x + c * bay + (bay - paneW) / 2}
              y={y}
              width={paneW}
              height={paneH}
              rx="0.15"
              fill={glass}
              fillOpacity={ghost ? 0.5 : 0.42}
            />
          ))}
          {Array.from({ length: sideColumns }, (_, c) => {
            const sx = face.right + c * sideBay + sideBay * 0.25;
            const lift = ((c * sideBay + sideBay * 0.25) / DEPTH_X) * DEPTH_Y;
            return (
              <polygon
                key={`side-${c}`}
                points={`${sx},${y - lift} ${sx + sideBay * 0.5},${y - lift - (sideBay * 0.5 * DEPTH_Y) / DEPTH_X} ${sx + sideBay * 0.5},${y - lift - (sideBay * 0.5 * DEPTH_Y) / DEPTH_X + paneH} ${sx},${y - lift + paneH}`}
                fill={glass}
                fillOpacity={ghost ? 0.3 : 0.2}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
}

/** Car-park levels: a long dark opening on every floor. */
function ParkingSlots({ face }: { face: Face }) {
  const floorH = face.height / face.floors;
  const inset = 1.2;
  const slots = Array.from({ length: face.floors }, (_, f) => face.top + f * floorH + floorH * 0.3);
  return (
    <g>
      {slots.map((y) => (
        <rect
          key={`slot-${y}`}
          x={face.x + inset}
          y={y}
          width={face.right - face.x - inset * 2}
          height={Math.max(0.4, floorH * 0.42)}
          rx="0.2"
          fill="#0f172a"
          fillOpacity="0.16"
        />
      ))}
    </g>
  );
}

/** The lobby: a glass front with mullions and an entrance door in the middle. */
function LobbyFront({ face, ghost }: { face: Face; ghost: boolean }) {
  const width = face.right - face.x;
  const doorW = Math.min(5, width * 0.18);
  const doorX = face.x + (width - doorW) / 2;
  const mullions = Math.max(2, Math.floor(width / 5));
  return (
    <g>
      <rect
        x={face.x + 0.8}
        y={face.top + 0.6}
        width={width - 1.6}
        height={Math.max(0.4, face.height - 0.6)}
        fill="#fff"
        fillOpacity={ghost ? 0.4 : 0.35}
      />
      {Array.from({ length: mullions - 1 }, (_, i) => {
        const mx = face.x + ((i + 1) * width) / mullions;
        return (
          <line
            key={`mullion-${mx}`}
            x1={mx}
            x2={mx}
            y1={face.top + 0.6}
            y2={face.bottom}
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="0.3"
          />
        );
      })}
      <rect
        x={doorX}
        y={face.top + face.height * 0.25}
        width={doorW}
        height={face.height * 0.75}
        fill="#0f172a"
        fillOpacity={ghost ? 0.08 : 0.22}
      />
    </g>
  );
}

/** A parapet along the top edge and a small plant room set back on the roof. */
function Roof({ width, top, ghost }: { width: number; top: number; ghost: boolean }) {
  const x = (ELEVATION_W - width - DEPTH_X) / 2;
  const plantW = Math.min(10, width * 0.3);
  const plantX = x + width * 0.55 + DEPTH_X * 0.5;
  const plantY = top - DEPTH_Y * 0.6;
  const plantH = 2.2;
  const tone = ghost ? "#e4e4e7" : "#cbd5e1";
  return (
    <g>
      <rect x={x} y={top - 0.6} width={width} height="0.6" fill="#fff" fillOpacity="0.7" />
      <rect x={plantX} y={plantY - plantH} width={plantW} height={plantH} fill={tone} />
      <polygon
        points={`${plantX},${plantY - plantH} ${plantX + 2},${plantY - plantH - 1.2} ${plantX + plantW + 2},${plantY - plantH - 1.2} ${plantX + plantW},${plantY - plantH}`}
        fill="#fff"
        fillOpacity="0.8"
      />
      <polygon
        points={`${plantX + plantW},${plantY - plantH} ${plantX + plantW + 2},${plantY - plantH - 1.2} ${plantX + plantW + 2},${plantY - 1.2} ${plantX + plantW},${plantY}`}
        fill={tone}
        fillOpacity="0.7"
      />
    </g>
  );
}

// ---- Height marker ------------------------------------------------------------------------

/** A dotted dimension line beside the building, from the ground to the roof, with its height. */
function HeightMarker({ left, top, roofM }: { left: number; top: number; roofM: number }) {
  const x = Math.max(4, left - 5);
  const tick = 1.6;
  return (
    <g stroke="#64748b" strokeWidth="0.4" strokeLinecap="round">
      <line x1={x} x2={x} y1={GROUND_Y} y2={top} strokeDasharray="0.1 1.4" strokeWidth="0.7" />
      <line x1={x - tick} x2={x + tick} y1={top} y2={top} />
      <line x1={x - tick} x2={x + tick} y1={GROUND_Y} y2={GROUND_Y} />
      <text
        x={x}
        y={top - 2.2}
        textAnchor="middle"
        fontSize="5"
        fontWeight="500"
        fill="#475569"
        stroke="none"
      >
        {Math.round(roofM)} m
      </text>
    </g>
  );
}
