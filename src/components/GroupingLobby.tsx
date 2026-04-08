"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { chunkStudents, persistGroups, loadGroups, moveStudent } from "@/lib/groups";
import type { GroupWithMembers } from "@/types";
import ConfirmDialog from "./ConfirmDialog";

// ═══════════════════════════════════════════════
// GroupingLobby — generická lobby pro učitele.
// Zobrazí se pro session ve stavu 'lobby' s aktivitou
// requires_grouping=true. Učitel rozhází žáky do skupin
// po N (team_size), případně přesune jednotlivce mezi
// skupinami a finálně klikne "Spustit hru".
// ═══════════════════════════════════════════════

interface Props {
  sessionId: string;
  sessionCode: string;
  classId: string;
  activityTitle: string;
  teamSize: number;
}

interface ConnectedStudent {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: string;
  joined: boolean;
}

export default function GroupingLobby({ sessionId, sessionCode, classId, activityTitle, teamSize }: Props) {
  const router = useRouter();
  const [students, setStudents] = useState<ConnectedStudent[]>([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmStartUnassigned, setConfirmStartUnassigned] = useState(false);
  const [warnNoGroups, setWarnNoGroups] = useState(false);

  const refresh = useCallback(async () => {
    // Students in class + who joined this session
    const [{ data: classStudents }, { data: events }, gs] = await Promise.all([
      supabase.from("students").select("id, display_name, avatar_emoji, avatar_color").eq("class_id", classId),
      supabase.from("student_events").select("student_id").eq("session_id", sessionId).eq("event_type", "join"),
      loadGroups(sessionId),
    ]);
    if (!classStudents) return;
    const joinedSet = new Set((events || []).map((e) => e.student_id));
    setStudents(
      classStudents
        .map((s) => ({
          id: s.id,
          display_name: s.display_name,
          avatar_emoji: s.avatar_emoji || "🦊",
          avatar_color: s.avatar_color || "#00D4FF",
          joined: joinedSet.has(s.id),
        }))
        .sort((a, b) => Number(b.joined) - Number(a.joined) || a.display_name.localeCompare(b.display_name))
    );
    setGroups(gs);
    setLoading(false);
  }, [classId, sessionId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  // Heartbeat - keep students from being kicked
  useEffect(() => {
    const tick = () => supabase.from("sessions").update({ teacher_heartbeat: new Date().toISOString() }).eq("id", sessionId).then(() => {});
    tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [sessionId]);

  const joined = students.filter((s) => s.joined);
  const unassignedStudents = joined.filter((s) => !groups.some((g) => g.members.some((m) => m.student_id === s.id)));

  async function randomize() {
    if (joined.length === 0) return;
    setBusy(true);
    const layout = chunkStudents(joined, teamSize).map((grp) => grp.map((s) => s.id));
    await persistGroups(sessionId, layout);
    await refresh();
    setBusy(false);
  }

  async function clearGroups() {
    setBusy(true);
    await supabase.from("session_groups").delete().eq("session_id", sessionId);
    await refresh();
    setBusy(false);
  }

  async function startSession() {
    if (groups.length === 0) { setWarnNoGroups(true); return; }
    if (unassignedStudents.length > 0) { setConfirmStartUnassigned(true); return; }
    await doStartSession();
  }

  async function doStartSession() {
    setBusy(true);
    await supabase.from("sessions").update({ status: "active" }).eq("id", sessionId);
    setBusy(false);
    router.refresh();
  }

  async function handleDrop(targetGroupId: string) {
    if (!draggedId) return;
    const sourceGroup = groups.find((g) => g.members.some((m) => m.student_id === draggedId));
    if (!sourceGroup) {
      // Was unassigned -> add to target
      const { count } = await supabase
        .from("session_group_members")
        .select("student_id", { count: "exact", head: true })
        .eq("group_id", targetGroupId);
      await supabase.from("session_group_members").insert({
        group_id: targetGroupId,
        student_id: draggedId,
        slot_index: count || 0,
      });
    } else if (sourceGroup.id !== targetGroupId) {
      await moveStudent(sourceGroup.id, targetGroupId, draggedId);
    }
    setDraggedId(null);
    await refresh();
  }

  async function removeFromGroup(groupId: string, studentId: string) {
    await supabase.from("session_group_members").delete().eq("group_id", groupId).eq("student_id", studentId);
    await refresh();
  }

  async function endSession() {
    await supabase.from("sessions").update({ is_active: false, status: "closed" }).eq("id", sessionId);
    router.push("/ucitel/dashboard");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white">
        <div className="text-xl tracking-wider opacity-60">Načítám…</div>
      </main>
    );
  }

  const expectedGroups = teamSize > 0 ? Math.ceil(joined.length / teamSize) : 0;

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-xs tracking-[0.3em] text-[#00D4FF]/70 uppercase">// LOBBY — ROZDĚLENÍ DO SKUPIN</div>
            <h1 className="text-3xl font-black tracking-wider mt-1">{activityTitle}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-white/50">Kód: <span className="text-[#00D4FF] font-bold tracking-widest">{sessionCode}</span></span>
              <span className="text-white/50">Velikost skupiny: <span className="text-[#00D4FF] font-bold">{teamSize}</span></span>
            </div>
          </div>
          <button onClick={() => setConfirmEnd(true)} className="px-4 py-2 text-xs tracking-wider rounded border border-pink-400 text-pink-400 hover:bg-pink-500/10">
            ✕ Ukončit
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Připojeno žáků" value={`${joined.length} / ${students.length}`} color="#00D4FF" />
          <Stat label="Skupiny vytvořeno" value={`${groups.length}`} color={groups.length > 0 ? "#39ff14" : "#ffd700"} />
          <Stat label="Bez skupiny" value={`${unassignedStudents.length}`} color={unassignedStudents.length === 0 ? "#39ff14" : "#ffd700"} />
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={randomize}
            disabled={busy || joined.length === 0}
            className="px-4 py-2 text-sm font-bold tracking-wider rounded bg-[#00D4FF] text-black disabled:opacity-30 hover:shadow-[0_0_20px_#00D4FF]"
          >
            🎲 Náhodně rozhodit ({expectedGroups || 0} skupin po {teamSize})
          </button>
          <button
            onClick={clearGroups}
            disabled={busy || groups.length === 0}
            className="px-4 py-2 text-sm tracking-wider rounded bg-white/5 text-white/60 disabled:opacity-30 hover:bg-white/10"
          >
            ✕ Vymazat skupiny
          </button>
          <div className="flex-1" />
          <button
            onClick={startSession}
            disabled={busy || groups.length === 0}
            className="px-6 py-2 text-sm font-bold tracking-wider rounded bg-[#39ff14] text-black disabled:opacity-30 hover:shadow-[0_0_20px_#39ff14]"
          >
            ▶ Spustit hru
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* LEFT: unassigned + offline */}
          <div className="bg-white/[0.03] border border-white/10 rounded p-4">
            <div className="text-xs tracking-[0.18em] uppercase text-white/50 mb-3">Nepřiřazení žáci</div>
            <div className="space-y-2">
              {unassignedStudents.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDraggedId(s.id)}
                  onDragEnd={() => setDraggedId(null)}
                  className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10 cursor-move hover:bg-white/10"
                >
                  <span className="text-xl">{s.avatar_emoji}</span>
                  <span className="text-sm flex-1 truncate">{s.display_name}</span>
                </div>
              ))}
              {unassignedStudents.length === 0 && joined.length > 0 && (
                <div className="text-xs text-[#39ff14]/70 py-4 text-center">✓ Všichni připojení jsou ve skupinách</div>
              )}
              {joined.length === 0 && (
                <div className="text-xs text-white/30 py-4 text-center">Čekám na žáky…</div>
              )}
            </div>

            {students.filter((s) => !s.joined).length > 0 && (
              <>
                <div className="text-[10px] tracking-wider uppercase text-white/30 mt-5 mb-2">Offline</div>
                <div className="space-y-1">
                  {students.filter((s) => !s.joined).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 p-1.5 rounded opacity-40">
                      <span className="text-base">{s.avatar_emoji}</span>
                      <span className="text-xs flex-1 truncate">{s.display_name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: groups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {groups.length === 0 && (
              <div className="col-span-full text-center py-12 text-white/40 text-sm border border-dashed border-white/10 rounded">
                Klikni „🎲 Náhodně rozhodit" nebo přetáhni žáky pro vytvoření skupin
              </div>
            )}
            {groups.map((g) => (
              <div
                key={g.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(g.id)}
                className={`bg-white/[0.04] border rounded p-3 ${draggedId ? "border-[#00D4FF]/50" : "border-white/10"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold tracking-wider text-[#00D4FF]">SKUPINA {g.group_index}</div>
                  <div className="text-[10px] text-white/40">{g.members.length}/{teamSize}</div>
                </div>
                <div className="space-y-1.5">
                  {g.members.map((m) => (
                    <div
                      key={m.student_id}
                      draggable
                      onDragStart={() => setDraggedId(m.student_id)}
                      onDragEnd={() => setDraggedId(null)}
                      className="flex items-center gap-2 p-2 rounded bg-black/30 border border-white/5 cursor-move hover:bg-black/50"
                      style={{ borderLeftWidth: 3, borderLeftColor: m.avatar_color }}
                    >
                      <span className="text-lg">{m.avatar_emoji}</span>
                      <span className="text-sm flex-1 truncate">{m.display_name}</span>
                      <button
                        onClick={() => removeFromGroup(g.id, m.student_id)}
                        className="text-pink-400 text-xs opacity-50 hover:opacity-100"
                        title="Odebrat ze skupiny"
                      >×</button>
                    </div>
                  ))}
                  {g.members.length === 0 && (
                    <div className="text-[10px] text-white/30 text-center py-3 border border-dashed border-white/10 rounded">
                      Přetáhni žáka sem
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
        open={confirmStartUnassigned}
        title="Spustit s nepřiřazenými?"
        message={`${unassignedStudents.length} žáků zatím není v žádné skupině. Spustit hru přesto?`}
        confirmLabel="Spustit"
        onConfirm={() => { setConfirmStartUnassigned(false); doStartSession(); }}
        onCancel={() => setConfirmStartUnassigned(false)}
      />
      <ConfirmDialog
        open={warnNoGroups}
        title="Žádné skupiny"
        message="Nejdřív rozhoď žáky do skupin pomocí 🎲 nebo drag-drop."
        confirmLabel="OK"
        cancelLabel="Zavřít"
        onConfirm={() => setWarnNoGroups(false)}
        onCancel={() => setWarnNoGroups(false)}
      />
    </main>
  );
}


function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded p-3">
      <div className="text-[10px] tracking-[0.18em] uppercase text-white/40">{label}</div>
      <div className="text-2xl font-black mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
