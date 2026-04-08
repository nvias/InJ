"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ConfirmDialog from "./ConfirmDialog";

// ═══════════════════════════════════════════════
// Učitelská obrazovka pro aktivity typu team_forge
// Sleduje připojené žáky, jejich postup koly,
// nejlepší skóre, sestavené týmy.
// ═══════════════════════════════════════════════

interface Props {
  sessionId: string;
  activityTitle: string;
  sessionCode: string;
  classId: string;
}

interface ConnectedStudent {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: string;
  joined: boolean;
  rounds: { 1: RoundEvent | null; 2: RoundEvent | null; 3: RoundEvent | null };
}

interface RoundEvent {
  finalScore: number;
  maxScore: number;
  team: { id: number; name: string; theme: string; type: string }[];
  balanceScore?: number;
  personalityScore?: number;
  uniqueThemes?: number;
}

const THEME_COLORS: Record<string, string> = {
  blue: "#2196f3", yellow: "#f5c800", red: "#e53935", green: "#2e7d32",
};

export default function TeamForgeTeacherView({ sessionId, activityTitle, sessionCode, classId }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<ConnectedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"live" | "rankings" | "teams">("live");
  const [sessionStatus, setSessionStatus] = useState<"active" | "paused" | "closed">("active");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const loadData = useCallback(async () => {
    // 1) všichni žáci ve třídě
    const { data: classStudents } = await supabase
      .from("students")
      .select("id, display_name, avatar_emoji, avatar_color")
      .eq("class_id", classId);
    if (!classStudents) return;

    // 2) všechny eventy této session
    const { data: events } = await supabase
      .from("student_events")
      .select("student_id, event_type, question_id, answer")
      .eq("session_id", sessionId);

    const joinedSet = new Set<string>();
    const roundsByStudent = new Map<string, { 1: RoundEvent | null; 2: RoundEvent | null; 3: RoundEvent | null }>();

    for (const ev of events || []) {
      if (ev.event_type === "join") {
        joinedSet.add(ev.student_id);
        continue;
      }
      if (ev.event_type !== "team_forge_round") continue;
      const m = /^tf_round_([123])$/.exec(ev.question_id);
      if (!m) continue;
      try {
        const parsed = JSON.parse(ev.answer || "{}") as RoundEvent;
        const r = Number(m[1]) as 1 | 2 | 3;
        const slot = roundsByStudent.get(ev.student_id) || { 1: null, 2: null, 3: null };
        slot[r] = parsed;
        roundsByStudent.set(ev.student_id, slot);
        joinedSet.add(ev.student_id);
      } catch {}
    }

    const merged: ConnectedStudent[] = classStudents
      .map((s) => ({
        id: s.id,
        display_name: s.display_name,
        avatar_emoji: s.avatar_emoji || "🦊",
        avatar_color: s.avatar_color || "#00D4FF",
        joined: joinedSet.has(s.id),
        rounds: roundsByStudent.get(s.id) || { 1: null, 2: null, 3: null },
      }))
      .sort((a, b) => Number(b.joined) - Number(a.joined) || a.display_name.localeCompare(b.display_name));

    setStudents(merged);

    // 3) status session
    const { data: sess } = await supabase
      .from("sessions").select("status, is_active").eq("id", sessionId).single();
    if (sess) setSessionStatus((sess.status as "active" | "paused" | "closed") || (sess.is_active ? "active" : "closed"));

    setLoading(false);
  }, [sessionId, classId]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 3000);
    return () => clearInterval(t);
  }, [loadData]);

  // Heartbeat
  useEffect(() => {
    const tick = () => {
      supabase.from("sessions").update({ teacher_heartbeat: new Date().toISOString() }).eq("id", sessionId).then(() => {});
    };
    tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [sessionId]);

  async function endSession() {
    await supabase.from("sessions").update({ is_active: false, status: "closed" }).eq("id", sessionId);
    router.push("/ucitel/dashboard");
  }

  const joinedCount = students.filter((s) => s.joined).length;
  const completedAll = students.filter((s) => s.joined && s.rounds[1] && s.rounds[2] && s.rounds[3]).length;

  // Best scores per round (only joined students)
  const playing = students.filter((s) => s.joined);
  const bestPerRound: Record<1 | 2 | 3, ConnectedStudent[]> = {
    1: [...playing].filter((s) => s.rounds[1]).sort((a, b) => (b.rounds[1]!.finalScore - a.rounds[1]!.finalScore)),
    2: [...playing].filter((s) => s.rounds[2]).sort((a, b) => (b.rounds[2]!.finalScore - a.rounds[2]!.finalScore)),
    3: [...playing].filter((s) => s.rounds[3]).sort((a, b) => (b.rounds[3]!.finalScore - a.rounds[3]!.finalScore)),
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white">
        <div className="text-xl tracking-wider opacity-60">Načítám…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs tracking-[0.3em] text-[#00D4FF]/70 uppercase">// LEKCE</div>
            <h1 className="text-3xl font-black tracking-wider mt-1">{activityTitle}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-white/50">Kód: <span className="text-[#00D4FF] font-bold tracking-widest">{sessionCode}</span></span>
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${sessionStatus === "active" ? "bg-green-400 animate-pulse" : sessionStatus === "paused" ? "bg-yellow-400" : "bg-white/30"}`} />
                <span className="text-xs uppercase tracking-wider opacity-70">{sessionStatus}</span>
              </span>
            </div>
          </div>
          <button onClick={() => setConfirmEnd(true)} className="px-4 py-2 text-xs tracking-wider rounded border border-pink-400 text-pink-400 hover:bg-pink-500/10">
            ✕ Ukončit lekci
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Připojeno žáků" value={`${joinedCount} / ${students.length}`} color="#00D4FF" />
          <Stat label="Dokončili všechna kola" value={`${completedAll} / ${joinedCount || 1}`} color="#39ff14" />
          <Stat label="Nejlepší skóre (kolo 3)" value={bestPerRound[3][0] ? `${bestPerRound[3][0].rounds[3]!.finalScore}/200` : "—"} color="#ffd700" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {([
            { k: "live" as const, label: "🔴 Živý postup" },
            { k: "rankings" as const, label: "🏆 Žebříček" },
            { k: "teams" as const, label: "👥 Sestavené týmy" },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 text-xs tracking-wider rounded transition ${tab === t.k ? "bg-[#00D4FF] text-black font-bold" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: live */}
        {tab === "live" && (
          <div className="bg-white/[0.03] border border-white/10 rounded p-4">
            {students.length === 0 && <div className="text-center py-8 text-white/40 text-sm">Ve třídě zatím nejsou žádní žáci</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {students.map((s) => {
                const r1 = !!s.rounds[1], r2 = !!s.rounds[2], r3 = !!s.rounds[3];
                return (
                  <div key={s.id} className={`flex items-center gap-3 p-3 rounded border ${s.joined ? "bg-white/[0.04] border-white/10" : "bg-white/[0.01] border-white/5 opacity-50"}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: `${s.avatar_color}33` }}>
                      {s.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{s.display_name}</div>
                      <div className="text-[10px] text-white/40 uppercase tracking-wider">{s.joined ? "připojen" : "offline"}</div>
                    </div>
                    <div className="flex gap-1">
                      <RoundDot done={r1} score={s.rounds[1]?.finalScore} max={100} color="#39ff14" />
                      <RoundDot done={r2} score={s.rounds[2]?.finalScore} max={200} color="#ffd700" />
                      <RoundDot done={r3} score={s.rounds[3]?.finalScore} max={200} color="#ff006e" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: rankings */}
        {tab === "rankings" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((r) => {
              const round = r as 1 | 2 | 3;
              const list = bestPerRound[round];
              const colors = { 1: "#39ff14", 2: "#ffd700", 3: "#ff006e" };
              const titles = { 1: "KOLO 1 — Balance", 2: "KOLO 2 — + Osobnosti", 3: "KOLO 3 — Finále" };
              return (
                <div key={r} className="bg-white/[0.03] border border-white/10 rounded p-4">
                  <div className="text-xs tracking-[0.18em] font-bold mb-3" style={{ color: colors[round] }}>{titles[round]}</div>
                  {list.length === 0 && <div className="text-white/30 text-xs py-4 text-center">Zatím nikdo</div>}
                  {list.slice(0, 5).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-b-0">
                      <span className="w-5 text-center text-white/40 text-xs">{i + 1}.</span>
                      <span className="text-lg">{s.avatar_emoji}</span>
                      <span className="flex-1 text-sm truncate">{s.display_name}</span>
                      <span className="text-sm font-bold" style={{ color: colors[round] }}>{s.rounds[round]!.finalScore}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: teams */}
        {tab === "teams" && (
          <div className="space-y-3">
            {playing.length === 0 && <div className="text-center py-8 text-white/40 text-sm">Žádný žák zatím nedohrál ani jedno kolo</div>}
            {playing.map((s) => (
              <div key={s.id} className="bg-white/[0.03] border border-white/10 rounded p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ background: `${s.avatar_color}33` }}>{s.avatar_emoji}</div>
                  <div className="text-sm font-bold">{s.display_name}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((r) => {
                    const round = r as 1 | 2 | 3;
                    const ev = s.rounds[round];
                    const colors = { 1: "#39ff14", 2: "#ffd700", 3: "#ff006e" };
                    return (
                      <div key={r} className="bg-black/30 rounded p-2 border border-white/5">
                        <div className="text-[10px] tracking-wider mb-1.5 flex justify-between">
                          <span style={{ color: colors[round] }}>KOLO {r}</span>
                          {ev && <span className="font-bold" style={{ color: colors[round] }}>{ev.finalScore}/{ev.maxScore}</span>}
                        </div>
                        {ev ? (
                          <div className="flex gap-1">
                            {ev.team.map((c, i) => (
                              <div key={i} className="flex-1 text-center bg-white/5 rounded p-1 border" style={{ borderColor: `${THEME_COLORS[c.theme] || "#fff"}80` }}>
                                <div className="text-[9px] font-bold tracking-wider truncate">{c.name}</div>
                                <div className="w-2 h-2 rounded-full mx-auto mt-0.5" style={{ background: THEME_COLORS[c.theme] || "#fff" }} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-white/30 text-center py-2">— nehráno —</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded p-4">
      <div className="text-[10px] tracking-[0.18em] uppercase text-white/40">{label}</div>
      <div className="text-3xl font-black mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function RoundDot({ done, score, max, color }: { done: boolean; score?: number; max: number; color: string }) {
  if (!done) return <div className="w-8 h-8 rounded border border-white/10 bg-white/[0.02]" />;
  const pct = (score! / max);
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold border" style={{ background: `${color}22`, borderColor: color, color, opacity: 0.5 + pct * 0.5 }}>
      {score}
    </div>
  );
}
