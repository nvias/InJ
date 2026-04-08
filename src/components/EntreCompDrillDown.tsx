"use client";

import { useState, useEffect } from "react";
import {
  ENTRECOMP_AREAS, ENTRECOMP_LEVELS, xpToLevel, GROUP_COLORS,
  type EntreCompArea, type EntreCompCompetence, type LevelGroup,
} from "@/lib/entrecomp";
import { getEntreCompLevel } from "@/lib/frameworks";
import RadarChart from "./RadarChart";

// ---- Public interface ----
// Používej tuto komponentu všude kde se zobrazuje EntreComp.
// data = Map<competence_key, { xp, evidence? }>
// Funguje pro žáka i učitele (průměr třídy).

export interface CompetenceXP {
  xp: number;
  evidence?: string[];
}

interface EntreCompDrillDownProps {
  data: Map<string, CompetenceXP>;
  etalonLevel?: number;
  /** Label zobrazený nad grafem, např. "Anna" nebo "Průměr třídy" */
  label?: string;
}

// ---- Helpers ----

// Level → procento v grafu
// Foundation(1-2)=0-25%, Intermediate(3-4)=25-50%, Advanced(5-6)=50-75%, Expert(7-8)=75-100%
// Level 1 s 0 progress = 3% (viditelný základ, ne neviditelná tečka)
function levelToRadarValue(level: number, progress: number): number {
  // Base: level 1=3%, level 2=12.5%, level 3=25%, level 4=37.5%, ...
  // Each level = 12.5% of full scale. Minimum 3% aby byl vidět.
  const base = Math.max((level - 1) * 12.5, 0);
  const levelProgress = (progress / 100) * 12.5;
  return Math.max(base + levelProgress, 5); // min 5% aby to nebylo neviditelný
}

// Zone rings for radar background
const ZONE_LABELS: { pct: number; group: LevelGroup }[] = [
  { pct: 25, group: "foundation" },
  { pct: 50, group: "intermediate" },
  { pct: 75, group: "advanced" },
  { pct: 100, group: "expert" },
];

// Build radar zone rings scaled to visible area
function buildRadarZones(visiblePct: number) {
  return ZONE_LABELS
    .filter((z) => z.pct <= visiblePct)
    .map((z) => {
      const gc = GROUP_COLORS[z.group];
      return { pct: (z.pct / visiblePct) * 100, color: gc.color, label: gc.labelCZ };
    });
}

// XP progress bar with etalon
function XPProgressBar({ xp, etalonLevel, color }: { xp: number; etalonLevel: number; color: string }) {
  const info = xpToLevel(xp);
  const nextLevel = ENTRECOMP_LEVELS.find((l) => l.level === info.level + 1);
  const xpToNext = nextLevel ? nextLevel.xpRequired - xp : 0;
  return (
    <div>
      <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${info.progress}%`, backgroundColor: color }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-foreground/30 text-[10px]">
          {nextLevel ? `${info.xpInLevel}/${nextLevel.xpRequired - info.levelInfo.xpRequired} XP` : "Max"}
        </span>
        <span className="text-foreground/20 text-[10px]">
          {nextLevel ? `→ ${nextLevel.nameCZ}` : ""}
        </span>
      </div>
    </div>
  );
}

// ---- Level 3: Competence detail with DB descriptions ----

function CompetenceDetail({ comp, area, xp, evidence, etalonLevel, onBack }: {
  comp: EntreCompCompetence; area: EntreCompArea; xp: number;
  evidence: string[]; etalonLevel: number; onBack: () => void;
}) {
  const info = xpToLevel(xp);
  const gc = GROUP_COLORS[info.levelInfo.group];
  const [threads, setThreads] = useState<{ name: string; description: string }[]>([]);

  useEffect(() => {
    getEntreCompLevel(comp.key, info.level).then((result) => setThreads(result.threads));
  }, [comp.key, info.level]);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-foreground/40 text-sm hover:text-foreground/60 mb-4">&larr; {area.nameCZ}</button>

      <div className="text-center mb-5">
        <h3 className="text-xl font-bold text-white">{comp.nameCZ}</h3>
        <p className="text-foreground/40 text-xs mt-1">{comp.name}</p>
      </div>

      <div className="p-5 rounded-2xl mb-5 text-center" style={{ backgroundColor: gc.bg }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: gc.color }}>{gc.labelCZ}</div>
        <div className="text-3xl font-bold text-white">Úroveň {info.level}</div>
        <div className="text-lg font-medium mt-1" style={{ color: gc.color }}>{info.levelInfo.nameCZ}</div>
        <p className="text-foreground/50 text-sm mt-2">{info.levelInfo.description}</p>
        <div className="text-foreground/30 text-xs mt-2">{xp} XP celkem</div>
      </div>

      {/* Thread descriptions from DB */}
      {threads.length > 0 && (
        <div className="mb-5">
          <h4 className="text-foreground/40 text-xs font-semibold uppercase tracking-wider mb-2">Co to znamená na úrovni {info.level}:</h4>
          <div className="flex flex-col gap-2">
            {threads.map((t) => (
              <div key={t.name} className="p-3 rounded-xl" style={{ backgroundColor: area.colorLight }}>
                <p className="text-foreground/50 text-xs font-medium mb-1">{t.name}</p>
                <p className="text-white text-sm">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <XPProgressBar xp={xp} etalonLevel={etalonLevel} color={gc.color} />

      <div className="flex flex-col gap-1 mt-4">
        {ENTRECOMP_LEVELS.map((lv) => {
          const reached = info.level >= lv.level;
          const isCurrent = info.level === lv.level;
          const lvGc = GROUP_COLORS[lv.group];
          return (
            <div key={lv.level} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${isCurrent ? "ring-1" : ""}`}
              style={isCurrent ? { backgroundColor: lvGc.bg, ringColor: lvGc.color } : {}}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                reached ? "text-white" : "text-foreground/15 bg-primary/10"
              }`} style={reached ? { backgroundColor: lvGc.color } : {}}>
                {lv.level}
              </div>
              <span className={`text-sm flex-1 ${reached ? "text-white font-medium" : "text-foreground/25"}`}>
                {lv.nameCZ} <span className="text-foreground/20 text-xs">{lv.xpRequired} XP</span>
              </span>
              {isCurrent && <span className="text-xs font-bold" style={{ color: lvGc.color }}>Aktuální</span>}
            </div>
          );
        })}
      </div>

      {evidence.length > 0 && (
        <div className="mt-4">
          <p className="text-foreground/40 text-xs mb-1">Prokázáno v:</p>
          <div className="flex flex-wrap gap-1">
            {evidence.map((e, i) => <span key={i} className="px-2 py-0.5 bg-primary/10 rounded text-xs text-foreground/50">{e}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main component ----

export default function EntreCompDrillDown({ data, etalonLevel = 1, label }: EntreCompDrillDownProps) {
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [selectedArea, setSelectedArea] = useState<EntreCompArea | null>(null);
  const [selectedComp, setSelectedComp] = useState<EntreCompCompetence | null>(null);

  function compXp(key: string): number {
    return data.get(key)?.xp || 0;
  }

  function areaAvgLevel(area: EntreCompArea): number {
    const levels = area.competences.map((c) => xpToLevel(compXp(c.key)).level);
    return levels.length > 0 ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 1;
  }

  function areaTotalXp(area: EntreCompArea): number {
    return area.competences.reduce((s, c) => s + compXp(c.key), 0);
  }

  // Build radar data with zone-based values
  function buildRadarData(comps: { key: string; nameCZ: string }[]): { label: string; shortLabel: string; value: number }[] {
    return comps.map((c) => {
      const info = xpToLevel(compXp(c.key));
      return {
        label: c.nameCZ,
        shortLabel: c.nameCZ.length > 12 ? c.nameCZ.slice(0, 11) + "…" : c.nameCZ,
        value: levelToRadarValue(info.level, info.progress),
      };
    });
  }

  // Overall max level
  let overallMaxLevel = 1;
  for (const area of ENTRECOMP_AREAS) {
    for (const c of area.competences) {
      const lv = xpToLevel(compXp(c.key)).level;
      if (lv > overallMaxLevel) overallMaxLevel = lv;
    }
  }
  const overallGroup = ENTRECOMP_LEVELS[Math.max(overallMaxLevel - 1, 0)].group;
  const overallGc = GROUP_COLORS[overallGroup];

  // Determine max chart range based on max level (zoom effect)
  const maxGroupIndex = Math.floor((overallMaxLevel - 1) / 2);
  const visiblePct = (maxGroupIndex + 1) * 25; // 25, 50, 75, or 100

  // Scale radar values so visible zone fills the chart
  function scaleForZoom(value: number): number {
    return (value / visiblePct) * 100;
  }

  // === LEVEL 3: Detail kompetence ===
  if (selectedArea && selectedComp) {
    return (
      <CompetenceDetail
        comp={selectedComp}
        area={selectedArea}
        xp={compXp(selectedComp.key)}
        evidence={data.get(selectedComp.key)?.evidence || []}
        etalonLevel={etalonLevel}
        onBack={() => setSelectedComp(null)}
      />
    );
  }

  // === LEVEL 2: Kompetence v oblasti ===
  if (selectedArea) {
    const radarData = buildRadarData(selectedArea.competences);
    const areaMaxLv = Math.max(...selectedArea.competences.map((c) => xpToLevel(compXp(c.key)).level));
    const areaVisiblePct = (Math.floor((areaMaxLv - 1) / 2) + 1) * 25;
    const scaledData = radarData.map((d) => ({ ...d, value: (d.value / areaVisiblePct) * 100 }));

    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelectedArea(null)}
          className="text-foreground/40 text-sm hover:text-foreground/60 mb-4">&larr; Přehled</button>

        <div className="text-center mb-3">
          <h3 className="text-lg font-bold" style={{ color: selectedArea.color }}>{selectedArea.nameCZ}</h3>
          <p className="text-foreground/30 text-xs">{selectedArea.name} · {areaTotalXp(selectedArea)} XP</p>
        </div>

        <div className="flex justify-center">
          <RadarChart data={scaledData} size={300} color={selectedArea.color}
            zones={buildRadarZones(areaVisiblePct)} />
        </div>

        {/* Zone indicator */}
        <div className="flex justify-center gap-2 mt-2 mb-4">
          {ZONE_LABELS.filter((z) => z.pct <= areaVisiblePct).map((z) => {
            const gc = GROUP_COLORS[z.group];
            const isCurrent = Math.floor((areaMaxLv - 1) / 2) === ZONE_LABELS.indexOf(z);
            return (
              <span key={z.group} className={`text-[10px] px-2 py-0.5 rounded-full ${isCurrent ? "font-bold" : ""}`}
                style={{ backgroundColor: isCurrent ? gc.bg : "transparent", color: isCurrent ? gc.color : "#ffffff20" }}>
                {gc.labelCZ}
              </span>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          {selectedArea.competences.map((comp) => {
            const xp = compXp(comp.key);
            const info = xpToLevel(xp);
            const gc = GROUP_COLORS[info.levelInfo.group];
            return (
              <button key={comp.key} onClick={() => setSelectedComp(comp)}
                className="p-3.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                style={{ backgroundColor: selectedArea.colorLight }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white font-medium text-sm">{comp.nameCZ}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: gc.bg, color: gc.color }}>
                    Lv.{info.level} {info.levelInfo.nameCZ}
                  </span>
                </div>
                <XPProgressBar xp={xp} etalonLevel={etalonLevel} color={selectedArea.color} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // === LEVEL 1: Přehled ===
  const summaryRadar = ENTRECOMP_AREAS.map((a) => ({
    label: a.nameCZ, shortLabel: a.nameCZ,
    value: scaleForZoom(levelToRadarValue(areaAvgLevel(a), 0)),
  }));

  const detailRadar = ENTRECOMP_AREAS.flatMap((a) =>
    a.competences.map((c) => {
      const info = xpToLevel(compXp(c.key));
      return {
        label: c.nameCZ,
        shortLabel: c.nameCZ.length > 12 ? c.nameCZ.slice(0, 11) + "…" : c.nameCZ,
        value: scaleForZoom(levelToRadarValue(info.level, info.progress)),
      };
    })
  );

  const radarData = view === "summary" ? summaryRadar : detailRadar;

  return (
    <div className="animate-fade-in">
      {/* Level badge */}
      <div className="text-center mb-4">
        {label && <p className="text-foreground/40 text-xs mb-1">{label}</p>}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold" style={{ backgroundColor: overallGc.bg, color: overallGc.color }}>
          <span className="text-lg">{overallMaxLevel <= 2 ? "🌱" : overallMaxLevel <= 4 ? "🌿" : overallMaxLevel <= 6 ? "🌳" : "⭐"}</span>
          {overallGc.labelCZ} — Úroveň {overallMaxLevel}
        </div>
        <p className="text-foreground/30 text-xs mt-1">
          {ENTRECOMP_LEVELS[Math.max(overallMaxLevel - 1, 0)].nameCZ} — {ENTRECOMP_LEVELS[Math.max(overallMaxLevel - 1, 0)].description}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex justify-center gap-1 mb-3 bg-primary/10 rounded-lg p-1">
        <button onClick={() => setView("summary")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === "summary" ? "bg-accent/20 text-accent" : "text-foreground/40"}`}>
          3 oblasti
        </button>
        <button onClick={() => setView("detail")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === "detail" ? "bg-accent/20 text-accent" : "text-foreground/40"}`}>
          15 kompetencí
        </button>
      </div>

      {/* Radar */}
      <div className="flex justify-center">
        <RadarChart data={radarData} size={view === "detail" ? 350 : 320} color={view === "detail" ? "#7C3AED" : "#00D4FF"}
          zones={buildRadarZones(visiblePct)} />
      </div>

      {/* Visible zone indicator */}
      <div className="flex justify-center gap-2 mt-2 mb-4">
        {ZONE_LABELS.filter((z) => z.pct <= visiblePct).map((z) => {
          const gc = GROUP_COLORS[z.group];
          const isCurrent = z.group === overallGroup;
          return (
            <span key={z.group} className={`text-xs px-2.5 py-1 rounded-full ${isCurrent ? "font-bold" : ""}`}
              style={{ backgroundColor: isCurrent ? gc.bg : "transparent", color: isCurrent ? gc.color : "#ffffff25" }}>
              {gc.labelCZ}
            </span>
          );
        })}
      </div>

      {/* Area cards */}
      <div className="flex flex-col gap-3">
        {ENTRECOMP_AREAS.map((area) => {
          const avgLv = areaAvgLevel(area);
          const totalXp = areaTotalXp(area);
          const lvInfo = ENTRECOMP_LEVELS[Math.max(avgLv - 1, 0)];
          const gc = GROUP_COLORS[lvInfo.group];

          return (
            <button key={area.key} onClick={() => setSelectedArea(area)}
              className="p-4 rounded-xl text-left transition-all hover:scale-[1.01] border border-transparent hover:border-white/10"
              style={{ backgroundColor: area.colorLight }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-white font-semibold">{area.nameCZ}</h3>
                  <p className="text-foreground/30 text-xs">{area.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: gc.bg, color: gc.color }}>
                    Lv.{avgLv} {lvInfo.nameCZ}
                  </span>
                  <div className="text-foreground/20 text-xs mt-1">{totalXp} XP</div>
                </div>
              </div>
              <div className="flex gap-1">
                {area.competences.map((c) => {
                  const info = xpToLevel(compXp(c.key));
                  return (
                    <div key={c.key} className="flex-1 h-2 bg-black/20 rounded-full overflow-hidden" title={`${c.nameCZ}: Lv.${info.level}`}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(info.progress, 5)}%`, backgroundColor: area.color }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {area.competences.map((c) => (
                  <span key={c.key} className="flex-1 text-[9px] text-foreground/20 text-center truncate">{c.nameCZ}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
