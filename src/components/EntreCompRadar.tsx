"use client";

import { useState } from "react";
import { ENTRECOMP_AREAS, xpToLevel, GROUP_COLORS, type LevelGroup } from "@/lib/entrecomp";

interface CompetenceXP {
  xp: number;
  evidence?: string[];
}

interface EntreCompRadarProps {
  data: Map<string, CompetenceXP>;
  etalonLevel?: number;
  size?: number;
  onCompetenceClick?: (areaKey: string, compKey: string) => void;
}

const ZONES: { group: LevelGroup; maxLevel: number }[] = [
  { group: "foundation", maxLevel: 2 },
  { group: "intermediate", maxLevel: 4 },
  { group: "advanced", maxLevel: 6 },
  { group: "expert", maxLevel: 8 },
];

const SHORT_LABELS: Record<string, string> = {
  spotting_opportunities: "Příležitosti",
  creativity: "Kreativita",
  vision: "Vize",
  valuing_ideas: "Nápady",
  ethical_thinking: "Etika",
  self_awareness: "Sebe-uv.",
  motivation: "Motivace",
  mobilising_resources: "Zdroje",
  financial_literacy: "Finance",
  mobilising_others: "Mobilizace",
  taking_initiative: "Iniciativa",
  planning: "Plánování",
  coping_with_uncertainty: "Nejistota",
  working_with_others: "Spolupráce",
  learning_through_experience: "Zkušenost",
};

export default function EntreCompRadar({ data, etalonLevel = 1, size = 340, onCompetenceClick }: EntreCompRadarProps) {
  const [hoveredComp, setHoveredComp] = useState<string | null>(null);

  // Find max level across all competences to determine visible zones
  const allComps = ENTRECOMP_AREAS.flatMap((area) =>
    area.competences.map((c) => ({ ...c, areaKey: area.key, areaColor: area.color }))
  );
  const n = allComps.length;
  const angleStep = (2 * Math.PI) / n;

  let maxStudentLevel = 1;
  for (const comp of allComps) {
    const xp = data.get(comp.key)?.xp || 0;
    const info = xpToLevel(xp);
    if (info.level > maxStudentLevel) maxStudentLevel = info.level;
  }

  // Determine which zones to show: always show current + one above (as goal)
  const maxVisibleLevel = Math.min(maxStudentLevel + 2, 8);
  const visibleZones = ZONES.filter((z) => z.maxLevel <= maxVisibleLevel + 1);
  const maxZoneLevel = visibleZones[visibleZones.length - 1]?.maxLevel || 2;

  // Current group label
  const currentZone = ZONES.find((z) => maxStudentLevel <= z.maxLevel) || ZONES[0];
  const currentGc = GROUP_COLORS[currentZone.group];

  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size / 2) - 35;

  function levelToRadius(level: number): number {
    return (level / maxZoneLevel) * maxR;
  }

  function getPoint(index: number, radius: number): [number, number] {
    const angle = angleStep * index - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }

  function makePolygon(radiusFn: (i: number) => number): string {
    return allComps.map((_, i) => {
      const [x, y] = getPoint(i, radiusFn(i));
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join(" ") + " Z";
  }

  // Student polygon
  const studentPath = makePolygon((i) => {
    const xp = data.get(allComps[i].key)?.xp || 0;
    const info = xpToLevel(xp);
    const r = levelToRadius(info.level + info.progress / 100);
    return Math.max(r, 5);
  });

  // Etalon polygon
  const etalonR = levelToRadius(etalonLevel);

  return (
    <div className="flex flex-col items-center">
      {/* Current level badge */}
      <div className="mb-3 px-4 py-1.5 rounded-full text-sm font-bold" style={{ backgroundColor: currentGc.bg, color: currentGc.color }}>
        {currentGc.label} — Úroveň {maxStudentLevel}
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        {/* Zone rings - only visible zones */}
        {visibleZones.map((zone) => {
          const gc = GROUP_COLORS[zone.group];
          const r = levelToRadius(zone.maxLevel);
          const isReached = maxStudentLevel >= zone.maxLevel - 1;
          const points = allComps.map((_, i) => getPoint(i, r).join(",")).join(" ");

          return (
            <g key={zone.group}>
              <polygon points={points}
                fill={gc.color} fillOpacity={isReached ? 0.08 : 0.03}
                stroke={gc.color} strokeOpacity={isReached ? 0.25 : 0.1} strokeWidth={1} />
              {/* Zone label */}
              <text x={cx + 4} y={cy - r + 14} className="text-[9px] font-medium" style={{ fill: gc.color }} fillOpacity={0.5}>
                {gc.label}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        {allComps.map((comp, i) => {
          const outerR = levelToRadius(maxZoneLevel);
          const [x, y] = getPoint(i, outerR);
          return <line key={`ax-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={comp.areaColor} strokeOpacity={0.1} strokeWidth={1} />;
        })}

        {/* Area color marks on outer edge */}
        {allComps.map((comp, i) => {
          const outerR = levelToRadius(maxZoneLevel);
          const [x1, y1] = getPoint(i, outerR);
          const [x2, y2] = getPoint(i, outerR + 4);
          return <line key={`mark-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={comp.areaColor} strokeWidth={3} strokeLinecap="round" />;
        })}

        {/* Etalon ring (dashed) */}
        {etalonR > 0 && (
          <polygon
            points={allComps.map((_, i) => getPoint(i, etalonR).join(",")).join(" ")}
            fill="none" stroke="#D97706" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.35}
          />
        )}

        {/* Student polygon */}
        <path d={studentPath} fill="#00D4FF" fillOpacity={0.2} stroke="#00D4FF" strokeWidth={2.5} strokeLinejoin="round">
          <animate
            attributeName="d"
            from={makePolygon(() => 0)}
            to={studentPath}
            dur="0.8s" fill="freeze"
          />
        </path>

        {/* Data points */}
        {allComps.map((comp, i) => {
          const xp = data.get(comp.key)?.xp || 0;
          const info = xpToLevel(xp);
          const r = levelToRadius(info.level + info.progress / 100);
          const [px, py] = getPoint(i, Math.max(r, 5));
          const isHovered = hoveredComp === comp.key;
          const gc = GROUP_COLORS[info.levelInfo.group];

          return (
            <g key={`pt-${i}`}
              onMouseEnter={() => setHoveredComp(comp.key)}
              onMouseLeave={() => setHoveredComp(null)}
              onClick={() => onCompetenceClick?.(comp.areaKey, comp.key)}
              className="cursor-pointer">
              {isHovered && <circle cx={px} cy={py} r={10} fill={gc.color} fillOpacity={0.2} />}
              <circle cx={px} cy={py} r={isHovered ? 6 : 4} fill={gc.color} stroke="white" strokeWidth={1.5} />
              {isHovered && (
                <>
                  <text x={px} y={py - 14} textAnchor="middle" className="text-[11px] font-bold" style={{ fill: gc.color }}>
                    Lv.{info.level}
                  </text>
                  <text x={px} y={py + 18} textAnchor="middle" className="text-[9px]" style={{ fill: "#ffffff80" }}>
                    {xp} XP
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Axis labels */}
        {allComps.map((comp, i) => {
          const outerR = levelToRadius(maxZoneLevel) + 18;
          const angle = angleStep * i - Math.PI / 2;
          const x = cx + outerR * Math.cos(angle);
          const y = cy + outerR * Math.sin(angle);
          const isHovered = hoveredComp === comp.key;
          const hasData = (data.get(comp.key)?.xp || 0) > 0;

          return (
            <text key={`lbl-${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              className={isHovered ? "text-[10px] font-bold" : "text-[8px]"}
              style={{ fill: isHovered ? comp.areaColor : hasData ? "#ffffff70" : "#ffffff25" }}
              onMouseEnter={() => setHoveredComp(comp.key)}
              onMouseLeave={() => setHoveredComp(null)}
              onClick={() => onCompetenceClick?.(comp.areaKey, comp.key)}>
              {SHORT_LABELS[comp.key] || comp.key}
            </text>
          );
        })}
      </svg>

      {/* Legend - only visible zones */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {visibleZones.map((zone) => {
          const gc = GROUP_COLORS[zone.group];
          const isCurrent = currentZone.group === zone.group;
          return (
            <div key={zone.group} className={`flex items-center gap-1.5 text-xs ${isCurrent ? "font-bold" : ""}`}>
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: gc.color, opacity: isCurrent ? 1 : 0.4 }} />
              <span style={{ color: isCurrent ? gc.color : "#ffffff40" }}>{gc.label} ({zone.maxLevel - 1}-{zone.maxLevel})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
