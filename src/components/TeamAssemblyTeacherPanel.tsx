"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, TeamRole } from "@/types";
import { TEAM_ROLE_INFO } from "@/types";

// Defensivní parsing JSONB pole (string/null/array tolerantní)
function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

interface Props {
  sessionId: string;
  /** Callback after teacher approves all teams (for parent to enable "next activity" button). */
  onAllApproved?: (allApproved: boolean) => void;
}

interface MemberLite {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
  teamRole: TeamRole | null;
}

interface TeamWithMembers extends Team {
  members: MemberLite[];
}

export default function TeamAssemblyTeacherPanel({ sessionId, onAllApproved }: Props) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setLoading(true);

    // SELF-HEAL: lídr musí být v member_ids (chrání před starými / nekonzistentními daty)
    const { data: rawTeams } = await supabase
      .from("teams")
      .select("id, leader_student_id, member_ids")
      .eq("session_id", sessionId);
    for (const t of (rawTeams ?? [])) {
      const memIds = asStringArray(t.member_ids);
      if (!memIds.includes(t.leader_student_id as string)) {
        await supabase
          .from("teams")
          .update({ member_ids: [t.leader_student_id, ...memIds] })
          .eq("id", t.id);
      }
    }

    const { data: teamRows } = await supabase
      .from("teams")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const teamList = (teamRows ?? []) as Team[];
    if (teamList.length === 0) {
      setTeams([]);
      if (isInitial) setLoading(false);
      onAllApproved?.(false);
      return;
    }

    // Hydrate members — vždy načti i lídry (i když chybí v member_ids)
    const allRelevantIds = new Set<string>();
    for (const t of teamList) {
      if (t.leader_student_id) allRelevantIds.add(t.leader_student_id);
      for (const id of asStringArray(t.member_ids)) allRelevantIds.add(id);
    }
    const { data: studentRows } = allRelevantIds.size > 0
      ? await supabase
          .from("students")
          .select("id, display_name, avatar_emoji, team_role")
          .in("id", Array.from(allRelevantIds))
      : { data: [] };

    const memberMap = new Map<string, MemberLite>();
    for (const s of (studentRows ?? [])) {
      memberMap.set(s.id as string, {
        studentId: s.id as string,
        displayName: s.display_name as string,
        avatarEmoji: (s.avatar_emoji as string) ?? "🦊",
        teamRole: (s.team_role as TeamRole | null) ?? null,
      });
    }

    const hydrated: TeamWithMembers[] = teamList.map((t) => {
      // Vždy začni lídrem, pak doplň ostatní z member_ids (deduplikace)
      const members: MemberLite[] = [];
      const leader = memberMap.get(t.leader_student_id);
      if (leader) members.push(leader);
      for (const id of asStringArray(t.member_ids)) {
        if (id === t.leader_student_id) continue;
        const m = memberMap.get(id);
        if (m && !members.find((mm) => mm.studentId === id)) members.push(m);
      }
      return { ...t, members };
    });
    setTeams(hydrated);
    if (isInitial) setLoading(false);

    const allApproved = hydrated.length > 0 && hydrated.every((t) => t.is_approved);
    onAllApproved?.(allApproved);
  }, [sessionId, onAllApproved]);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), 2000);
    return () => clearInterval(id);
  }, [load]);

  async function approve(teamId: string) {
    setWorking(teamId);
    await supabase.from("teams").update({
      is_approved: true,
      approved_by: "pilot-teacher",
      approved_at: new Date().toISOString(),
    }).eq("id", teamId);
    setWorking(null);
    load(false);
  }

  async function unapprove(teamId: string) {
    setWorking(teamId);
    await supabase.from("teams").update({
      is_approved: false,
      approved_by: null,
      approved_at: null,
    }).eq("id", teamId);
    setWorking(null);
    load(false);
  }

  async function moveStudent(studentId: string, fromTeamId: string, toTeamId: string) {
    setWorking(fromTeamId);
    const from = teams.find((t) => t.id === fromTeamId);
    const to = teams.find((t) => t.id === toTeamId);
    if (!from || !to) { setWorking(null); return; }
    if (from.leader_student_id === studentId) {
      alert("Lídra nelze přesunout — vede tým.");
      setWorking(null);
      return;
    }
    // Re-fetch fresh member_ids ať nepřepíšeme paralelní změny od žáků
    const { data: freshRows } = await supabase
      .from("teams")
      .select("id, member_ids")
      .in("id", [fromTeamId, toTeamId]);
    const fromFresh = (freshRows ?? []).find((r) => r.id === fromTeamId);
    const toFresh = (freshRows ?? []).find((r) => r.id === toTeamId);
    const fromMembers = asStringArray(fromFresh?.member_ids).filter((id) => id !== studentId);
    const toMembers = Array.from(new Set([...asStringArray(toFresh?.member_ids), studentId]));
    await supabase.from("teams").update({ member_ids: fromMembers, is_leader_confirmed: false, is_approved: false }).eq("id", fromTeamId);
    await supabase.from("teams").update({ member_ids: toMembers, is_leader_confirmed: false, is_approved: false }).eq("id", toTeamId);
    setWorking(null);
    load(false);
  }


  if (loading) {
    return <p className="text-foreground/40 text-sm">Načítám týmy…</p>;
  }

  if (teams.length === 0) {
    return (
      <div className="bg-yellow-400/5 border border-yellow-400/30 rounded-xl p-4 text-yellow-200/70 text-sm">
        Týmy se ještě nezačaly tvořit. Žáci právě probíhají vlastní self-organizací.
      </div>
    );
  }

  const allApproved = teams.every((t) => t.is_approved);
  const totalMembers = teams.reduce((s, t) => s + t.members.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/70">
          {teams.length} {teams.length === 1 ? "tým" : teams.length < 5 ? "týmy" : "týmů"} · {totalMembers} žáků
        </span>
        <span className={`text-xs px-3 py-1 rounded-full ${
          allApproved ? "bg-green-400/20 text-green-300" : "bg-yellow-400/20 text-yellow-300"
        }`}>
          {allApproved ? "✓ Všechny týmy schváleny" : `${teams.filter((t) => t.is_approved).length}/${teams.length} schváleno`}
        </span>
      </div>

      <div className="space-y-3">
        {teams.map((t) => {
          const uniqueRoles = new Set(t.members.map((m) => m.teamRole).filter(Boolean));
          const idealRoles = uniqueRoles.size >= 3;
          return (
            <div
              key={t.id}
              className={`border-2 rounded-xl p-4 transition-colors ${
                t.is_approved
                  ? "border-green-400/40 bg-green-400/5"
                  : t.is_leader_confirmed
                  ? "border-accent/40 bg-accent/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-accent uppercase tracking-wider">
                      Tým „{t.members.find((m) => m.studentId === t.leader_student_id)?.displayName ?? "?"}"
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.members.length >= 3 ? "bg-green-400/20 text-green-300" :
                      t.members.length === 2 ? "bg-accent/20 text-accent" :
                      "bg-yellow-400/20 text-yellow-300"
                    }`}>
                      👥 {t.members.length} {t.members.length === 1 ? "člen" : t.members.length < 5 ? "členové" : "členů"}
                    </span>
                  </div>
                  <p className="text-white text-sm leading-relaxed">{t.opportunity_text}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {t.is_leader_confirmed && !t.is_approved && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent">Lídr potvrdil</span>
                  )}
                  {!t.is_leader_confirmed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300">Čeká na lídra</span>
                  )}
                </div>
              </div>

              {/* Members */}
              <div className="flex flex-col gap-1.5 mb-3">
                {t.members.map((m) => {
                  const info = m.teamRole ? TEAM_ROLE_INFO[m.teamRole] : null;
                  const isLeader = m.studentId === t.leader_student_id;
                  return (
                    <div key={m.studentId} className="bg-background/50 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                      <span className="text-lg">{m.avatarEmoji}</span>
                      <span className="text-white font-medium">{m.displayName}</span>
                      {isLeader && <span className="text-accent text-[10px]">👑 Lídr</span>}
                      {info ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px]">
                          <span>{info.emoji}</span><span>{info.label}</span>
                        </span>
                      ) : (
                        <span className="text-foreground/30 text-[10px] italic">bez role</span>
                      )}
                      {!isLeader && (
                        <select
                          className="ml-auto bg-transparent text-foreground/40 hover:text-white text-[10px] outline-none cursor-pointer border border-primary/20 rounded px-1 py-0.5"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) moveStudent(m.studentId, t.id, e.target.value);
                          }}
                          title="Přesunout do jiného týmu"
                          disabled={working === t.id}
                        >
                          <option value="">⤴ přesun</option>
                          {teams.filter((other) => other.id !== t.id).map((other) => (
                            <option key={other.id} value={other.id}>
                              → {other.members.find((mm) => mm.studentId === other.leader_student_id)?.displayName ?? "tým"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Role diversity hint */}
              <div className="text-xs text-foreground/40 mb-3">
                Rozmanitost rolí: {uniqueRoles.size}/5 {idealRoles ? "✓" : "(min 3 ideální)"}
              </div>

              {/* Approve / unapprove */}
              {t.is_approved ? (
                <button
                  onClick={() => unapprove(t.id)}
                  disabled={working === t.id}
                  className="text-xs px-3 py-1.5 border border-green-400/40 text-green-300 hover:bg-green-400/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  ✓ Schváleno (zrušit schválení)
                </button>
              ) : (
                <button
                  onClick={() => approve(t.id)}
                  disabled={working === t.id || !t.is_leader_confirmed}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    t.is_leader_confirmed
                      ? "bg-accent text-background hover:bg-accent/90"
                      : "bg-primary/20 text-foreground/30 cursor-not-allowed"
                  }`}
                >
                  Schválit tým
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
