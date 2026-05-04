"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session, Activity, Question, ActivityMode, TeamRole } from "@/types";
import { calcXp, getQuestionMode, TEAM_ROLE_INFO } from "@/types";
import RadarChart from "@/components/RadarChart";
import EntreCompDrillDown from "@/components/EntreCompDrillDown";
import EntreCompRadar from "@/components/EntreCompRadar";
import { RVP_COMPETENCES } from "@/lib/competences";
import { mapFlatKeyToEntreComp, calcCompetenceXp, ENTRECOMP_AREAS, xpToLevel, GROUP_COLORS } from "@/lib/entrecomp";
import { AVATAR_EMOJIS } from "@/lib/avatars";

const AVATARS = AVATAR_EMOJIS;

const COMPETENCE_LABELS: Record<string, { name: string; framework: string }> = {
  rvp_komunikacni: { name: "Komunikační", framework: "RVP" },
  rvp_k_uceni: { name: "K učení", framework: "RVP" },
  rvp_pracovni: { name: "Pracovní", framework: "RVP" },
  rvp_osobnostni: { name: "Osobnostní a sociální", framework: "RVP" },
  rvp_obcanske: { name: "Občanské", framework: "RVP" },
  rvp_k_reseni_problemu: { name: "K řešení problémů", framework: "RVP" },
  rvp_k_podnikavosti: { name: "K podnikavosti", framework: "RVP" },
  rvp_digitalni: { name: "Digitální", framework: "RVP" },
  rvp_kulturni: { name: "Kulturní", framework: "RVP" },
  entrecomp_spotting_opportunities: { name: "Hledání příležitostí", framework: "EntreComp" },
  entrecomp_creativity: { name: "Kreativita", framework: "EntreComp" },
  entrecomp_vision: { name: "Vize", framework: "EntreComp" },
  entrecomp_valuing_ideas: { name: "Hodnocení nápadů", framework: "EntreComp" },
  entrecomp_ethical_thinking: { name: "Etické myšlení", framework: "EntreComp" },
  entrecomp_self_awareness: { name: "Sebeuvědomění", framework: "EntreComp" },
  entrecomp_motivation: { name: "Motivace", framework: "EntreComp" },
  entrecomp_mobilising_others: { name: "Mobilizace ostatních", framework: "EntreComp" },
  entrecomp_mobilising_resources: { name: "Mobilizace zdrojů", framework: "EntreComp" },
  entrecomp_financial_literacy: { name: "Finanční gramotnost", framework: "EntreComp" },
  entrecomp_taking_initiative: { name: "Iniciativa", framework: "EntreComp" },
  entrecomp_planning: { name: "Plánování", framework: "EntreComp" },
  entrecomp_coping_with_uncertainty: { name: "Zvládání nejistoty", framework: "EntreComp" },
  entrecomp_working_with_others: { name: "Spolupráce", framework: "EntreComp" },
  entrecomp_learning_through_experience: { name: "Učení zkušeností", framework: "EntreComp" },
};

interface StudentAuth {
  studentId: string;
  classId: string;
  code: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
}

interface SessionWithActivity extends Session {
  activities: Activity | null;
}

interface PastSession {
  session: SessionWithActivity;
  answeredCount: number;
  correctCount: number;
  xp: number;
}

interface CompetenceScore {
  key: string;
  label: string;
  framework: string;
  score: number;
}

type ProfileTab = "me" | "skills" | "team" | "growth" | "rvp";

export default function ProfilPage() {
  const [auth, setAuth] = useState<StudentAuth | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🦊");
  const [saving, setSaving] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionWithActivity | null>(null);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [unfinishedSessions, setUnfinishedSessions] = useState<PastSession[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [competences, setCompetences] = useState<CompetenceScore[]>([]);
  const [entreCompMap, setEntreCompMap] = useState<Map<string, { xp: number; evidence: string[] }>>(new Map());
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [growthScore, setGrowthScore] = useState(0);
  const [tab, setTab] = useState<ProfileTab>("me");
  const [selectedRadarComp, setSelectedRadarComp] = useState<{ areaKey: string; compKey: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("inj-student");
    if (!stored) { router.replace("/"); return; }
    const parsed: StudentAuth = JSON.parse(stored);
    setAuth(parsed);
    if (parsed.displayName === "Anonym" || parsed.displayName.startsWith("Žák ")) setNeedsSetup(true);
    setSelectedEmoji(parsed.avatarEmoji || "🦊");
    setLoading(false);
  }, [router]);

  const checkActiveSession = useCallback(async () => {
    if (!auth) return;
    const { data } = await supabase
      .from("sessions").select("*, activities(*)").eq("class_id", auth.classId)
      .eq("is_active", true).order("created_at", { ascending: false }).limit(1);
    setActiveSession(data && data.length > 0 ? data[0] as SessionWithActivity : null);
  }, [auth]);

  const loadData = useCallback(async () => {
    if (!auth) return;
    const { data: allSessions } = await supabase
      .from("sessions").select("*, activities(*)").eq("class_id", auth.classId)
      .order("created_at", { ascending: false }).limit(20);

    if (!allSessions || allSessions.length === 0) {
      setPastSessions([]); setUnfinishedSessions([]); setTotalXp(0); return;
    }

    const sessionIds = allSessions.map((s) => s.id);
    const { data: events } = await supabase
      .from("student_events").select("session_id, question_id, is_correct, attempt_no, duration_ms")
      .eq("student_id", auth.studentId).eq("event_type", "answer").in("session_id", sessionIds);

    let totalXpCalc = 0;
    let totalCorrections = 0;
    let totalAnswers = 0;
    const finished: PastSession[] = [];
    const unfinished: PastSession[] = [];
    const compAcc: Record<string, { earned: number; total: number }> = {};

    for (const s of allSessions) {
      const sess = s as SessionWithActivity;
      const activity = sess.activities as Activity | null;
      const sessionEvents = events?.filter((e) => e.session_id === s.id) || [];
      const totalQuestions = activity?.questions?.length || 0;

      const qBest = new Map<string, { is_correct: boolean; attempt_no: number; duration_ms: number; question_id: string }>();
      for (const ev of sessionEvents) {
        const ex = qBest.get(ev.question_id);
        if (!ex || (ev.is_correct && !ex.is_correct) || ev.attempt_no > ex.attempt_no)
          qBest.set(ev.question_id, ev);
      }

      let sessionXp = 0, correctCount = 0;
      const mode = ((s as Session).activity_mode as ActivityMode) || "learning";
      for (const [qId, best] of Array.from(qBest.entries())) {
        if (best.is_correct) correctCount++;
        if (best.is_correct && best.attempt_no > 1) totalCorrections++;
        totalAnswers++;
        const q = activity?.questions?.find((qq: Question) => qq.id === qId);
        const qMode = q ? getQuestionMode(mode, q) : "learning";
        sessionXp += calcXp(qMode, best.is_correct, best.attempt_no, best.duration_ms);

        // Competence accumulation
        if (q?.competence_weights) {
          for (const [key, weight] of Object.entries(q.competence_weights)) {
            if (!compAcc[key]) compAcc[key] = { earned: 0, total: 0 };
            compAcc[key].total += weight as number;
            if (best.is_correct) compAcc[key].earned += weight as number;
          }
        }
      }

      totalXpCalc += sessionXp;
      const entry: PastSession = { session: sess, answeredCount: qBest.size, correctCount, xp: sessionXp };
      if (qBest.size === 0) continue;

      const status = (s as Session & { status?: string }).status || (s.is_active ? "active" : "closed");
      if (status === "closed" || qBest.size >= totalQuestions) finished.push(entry);
      else if (status === "paused" && qBest.size < totalQuestions) unfinished.push(entry);
    }

    setPastSessions(finished);
    setUnfinishedSessions(unfinished);
    setTotalXp(totalXpCalc);
    setGrowthScore(totalAnswers > 0 ? totalCorrections / totalAnswers : 0);

    // Competences
    const scores: CompetenceScore[] = [];
    for (const [key, data] of Object.entries(compAcc)) {
      if (data.total === 0) continue;
      const info = COMPETENCE_LABELS[key] || { name: key.replace(/_/g, " "), framework: key.startsWith("rvp_") ? "RVP" : "EntreComp" };
      scores.push({ key, label: info.name, framework: info.framework, score: Math.round((data.earned / data.total) * 100) });
    }
    scores.sort((a, b) => b.score - a.score);
    setCompetences(scores);

    // Build EntreComp XP data from events
    // DEDUPLICATE: each question_id counts only ONCE (best attempt across all sessions)
    const bestPerQuestion = new Map<string, { is_correct: boolean; attempt_no: number; activity_title: string; question: Question }>();
    for (const s of allSessions) {
      const activity = (s as SessionWithActivity).activities as Activity | null;
      if (!activity?.questions) continue;
      const sessionEvents = events?.filter((e) => e.session_id === s.id) || [];
      for (const ev of sessionEvents) {
        const q = activity.questions.find((qq: Question) => qq.id === ev.question_id);
        if (!q?.competence_weights) continue;
        const existing = bestPerQuestion.get(ev.question_id);
        // Keep best: correct > wrong, higher attempt_no for corrections
        if (!existing || (ev.is_correct && !existing.is_correct)) {
          bestPerQuestion.set(ev.question_id, { is_correct: ev.is_correct, attempt_no: ev.attempt_no, activity_title: activity.title, question: q });
        }
      }
    }

    const ecXp = new Map<string, { xp: number; evidence: Set<string> }>();
    for (const [, best] of Array.from(bestPerQuestion.entries())) {
      const cxp = calcCompetenceXp("answer", best.is_correct, best.attempt_no);
      if (cxp <= 0) continue;
      for (const key of Object.keys(best.question.competence_weights)) {
        const mapping = mapFlatKeyToEntreComp(key);
        if (!mapping) continue;
        const weight = best.question.competence_weights[key] as number;
        const weightedXp = Math.round(cxp * weight);
        if (!ecXp.has(mapping.competence)) ecXp.set(mapping.competence, { xp: 0, evidence: new Set() });
        const entry = ecXp.get(mapping.competence)!;
        entry.xp += weightedXp;
        entry.evidence.add(best.activity_title);
      }
    }

    const ecMap = new Map<string, { xp: number; evidence: string[] }>();
    for (const [key, val] of Array.from(ecXp.entries())) {
      ecMap.set(key, { xp: val.xp, evidence: Array.from(val.evidence) });
    }
    setEntreCompMap(ecMap);

    // Týmová role: čte se ze students.team_role (nastavuje aktivita role_selection v lekci).
    // Behaviorální detekce z eventů byla odstraněna při přechodu na preferenční taxonomii.
    const { data: studentRow } = await supabase
      .from("students")
      .select("team_role")
      .eq("id", auth.studentId)
      .single();
    if (studentRow?.team_role) {
      setTeamRole(studentRow.team_role as TeamRole);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    checkActiveSession(); loadData();
    const interval = setInterval(checkActiveSession, 10000);
    return () => clearInterval(interval);
  }, [auth, checkActiveSession, loadData]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!auth || name.trim().length < 2) return;
    setSaving(true);
    await supabase.from("students").update({ display_name: name.trim(), avatar_emoji: selectedEmoji }).eq("id", auth.studentId);
    const updated = { ...auth, displayName: name.trim(), avatarEmoji: selectedEmoji };
    localStorage.setItem("inj-student", JSON.stringify(updated));
    setAuth(updated); setNeedsSetup(false); setSaving(false);
  }

  function handleJoinSession() {
    if (!activeSession) return;
    localStorage.setItem("inj-session", JSON.stringify({ sessionId: activeSession.id, sessionCode: activeSession.code }));
    router.push(`/lekce/${activeSession.code}`);
  }

  if (loading || !auth) return <main className="min-h-screen flex items-center justify-center bg-background"><p className="text-foreground/60">Načítání...</p></main>;

  const rvpCompetences = competences.filter((c) => c.framework === "RVP");
  const entreCompetences = competences.filter((c) => c.framework === "EntreComp");

  // Render competence bar
  const CompBar = ({ c }: { c: CompetenceScore }) => (
    <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white text-sm font-medium">{c.label}</span>
        <span className={`text-sm font-bold ${c.score >= 70 ? "text-green-400" : c.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>{c.score}%</span>
      </div>
      <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${c.score >= 70 ? "bg-green-400" : c.score >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
          style={{ width: `${c.score}%` }} />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-6 pt-8">
        {/* Setup form */}
        {needsSetup ? (
          <div className="mb-8 animate-fade-in">
            <h1 className="text-2xl font-bold text-white text-center mb-2">Vítej!</h1>
            <p className="text-foreground/50 text-center mb-6">Nastav si svůj profil</p>
            <form onSubmit={handleSetup} className="flex flex-col gap-5">
              <div>
                <label className="block text-foreground/80 text-sm mb-1.5">Jak ti říkají?</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Tvoje jméno nebo přezdívka" required maxLength={30}
                  className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors" autoFocus />
              </div>
              <div>
                <label className="block text-foreground/80 text-sm mb-2">Vyber si avatara</label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => setSelectedEmoji(emoji)}
                      className={`aspect-square text-2xl rounded-xl transition-all ${selectedEmoji === emoji ? "bg-accent/20 border-2 border-accent scale-110" : "bg-primary/10 border-2 border-transparent hover:border-primary/40"}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3.5 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-bold rounded-xl transition-colors mt-2">
                {saving ? "Ukládám..." : "Uložit a pokračovat"}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl"
                style={{ backgroundColor: auth.avatarColor + "30" }}>{auth.avatarEmoji || "🦊"}</div>
              <h1 className="text-2xl font-bold text-white">{auth.displayName}</h1>
              <div className="text-3xl font-bold text-accent mt-1">{totalXp} XP</div>
              {teamRole && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-sm">
                  <span>{TEAM_ROLE_INFO[teamRole].emoji}</span>
                  <span className="text-accent font-medium">{TEAM_ROLE_INFO[teamRole].label}</span>
                </div>
              )}
            </div>

            {/* Active session banner */}
            {activeSession && (
              <div className="mb-4 p-4 bg-accent/10 border-2 border-accent/40 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-sm font-semibold">Aktivní lekce</span>
                </div>
                <h3 className="text-lg font-bold text-white">{activeSession.activities?.title || "Lekce"}</h3>
                <button onClick={handleJoinSession}
                  className="mt-3 w-full py-3 bg-accent hover:bg-accent/80 text-background font-bold rounded-xl transition-colors">
                  Připojit se
                </button>
              </div>
            )}

            {/* 5 Tabs */}
            <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
              {([
                { key: "me" as const, label: "Já", icon: "👤" },
                { key: "skills" as const, label: "Dovednosti", icon: "⭐" },
                { key: "team" as const, label: "Tým", icon: "🤝" },
                { key: "growth" as const, label: "Růst", icon: "📈" },
                { key: "rvp" as const, label: "RVP", icon: "🏫" },
              ]).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    tab === t.key ? "bg-accent/20 text-accent" : "bg-primary/10 text-foreground/40"
                  }`}>
                  <span className="mr-1">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* === TAB: Já === */}
            {tab === "me" && (
              <div className="animate-fade-in">
                {/* Unfinished sessions */}
                {unfinishedSessions.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-semibold text-yellow-400 mb-2">Nedokončené lekce</h3>
                    {unfinishedSessions.map((ps) => (
                      <button key={ps.session.id} onClick={() => router.push(`/lekce/${ps.session.code}`)}
                        className="flex items-center justify-between py-3 px-4 bg-yellow-400/5 rounded-xl border border-yellow-400/20 hover:bg-yellow-400/10 w-full mb-2 text-left">
                        <div>
                          <p className="text-white text-sm">{ps.session.activities?.title || "Lekce"}</p>
                          <p className="text-foreground/30 text-xs">{ps.answeredCount} otázek zodpovězeno</p>
                        </div>
                        <span className="text-yellow-400 text-sm">Pokračovat &rarr;</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Past sessions */}
                {pastSessions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/40 mb-2">Historie</h3>
                    {pastSessions.map((ps) => (
                      <div key={ps.session.id} className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-xl border border-primary/10 mb-2">
                        <div>
                          <p className="text-white text-sm">{ps.session.activities?.title || "Lekce"}</p>
                          <p className="text-foreground/30 text-xs">{ps.correctCount}/{ps.answeredCount} správně</p>
                        </div>
                        <span className="text-accent font-bold">{ps.xp} XP</span>
                      </div>
                    ))}
                  </div>
                )}
                {pastSessions.length === 0 && unfinishedSessions.length === 0 && !activeSession && (
                  <div className="text-center py-8"><p className="text-foreground/30">Zatím žádné lekce</p></div>
                )}
              </div>
            )}

            {/* === TAB: Dovednosti (EntreComp drill-down) === */}
            {tab === "skills" && (
              <EntreCompDrillDown data={entreCompMap} etalonLevel={1} />
            )}

            {/* === TAB: Tým === */}
            {tab === "team" && (
              <div className="animate-fade-in">
                {teamRole ? (
                  <div className="text-center py-6">
                    <div className="text-6xl mb-4">{TEAM_ROLE_INFO[teamRole].emoji}</div>
                    <h2 className="text-2xl font-bold text-accent mb-2">{TEAM_ROLE_INFO[teamRole].label}</h2>
                    <p className="text-foreground/60">{TEAM_ROLE_INFO[teamRole].description}</p>
                    <div className="mt-6 grid grid-cols-5 gap-2">
                      {(Object.keys(TEAM_ROLE_INFO) as TeamRole[]).map((role) => (
                        <div key={role} className={`p-2 rounded-xl text-center ${role === teamRole ? "bg-accent/20 border border-accent" : "bg-primary/10"}`}>
                          <div className="text-xl">{TEAM_ROLE_INFO[role].emoji}</div>
                          <div className={`text-[10px] mt-1 ${role === teamRole ? "text-accent" : "text-foreground/30"}`}>{TEAM_ROLE_INFO[role].label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-foreground/30">Dokonči více lekcí pro detekci týmové role</p>
                  </div>
                )}
              </div>
            )}

            {/* === TAB: Růst === */}
            {tab === "growth" && (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🧠</div>
                  <h2 className="text-xl font-bold text-white">Síla mozku</h2>
                  <div className="mt-3 w-32 h-32 mx-auto rounded-full border-4 border-accent/30 flex items-center justify-center relative">
                    <div className="text-3xl font-bold text-accent">{Math.round(growthScore * 100)}%</div>
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/20" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent"
                        strokeDasharray={`${growthScore * 100} ${100 - growthScore * 100}`} strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-foreground/40 text-sm mt-3">
                    {growthScore > 0.3 ? "Skvělá práce s chybami! Mozek roste!" : growthScore > 0 ? "Každá oprava tě posiluje" : "Zkus opravit chyby - mozek poroste!"}
                  </p>
                </div>

                {/* Timeline */}
                {pastSessions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/40 mb-3">Posun v čase</h3>
                    <div className="flex flex-col gap-2">
                      {pastSessions.slice(0, 5).reverse().map((ps, i) => {
                        const pct = ps.answeredCount > 0 ? Math.round((ps.correctCount / ps.answeredCount) * 100) : 0;
                        return (
                          <div key={ps.session.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">{i + 1}</div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-white text-sm">{ps.session.activities?.title || "Lekce"}</span>
                                <span className="text-accent text-sm font-bold">{pct}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-primary/20 rounded-full mt-1">
                                <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === TAB: RVP === */}
            {tab === "rvp" && (() => {
              const compMap = new Map(competences.map((c) => [c.key, c.score]));
              const rvpRadar = RVP_COMPETENCES.map((def) => ({
                label: def.label, shortLabel: def.shortLabel, value: compMap.get(def.key) || 0,
              }));
              const hasData = rvpRadar.some((d) => d.value > 0);

              return (
                <div className="animate-fade-in">
                  <RadarChart data={rvpRadar} size={280} color="#4ECDC4" />
                  {!hasData && (
                    <p className="text-foreground/30 text-center mt-2 text-sm">Dokonči lekce pro zobrazení kompetencí</p>
                  )}
                  {hasData && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-2">RVP detail</h3>
                      <div className="flex flex-col gap-1.5">
                        {rvpRadar.filter((d) => d.value > 0).sort((a, b) => b.value - a.value).map((d) => (
                          <div key={d.label} className="flex items-center gap-2">
                            <span className="text-foreground/50 text-xs w-24 text-right truncate">{d.shortLabel}</span>
                            <div className="flex-1 h-2 bg-primary/20 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${d.value >= 70 ? "bg-green-400" : d.value >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                                style={{ width: `${d.value}%` }} />
                            </div>
                            <span className="text-foreground/40 text-xs w-8">{d.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Logout */}
            <div className="mt-8 text-center">
              <button onClick={() => { localStorage.removeItem("inj-student"); localStorage.removeItem("inj-session"); router.replace("/"); }}
                className="text-foreground/30 text-sm hover:text-foreground/50 transition-colors">
                Odhlásit se
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
