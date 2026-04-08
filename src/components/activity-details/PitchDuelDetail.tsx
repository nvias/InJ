"use client";

import type { Activity } from "@/types";
import { PITCH_TYPES } from "@/lib/pitch-duel-config";

// ═══════════════════════════════════════════════
// Detail Pitch Duel aktivity — typy pitchů + témata
// (témata jsou hardcoded v src/lib/pitch-duel-config.ts)
// ═══════════════════════════════════════════════

interface Props {
  activity: Activity;
}

export default function PitchDuelDetail({ activity }: Props) {
  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎤</span>
          <div>
            <div className="text-xs uppercase tracking-wider text-accent/70">Typ aktivity</div>
            <div className="text-lg font-bold text-white">Pitch Duel — souboj prezentací</div>
          </div>
        </div>
        <p className="text-sm text-foreground/60 leading-relaxed">
          Dvojice žáků dostane stejné téma a stejný čas. Každý odpitchuje svou verzi, AI nebo učitel rozhodne, kdo byl přesvědčivější.
          Trénuje rétoriku, strukturu argumentu a zvládání tlaku.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Velikost skupiny</div>
            <div className="text-white font-bold mt-1">{activity.team_size}</div>
          </div>
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Lobby</div>
            <div className="text-white font-bold mt-1">{activity.requires_grouping ? "Náhodné páry" : "Ne"}</div>
          </div>
          <div className="bg-background/50 rounded p-2">
            <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Typů pitche</div>
            <div className="text-white font-bold mt-1">{PITCH_TYPES.length}</div>
          </div>
        </div>
      </div>

      {/* Pitch types + topics */}
      {PITCH_TYPES.map((pt) => (
        <div key={pt.id} className="bg-primary/5 border border-primary/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{pt.emoji}</span>
            <div>
              <h3 className="text-base font-bold text-white">{pt.name}</h3>
              <div className="text-xs text-foreground/50">{pt.desc}</div>
            </div>
            <span className="ml-auto text-xs text-foreground/30">{pt.topics.length} témat</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pt.topics.map((t, i) => (
              <div key={i} className="bg-background/50 rounded p-2 text-sm text-foreground/70 border-l-2 border-accent/30">
                {t}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit hint */}
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-xs text-yellow-200/70">
        💡 Témata se editují v <code className="bg-background/60 px-1.5 py-0.5 rounded">src/lib/pitch-duel-config.ts</code>.
        Pro každý duel se náhodně vybere jedno téma z vybrané kategorie.
      </div>
    </div>
  );
}
