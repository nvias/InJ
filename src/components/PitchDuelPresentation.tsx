"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadGroups } from "@/lib/groups";
import { PITCH_ROUND_ORDER, pitchTypeById, PITCH_DURATION_SECONDS } from "@/lib/pitch-duel-config";
import type { GroupWithMembers } from "@/types";

// ═══════════════════════════════════════════════
// PitchDuelPresentation — read-only projektor view
// Zobrazuje aktuální stav celé třídy pro prezentaci.
// Žádné ovládací prvky, jen velké informace.
// ═══════════════════════════════════════════════

interface PitchEntry { student_id: string; text: string }
interface RoundData {
  pitch_a?: PitchEntry;
  pitch_b?: PitchEntry;
  verdict?: { winner: "a" | "b" | "tie" };
  xp_a?: number;
  xp_b?: number;
}
interface DuelState {
  phase: "idle" | "intro" | "pitching" | "submitted" | "finished";
  current_round?: 0 | 1 | 2;
  current_speaker?: "a" | "b";
  topic_for_round?: { 0?: string; 1?: string; 2?: string };
  round_0?: RoundData;
  round_1?: RoundData;
  round_2?: RoundData;
}
interface GroupWithState extends GroupWithMembers { state: DuelState }

interface Props {
  sessionId: string;
  activityTitle: string;
}

const ROUND_KEY = (i: 0 | 1 | 2) => `round_${i}` as "round_0" | "round_1" | "round_2";

export default function PitchDuelPresentation({ sessionId, activityTitle }: Props) {
  const [groups, setGroups] = useState<GroupWithState[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const baseGroups = await loadGroups(sessionId);
    if (baseGroups.length === 0) { setGroups([]); setLoading(false); return; }
    const ids = baseGroups.map((g) => g.id);
    const { data: rows } = await supabase.from("session_groups").select("id, state").in("id", ids);
    const stateMap = new Map<string, DuelState>();
    for (const r of rows || []) {
      const raw = (r.state as Partial<DuelState>) || {};
      stateMap.set(r.id, { phase: "idle", ...raw } as DuelState);
    }
    setGroups(baseGroups.map((g) => ({ ...g, state: stateMap.get(g.id) || { phase: "idle" } })));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 1500);
    return () => clearInterval(i);
  }, [refresh]);

  if (loading) {
    return <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white"><div className="opacity-60">Načítám…</div></main>;
  }

  // Pokud nemáme skupiny, zobraz čekání na lobby
  if (groups.length === 0) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] text-white flex flex-col items-center justify-center p-8">
        <div className="text-xs tracking-[0.4em] text-cyan-400 uppercase mb-4">// Pitch Duel — Lobby</div>
        <h1 className="text-6xl font-black tracking-wider text-center bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent mb-6">
          {activityTitle}
        </h1>
        <div className="text-2xl text-white/60 animate-pulse">Učitel rozhází žáky do dvojic…</div>
      </main>
    );
  }

  // Vyvodit globální stav z prvního páru (všechny páry jsou synchronní)
  const sample = groups[0]?.state;
  const phase = sample?.phase || "idle";
  const currentRound = (sample?.current_round ?? 0) as 0 | 1 | 2;
  const currentTypeId = PITCH_ROUND_ORDER[currentRound];
  const currentType = pitchTypeById(currentTypeId);
  const currentTopic = sample?.topic_for_round?.[currentRound];

  const countInPhase = (p: DuelState["phase"]) => groups.filter((g) => g.state.phase === p).length;
  const countCurrentRoundDone = groups.filter((g) => {
    const r = g.state[ROUND_KEY(currentRound)] as RoundData | undefined;
    return !!r?.pitch_a && !!r?.pitch_b;
  }).length;
  const countVerdicts = groups.filter((g) => {
    const r = g.state[ROUND_KEY(currentRound)] as RoundData | undefined;
    return !!r?.verdict;
  }).length;

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs tracking-[0.4em] text-cyan-400 uppercase">// Pitch Duel</div>
            <h1 className="text-3xl font-black tracking-wider">{activityTitle}</h1>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => {
              const idx = i as 0 | 1 | 2;
              const launched = groups.some((g) => g.state.topic_for_round?.[idx]);
              const done = groups.every((g) => {
                const r = g.state[ROUND_KEY(idx)] as RoundData | undefined;
                return !!r?.verdict;
              });
              const active = currentRound === idx && launched;
              return (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black border-2 ${
                    active ? "bg-cyan-400 text-black border-cyan-400 scale-110" :
                    done ? "bg-green-400/20 text-green-400 border-green-400" :
                    launched ? "bg-yellow-400/20 text-yellow-400 border-yellow-400" :
                    "border-white/20 text-white/30"
                  }`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* PHASE: idle (žádné kolo ještě nezačalo) */}
        {phase === "idle" && (
          <div className="text-center py-20">
            <div className="text-7xl mb-6">🎤</div>
            <div className="text-3xl font-bold mb-3">{groups.length} dvojic je připraveno</div>
            <div className="text-lg text-white/60 animate-pulse">Učitel za chvilku spustí první kolo…</div>
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {PITCH_ROUND_ORDER.map((typeId, i) => {
                const pt = pitchTypeById(typeId)!;
                return (
                  <div key={typeId} className="bg-white/[0.04] border border-white/10 rounded-lg p-4">
                    <div className="text-4xl mb-2">{pt.emoji}</div>
                    <div className="text-xs text-white/40">Kolo {i + 1}</div>
                    <div className="text-sm font-bold">{pt.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE: intro (typ představen, téma případně odhaleno) */}
        {phase === "intro" && currentType && (
          <div className="text-center py-6">
            <div className="text-9xl mb-4 animate-bounce">{currentType.emoji}</div>
            <div className="text-xs tracking-[0.4em] text-pink-400 uppercase mb-2">// Kolo {currentRound + 1} ze 3</div>
            <h2 className="text-6xl font-black mb-2">{currentType.name}</h2>
            <p className="text-xl text-white/60 mb-8">{currentType.desc}</p>

            {/* Focus tipy — vždy viditelné, BIG */}
            <div className="max-w-4xl mx-auto mb-8">
              <div className="text-sm tracking-[0.3em] text-white/50 uppercase mb-4">// Soustřeďte se na</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {currentType.focus_tips.map((tip, i) => (
                  <span key={i} className="text-2xl px-6 py-3 rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border-2 border-cyan-400/40 font-bold">
                    {tip}
                  </span>
                ))}
              </div>
            </div>

            {currentTopic ? (
              <>
                <div className="bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border-2 border-pink-400/60 rounded-2xl p-10 mb-4 max-w-4xl mx-auto">
                  <div className="text-sm tracking-[0.3em] text-pink-400 uppercase mb-4">// Vaše téma</div>
                  <div className="text-4xl font-bold leading-tight">&quot;{currentTopic}&quot;</div>
                </div>
                <div className="mt-4 text-base text-cyan-400 animate-pulse">Připravte si pitch! Učitel za chvilku spustí timer…</div>
              </>
            ) : (
              <div className="text-base text-yellow-400 animate-pulse mt-4">Učitel za chvilku vylosuje téma…</div>
            )}
          </div>
        )}

        {/* PHASE: pitching — projektor zůstává „nástěnka" se specifikací kola */}
        {phase === "pitching" && currentType && (
          <div className="text-center py-6">
            <div className="text-9xl mb-4">{currentType.emoji}</div>
            <div className="text-xs tracking-[0.4em] text-pink-400 uppercase mb-2">// Kolo {currentRound + 1} ze 3 — pitching</div>
            <h2 className="text-6xl font-black mb-2">{currentType.name}</h2>
            <p className="text-xl text-white/60 mb-8">{currentType.desc}</p>

            {/* Focus tipy — VELKÉ, vždy viditelné během pitchování */}
            <div className="max-w-4xl mx-auto mb-8">
              <div className="text-sm tracking-[0.3em] text-white/50 uppercase mb-4">// Soustřeďte se na</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {currentType.focus_tips.map((tip, i) => (
                  <span key={i} className="text-2xl px-6 py-3 rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border-2 border-cyan-400/40 font-bold">
                    {tip}
                  </span>
                ))}
              </div>
            </div>

            {currentTopic && (
              <div className="bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border-2 border-pink-400/60 rounded-2xl p-10 max-w-4xl mx-auto">
                <div className="text-sm tracking-[0.3em] text-pink-400 uppercase mb-4">// Téma</div>
                <div className="text-4xl font-bold leading-tight">&quot;{currentTopic}&quot;</div>
              </div>
            )}

            {/* Diskrétní progress dole */}
            <div className="mt-8 text-sm text-white/40 tracking-wider">
              {countCurrentRoundDone} / {groups.length} dvojic dokončilo
            </div>
          </div>
        )}

        {/* PHASE: submitted (čeká se na verdikt) */}
        {phase === "submitted" && currentType && (
          <div>
            <div className="text-center mb-6">
              <div className="text-6xl mb-3">⚖️</div>
              <div className="text-xs tracking-[0.3em] text-cyan-400 uppercase">// Kolo {currentRound + 1} — {currentType.name}</div>
              <h2 className="text-3xl font-black mt-1">Učitel hodnotí…</h2>
              <div className="text-sm text-white/50 mt-2">{countVerdicts} / {groups.length} dvojic rozhodnuto</div>
            </div>

            {/* Verdict grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((g) => {
                const r = g.state[ROUND_KEY(currentRound)] as RoundData | undefined;
                const verdict = r?.verdict;
                const memberA = g.members[0];
                const memberB = g.members[1];
                const winnerName = verdict?.winner === "tie" ? "Remíza" : verdict?.winner === "a" ? memberA?.display_name : verdict?.winner === "b" ? memberB?.display_name : null;
                return (
                  <div key={g.id} className={`rounded-lg p-4 border ${verdict ? "bg-yellow-400/10 border-yellow-400/40" : "bg-white/[0.04] border-white/10"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-white/40 tracking-wider uppercase">Pár {g.group_index}</div>
                      {verdict && <div className="text-xs text-yellow-400 font-bold tracking-wider">🏆 Verdikt</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 flex items-center gap-2 ${verdict?.winner === "a" ? "text-yellow-400 font-black" : ""}`}>
                        <span className="text-2xl">{memberA?.avatar_emoji}</span>
                        <span className="text-base truncate">{memberA?.display_name}</span>
                      </div>
                      <span className="text-pink-400 text-lg font-black">VS</span>
                      <div className={`flex-1 flex items-center gap-2 justify-end ${verdict?.winner === "b" ? "text-yellow-400 font-black" : ""}`}>
                        <span className="text-base truncate">{memberB?.display_name}</span>
                        <span className="text-2xl">{memberB?.avatar_emoji}</span>
                      </div>
                    </div>
                    {winnerName && (
                      <div className="mt-2 text-center text-sm font-bold text-yellow-300">
                        🏆 {winnerName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE: finished (všechna kola hotová) */}
        {phase === "finished" && (
          <div>
            <div className="text-center mb-6">
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="text-4xl font-black bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                SOUHRN VŠECH 3 KOL
              </h2>
            </div>

            {/* Per-pair summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((g) => {
                const memberA = g.members[0];
                const memberB = g.members[1];
                let winsA = 0, winsB = 0, ties = 0;
                for (let i = 0; i < 3; i++) {
                  const r = g.state[ROUND_KEY(i as 0 | 1 | 2)] as RoundData | undefined;
                  if (r?.verdict?.winner === "a") winsA++;
                  else if (r?.verdict?.winner === "b") winsB++;
                  else if (r?.verdict?.winner === "tie") ties++;
                }
                const overall = winsA > winsB ? "a" : winsB > winsA ? "b" : "tie";
                return (
                  <div key={g.id} className="bg-white/[0.04] border border-white/10 rounded-lg p-4">
                    <div className="text-xs text-white/40 tracking-wider uppercase mb-2">Pár {g.group_index}</div>
                    <div className="flex items-center gap-3">
                      <div className={`flex-1 text-center p-3 rounded ${overall === "a" ? "bg-yellow-400/15 ring-2 ring-yellow-400" : "bg-cyan-400/5"}`}>
                        <div className="text-2xl">{memberA?.avatar_emoji}</div>
                        <div className="text-sm font-bold">{memberA?.display_name}</div>
                        <div className={`text-2xl font-black ${overall === "a" ? "text-yellow-400" : "text-cyan-400"}`}>{winsA}</div>
                      </div>
                      <div className="text-pink-400 font-black">VS</div>
                      <div className={`flex-1 text-center p-3 rounded ${overall === "b" ? "bg-yellow-400/15 ring-2 ring-yellow-400" : "bg-pink-400/5"}`}>
                        <div className="text-2xl">{memberB?.avatar_emoji}</div>
                        <div className="text-sm font-bold">{memberB?.display_name}</div>
                        <div className={`text-2xl font-black ${overall === "b" ? "text-yellow-400" : "text-pink-400"}`}>{winsB}</div>
                      </div>
                    </div>
                    {ties > 0 && <div className="text-center text-[10px] text-white/40 mt-1">{ties} remíza</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
