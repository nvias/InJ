"use client";

import type { Activity } from "@/types";

// ═══════════════════════════════════════════════
// Detail Team Forge aktivity — read-only přehled
// (postavy jsou hardcoded v src/components/TeamForge.tsx,
// odpovídají fyzickým kartičkám)
// ═══════════════════════════════════════════════

const CHARACTERS = [
  { name: "SIMONA",  theme: "yellow", typeName: "Archer",    emoji: "🏹", stats: [31, 10, 59] },
  { name: "ZUZANA",  theme: "blue",   typeName: "Bard",      emoji: "🎵", stats: [19, 64, 17] },
  { name: "PETRA",   theme: "green",  typeName: "Healer",    emoji: "🌿", stats: [56, 39,  5] },
  { name: "VIKTOR",  theme: "red",    typeName: "Scholar",   emoji: "📚", stats: [16, 75,  9] },
  { name: "TOMAS",   theme: "green",  typeName: "Ninja",     emoji: "🥷", stats: [28, 15, 57] },
  { name: "LUCIE",   theme: "green",  typeName: "Wizard",    emoji: "🔮", stats: [19, 64, 17] },
  { name: "RENATA",  theme: "blue",   typeName: "Knight",    emoji: "🛡️", stats: [67, 24,  9] },
  { name: "MARKETA", theme: "red",    typeName: "Berserker", emoji: "⚔️", stats: [19,  4, 77] },
  { name: "RADEK",   theme: "red",    typeName: "Berserker", emoji: "🪓", stats: [ 7, 22, 71] },
  { name: "FILIP",   theme: "yellow", typeName: "Sorceress", emoji: "✨", stats: [74,  5, 21] },
];

const STAT_NAMES = ["Pečlivost", "Nápady", "Spolupráce"];
const STAT_COLORS = ["#4dd0e1", "#ffd740", "#a5d610"];
const THEME_COLORS: Record<string, string> = {
  blue: "#2196f3", yellow: "#f5c800", red: "#e53935", green: "#2e7d32",
};

interface Props {
  activity: Activity;
}

export default function TeamForgeDetail({ activity }: Props) {
  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎯</span>
          <div>
            <div className="text-xs uppercase tracking-wider text-accent/70">Typ aktivity</div>
            <div className="text-lg font-bold text-white">Team Forge — sestavování týmu</div>
          </div>
        </div>
        <p className="text-sm text-foreground/60 leading-relaxed">
          Aktuálně <strong>single-player</strong> trénink: žák sestavuje tým 3 postav ze 10 a hra hodnotí
          balance dovedností + osobnostní diverzitu ve 3 kolech. V budoucnu plánováno jako týmovka pro 3 reálné žáky.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Velikost skupiny</div>
            <div className="text-white font-bold mt-1">{activity.team_size}</div>
          </div>
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Lobby před hrou</div>
            <div className="text-white font-bold mt-1">{activity.requires_grouping ? "Ano" : "Ne"}</div>
          </div>
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Postav</div>
            <div className="text-white font-bold mt-1">{CHARACTERS.length}</div>
          </div>
        </div>
      </div>

      {/* Scoring rules */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3">Pravidla skórování</h3>
        <ul className="space-y-2 text-sm text-foreground/70">
          <li><span className="text-green-400 font-bold">Kolo 1</span> — balance 3 dovedností (max 100 b)</li>
          <li><span className="text-yellow-400 font-bold">Kolo 2</span> — balance + bonus za diverzitu osobností (max 200 b)</li>
          <li><span className="text-pink-400 font-bold">Kolo 3</span> — finále, stejná pravidla, výzva překonat skóre kola 2</li>
        </ul>
      </div>

      {/* Character roster */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3">
          Postavy ({CHARACTERS.length})
          <span className="text-foreground/30 text-xs ml-2 normal-case">— odpovídají fyzickým kartičkám</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {CHARACTERS.map((c) => (
            <div key={c.name} className="bg-background/50 rounded p-3 border-l-4" style={{ borderLeftColor: THEME_COLORS[c.theme] }}>
              <div className="text-2xl text-center">{c.emoji}</div>
              <div className="text-xs font-bold text-white text-center mt-1 tracking-wider">{c.name}</div>
              <div className="text-[10px] text-foreground/40 text-center uppercase">{c.typeName}</div>
              <div className="flex gap-0.5 mt-2">
                {c.stats.map((s, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-sm" style={{ background: STAT_COLORS[i], opacity: 0.3 + s / 150 }} title={`${STAT_NAMES[i]}: ${s}`} />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-foreground/40 mt-1">
                {c.stats.map((s, i) => <span key={i}>{s}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3 text-[10px] text-foreground/40">
          {STAT_NAMES.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: STAT_COLORS[i] }} />
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* Edit hint */}
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-xs text-yellow-200/70">
        💡 Postavy jsou vázané na fyzické kartičky a editují se přímo v <code className="bg-background/60 px-1.5 py-0.5 rounded">src/components/TeamForge.tsx</code>.
        Editace skrz UI bude přidána později.
      </div>
    </div>
  );
}
