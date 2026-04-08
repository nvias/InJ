"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { findStudentGroup } from "@/lib/groups";
import { PITCH_DURATION_SECONDS, PITCH_ROUND_ORDER, pitchTypeById } from "@/lib/pitch-duel-config";
import type { GroupWithMembers } from "@/types";

// ═══════════════════════════════════════════════
// PITCH DUEL — žákovská strana
// Učitel řídí 3 kola (Startup → Business → Inspirational).
// V rámci jednoho kola: A pitchuje (60s) → B pitchuje (60s) → submitted.
// Stav celého páru je v session_groups.state JSONB:
// {
//   phase: 'idle' | 'pitching' | 'submitted' | 'finished',
//   current_round?: 0 | 1 | 2,
//   current_speaker?: 'a' | 'b',
//   topic_for_round?: { 0?: string, 1?: string, 2?: string },
//   round_0?: { pitch_a?, pitch_b?, verdict? },
//   round_1?: { ... },
//   round_2?: { ... }
// }
// ═══════════════════════════════════════════════

interface PitchEntry { student_id: string; text: string; submitted_at?: string }
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

interface Props {
  auth: { studentId: string; classId: string; displayName: string; avatarEmoji: string; avatarColor: string };
  sessionId: string;
}

const ROUND_KEY = (i: 0 | 1 | 2) => `round_${i}` as "round_0" | "round_1" | "round_2";

export default function PitchDuel({ auth, sessionId }: Props) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [state, setState] = useState<DuelState>({ phase: "idle" });
  const [loading, setLoading] = useState(true);
  const [pitchText, setPitchText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(PITCH_DURATION_SECONDS);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const g = await findStudentGroup(sessionId, auth.studentId);
    setGroup(g);
    if (g) {
      const { data: gRow } = await supabase
        .from("session_groups")
        .select("state")
        .eq("id", g.id)
        .single();
      const raw = (gRow?.state as Partial<DuelState>) || {};
      const newState: DuelState = { phase: "idle", ...raw } as DuelState;
      setState(newState);
    }
    setLoading(false);
  }, [sessionId, auth.studentId]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 1500);
    return () => clearInterval(i);
  }, [refresh]);

  // Timer — restartuje při změně kola nebo speakera
  useEffect(() => {
    if (state.phase !== "pitching") return;
    setSecondsLeft(PITCH_DURATION_SECONDS);
    setPitchText("");
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, state.current_round, state.current_speaker]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white">
        <div className="text-xl tracking-wider opacity-60">Načítám…</div>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-lg">Učitel tě ještě nepřiřadil ke skupině…</div>
          <button onClick={() => router.push("/zak/profil")} className="mt-4 text-sm text-white/50 hover:text-white">← Profil</button>
        </div>
      </main>
    );
  }

  const isA = group.members[0]?.student_id === auth.studentId;
  const partner = group.members.find((m) => m.student_id !== auth.studentId);

  // Pomocná funkce pro vypsání aktuálního kola
  const currentRoundIndex = (state.current_round ?? 0) as 0 | 1 | 2;
  const currentTypeId = PITCH_ROUND_ORDER[currentRoundIndex];
  const currentPitchType = pitchTypeById(currentTypeId);
  const currentTopic = state.topic_for_round?.[currentRoundIndex];

  async function submitPitch() {
    if (!group || submitting) return;
    setSubmitting(true);

    const roundKey = ROUND_KEY(currentRoundIndex);
    const existingRound: RoundData = (state[roundKey] as RoundData | undefined) || {};
    const slot = isA ? "pitch_a" : "pitch_b";

    const updatedRound: RoundData = {
      ...existingRound,
      [slot]: { student_id: auth.studentId, text: pitchText.trim(), submitted_at: new Date().toISOString() },
    };

    const next: DuelState = { ...state, [roundKey]: updatedRound };

    // Po A flipni speaker na B; po B nastav phase=submitted
    if (isA) {
      next.current_speaker = "b";
    } else {
      next.phase = "submitted";
      next.current_speaker = undefined;
    }

    setState(next);
    await supabase.from("session_groups").update({ state: next }).eq("id", group.id);

    await supabase.from("student_events").insert({
      student_id: auth.studentId,
      session_id: sessionId,
      question_id: `pitch_duel_${currentTypeId}`,
      event_type: "pitch_submit",
      answer: pitchText.trim().slice(0, 4000),
      is_correct: false,
      attempt_no: 1,
      duration_ms: (PITCH_DURATION_SECONDS - secondsLeft) * 1000,
    });

    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        {/* Header: pair info */}
        <div className="text-center mb-5 mt-4">
          <div className="text-xs tracking-[0.3em] text-pink-400 uppercase">// PITCH DUEL</div>
          <h1 className="text-2xl font-black tracking-wider mt-1 bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
            SKUPINA {group.group_index}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-cyan-400/10 border border-cyan-400/40">
              <span className="text-lg">{auth.avatarEmoji}</span>
              <span className="text-xs font-bold">{auth.displayName}</span>
              <span className="text-[10px] text-cyan-400">TY</span>
            </div>
            <span className="text-pink-400 text-xl font-black">VS</span>
            {partner && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-pink-400/10 border border-pink-400/40">
                <span className="text-lg">{partner.avatar_emoji}</span>
                <span className="text-xs font-bold">{partner.display_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Round indicator */}
        {(state.phase === "pitching" || state.phase === "submitted") && currentPitchType && (
          <div className="bg-gradient-to-br from-pink-500/10 to-cyan-500/10 border border-white/15 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{currentPitchType.emoji}</span>
                <div>
                  <div className="text-[10px] text-cyan-400 tracking-wider uppercase">Kolo {currentRoundIndex + 1} ze 3</div>
                  <div className="text-base font-black">{currentPitchType.name}</div>
                </div>
              </div>
              <div className="text-[10px] text-white/40 tracking-wider uppercase">{currentPitchType.desc}</div>
            </div>

            {/* Focus tips */}
            <div className="border-t border-white/10 pt-3 mt-2">
              <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-2">// Soustřeď se na</div>
              <div className="flex flex-wrap gap-1.5">
                {currentPitchType.focus_tips.map((tip, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">
                    {tip}
                  </span>
                ))}
              </div>
            </div>

            {currentTopic && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[10px] text-pink-400 tracking-[0.18em] uppercase mb-1">// Téma</div>
                <div className="text-sm font-bold">&quot;{currentTopic}&quot;</div>
              </div>
            )}
          </div>
        )}

        {/* PHASE: idle (čekání na učitele) */}
        {state.phase === "idle" && (
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-8 text-center">
            <div className="text-5xl mb-3">⏳</div>
            <div className="text-lg font-bold mb-2">Čekáme na učitele…</div>
            <div className="text-sm text-white/50">Učitel za chvilku spustí první pitch</div>
          </div>
        )}

        {/* PHASE: intro (typ představen, téma se případně odhalí později) */}
        {state.phase === "intro" && currentPitchType && (
          <div className="bg-gradient-to-br from-cyan-500/10 to-pink-500/10 border-2 border-cyan-400/40 rounded-xl p-6 text-center">
            <div className="text-5xl mb-2 animate-pulse">{currentPitchType.emoji}</div>
            <div className="text-[10px] tracking-[0.18em] text-cyan-400 uppercase">Připrav se na</div>
            <div className="text-lg font-black mt-1">{currentPitchType.name}</div>
            <div className="text-xs text-white/50 mt-1">{currentPitchType.desc}</div>

            {/* Focus tipy vždy zobrazené */}
            <div className="mt-4">
              <div className="text-[10px] text-white/40 tracking-[0.18em] uppercase mb-2">// Soustřeď se na</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {currentPitchType.focus_tips.map((tip, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 font-semibold">
                    {tip}
                  </span>
                ))}
              </div>
            </div>

            {currentTopic ? (
              <>
                <div className="mt-5 pt-5 border-t border-white/10">
                  <div className="text-[10px] text-pink-400 tracking-[0.18em] uppercase mb-2">// Vaše téma</div>
                  <div className="text-xl font-bold text-white px-3">&quot;{currentTopic}&quot;</div>
                </div>
                <div className="mt-4 text-xs text-cyan-400 animate-pulse">Učitel za chvilku spustí timer…</div>
              </>
            ) : (
              <div className="mt-5 text-xs text-white/50 animate-pulse">
                Učitel za chvilku vylosuje téma…
              </div>
            )}
          </div>
        )}

        {/* PHASE: pitching */}
        {state.phase === "pitching" && (() => {
          const myTurn = (state.current_speaker === "a" && isA) || (state.current_speaker === "b" && !isA);
          const currentMember = state.current_speaker === "a" ? group.members[0] : group.members[1];
          const watchingMember = state.current_speaker === "a" ? group.members[1] : group.members[0];
          const roundKey = ROUND_KEY(currentRoundIndex);
          const myRound: RoundData = (state[roundKey] as RoundData | undefined) || {};
          const mySlot = isA ? "pitch_a" : "pitch_b";
          const alreadySubmitted = !!myRound[mySlot];

          return (
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6">
              {/* Speaker indicator */}
              <div className="flex items-center justify-center gap-3 mb-4 py-2 px-4 rounded-lg bg-black/40 border border-pink-400/40">
                <span className="text-2xl">🎤</span>
                <div className="text-center">
                  <div className="text-[10px] text-pink-400 tracking-[0.18em] uppercase">Pitchuje</div>
                  <div className="text-lg font-black">{currentMember?.display_name}</div>
                </div>
              </div>

              {/* Timer */}
              <div className="text-center mb-4">
                <div className={`text-6xl font-black tabular-nums ${secondsLeft <= 10 ? "text-pink-400 animate-pulse" : "text-cyan-400"}`}>
                  {secondsLeft}
                </div>
                <div className="text-xs text-white/40 tracking-wider uppercase">sekund</div>
              </div>

              {myTurn && !alreadySubmitted ? (
                <>
                  <div className="text-xs text-cyan-400 text-center mb-2 tracking-wider uppercase">// Teď jsi na řadě TY</div>
                  <textarea
                    value={pitchText}
                    onChange={(e) => setPitchText(e.target.value)}
                    rows={6}
                    placeholder="Piš svůj pitch zde…"
                    className="w-full p-3 bg-black/40 border border-cyan-400/40 rounded text-white outline-none focus:border-cyan-400 resize-none"
                  />
                  <button
                    onClick={submitPitch}
                    disabled={pitchText.trim().length === 0 || submitting}
                    className="w-full mt-3 py-3 bg-cyan-400 text-black font-bold rounded tracking-wider disabled:opacity-30 hover:shadow-[0_0_20px_#00D4FF]"
                  >
                    {submitting ? "Odesílám…" : "✓ Odeslat pitch"}
                  </button>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">{watchingMember?.avatar_emoji} 👀</div>
                  <div className="text-sm text-white/60 mb-1">
                    {alreadySubmitted ? "Tvůj pitch je odeslán." : "Sleduj partnera…"}
                  </div>
                  <div className="text-xs text-white/40">
                    Pitchuje <span className="text-pink-400 font-bold">{currentMember?.display_name}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* PHASE: submitted (kolo dokončeno + případně verdikt) */}
        {state.phase === "submitted" && (() => {
          const roundKey = ROUND_KEY(currentRoundIndex);
          const r = (state[roundKey] as RoundData | undefined) || {};
          const hasVerdict = !!r.verdict;
          const myXp = isA ? r.xp_a : r.xp_b;
          const myRewards = isA ? r.rewards_a : r.rewards_b;
          const iWon = r.verdict?.winner === (isA ? "a" : "b");
          const isTie = r.verdict?.winner === "tie";

          return (
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6">
              {!hasVerdict ? (
                <div className="text-center">
                  <div className="text-5xl mb-3">✓</div>
                  <div className="text-xl font-bold mb-2">Kolo {currentRoundIndex + 1} hotovo</div>
                  <div className="text-sm text-white/50 mb-4">Učitel právě hodnotí…</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-2">{iWon ? "🏆" : isTie ? "🤝" : "💪"}</div>
                  <div className={`text-2xl font-black mb-1 ${iWon ? "text-yellow-400" : isTie ? "text-cyan-400" : "text-white/70"}`}>
                    {iWon ? "Vyhrál/a jsi!" : isTie ? "Remíza" : "Nevadí, mozek roste"}
                  </div>
                  {!iWon && !isTie && (
                    <div className="text-xs text-white/50 mb-2">Příště to dáš ještě líp</div>
                  )}
                  {typeof myXp === "number" && (
                    <div className="mt-3 inline-block px-4 py-2 rounded-full bg-yellow-400/20 border border-yellow-400/60 text-yellow-300 font-black text-lg">
                      +{myXp} XP
                    </div>
                  )}
                  {myRewards && myRewards.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-[10px] tracking-[0.18em] text-white/40 uppercase mb-2">// Tvoje kompetence porostly</div>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {myRewards.map((rw, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
                            {rw.competence_key.replace(/^(rvp_|entrecomp_)/, "").replace(/_/g, " ")} +{rw.xp_added}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recap obou pitchů */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-left">
                {r.pitch_a && (
                  <div className={`border rounded p-3 ${r.verdict?.winner === "a" ? "bg-yellow-400/10 border-yellow-400/60" : "bg-cyan-400/5 border-cyan-400/30"}`}>
                    <div className="text-[10px] text-cyan-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                      {group.members[0]?.display_name}
                      {r.verdict?.winner === "a" && <span>🏆</span>}
                    </div>
                    <div className="text-xs text-white/70 line-clamp-6 whitespace-pre-wrap">{r.pitch_a.text}</div>
                  </div>
                )}
                {r.pitch_b && (
                  <div className={`border rounded p-3 ${r.verdict?.winner === "b" ? "bg-yellow-400/10 border-yellow-400/60" : "bg-pink-400/5 border-pink-400/30"}`}>
                    <div className="text-[10px] text-pink-400 tracking-wider uppercase mb-1 flex items-center gap-1">
                      {group.members[1]?.display_name}
                      {r.verdict?.winner === "b" && <span>🏆</span>}
                    </div>
                    <div className="text-xs text-white/70 line-clamp-6 whitespace-pre-wrap">{r.pitch_b.text}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* PHASE: finished (všechna 3 kola hotová) */}
        {state.phase === "finished" && (
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-6 text-center">
            <div className="text-6xl mb-3">🏆</div>
            <div className="text-xl font-black mb-4">Všechna kola dokončena!</div>

            {/* Souhrn 3 kol s verdikty */}
            <div className="space-y-3 text-left">
              {[0, 1, 2].map((i) => {
                const idx = i as 0 | 1 | 2;
                const pt = pitchTypeById(PITCH_ROUND_ORDER[idx]);
                const r = (state[ROUND_KEY(idx)] as RoundData | undefined) || {};
                const winnerName =
                  r.verdict?.winner === "tie"
                    ? "Remíza"
                    : r.verdict?.winner === "a"
                    ? group.members[0]?.display_name
                    : r.verdict?.winner === "b"
                    ? group.members[1]?.display_name
                    : "—";
                return (
                  <div key={i} className="bg-black/30 border border-white/10 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{pt?.emoji}</span>
                      <span className="text-sm font-bold">{pt?.name}</span>
                      <span className="ml-auto text-xs text-yellow-400">🏆 {winnerName}</span>
                    </div>
                    {state.topic_for_round?.[idx] && (
                      <div className="text-[11px] text-white/40 italic">&quot;{state.topic_for_round[idx]}&quot;</div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => router.push("/zak/profil")} className="mt-6 px-6 py-3 bg-cyan-400 text-black font-bold rounded tracking-wider hover:shadow-[0_0_20px_#00D4FF]">
              ▶ Zpět na profil
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
