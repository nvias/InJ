"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadGroups } from "@/lib/groups";
import { PITCH_ROUND_ORDER, pitchTypeById, pickRandomTopic, PITCH_COMPETENCE_WEIGHTS, pitchXpForVerdict } from "@/lib/pitch-duel-config";
import { awardCompetencesByWeights } from "@/lib/competence-rewards";
import type { GroupWithMembers } from "@/types";
import GroupingLobby from "./GroupingLobby";
import ConfirmDialog from "./ConfirmDialog";

// ═══════════════════════════════════════════════
// PitchDuelTeacherView — řídí 3 kola napříč všemi páry.
// Učitel volí téma, spustí kolo, sleduje páry, hodnotí, postupuje dál.
// ═══════════════════════════════════════════════

interface PitchEntry { student_id: string; text: string }
interface XpReward { competence_key: string; xp_added: number; xp_total: number; level: number }
interface RoundData {
  pitch_a?: PitchEntry;
  pitch_b?: PitchEntry;
  verdict?: { winner: "a" | "b" | "tie"; reason?: string };
  xp_a?: number;
  xp_b?: number;
  rewards_a?: XpReward[];
  rewards_b?: XpReward[];
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
  sessionCode: string;
  activityTitle: string;
  classId: string;
  teamSize: number;
}

const ROUND_KEY = (i: 0 | 1 | 2) => `round_${i}` as "round_0" | "round_1" | "round_2";

export default function PitchDuelTeacherView({ sessionId, sessionCode, activityTitle, classId, teamSize }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const autoStartedRef = useRef(false);

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

  // Heartbeat
  useEffect(() => {
    const tick = () => supabase.from("sessions").update({ teacher_heartbeat: new Date().toISOString() }).eq("id", sessionId).then(() => {});
    tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [sessionId]);

  // Bulk update všech párů
  async function bulkUpdate(patch: (current: DuelState) => DuelState) {
    const updates = groups.map(async (g) => {
      const next = patch(g.state);
      await supabase.from("session_groups").update({ state: next }).eq("id", g.id);
    });
    await Promise.all(updates);
    refresh();
  }

  // Krok 1: Představit kolo — phase=intro, BEZ tématu (jen typ + focus tipy)
  const previewRound = useCallback(async (roundIndex: 0 | 1 | 2) => {
    await bulkUpdate((cur) => ({
      ...cur,
      phase: "intro",
      current_round: roundIndex,
      current_speaker: undefined,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Krok 2: Vylosovat téma — uloží téma do topic_for_round[roundIndex]
  async function revealTopic(roundIndex: 0 | 1 | 2) {
    const typeId = PITCH_ROUND_ORDER[roundIndex];
    const topic = pickRandomTopic(typeId);
    await bulkUpdate((cur) => ({
      ...cur,
      topic_for_round: { ...cur.topic_for_round, [roundIndex]: topic },
    }));
  }

  // Krok 3: Začít pitchovat — phase=pitching, A startuje
  async function startPitching() {
    await bulkUpdate((cur) => ({
      ...cur,
      phase: "pitching",
      current_speaker: "a",
    }));
  }

  async function setVerdict(groupId: string, roundIndex: 0 | 1 | 2, winner: "a" | "b" | "tie") {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const roundKey = ROUND_KEY(roundIndex);
    const existing: RoundData = (g.state[roundKey] as RoundData | undefined) || {};
    const memberA = g.members[0];
    const memberB = g.members[1];
    const typeId = PITCH_ROUND_ORDER[roundIndex];
    const weights = PITCH_COMPETENCE_WEIGHTS[typeId];

    // XP per role
    const xpA = pitchXpForVerdict(winner === "a" ? "winner" : winner === "tie" ? "tie" : "loser");
    const xpB = pitchXpForVerdict(winner === "b" ? "winner" : winner === "tie" ? "tie" : "loser");

    // Award competences (parallel for each member)
    const [rewardsA, rewardsB] = await Promise.all([
      memberA ? awardCompetencesByWeights(memberA.student_id, xpA, weights) : Promise.resolve([]),
      memberB ? awardCompetencesByWeights(memberB.student_id, xpB, weights) : Promise.resolve([]),
    ]);

    // Persist verdict + xp + rewards into session_groups.state for live display
    const next: DuelState = {
      ...g.state,
      [roundKey]: {
        ...existing,
        verdict: { winner, reason: "Učitel" },
        xp_a: xpA,
        xp_b: xpB,
        rewards_a: rewardsA.map((r) => ({ competence_key: r.competence_key, xp_added: r.xp_added, xp_total: r.xp_total, level: r.level })),
        rewards_b: rewardsB.map((r) => ({ competence_key: r.competence_key, xp_added: r.xp_added, xp_total: r.xp_total, level: r.level })),
      },
    };
    await supabase.from("session_groups").update({ state: next }).eq("id", groupId);
    refresh();
  }

  async function finishAll() {
    await bulkUpdate((cur) => ({ ...cur, phase: "finished" }));
  }

  async function endSession() {
    await supabase.from("sessions").update({ is_active: false, status: "closed" }).eq("id", sessionId);
    router.push("/ucitel/dashboard");
  }

  // PLNÝ RESET — smaže skupiny + pitch eventy a vrátí session do lobby
  async function fullReset() {
    await Promise.all([
      supabase.from("session_groups").delete().eq("session_id", sessionId),
      supabase.from("student_events").delete().eq("session_id", sessionId).eq("event_type", "pitch_submit"),
      supabase.from("sessions").update({ status: "lobby" }).eq("id", sessionId),
    ]);
    refresh();
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white"><div className="opacity-60">Načítám…</div></main>;
  }

  // Auto-start: po skončení lobby (groups vznikly, vše idle) automaticky představ kolo 1
  if (!autoStartedRef.current && groups.length > 0) {
    const allIdle = groups.every((g) => g.state.phase === "idle" && g.state.current_round === undefined);
    if (allIdle) {
      autoStartedRef.current = true;
      previewRound(0);
    }
  }

  // Self-healing: pokud nejsou skupiny, vykresli rovnou lobby
  if (groups.length === 0) {
    autoStartedRef.current = false;
    return (
      <GroupingLobby
        sessionId={sessionId}
        sessionCode={sessionCode}
        classId={classId}
        activityTitle={activityTitle}
        teamSize={teamSize}
      />
    );
  }

  // Globální stav: jaké kolo právě běží + kolik párů ho dokončilo
  const currentRound = (groups[0]?.state.current_round ?? null) as 0 | 1 | 2 | null;
  const allInPhase = (phase: DuelState["phase"]) => groups.every((g) => g.state.phase === phase);
  const countInPhase = (phase: DuelState["phase"]) => groups.filter((g) => g.state.phase === phase).length;

  // Které kolo je další k spuštění?
  function nextRoundToLaunch(): 0 | 1 | 2 | null {
    for (let i = 0; i < 3; i++) {
      const idx = i as 0 | 1 | 2;
      const launched = groups.some((g) => g.state.topic_for_round?.[idx]);
      if (!launched) return idx;
    }
    return null;
  }
  const nextRound = nextRoundToLaunch();
  const allRoundsDone = nextRound === null && allInPhase("submitted");
  const isFinished = allInPhase("finished");

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs tracking-[0.3em] text-pink-400 uppercase">// PITCH DUEL — UČITEL</div>
            <h1 className="text-3xl font-black tracking-wider mt-1">{activityTitle}</h1>
            <div className="text-sm text-white/50 mt-1">Kód: <span className="text-cyan-400 font-bold tracking-widest">{sessionCode}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmReset(true)} className="px-4 py-2 text-xs tracking-wider rounded border border-yellow-400 text-yellow-400 hover:bg-yellow-500/10">
              ↻ Plný reset
            </button>
            <button onClick={() => setConfirmEnd(true)} className="px-4 py-2 text-xs tracking-wider rounded border border-pink-400 text-pink-400 hover:bg-pink-500/10">
              ✕ Ukončit
            </button>
          </div>
        </div>

        {/* Round controls */}
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 mb-6">
          <div className="text-xs tracking-[0.18em] text-cyan-400 uppercase mb-3">// 3 KOLA SOUBOJE</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PITCH_ROUND_ORDER.map((typeId, i) => {
              const idx = i as 0 | 1 | 2;
              const pt = pitchTypeById(typeId)!;
              const isCurrent = currentRound === idx;
              const isDone = groups.every((g) => {
                const r = g.state[ROUND_KEY(idx)] as RoundData | undefined;
                return r && r.pitch_a && r.pitch_b;
              });
              const isPreviousDone = i === 0 || groups.every((g) => {
                const r = g.state[ROUND_KEY((i - 1) as 0 | 1 | 2)] as RoundData | undefined;
                return r && r.pitch_a && r.pitch_b;
              });
              const wasPreviewed = groups.some((g) => g.state.current_round === idx);
              const topic = groups[0]?.state.topic_for_round?.[idx];

              return (
                <div
                  key={typeId}
                  className={`rounded-lg p-4 border ${isCurrent ? "border-cyan-400 bg-cyan-400/10" : isDone ? "border-green-400/60 bg-green-400/5" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{pt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] tracking-wider uppercase text-white/40">Kolo {i + 1}</div>
                      <div className="text-sm font-black truncate">{pt.name}</div>
                    </div>
                    {isDone && <span className="text-green-400 text-lg">✓</span>}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {pt.focus_tips.slice(0, 3).map((tip, ti) => (
                      <span key={ti} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{tip}</span>
                    ))}
                  </div>

                  {topic && (
                    <div className="text-[11px] text-white/60 italic mb-2 line-clamp-2">&quot;{topic}&quot;</div>
                  )}

                  {/* STAVOVÁ TLAČÍTKA */}
                  {!isCurrent && !isDone && !isPreviousDone && (
                    <div className="text-[10px] text-white/30 text-center py-2">🔒 Dokonči předchozí kolo</div>
                  )}
                  {!isCurrent && !isDone && isPreviousDone && (
                    <button
                      onClick={() => previewRound(idx)}
                      className="w-full py-2 text-xs font-bold tracking-wider rounded bg-cyan-400 text-black hover:shadow-[0_0_15px_#00D4FF]"
                    >
                      📢 Představit kolo {i + 1}
                    </button>
                  )}
                  {isCurrent && wasPreviewed && !topic && allInPhase("intro") && (
                    <button
                      onClick={() => revealTopic(idx)}
                      className="w-full py-2 text-xs font-bold tracking-wider rounded bg-yellow-400 text-black hover:shadow-[0_0_15px_#ffd700]"
                    >
                      🎲 Vylosovat téma
                    </button>
                  )}
                  {isCurrent && topic && allInPhase("intro") && (
                    <button
                      onClick={startPitching}
                      className="w-full py-2 text-xs font-bold tracking-wider rounded bg-pink-500 text-white hover:shadow-[0_0_15px_#ff006e] animate-pulse"
                    >
                      ▶ Začít pitchovat
                    </button>
                  )}
                  {isCurrent && !allInPhase("intro") && !isDone && (
                    <div className="text-[10px] text-cyan-400 text-center py-2 tracking-wider uppercase">
                      {countInPhase("pitching")} / {groups.length} pitchuje · {countInPhase("submitted")} hotovo
                    </div>
                  )}
                  {isDone && (
                    <div className="text-[10px] text-green-400 text-center py-2 tracking-wider uppercase">Hotovo</div>
                  )}
                </div>
              );
            })}
          </div>

          {allRoundsDone && !isFinished && (
            <button onClick={finishAll} className="w-full mt-4 py-3 bg-yellow-400 text-black font-bold rounded tracking-wider hover:shadow-[0_0_20px_#ffd700]">
              🏆 Ukončit a zobrazit souhrn
            </button>
          )}
          {isFinished && (
            <div className="mt-4 text-center text-yellow-400 text-sm tracking-wider">✓ Aktivita dokončena — žáci vidí souhrn všech 3 kol</div>
          )}
        </div>

        {/* Pairs list */}
        <div className="space-y-3">
          <div className="text-xs tracking-[0.18em] text-white/50 uppercase">// PÁRY ({groups.length})</div>
          {groups.map((g) => {
            const expanded = expandedId === g.id;
            const memberA = g.members[0];
            const memberB = g.members[1];
            return (
              <div key={g.id} className="bg-white/[0.04] border border-white/10 rounded">
                <button onClick={() => setExpandedId(expanded ? null : g.id)} className="w-full p-3 flex items-center gap-3 hover:bg-white/5">
                  <div className="text-cyan-400 font-black text-xs tracking-wider">PÁR {g.group_index}</div>
                  <div className="flex items-center gap-2 flex-1 text-xs">
                    {memberA && <span className="px-2 py-1 rounded bg-cyan-400/10 border border-cyan-400/40">{memberA.avatar_emoji} {memberA.display_name}</span>}
                    <span className="text-pink-400">VS</span>
                    {memberB && <span className="px-2 py-1 rounded bg-pink-400/10 border border-pink-400/40">{memberB.avatar_emoji} {memberB.display_name}</span>}
                  </div>
                  {/* Round dots */}
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => {
                      const idx = i as 0 | 1 | 2;
                      const r = g.state[ROUND_KEY(idx)] as RoundData | undefined;
                      const aDone = !!r?.pitch_a;
                      const bDone = !!r?.pitch_b;
                      const judged = !!r?.verdict;
                      return (
                        <div key={i} className="w-6 h-6 rounded text-[10px] flex items-center justify-center font-bold"
                          style={{
                            background: judged ? "#39ff1422" : aDone && bDone ? "#ffd70022" : aDone || bDone ? "#00D4FF22" : "#ffffff08",
                            border: `1px solid ${judged ? "#39ff14" : aDone && bDone ? "#ffd700" : aDone || bDone ? "#00D4FF" : "#ffffff20"}`,
                            color: judged ? "#39ff14" : aDone && bDone ? "#ffd700" : aDone || bDone ? "#00D4FF" : "#ffffff40",
                          }}
                        >{i + 1}</div>
                      );
                    })}
                  </div>
                  <span className="text-white/30 text-xs">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded && (
                  <div className="p-3 border-t border-white/5 space-y-3">
                    {[0, 1, 2].map((i) => {
                      const idx = i as 0 | 1 | 2;
                      const pt = pitchTypeById(PITCH_ROUND_ORDER[idx])!;
                      const r = g.state[ROUND_KEY(idx)] as RoundData | undefined;
                      const topic = g.state.topic_for_round?.[idx];
                      if (!r && !topic) return null;
                      return (
                        <div key={i} className="bg-black/30 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{pt.emoji}</span>
                            <span className="text-sm font-bold">{pt.name}</span>
                            {topic && <span className="ml-auto text-[11px] text-white/40 italic truncate max-w-xs">&quot;{topic}&quot;</span>}
                          </div>
                          {(r?.pitch_a || r?.pitch_b) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div className="bg-cyan-400/5 border border-cyan-400/30 rounded p-2">
                                <div className="text-[10px] text-cyan-400 mb-1">A — {memberA?.display_name}</div>
                                <div className="text-white/80 whitespace-pre-wrap">{r?.pitch_a?.text || "— čeká —"}</div>
                              </div>
                              <div className="bg-pink-400/5 border border-pink-400/30 rounded p-2">
                                <div className="text-[10px] text-pink-400 mb-1">B — {memberB?.display_name}</div>
                                <div className="text-white/80 whitespace-pre-wrap">{r?.pitch_b?.text || "— čeká —"}</div>
                              </div>
                            </div>
                          )}
                          {/* Verdict buttons */}
                          {r?.pitch_a && r?.pitch_b && !r?.verdict && (
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => setVerdict(g.id, idx, "a")} className="flex-1 py-1.5 text-xs font-bold rounded bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black">
                                🏆 A
                              </button>
                              <button onClick={() => setVerdict(g.id, idx, "tie")} className="px-3 py-1.5 text-xs font-bold rounded bg-white/5 border border-white/20 text-white/70 hover:bg-white/15">
                                =
                              </button>
                              <button onClick={() => setVerdict(g.id, idx, "b")} className="flex-1 py-1.5 text-xs font-bold rounded bg-pink-400/20 border border-pink-400 text-pink-400 hover:bg-pink-400 hover:text-black">
                                🏆 B
                              </button>
                            </div>
                          )}
                          {r?.verdict && (
                            <div className="mt-2 text-center text-xs text-green-400">
                              🏆 {r.verdict.winner === "tie" ? "Remíza" : r.verdict.winner === "a" ? memberA?.display_name : memberB?.display_name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="Ukončit lekci?"
        message="Žáci budou přesměrováni na profil. Tuto akci nelze vrátit."
        confirmLabel="Ukončit"
        variant="danger"
        onConfirm={() => { setConfirmEnd(false); endSession(); }}
        onCancel={() => setConfirmEnd(false)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Plný reset aktivity?"
        message="Smaže všechny páry, všechny pitche a vrátí session do lobby. Žáci zůstanou připojeni."
        confirmLabel="Resetovat vše"
        variant="danger"
        onConfirm={() => { setConfirmReset(false); fullReset(); }}
        onCancel={() => setConfirmReset(false)}
      />
    </main>
  );
}
