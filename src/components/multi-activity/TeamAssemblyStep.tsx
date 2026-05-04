"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, TeamRole } from "@/types";
import { TEAM_ROLE_INFO, ALL_TEAM_ROLES } from "@/types";

// Defensivní parsing JSONB pole — Supabase typicky vrací JS array, ale výjimečně může
// dorazit jako string (po round-tripu) nebo null. Tahle helper zkonsoliduje obě cesty.
function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

interface TeamAssemblyStepProps {
  activityId: string;
  studentId: string;
  sessionId: string;
  lessonId: string | null;
  votingActivityId?: string;          // ID předchozí peer_review aktivity (zdroj příležitostí)
  brainstormActivityId?: string;      // ID brainstorm aktivity (zdroj text_submit eventů)
  xp?: number;
  onComplete: (xpGained: number) => void;
}

interface TeamView {
  id: string;
  opportunity_text: string;
  leader_student_id: string;
  leader_name: string;
  leader_emoji: string;
  member_ids: string[];
  is_leader_confirmed: boolean;
  is_approved: boolean;
}

interface MemberView {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
  teamRole: TeamRole | null;
}

// Spočti vítěze hlasování per skupinu (session_groups). Vítěz = autor textu s nejvíc hlasy.
async function detectWinners(
  sessionId: string,
  votingActivityId: string,
  brainstormActivityId: string
): Promise<Array<{ student_id: string; opportunity_text: string; source_event_id: string }>> {
  // 1) Vote eventy → spočítej hlasy per voted_event_id
  const { data: votes } = await supabase
    .from("student_events")
    .select("answer")
    .eq("session_id", sessionId)
    .eq("question_id", votingActivityId)
    .eq("event_type", "vote");

  const voteCounts = new Map<string, number>();
  for (const v of (votes ?? [])) {
    try {
      const parsed = JSON.parse(v.answer as string) as { voted_event_id: string };
      voteCounts.set(parsed.voted_event_id, (voteCounts.get(parsed.voted_event_id) ?? 0) + 1);
    } catch { /* ignore */ }
  }

  // 2) Načti skupiny session
  const { data: groups } = await supabase
    .from("session_groups")
    .select("id")
    .eq("session_id", sessionId);

  const winners: Array<{ student_id: string; opportunity_text: string; source_event_id: string }> = [];
  for (const g of (groups ?? [])) {
    // Členové této skupiny
    const { data: gMembers } = await supabase
      .from("session_group_members")
      .select("student_id")
      .eq("group_id", g.id);
    const memberIds = (gMembers ?? []).map((m) => m.student_id as string);
    if (memberIds.length === 0) continue;

    // Brainstorm text_submit eventy od členů této skupiny
    const { data: submits } = await supabase
      .from("student_events")
      .select("id, answer, student_id")
      .eq("session_id", sessionId)
      .eq("question_id", brainstormActivityId)
      .eq("event_type", "text_submit")
      .in("student_id", memberIds);

    let bestEventId: string | null = null;
    let bestVotes = -1;
    let bestText = "";
    let bestStudent: string | null = null;
    for (const s of (submits ?? [])) {
      const eid = s.id as string;
      const cnt = voteCounts.get(eid) ?? 0;
      if (cnt > bestVotes) {
        bestVotes = cnt;
        bestEventId = eid;
        bestText = (s.answer as string) ?? "";
        bestStudent = s.student_id as string;
      }
    }
    if (bestEventId && bestStudent) {
      winners.push({ student_id: bestStudent, opportunity_text: bestText, source_event_id: bestEventId });
    }
  }
  return winners;
}

export default function TeamAssemblyStep({
  activityId, studentId, sessionId, lessonId,
  votingActivityId, brainstormActivityId,
  xp = 60, onComplete,
}: TeamAssemblyStepProps) {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamView[]>([]);
  const [allMembers, setAllMembers] = useState<MemberView[]>([]); // všichni žáci ve třídě (sessions classmates)
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Inicializuj týmy: pokud teams řádky pro tuhle session ještě nejsou, vytvoř je z winners.
  // Idempotentní — opakovaně bezpečné.
  const ensureTeams = useCallback(async () => {
    if (!votingActivityId || !brainstormActivityId) return;

    // Existing teams pro session
    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("session_id", sessionId);

    if ((existing ?? []).length > 0) return;

    // První žák, kdo se sem dostane, vytvoří týmy z winners
    const winners = await detectWinners(sessionId, votingActivityId, brainstormActivityId);
    if (winners.length === 0) return;

    const rows = winners.map((w) => ({
      session_id: sessionId,
      lesson_id: lessonId,
      activity_id: activityId,
      opportunity_text: w.opportunity_text,
      source_event_id: w.source_event_id,
      leader_student_id: w.student_id,
      member_ids: [w.student_id],         // lídr je první člen
      roles_summary: {},
    }));

    // ON CONFLICT (session_id, leader_student_id) — žák může vést jen jeden tým
    await supabase.from("teams").insert(rows);
  }, [sessionId, lessonId, activityId, votingActivityId, brainstormActivityId]);

  const loadAll = useCallback(async (isInitial: boolean = false) => {
    // Spinner zobrazíme jen při prvním načtení; polling refreshuje data tichoučko
    if (isInitial) setLoading(true);

    // 1) Vytvoř týmy pokud nejsou (idempotent)
    await ensureTeams();

    // 1b) SELF-HEAL: zajisti, že lídr je v member_ids každého týmu.
    // (Mohlo se stát ve starém běhu před opravou race condition; cheap, idempotentní.)
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

    // 2) Načti týmy + lídry profile
    const { data: teamRows } = await supabase
      .from("teams")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (teamRows && teamRows.length > 0) {
      const leaderIds = teamRows.map((t) => t.leader_student_id);
      const { data: leaders } = await supabase
        .from("students")
        .select("id, display_name, avatar_emoji")
        .in("id", leaderIds);
      const leaderMap = new Map((leaders ?? []).map((l) => [l.id, l]));

      const tv: TeamView[] = (teamRows as Team[]).map((t) => {
        const leader = leaderMap.get(t.leader_student_id);
        return {
          id: t.id,
          opportunity_text: t.opportunity_text,
          leader_student_id: t.leader_student_id,
          leader_name: leader?.display_name ?? "Lídr",
          leader_emoji: leader?.avatar_emoji ?? "🦊",
          member_ids: asStringArray(t.member_ids),
          is_leader_confirmed: t.is_leader_confirmed,
          is_approved: t.is_approved,
        };
      });
      setTeams(tv);

      // Najdi v jakém týmu jsem
      const mine = tv.find((t) => t.member_ids.includes(studentId));
      setMyTeamId(mine?.id ?? null);
      // Pokud jsem lídr a tým už potvrzený
      const myLeaderTeam = tv.find((t) => t.leader_student_id === studentId);
      if (myLeaderTeam?.is_leader_confirmed) setConfirmed(true);
    }

    // 3) Načti všechny členy (pro role badges).
    // Vždy zahrň také lídry — i kdyby chyběli v member_ids (defensivní).
    const allRelevantIds = new Set<string>();
    for (const t of (teamRows ?? [])) {
      if (t.leader_student_id) allRelevantIds.add(t.leader_student_id as string);
      for (const id of asStringArray(t.member_ids)) allRelevantIds.add(id);
    }
    const { data: classmates } = allRelevantIds.size > 0
      ? await supabase
          .from("students")
          .select("id, display_name, avatar_emoji, team_role")
          .in("id", Array.from(allRelevantIds))
      : { data: [] };
    setAllMembers((classmates ?? []).map((s) => ({
      studentId: s.id as string,
      displayName: s.display_name as string,
      avatarEmoji: (s.avatar_emoji as string) ?? "🦊",
      teamRole: (s.team_role as TeamRole | null) ?? null,
    })));

    if (isInitial) setLoading(false);
  }, [sessionId, studentId, ensureTeams]);

  // Initial load (se spinnerem) + tiché polling každé 2 s (responzivní detekce join/leave)
  useEffect(() => {
    loadAll(true);
    const id = setInterval(() => loadAll(false), 2000);
    return () => clearInterval(id);
  }, [loadAll]);

  const myTeam = teams.find((t) => t.id === myTeamId);
  const iAmLeader = myTeam?.leader_student_id === studentId;
  const iAmInOthersTeam = !!myTeam && !iAmLeader;
  const iAmLeaderOfAnyTeam = teams.some((t) => t.leader_student_id === studentId);

  // — Akce —
  // Race-window mitigation: před každým UPDATE re-fetchni member_ids. UPDATE chainujeme s
  // .select() — Supabase pak vrátí ovlivněné řádky a my ověříme, že write opravdu proběhl.
  async function joinTeam(teamId: string) {
    if (submitting || iAmLeaderOfAnyTeam) return;
    setSubmitting(true);

    const { data: freshTeams, error: selErr } = await supabase
      .from("teams")
      .select("id, member_ids")
      .eq("session_id", sessionId);
    if (selErr) {
      alert("Chyba při načtení týmů: " + selErr.message);
      setSubmitting(false);
      return;
    }

    for (const t of (freshTeams ?? [])) {
      const memberIds = asStringArray(t.member_ids);
      const has = memberIds.includes(studentId);
      if (t.id === teamId) {
        if (!has) {
          const newMembers = [...memberIds, studentId];
          const { data: updated, error: upErr } = await supabase
            .from("teams")
            .update({ member_ids: newMembers })
            .eq("id", t.id)
            .select("id, member_ids");
          if (upErr) {
            alert("Chyba při přidání do týmu: " + upErr.message);
            setSubmitting(false);
            return;
          }
          if (!updated || updated.length === 0) {
            alert("Tým se nepodařilo aktualizovat (update vrátil 0 řádků). Zkus znovu nebo obnov stránku.");
            setSubmitting(false);
            return;
          }
        }
      } else if (has) {
        const newMembers = memberIds.filter((id) => id !== studentId);
        const { error: upErr } = await supabase
          .from("teams")
          .update({ member_ids: newMembers })
          .eq("id", t.id)
          .select("id");
        if (upErr) console.error("Chyba při odebrání ze starého týmu:", upErr);
      }
    }
    setSubmitting(false);
    loadAll(false);
  }

  async function leaveTeam() {
    if (!myTeam || iAmLeader || submitting) return;
    setSubmitting(true);
    const { data: freshTeam } = await supabase
      .from("teams")
      .select("member_ids")
      .eq("id", myTeam.id)
      .single();
    const memberIds = asStringArray(freshTeam?.member_ids);
    const newMembers = memberIds.filter((id) => id !== studentId);
    const { error: upErr } = await supabase
      .from("teams")
      .update({ member_ids: newMembers })
      .eq("id", myTeam.id)
      .select("id");
    if (upErr) alert("Chyba při odchodu z týmu: " + upErr.message);
    setSubmitting(false);
    loadAll(false);
  }

  async function leaderConfirm() {
    if (!iAmLeader || !myTeam || submitting) return;
    setSubmitting(true);
    // Spočítej roles_summary
    const summary: Partial<Record<TeamRole, number>> = {};
    for (const mid of myTeam.member_ids) {
      const m = allMembers.find((x) => x.studentId === mid);
      if (m?.teamRole) summary[m.teamRole] = (summary[m.teamRole] ?? 0) + 1;
    }
    await supabase.from("teams")
      .update({ is_leader_confirmed: true, roles_summary: summary })
      .eq("id", myTeam.id);
    setConfirmed(true);
    setSubmitting(false);
    // Po potvrzení čekáme na schválení učitelem; XP se započte když učitel schválí.
    // Označíme XP teď ale necháme onComplete, který přepne do "submitted" stavu.
    setTimeout(() => onComplete(xp), 1500);
  }

  // — Render —
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-foreground/50 text-sm">Načítám týmy...</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-5 text-yellow-200/80 text-sm text-center">
        <div className="text-3xl mb-3">⏳</div>
        Týmy se ještě nesestavily. Možná předchozí hlasování nebylo dokončeno — zkus to za chvíli.
      </div>
    );
  }

  // Lider potvrdil → čeká na učitele
  if (iAmLeader && (confirmed || myTeam?.is_leader_confirmed)) {
    return (
      <div className="text-center py-10 animate-fade-in">
        <div className="text-6xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-white mb-2">Tým potvrzen</h2>
        <p className="text-foreground/60 text-sm">Čeká na schválení učitelem.</p>
        {myTeam && (
          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl p-4 text-left">
            <p className="text-xs uppercase tracking-wider text-accent mb-2">Vaše příležitost</p>
            <p className="text-white text-sm">{myTeam.opportunity_text}</p>
          </div>
        )}
      </div>
    );
  }

  // — UI: Lídr vidí jiné view než ostatní —
  return (
    <div className="flex flex-col gap-4">
      {iAmLeader && myTeam ? (
        <LeaderView
          team={myTeam}
          members={allMembers}
          onConfirm={leaderConfirm}
          submitting={submitting}
        />
      ) : iAmInOthersTeam && myTeam ? (
        <JoinedView
          team={myTeam}
          members={allMembers}
          onLeave={leaveTeam}
          submitting={submitting}
        />
      ) : (
        <PickTeamView
          teams={teams}
          onJoin={joinTeam}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// — Sub-views —

function PickTeamView({
  teams, onJoin, submitting,
}: { teams: TeamView[]; onJoin: (id: string) => void; submitting: boolean }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Vyber tým</h2>
      <p className="text-foreground/60 text-sm mb-5">
        Každá příležitost hledá tým. Vyber tu, na které chceš pracovat. Připojit se můžeš jen k jedné.
      </p>

      <div className="flex flex-col gap-3">
        {teams.map((t) => (
          <div key={t.id} className="border-2 border-primary/30 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-2">
              <span className="text-3xl">{t.leader_emoji}</span>
              <div className="flex-1">
                <p className="text-xs text-accent uppercase tracking-wider">Lídr</p>
                <p className="text-white font-bold">{t.leader_name}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-foreground/60">
                {t.member_ids.length} {t.member_ids.length === 1 ? "člen" : "členů"}
              </span>
            </div>
            <p className="text-foreground/80 text-sm mb-3 leading-relaxed">{t.opportunity_text}</p>
            <button
              onClick={() => onJoin(t.id)}
              disabled={submitting}
              className="w-full py-2.5 bg-accent/20 text-accent hover:bg-accent/30 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Přidat se k tomuto týmu
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function JoinedView({
  team, members, onLeave, submitting,
}: { team: TeamView; members: MemberView[]; onLeave: () => void; submitting: boolean }) {
  // Defensivní složení teamMembers: vždy začni lídrem (i když chybí v member_ids),
  // pak doplň ostatní z member_ids (deduplikace).
  const teamMembers: MemberView[] = [];
  const leaderProfile = members.find((m) => m.studentId === team.leader_student_id);
  if (leaderProfile) teamMembers.push(leaderProfile);
  for (const id of team.member_ids) {
    if (id === team.leader_student_id) continue;     // už jsme přidali lídra
    const m = members.find((mm) => mm.studentId === id);
    if (m && !teamMembers.find((tm) => tm.studentId === id)) teamMembers.push(m);
  }
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Jsi v týmu</h2>
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-4">
        <p className="text-xs text-accent uppercase tracking-wider mb-1">Vaše příležitost</p>
        <p className="text-white text-sm leading-relaxed mb-3">{team.opportunity_text}</p>
        <div className="flex flex-col gap-1.5">
          {teamMembers.map((m) => {
            const info = m.teamRole ? TEAM_ROLE_INFO[m.teamRole] : null;
            const isLeader = m.studentId === team.leader_student_id;
            return (
              <div key={m.studentId} className="bg-primary/10 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                <span className="text-lg">{m.avatarEmoji}</span>
                <span className="text-white font-medium">{m.displayName}</span>
                {isLeader && <span className="text-accent text-[10px]">👑 Lídr</span>}
                <span className="ml-auto">
                  {info ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px]">
                      <span>{info.emoji}</span><span>{info.label}</span>
                    </span>
                  ) : (
                    <span className="text-foreground/30 text-[10px] italic">bez role</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-foreground/50 text-xs text-center mb-3">
        Lídr potvrdí složení týmu, pak učitel celé skupiny schválí.
      </p>
      <button
        onClick={onLeave}
        disabled={submitting}
        className="w-full py-2.5 border border-primary/30 text-foreground/60 hover:text-white rounded-xl transition-colors text-sm disabled:opacity-50"
      >
        Odejít a vybrat jiný tým
      </button>
    </div>
  );
}

function LeaderView({
  team, members, onConfirm, submitting,
}: { team: TeamView; members: MemberView[]; onConfirm: () => void; submitting: boolean }) {
  // Defensivní složení teamMembers: vždy začni lídrem (i když chybí v member_ids),
  // pak doplň ostatní z member_ids (deduplikace).
  const teamMembers: MemberView[] = [];
  const leaderProfile = members.find((m) => m.studentId === team.leader_student_id);
  if (leaderProfile) teamMembers.push(leaderProfile);
  for (const id of team.member_ids) {
    if (id === team.leader_student_id) continue;     // už jsme přidali lídra
    const m = members.find((mm) => mm.studentId === id);
    if (m && !teamMembers.find((tm) => tm.studentId === id)) teamMembers.push(m);
  }
  // Spočti unikátní role
  const uniqueRoles = new Set(teamMembers.map((m) => m.teamRole).filter(Boolean));
  const idealRoles = uniqueRoles.size >= 3;
  const missingRoles = ALL_TEAM_ROLES.filter((r) => !uniqueRoles.has(r));

  return (
    <div>
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-4">
        <p className="text-xs text-accent uppercase tracking-wider mb-1">Tvoje příležitost hledá tým 👑</p>
        <p className="text-white text-sm leading-relaxed">{team.opportunity_text}</p>
      </div>

      <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider mb-2">
        Tým ({teamMembers.length} {teamMembers.length === 1 ? "člen" : "členů"})
      </h3>
      <div className="space-y-2 mb-4">
        {teamMembers.map((m) => {
          const info = m.teamRole ? TEAM_ROLE_INFO[m.teamRole] : null;
          const isLeader = m.studentId === team.leader_student_id;
          return (
            <div key={m.studentId} className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">{m.avatarEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{m.displayName}</span>
                  {isLeader && <span className="text-xs text-accent">👑 Lídr (ty)</span>}
                </div>
                <div className="text-xs flex items-center gap-1 mt-0.5">
                  {info ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                      <span>{info.emoji}</span><span>{info.label}</span>
                    </span>
                  ) : (
                    <span className="text-foreground/30 italic">bez role (nesplnil/a Volbu role)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role validation */}
      <div className={`rounded-xl p-3 mb-5 border ${
        idealRoles ? "bg-green-400/10 border-green-400/30" : "bg-yellow-400/10 border-yellow-400/30"
      }`}>
        <p className={`text-sm font-bold ${idealRoles ? "text-green-300" : "text-yellow-200"} mb-1`}>
          {idealRoles ? "✓ Tým má dobrou rozmanitost rolí" : "⚠️ Týmu by se hodilo víc různých rolí"}
        </p>
        <p className="text-foreground/60 text-xs">
          Aktuálně {uniqueRoles.size} z 5 rolí
          {!idealRoles && missingRoles.length > 0 && ` · chybí: ${missingRoles.map((r) => TEAM_ROLE_INFO[r].label).join(", ")}`}
        </p>
      </div>

      {/* Lídr může potvrdit kdykoliv — i sám (malá třída, méně přihlášených).
          Spolužáci se ještě přidají před potvrzením, ale lídr nečeká navěky. */}
      <button
        onClick={onConfirm}
        disabled={submitting}
        className={`w-full py-4 rounded-xl font-bold transition-all ${
          !submitting
            ? "bg-accent text-background hover:bg-accent/90"
            : "bg-primary/20 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {submitting ? "Potvrzuji..." : teamMembers.length === 1 ? "Potvrdit tým (jen ty)" : `Potvrdit tým (${teamMembers.length} členů)`}
      </button>
      {teamMembers.length === 1 && (
        <p className="text-foreground/40 text-xs text-center mt-2">
          Můžeš potvrdit i sám — nebo počkej, jestli se přihlásí spolužáci.
        </p>
      )}
    </div>
  );
}
