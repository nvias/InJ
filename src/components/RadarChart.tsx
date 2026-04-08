"use client";

interface RadarDataPoint {
  label: string;
  value: number; // 0-100
  shortLabel?: string;
}

interface RadarZone {
  pct: number; // where this zone ends (0-100)
  color: string;
  label?: string;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  color?: string;
  bgColor?: string;
  compareData?: RadarDataPoint[];
  compareColor?: string;
  compareLabel?: string;
  /** Optional colored zone rings (e.g. Foundation/Intermediate/Advanced/Expert) */
  zones?: RadarZone[];
}

export default function RadarChart({
  data,
  size = 280,
  color = "#00D4FF",
  bgColor = "#1A3BE8",
  compareData,
  compareColor = "#FF6B6B",
  zones,
}: RadarChartProps) {
  if (data.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const levels = 4; // concentric rings
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;

  // Calculate point positions
  function getPoint(index: number, value: number): [number, number] {
    const angle = angleStep * index - Math.PI / 2; // start from top
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Build polygon path
  function buildPath(values: number[]): string {
    return values
      .map((v, i) => {
        const [x, y] = getPoint(i, v);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ") + " Z";
  }

  const dataPath = buildPath(data.map((d) => d.value));
  const comparePath = compareData ? buildPath(compareData.map((d) => d.value)) : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Zone rings (if provided) */}
        {zones && zones.map((zone) => {
          const r = (zone.pct / 100) * radius;
          const points = Array.from({ length: n }, (_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(" ");
          return (
            <g key={zone.pct}>
              <polygon points={points} fill={zone.color} fillOpacity={0.06} stroke={zone.color} strokeOpacity={0.2} strokeWidth={1} />
              {zone.label && (
                <text x={cx + 3} y={cy - r + 11} className="text-[8px]" style={{ fill: zone.color }} fillOpacity={0.5}>{zone.label}</text>
              )}
            </g>
          );
        })}
        {/* Background rings (only if no zones) */}
        {!zones && Array.from({ length: levels }, (_, level) => {
          const r = ((level + 1) / levels) * radius;
          const points = Array.from({ length: n }, (_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(" ");
          return (
            <polygon key={level} points={points} fill="none" stroke={bgColor} strokeOpacity={0.2} strokeWidth={1} />
          );
        })}

        {/* Axis lines */}
        {data.map((_, i) => {
          const [x, y] = getPoint(i, 100);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={bgColor} strokeOpacity={0.15} strokeWidth={1} />
          );
        })}

        {/* Compare polygon (behind main) */}
        {comparePath && (
          <polygon
            points={comparePath.replace(/[MLZ]/g, (m) => (m === "Z" ? "" : "")).trim().replace(/L/g, " ")}
            fill={compareColor}
            fillOpacity={0.1}
            stroke={compareColor}
            strokeWidth={1.5}
            strokeOpacity={0.4}
          >
            <animate attributeName="fill-opacity" from="0" to="0.1" dur="0.5s" fill="freeze" />
          </polygon>
        )}

        {/* Main data polygon */}
        <path
          d={dataPath}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        >
          <animate attributeName="fill-opacity" from="0" to="0.15" dur="0.6s" fill="freeze" />
        </path>

        {/* Data points */}
        {data.map((d, i) => {
          const [x, y] = getPoint(i, d.value);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill={d.value > 0 ? color : "#666"}
              stroke={d.value > 0 ? color : "#444"}
              strokeWidth={1}
            >
              <animate attributeName="r" from="0" to="3" dur="0.4s" fill="freeze" begin={`${i * 0.05}s`} />
            </circle>
          );
        })}

        {/* Labels */}
        {data.map((d, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const labelR = radius + 22;
          const x = cx + labelR * Math.cos(angle);
          const y = cy + labelR * Math.sin(angle);
          const isTop = angle < -Math.PI / 4 && angle > -3 * Math.PI / 4;
          const isBottom = angle > Math.PI / 4 && angle < 3 * Math.PI / 4;

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline={isTop ? "auto" : isBottom ? "hanging" : "middle"}
              className="text-[9px] fill-current"
              style={{ fill: d.value > 0 ? "#ffffff80" : "#ffffff30" }}
            >
              {d.shortLabel || d.label}
            </text>
          );
        })}

        {/* Center value percentages on hover points */}
        {data.map((d, i) => {
          if (d.value === 0) return null;
          const [x, y] = getPoint(i, d.value);
          return (
            <text
              key={`v${i}`}
              x={x}
              y={y - 8}
              textAnchor="middle"
              className="text-[8px] font-bold"
              style={{ fill: color }}
            >
              {d.value}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}
