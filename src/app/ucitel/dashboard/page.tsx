"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateCode, randomAvatarColor } from "@/lib/utils";
import type { Class, Student, Session, Activity, ActivityMode, Question } from "@/types";
import { calcXp, getQuestionMode } from "@/types";
import RadarChart from "@/components/RadarChart";
import EntreCompDrillDown, { type CompetenceXP } from "@/components/EntreCompDrillDown";
import { RVP_COMPETENCES, ENTRECOMP_COMPETENCES, ALL_COMPETENCES } from "@/lib/competences";
import { ENTRECOMP_AREAS, xpToLevel, calcCompetenceXp, getEtalonLevel, mapFlatKeyToEntreComp, GROUP_COLORS } from "@/lib/entrecomp";

// Kompetence třídy - XP progression + etalon
function CompetencesTab({ classes }: { classes: Class[] }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || "");
  const [classAvg, setClassAvg] = useState<{ label: string; shortLabel: string; value: number }[]>([]);
  const [studentData, setStudentData] = useState<{ name: string; emoji: string; data: { label: string; shortLabel: string; value: number }[] }[]>([]);
  const [biggestGaps, setBiggestGaps] = useState<{ competence: string; best: string; worst: string; gap: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"rvp" | "entrecomp">("entrecomp");

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);

    async function load() {
      const { data: sessions } = await supabase.from("sessions").select("*, activities(*)").eq("class_id", selectedClass);
      const { data: students } = await supabase.from("students").select("*").eq("class_id", selectedClass);
      if (!sessions || !students) { setLoading(false); return; }

      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) { setClassAvg([]); setStudentData([]); setLoading(false); return; }
      const { data: events } = await supabase.from("student_events").select("*").eq("event_type", "answer").in("session_id", sessionIds);
      if (!events) { setLoading(false); return; }

      const defs = viewMode === "rvp" ? RVP_COMPETENCES : ENTRECOMP_COMPETENCES;

      // Per-student competence scores
      const perStudent = new Map<string, Map<string, { earned: number; total: number }>>();

      for (const student of students) {
        const sEvts = events.filter((e) => e.student_id === student.id);
        const qBest = new Map<string, typeof events[0]>();
        for (const ev of sEvts) {
          const ex = qBest.get(ev.question_id);
          if (!ex || (ev.is_correct && !ex.is_correct) || ev.attempt_no > ex.attempt_no) qBest.set(ev.question_id, ev);
        }

        const compScores = new Map<string, { earned: number; total: number }>();
        for (const [qId, best] of Array.from(qBest.entries())) {
          const sess = sessions.find((s) => events.some((e) => e.session_id === s.id && e.question_id === qId));
          const activity = sess?.activities as Activity | null;
          const q = activity?.questions?.find((qq: Question) => qq.id === qId);
          if (!q?.competence_weights) continue;

          for (const [key, weight] of Object.entries(q.competence_weights)) {
            if (!compScores.has(key)) compScores.set(key, { earned: 0, total: 0 });
            const c = compScores.get(key)!;
            c.total += weight as number;
            if (best.is_correct) c.earned += weight as number;
          }
        }
        perStudent.set(student.id, compScores);
      }

      // Class average
      const avgScores: Record<string, { sum: number; count: number }> = {};
      for (const [, compScores] of Array.from(perStudent.entries())) {
        for (const [key, data] of Array.from(compScores.entries())) {
          if (!avgScores[key]) avgScores[key] = { sum: 0, count: 0 };
          avgScores[key].sum += data.total > 0 ? (data.earned / data.total) * 100 : 0;
          avgScores[key].count++;
        }
      }

      const avgData = defs.map((def) => ({
        label: def.label, shortLabel: def.shortLabel,
        value: avgScores[def.key] ? Math.round(avgScores[def.key].sum / avgScores[def.key].count) : 0,
      }));
      setClassAvg(avgData);

      // Per-student radar data
      const sData = students.filter((s) => perStudent.get(s.id)?.size).map((student) => {
        const compScores = perStudent.get(student.id)!;
        return {
          name: student.display_name,
          emoji: student.avatar_emoji || "🦊",
          data: defs.map((def) => {
            const c = compScores.get(def.key);
            return { label: def.label, shortLabel: def.shortLabel, value: c && c.total > 0 ? Math.round((c.earned / c.total) * 100) : 0 };
          }),
        };
      });
      setStudentData(sData);

      // Biggest gaps
      const gaps: typeof biggestGaps = [];
      for (const def of defs) {
        let bestVal = 0, worstVal = 100, bestName = "", worstName = "";
        for (const student of students) {
          const compScores = perStudent.get(student.id);
          if (!compScores) continue;
          const c = compScores.get(def.key);
          const val = c && c.total > 0 ? Math.round((c.earned / c.total) * 100) : -1;
          if (val < 0) continue;
          if (val > bestVal) { bestVal = val; bestName = student.display_name; }
          if (val < worstVal) { worstVal = val; worstName = student.display_name; }
        }
        if (bestName && worstName && bestVal - worstVal > 20) {
          gaps.push({ competence: def.label, best: `${bestName} (${bestVal}%)`, worst: `${worstName} (${worstVal}%)`, gap: bestVal - worstVal });
        }
      }
      gaps.sort((a, b) => b.gap - a.gap);
      setBiggestGaps(gaps.slice(0, 5));
      setLoading(false);
    }
    load();
  }, [selectedClass, viewMode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Kompetence třídy</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-primary/10 rounded-lg p-1">
            <button onClick={() => setViewMode("entrecomp")} className={`px-3 py-1 rounded text-xs font-medium ${viewMode === "entrecomp" ? "bg-accent/20 text-accent" : "text-foreground/40"}`}>EntreComp</button>
            <button onClick={() => setViewMode("rvp")} className={`px-3 py-1 rounded text-xs font-medium ${viewMode === "rvp" ? "bg-accent/20 text-accent" : "text-foreground/40"}`}>RVP</button>
          </div>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
            className="py-2 px-4 bg-background border border-primary/50 rounded-xl text-white text-sm outline-none">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-foreground/40 text-center py-8">Načítání...</p>
      ) : classAvg.length === 0 || !classAvg.some((d) => d.value > 0) ? (
        <p className="text-foreground/30 text-center py-8">Zatím žádné výsledky</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {viewMode === "entrecomp" ? (
            <>
              {/* EntreComp: drill-down průměr třídy */}
              <div className="border border-primary/20 rounded-xl p-5 md:col-span-2">
                {(() => {
                  const avgXpMap = new Map<string, CompetenceXP>();
                  for (const area of ENTRECOMP_AREAS) {
                    for (const comp of area.competences) {
                      const item = classAvg.find((d) => d.label === comp.nameCZ || d.shortLabel === comp.nameCZ);
                      avgXpMap.set(comp.key, { xp: Math.round((item?.value || 0) * 1.5) });
                    }
                  }
                  return <EntreCompDrillDown data={avgXpMap} etalonLevel={1} label="Průměr třídy" />;
                })()}
              </div>

              {/* EntreComp: per-student drill-down */}
              {studentData.length > 0 && (
                <div className="border border-primary/20 rounded-xl p-5 md:col-span-2">
                  <h3 className="text-sm font-semibold text-foreground/40 mb-4">Žáci</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentData.map((s) => {
                      const sXp = new Map<string, CompetenceXP>();
                      for (const area of ENTRECOMP_AREAS) {
                        for (const comp of area.competences) {
                          const item = s.data.find((d) => d.label === comp.nameCZ || d.shortLabel === comp.nameCZ);
                          sXp.set(comp.key, { xp: Math.round((item?.value || 0) * 1.5) });
                        }
                      }
                      return (
                        <div key={s.name} className="border border-primary/10 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{s.emoji}</span>
                            <span className="text-white font-medium">{s.name}</span>
                          </div>
                          <EntreCompDrillDown data={sXp} etalonLevel={1} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* RVP: radar chart průměr */}
              <div className="border border-primary/20 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground/40 mb-3 text-center">Průměr třídy - RVP</h3>
                <RadarChart data={classAvg} size={280} color="#4ECDC4" />
              </div>

              {/* RVP: per-student mini radars */}
              <div className="border border-primary/20 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground/40 mb-3 text-center">Žáci</h3>
                <div className="grid grid-cols-2 gap-4">
                  {studentData.map((s) => (
                    <div key={s.name} className="text-center">
                      <div className="text-lg">{s.emoji}</div>
                      <div className="text-white text-xs font-medium mb-1">{s.name}</div>
                      <RadarChart data={s.data} size={120} color="#4ECDC4" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Biggest gaps */}
          {biggestGaps.length > 0 && (
            <div className="border border-primary/20 rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3">Největší rozdíly mezi žáky</h3>
              <div className="flex flex-col gap-2">
                {biggestGaps.map((g) => (
                  <div key={g.competence} className="flex items-center justify-between py-2 px-3 bg-primary/5 rounded-lg">
                    <span className="text-white text-sm font-medium">{g.competence}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-400">{g.best}</span>
                      <span className="text-yellow-400 font-bold">↔ {g.gap}%</span>
                      <span className="text-red-400">{g.worst}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Etalon přehled */}
          {studentData.length > 0 && (
            <div className="border border-primary/20 rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground/40 mb-3">Přehled vs. etalon (6. třída = Lv.1 Discover)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="py-2 px-2 text-left text-foreground/50">Žák</th>
                      <th className="py-2 px-2 text-center text-foreground/50">Průměr Lv.</th>
                      <th className="py-2 px-2 text-center text-foreground/50">vs. etalon</th>
                      <th className="py-2 px-2 text-left text-foreground/50">Nejsilnější</th>
                      <th className="py-2 px-2 text-left text-foreground/50">Nejslabší</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentData.map((s) => {
                      const values = s.data.map((d) => d.value);
                      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
                      const avgLevel = Math.max(Math.ceil(avg / 12.5), 1);
                      const etalon = 1; // 6. třída
                      const diff = avgLevel - etalon;
                      const best = s.data.reduce((a, b) => a.value > b.value ? a : b, s.data[0]);
                      const worst = s.data.reduce((a, b) => a.value < b.value ? a : b, s.data[0]);

                      return (
                        <tr key={s.name} className="border-b border-primary/10">
                          <td className="py-2 px-2">
                            <span className="mr-1.5">{s.emoji}</span>
                            <span className="text-white">{s.name}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-accent">Lv.{avgLevel}</td>
                          <td className="py-2 px-2 text-center">
                            {diff >= 2 ? <span className="text-yellow-400">&#11088; Nad</span>
                              : diff <= -2 ? <span className="text-red-400">&#9888;&#65039; Pod</span>
                              : <span className="text-green-400">&#10004; OK</span>}
                          </td>
                          <td className="py-2 px-2 text-foreground/60 text-xs">{best?.shortLabel} ({best?.value}%)</td>
                          <td className="py-2 px-2 text-foreground/60 text-xs">{worst?.shortLabel} ({worst?.value}%)</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hvězdy třídy - každá kompetence má svého lídra
function StarsTab({ classes }: { classes: Class[] }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || "");
  const [stars, setStars] = useState<{ emoji: string; label: string; studentName: string; studentEmoji: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);

    async function load() {
      // Get all closed sessions for this class
      const { data: sessions } = await supabase
        .from("sessions").select("*, activities(*)").eq("class_id", selectedClass);
      if (!sessions) { setLoading(false); return; }

      // Get all students
      const { data: students } = await supabase
        .from("students").select("*").eq("class_id", selectedClass);
      if (!students) { setLoading(false); return; }

      // Get all answer events
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) { setStars([]); setLoading(false); return; }
      const { data: events } = await supabase
        .from("student_events").select("*").eq("event_type", "answer").in("session_id", sessionIds);
      if (!events) { setLoading(false); return; }

      // Per-student stats
      const studentStats = new Map<string, {
        xp: number; corrections: number; fastCorrect: number; slowCorrect: number;
        accuracy: number; total: number; correct: number;
      }>();

      for (const student of students) {
        const sEvts = events.filter((e) => e.student_id === student.id);
        const qBest = new Map<string, typeof events[0]>();
        for (const ev of sEvts) {
          const ex = qBest.get(ev.question_id);
          if (!ex || (ev.is_correct && !ex.is_correct) || ev.attempt_no > ex.attempt_no) qBest.set(ev.question_id, ev);
        }

        let xp = 0, corrections = 0, fastCorrect = 0, slowCorrect = 0, correct = 0;
        for (const [qId, best] of Array.from(qBest.entries())) {
          // Find session and question for mode
          const sess = sessions.find((s) => events.some((e) => e.session_id === s.id && e.question_id === qId));
          const activity = sess?.activities as Activity | null;
          const q = activity?.questions?.find((qq: Question) => qq.id === qId);
          const mode = ((sess as Session)?.activity_mode as ActivityMode) || "learning";
          const qMode = q ? getQuestionMode(mode, q) : "learning";
          xp += calcXp(qMode, best.is_correct, best.attempt_no, best.duration_ms);
          if (best.is_correct) {
            correct++;
            if (best.attempt_no > 1) corrections++;
            if (best.duration_ms < 10000) fastCorrect++;
            if (best.duration_ms > 15000) slowCorrect++;
          }
        }

        studentStats.set(student.id, { xp, corrections, fastCorrect, slowCorrect, accuracy: qBest.size > 0 ? Math.round((correct / qBest.size) * 100) : 0, total: qBest.size, correct });
      }

      // Build awards - ensure every student appears
      const awards: typeof stars = [];
      const appeared = new Set<string>();

      function addAward(emoji: string, label: string, studentId: string, value: string) {
        const s = students.find((st) => st.id === studentId);
        if (!s) return;
        awards.push({ emoji, label, studentName: s.display_name, studentEmoji: s.avatar_emoji || "🦊", value });
        appeared.add(studentId);
      }

      // Find leaders for each category
      let bestXp = "", bestCorrections = "", bestFast = "", bestAccuracy = "", bestDeep = "";
      let maxXp = 0, maxCorr = 0, maxFast = 0, maxAcc = 0, maxDeep = 0;

      for (const [id, stats] of Array.from(studentStats.entries())) {
        if (stats.total === 0) continue;
        if (stats.xp > maxXp) { maxXp = stats.xp; bestXp = id; }
        if (stats.corrections > maxCorr) { maxCorr = stats.corrections; bestCorrections = id; }
        if (stats.fastCorrect > maxFast) { maxFast = stats.fastCorrect; bestFast = id; }
        if (stats.accuracy > maxAcc) { maxAcc = stats.accuracy; bestAccuracy = id; }
        if (stats.slowCorrect > maxDeep) { maxDeep = stats.slowCorrect; bestDeep = id; }
      }

      if (bestXp) addAward("🏆", "Nejvíc XP", bestXp, `${maxXp} XP`);
      if (bestCorrections) addAward("🧠", "Growth mindset", bestCorrections, `${maxCorr}x oprav`);
      if (bestFast) addAward("⚡", "Nejrychlejší", bestFast, `${maxFast} rychlých`);
      if (bestAccuracy) addAward("🎯", "Nejpřesnější", bestAccuracy, `${maxAcc}%`);
      if (bestDeep) addAward("🤔", "Hluboké přemýšlení", bestDeep, `${maxDeep} hlubokých`);

      // Ensure every student with answers appears
      for (const student of students) {
        if (appeared.has(student.id)) continue;
        const stats = studentStats.get(student.id);
        if (!stats || stats.total === 0) continue;
        addAward("🚀", "Na cestě", student.id, `${stats.xp} XP`);
      }

      setStars(awards);
      setLoading(false);
    }
    load();
  }, [selectedClass]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Hvězdy třídy</h1>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
          className="py-2 px-4 bg-background border border-primary/50 rounded-xl text-white text-sm outline-none">
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {loading ? (
        <p className="text-foreground/40 text-center py-8">Načítání...</p>
      ) : stars.length === 0 ? (
        <p className="text-foreground/30 text-center py-8">Zatím žádné výsledky v této třídě</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stars.map((star, i) => (
            <div key={i} className="border border-primary/20 rounded-xl p-5 text-center hover:border-accent/30 transition-colors">
              <div className="text-3xl mb-2">{star.emoji}</div>
              <div className="text-foreground/40 text-xs uppercase tracking-wider">{star.label}</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-2xl">{star.studentEmoji}</span>
                <span className="text-white font-bold text-lg">{star.studentName}</span>
              </div>
              <div className="text-accent text-sm font-bold mt-1">{star.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [authorized, setAuthorized] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [className, setClassName] = useState("");
  const [studentCount, setStudentCount] = useState(25);
  const [creating, setCreating] = useState(false);
  const [generatedStudents, setGeneratedStudents] = useState<Student[] | null>(null);
  const [tab, setTab] = useState<"classes" | "activities" | "stars" | "competences">("classes");
  // Quick-launch state
  const [launchActivityId, setLaunchActivityId] = useState<string | null>(null);
  const [launchClassId, setLaunchClassId] = useState("");
  const [launching, setLaunching] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    loadData();
  }, [router]);

  async function loadData() {
    const [classRes, sessionRes, actRes] = await Promise.all([
      supabase.from("classes").select("*").order("created_at", { ascending: false }),
      supabase.from("sessions").select("*, activities(title)").order("created_at", { ascending: false }),
      supabase.from("activities").select("*").order("created_at", { ascending: false }),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (sessionRes.data) setSessions(sessionRes.data);
    if (actRes.data) setActivities(actRes.data);
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const { data: cls, error } = await supabase
      .from("classes")
      .insert({ name: className })
      .select()
      .single();

    if (error || !cls) {
      alert("Chyba při vytváření třídy: " + (error?.message ?? ""));
      setCreating(false);
      return;
    }

    const students: { class_id: string; student_code: string; display_name: string; avatar_color: string }[] = [];
    const usedCodes = new Set<string>();
    for (let i = 0; i < studentCount; i++) {
      let code: string;
      do { code = generateCode(8); } while (usedCodes.has(code));
      usedCodes.add(code);
      students.push({
        class_id: cls.id,
        student_code: code,
        display_name: `Žák ${i + 1}`,
        avatar_color: randomAvatarColor(),
      });
    }

    const { data: insertedStudents, error: sErr } = await supabase
      .from("students")
      .insert(students)
      .select();

    if (sErr) {
      alert("Chyba při generování žáků: " + sErr.message);
      setCreating(false);
      return;
    }

    setGeneratedStudents(insertedStudents);
    setCreating(false);
    setShowCreateClass(false);
    setClassName("");
    loadData();
  }

  async function handleQuickLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!launchActivityId || !launchClassId) return;
    setLaunching(true);

    // Look up activity to decide if session needs lobby phase
    const { data: act } = await supabase
      .from("activities")
      .select("requires_grouping")
      .eq("id", launchActivityId)
      .single();
    const initialStatus = act?.requires_grouping ? "lobby" : "active";

    const code = generateCode(6);
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        class_id: launchClassId,
        activity_id: launchActivityId,
        code,
        is_active: true,
        status: initialStatus,
      })
      .select()
      .single();

    if (error || !data) {
      alert("Chyba: " + (error?.message ?? ""));
      setLaunching(false);
      return;
    }

    setLaunchActivityId(null);
    setLaunchClassId("");
    setLaunching(false);
    // Grouped activities go straight to lobby in prezentace; others to results overview
    const dest = act?.requires_grouping ? `prezentace` : `vysledky`;
    router.push(`/ucitel/lekce/${data.id}/${dest}`);
  }

  function exportCSV() {
    if (!generatedStudents) return;
    const header = "Cislo,Kod zaka,Jmeno\n";
    const rows = generatedStudents.map((s, i) => `${i + 1},${s.student_code},${s.display_name}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trida-kody.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLogout() {
    localStorage.removeItem("ucitel-auth");
    router.replace("/ucitel");
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">
            Cesta inovátora
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/ucitel/prezentace" target="_blank" className="text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
              📺 Projektor →
            </Link>
            <span className="text-foreground/60 text-sm">Učitel</span>
            <button onClick={handleLogout} className="text-sm text-foreground/40 hover:text-foreground transition-colors">
              Odhlásit
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Tabs */}
        <div className="flex items-center gap-6 mb-6 border-b border-primary/20">
          <button
            onClick={() => setTab("classes")}
            className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${tab === "classes" ? "text-accent border-accent" : "text-foreground/40 border-transparent hover:text-foreground/60"}`}
          >
            Třídy
          </button>
          <button
            onClick={() => setTab("activities")}
            className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${tab === "activities" ? "text-accent border-accent" : "text-foreground/40 border-transparent hover:text-foreground/60"}`}
          >
            Knihovna lekcí
          </button>
          <button
            onClick={() => setTab("stars")}
            className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${tab === "stars" ? "text-accent border-accent" : "text-foreground/40 border-transparent hover:text-foreground/60"}`}
          >
            Hvězdy třídy
          </button>
          <button
            onClick={() => setTab("competences")}
            className={`pb-3 text-lg font-semibold transition-colors border-b-2 ${tab === "competences" ? "text-accent border-accent" : "text-foreground/40 border-transparent hover:text-foreground/60"}`}
          >
            Kompetence
          </button>
        </div>

        {/* ===== TAB: TŘÍDY ===== */}
        {tab === "classes" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Vaše třídy</h1>
              <button
                onClick={() => setShowCreateClass(true)}
                className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-background font-semibold rounded-xl transition-colors"
              >
                + Nová třída
              </button>
            </div>

            {/* Create class modal */}
            {showCreateClass && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-background border border-primary/30 rounded-2xl p-8 max-w-md w-full animate-fade-in">
                  <h2 className="text-xl font-bold text-accent mb-6">Nová třída</h2>
                  <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-foreground/80 text-sm mb-1.5">Název třídy</label>
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="např. 6.A"
                        required
                        className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-foreground/80 text-sm mb-1.5">Počet žáků</label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={studentCount}
                        onChange={(e) => setStudentCount(Number(e.target.value))}
                        className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
                      />
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateClass(false)}
                        className="flex-1 py-3 border border-primary/30 text-foreground/60 rounded-xl hover:text-white transition-colors"
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="flex-1 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-semibold rounded-xl transition-colors"
                      >
                        {creating ? "Vytvářím..." : "Vytvořit"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Generated students table */}
            {generatedStudents && (
              <div className="mb-8 border border-accent/30 rounded-2xl p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-accent">Vygenerované kódy žáků</h2>
                  <div className="flex gap-3">
                    <button onClick={exportCSV} className="px-4 py-2 text-sm border border-accent/40 text-accent rounded-lg hover:bg-accent/10 transition-colors">
                      Exportovat CSV
                    </button>
                    <button onClick={() => window.print()} className="px-4 py-2 text-sm border border-primary/40 text-foreground/60 rounded-lg hover:text-white transition-colors">
                      Vytisknout
                    </button>
                    <button onClick={() => setGeneratedStudents(null)} className="px-4 py-2 text-sm text-foreground/40 hover:text-white transition-colors">
                      Zavřít
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary/20">
                        <th className="py-2 px-3 text-left text-foreground/50">#</th>
                        <th className="py-2 px-3 text-left text-foreground/50">Kód žáka</th>
                        <th className="py-2 px-3 text-left text-foreground/50">Jméno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedStudents.map((s, i) => (
                        <tr key={s.id} className="border-b border-primary/10">
                          <td className="py-2 px-3 text-foreground/40">{i + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-accent tracking-wider">{s.student_code}</td>
                          <td className="py-2 px-3 text-foreground/70">{s.display_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Classes grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classes.map((cls) => {
                const classSessions = sessions.filter((s) => s.class_id === cls.id);
                const activeSessions = classSessions.filter((s) => s.is_active);
                return (
                  <section key={cls.id} className="border border-primary/30 rounded-xl overflow-hidden">
                    {/* Card header with actions */}
                    <div className="flex items-center justify-between px-5 py-4 bg-primary/10 border-b border-primary/20">
                      <div>
                        <h2 className="text-lg font-semibold text-accent">{cls.name}</h2>
                        <p className="text-foreground/40 text-xs mt-0.5">
                          {classSessions.length} lekcí{activeSessions.length > 0 && ` · ${activeSessions.length} aktivní`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/ucitel/trida/${cls.id}`}
                          className="px-3 py-1.5 text-xs border border-primary/40 text-foreground/60 rounded-lg hover:text-white hover:border-primary/60 transition-colors"
                        >
                          Kódy žáků
                        </Link>
                        <Link
                          href={`/ucitel/lekce/nova?class=${cls.id}`}
                          className="px-3 py-1.5 text-xs bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors font-medium"
                        >
                          + Lekce
                        </Link>
                      </div>
                    </div>
                    {/* Sessions list */}
                    <div className="px-5 py-3">
                      {classSessions.length === 0 ? (
                        <p className="text-foreground/30 text-sm py-2">Zatím žádné lekce</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {classSessions.map((s) => {
                            const actTitle = (s as Session & { activities?: { title: string } }).activities?.title;
                            return (
                              <Link
                                key={s.id}
                                href={`/ucitel/lekce/${s.id}/vysledky`}
                                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-primary/10 transition-colors group"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-accent text-sm">{s.code}</span>
                                  {actTitle && <span className="text-foreground/40 text-xs">{actTitle}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const st = (s as Session & { status?: string }).status || (s.is_active ? "active" : "closed");
                                    return (<>
                                      <span className={`w-2 h-2 rounded-full ${st === "active" ? "bg-green-400" : st === "paused" ? "bg-yellow-400" : "bg-foreground/20"}`} />
                                      <span className={`text-xs ${st === "active" ? "text-green-400" : st === "paused" ? "text-yellow-400" : "text-foreground/30"}`}>
                                        {st === "active" ? "Aktivní" : st === "paused" ? "Pozastavená" : "Ukončená"}
                                      </span>
                                    </>);
                                  })()}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            {classes.length === 0 && (
              <div className="text-center py-16">
                <p className="text-foreground/40 text-lg">Zatím nemáte žádné třídy.</p>
                <p className="text-foreground/30 text-sm mt-2">Vytvořte první třídu tlačítkem výše.</p>
              </div>
            )}
          </>
        )}

        {/* ===== TAB: KNIHOVNA LEKCÍ ===== */}
        {tab === "activities" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Knihovna lekcí</h1>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-foreground/40 text-lg">Žádné aktivity v databázi.</p>
                <p className="text-foreground/30 text-sm mt-2">Spusťte SQL seed pro přidání vzorových aktivit.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activities.map((act) => {
                  const questionCount = act.questions?.length ?? 0;
                  const basicCount = act.questions?.filter((q) => q.difficulty === "basic").length ?? 0;
                  const advancedCount = questionCount - basicCount;
                  return (
                    <div key={act.id} className="border border-primary/30 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-primary/20">
                        <Link href={`/ucitel/aktivita/${act.id}`} className="text-lg font-semibold text-white hover:text-accent transition-colors">
                          {act.title}
                        </Link>
                        {act.description && (
                          <p className="text-foreground/50 text-sm mt-1">{act.description}</p>
                        )}
                        <div className="flex gap-3 mt-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                            {questionCount} otázek
                          </span>
                          {basicCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/15 text-green-400">
                              {basicCount} základní
                            </span>
                          )}
                          {advancedCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-300">
                              {advancedCount} pokročilé
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        {classes.length === 0 ? (
                          <p className="text-foreground/30 text-sm">Nejprve vytvořte třídu</p>
                        ) : launchActivityId === act.id ? (
                          <form onSubmit={handleQuickLaunch} className="flex items-center gap-3">
                            <select
                              value={launchClassId}
                              onChange={(e) => setLaunchClassId(e.target.value)}
                              required
                              className="flex-1 py-2 px-3 bg-background border border-primary/50 focus:border-accent rounded-lg text-white text-sm outline-none transition-colors"
                            >
                              <option value="">Vyber třídu</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              disabled={launching}
                              className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-semibold rounded-lg text-sm transition-colors"
                            >
                              {launching ? "..." : "Spustit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setLaunchActivityId(null); setLaunchClassId(""); }}
                              className="px-3 py-2 text-foreground/40 hover:text-white text-sm transition-colors"
                            >
                              Zrušit
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setLaunchActivityId(act.id)}
                            className="px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm font-medium"
                          >
                            Spustit pro třídu
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== TAB: HVĚZDY TŘÍDY ===== */}
        {tab === "stars" && (
          <StarsTab classes={classes} />
        )}

        {/* ===== TAB: KOMPETENCE ===== */}
        {tab === "competences" && (
          <CompetencesTab classes={classes} />
        )}

        {/* Quick-launch modal */}
        {launchActivityId && tab === "classes" && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-primary/30 rounded-2xl p-8 max-w-md w-full animate-fade-in">
              <h2 className="text-xl font-bold text-accent mb-4">Spustit lekci</h2>
              <form onSubmit={handleQuickLaunch} className="flex flex-col gap-4">
                <select
                  value={launchClassId}
                  onChange={(e) => setLaunchClassId(e.target.value)}
                  required
                  className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
                >
                  <option value="">Vyber třídu</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setLaunchActivityId(null); setLaunchClassId(""); }}
                    className="flex-1 py-3 border border-primary/30 text-foreground/60 rounded-xl hover:text-white transition-colors"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={launching}
                    className="flex-1 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-semibold rounded-xl transition-colors"
                  >
                    {launching ? "Spouštím..." : "Spustit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
