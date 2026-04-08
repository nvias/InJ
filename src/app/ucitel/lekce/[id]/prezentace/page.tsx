"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Question, StudentEvent, Activity, ActivityMode } from "@/types";
import { calcXp, getQuestionMode } from "@/types";
import TeamForgeTeacherView from "@/components/TeamForgeTeacherView";
import GroupingLobby from "@/components/GroupingLobby";
import PitchDuelTeacherView from "@/components/PitchDuelTeacherView";

interface PlayerAnswer {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
  answer: string | null;
  isCorrect: boolean;
}

interface LeaderboardEntry {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
  score: number;
  total: number;
  xp: number;
  correctedCount: number;
  avgTime: number;
  accuracy: number; // 0-100
}

interface SpecialAward {
  emoji: string;
  label: string;
  studentName: string;
  studentEmoji: string;
  value: string;
}


interface CompetenceResult {
  key: string;
  label: string;
  framework: string;
  score: number;
}

const OPTION_COLORS: Record<string, string> = {
  A: "bg-red-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-green-600",
};

const COMPETENCE_LABELS: Record<string, { name: string; framework: string }> = {
  rvp_komunikacni: { name: "Komunikační kompetence", framework: "RVP" },
  rvp_k_uceni: { name: "Kompetence k učení", framework: "RVP" },
  rvp_pracovni: { name: "Pracovní kompetence", framework: "RVP" },
  rvp_socialni: { name: "Sociální kompetence", framework: "RVP" },
  rvp_obcanske: { name: "Občanské kompetence", framework: "RVP" },
  rvp_k_reseni_problemu: { name: "Kompetence k řešení problémů", framework: "RVP" },
  rvp_digitalni: { name: "Digitální kompetence", framework: "RVP" },
  entrecomp_mobilising_others: { name: "Mobilizace ostatních", framework: "EntreComp" },
  entrecomp_creativity: { name: "Kreativita", framework: "EntreComp" },
  entrecomp_vision: { name: "Vize", framework: "EntreComp" },
  entrecomp_planning: { name: "Plánování", framework: "EntreComp" },
  entrecomp_self_awareness: { name: "Sebeuvědomění", framework: "EntreComp" },
  entrecomp_motivation: { name: "Motivace", framework: "EntreComp" },
  entrecomp_taking_initiative: { name: "Iniciativa", framework: "EntreComp" },
};

// answering → reveal (2s) → leaderboard (stays until next Q)
type PresentationPhase = "answering" | "reveal" | "leaderboard";

export default function PrezentacePage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState<string>("quiz");
  const [activityTeamSize, setActivityTeamSize] = useState<number>(1);
  const [activityRequiresGrouping, setActivityRequiresGrouping] = useState<boolean>(false);
  const [sessionCode, setSessionCode] = useState<string>("");
  const [sessionClassId, setSessionClassId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [sessionStatus, setSessionStatus] = useState("active");
  const [phase, setPhase] = useState<PresentationPhase>("answering");
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [connectedStudents, setConnectedStudents] = useState(0);
  const [activityMode, setActivityMode] = useState<ActivityMode>("learning");
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevQForTimerRef = useRef(-1);
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [classCompetences, setClassCompetences] = useState<CompetenceResult[]>([]);
  // Use refs to avoid recreating loadData callback on every change
  const prevQuestionRef = useRef(-1);
  const prevAnsweringOpenRef = useRef(true);
  // Finale: 0=done, 1=3rd, 2=2nd, 3=1st, 4=correctors, 5=competences
  const [finaleStep, setFinaleStep] = useState(0);
  const [finaleTab, setFinaleTab] = useState<"ranking" | "corrections" | "competences">("competences");
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const { data: session } = await supabase
      .from("sessions")
      .select("*, activities(*)")
      .eq("id", params.id)
      .single();

    if (!session) return;

    setIsActive(session.is_active);
    setSessionStatus(session.status || (session.is_active ? "active" : "closed"));
    setActivityMode((session.activity_mode as ActivityMode) || "learning");
    setTimerSeconds(session.timer_seconds ?? null);
    const activity = session.activities as Activity;
    setActivityTitle(activity.title);
    setActivityType(activity.type || "quiz");
    setActivityTeamSize(activity.team_size || 1);
    setActivityRequiresGrouping(activity.requires_grouping || false);
    setSessionCode(session.code || "");
    setSessionClassId(session.class_id || "");
    setQuestions(activity.questions);

    const newQ = session.current_question ?? 0;
    const nowOpen = session.answering_open ?? true;

    // Detect question change → reset to answering
    if (newQ !== prevQuestionRef.current) {
      prevQuestionRef.current = newQ;
      prevAnsweringOpenRef.current = nowOpen;
      setPhase("answering");
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    }
    // Detect answering closed → reveal → leaderboard (stays)
    else if (!nowOpen && prevAnsweringOpenRef.current) {
      prevAnsweringOpenRef.current = false;
      setPhase("reveal");
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = setTimeout(() => setPhase("leaderboard"), 5000);
    }
    // Detect answering reopened
    else if (nowOpen && !prevAnsweringOpenRef.current) {
      prevAnsweringOpenRef.current = true;
      setPhase("answering");
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    }

    setCurrentQuestion(newQ);

    // Events
    const { data: events } = await supabase
      .from("student_events")
      .select("*")
      .eq("session_id", params.id);

    const evts: StudentEvent[] = events || [];
    const connectedIds = new Set(evts.map((e) => e.student_id));
    setConnectedStudents(connectedIds.size);

    // Student info
    const studentIds = Array.from(connectedIds);
    const studentsMap = new Map<string, { display_name: string; avatar_emoji: string }>();
    if (studentIds.length > 0) {
      const { data: students } = await supabase.from("students").select("*").in("id", studentIds);
      if (students) {
        for (const s of students) {
          studentsMap.set(s.id, {
            display_name: (s as Record<string, unknown>).display_name as string || "Anonym",
            avatar_emoji: (s as Record<string, unknown>).avatar_emoji as string || "🦊",
          });
        }
      }
    }

    const answerEvts = evts.filter((e) => e.event_type === "answer");

    // Current question stats
    const currentQData = activity.questions[newQ];
    if (currentQData) {
      const qEvents = answerEvts.filter((e) => e.question_id === currentQData.id);
      const byStudent = new Map<string, StudentEvent>();
      for (const ev of qEvents) {
        const ex = byStudent.get(ev.student_id);
        if (!ex || ev.attempt_no > ex.attempt_no) byStudent.set(ev.student_id, ev);
      }
      const counts: Record<string, number> = {};
      for (const opt of currentQData.options) counts[opt.key] = 0;
      for (const ev of Array.from(byStudent.values())) {
        if (ev.answer) counts[ev.answer] = (counts[ev.answer] || 0) + 1;
      }
      setOptionCounts(counts);
      setTotalAnswers(byStudent.size);

      const answers: PlayerAnswer[] = [];
      for (const [sid, ev] of Array.from(byStudent.entries())) {
        const s = studentsMap.get(sid);
        answers.push({
          studentId: sid, displayName: s?.display_name || "Anonym",
          avatarEmoji: s?.avatar_emoji || "🦊", answer: ev.answer, isCorrect: ev.is_correct,
        });
      }
      setPlayerAnswers(answers);
    }

    // Leaderboard
    const entries: LeaderboardEntry[] = [];
    for (const sid of studentIds) {
      const sEvts = answerEvts.filter((e) => e.student_id === sid);
      const qBest = new Map<string, StudentEvent>();
      for (const ev of sEvts) {
        const ex = qBest.get(ev.question_id);
        if (!ex || (ev.is_correct && !ex.is_correct) || ev.attempt_no > ex.attempt_no) qBest.set(ev.question_id, ev);
      }
      let score = 0, corrected = 0, xp = 0, totalTime = 0;
      for (const [qId, best] of Array.from(qBest.entries())) {
        if (best.is_correct) score++;
        if (best.is_correct && best.attempt_no > 1) corrected++;
        totalTime += best.duration_ms;
        const q = activity.questions.find((qq: Question) => qq.id === qId);
        const qMode = q ? getQuestionMode(activityMode, q) : "learning";
        xp += calcXp(qMode, best.is_correct, best.attempt_no, best.duration_ms);
      }
      const s = studentsMap.get(sid);
      entries.push({
        studentId: sid, displayName: s?.display_name || "Anonym", avatarEmoji: s?.avatar_emoji || "🦊",
        score, total: qBest.size, xp, correctedCount: corrected,
        avgTime: qBest.size > 0 ? totalTime / qBest.size : 0,
        accuracy: qBest.size > 0 ? Math.round((score / qBest.size) * 100) : 0,
      });
    }
    entries.sort((a, b) => b.xp - a.xp);
    setLeaderboard(entries);

    // Class competences (aggregate all students)
    const compAcc: Record<string, { earned: number; total: number }> = {};
    for (const q of activity.questions as Question[]) {
      if (!q.competence_weights) continue;
      // How many students answered this question correctly?
      const qAnswers = answerEvts.filter((e) => e.question_id === q.id);
      const bestPerStudent = new Map<string, boolean>();
      for (const ev of qAnswers) {
        const ex = bestPerStudent.get(ev.student_id);
        if (ex === undefined || (!ex && ev.is_correct)) bestPerStudent.set(ev.student_id, ev.is_correct);
      }
      const answeredCount = bestPerStudent.size;
      if (answeredCount === 0) continue;
      const correctCount = Array.from(bestPerStudent.values()).filter(Boolean).length;

      for (const [key, weight] of Object.entries(q.competence_weights)) {
        if (!compAcc[key]) compAcc[key] = { earned: 0, total: 0 };
        compAcc[key].total += (weight as number) * answeredCount;
        compAcc[key].earned += (weight as number) * correctCount;
      }
    }
    const compResults: CompetenceResult[] = [];
    for (const [key, data] of Object.entries(compAcc)) {
      if (data.total === 0) continue;
      const info = COMPETENCE_LABELS[key] || { name: key.replace(/_/g, " "), framework: key.startsWith("rvp_") ? "RVP" : "EntreComp" };
      compResults.push({ key, label: info.name, framework: info.framework, score: Math.round((data.earned / data.total) * 100) });
    }
    compResults.sort((a, b) => b.score - a.score);
    setClassCompetences(compResults);
  }, [params.id]);

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") { router.replace("/ucitel"); return; }
    setAuthorized(true);
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => {
      clearInterval(interval);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router, loadData]);

  // Timer countdown for presentation (mirrors teacher dashboard timer)
  useEffect(() => {
    if (!timerSeconds || phase !== "answering") return;
    if (currentQuestion === prevQForTimerRef.current) return;
    prevQForTimerRef.current = currentQuestion;

    setTimeLeft(timerSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerSeconds, currentQuestion, phase]);

  // Stop timer when not answering
  useEffect(() => {
    if (phase !== "answering" && timerRef.current) clearInterval(timerRef.current);
  }, [phase]);

  // Auto-advance finale
  const isFinished = currentQuestion >= questions.length;
  const showFinale = isFinished || sessionStatus === "closed";

  // Simple interval-based auto-advance, no chain of timeouts
  // Step durations: 0=done(3s), 1=3rd(2s), 2=2nd(2s), 3=1st(2.5s), 4=corrections(3s), 5=competences(stays)
  const STEP_DURATIONS = [3000, 2000, 2000, 2500, 3000];
  useEffect(() => {
    if (!showFinale) return;
    if (leaderboard.length === 0) return;
    if (finaleStep >= 5) return;

    const duration = STEP_DURATIONS[finaleStep] ?? 2000;
    const timer = setTimeout(() => {
      setFinaleStep((s) => {
        const next = s + 1;
        if (next === 5) setFinaleTab("competences");
        return next;
      });
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFinale, finaleStep, leaderboard.length]);

  if (!authorized) return null;

  // Lobby phase: teacher composes groups
  if (activityRequiresGrouping && sessionStatus === "lobby") {
    return (
      <GroupingLobby
        sessionId={params.id}
        sessionCode={sessionCode}
        classId={sessionClassId}
        activityTitle={activityTitle}
        teamSize={activityTeamSize}
      />
    );
  }

  // Game-type activities have their own teacher UI
  if (activityType === "team_forge") {
    return (
      <TeamForgeTeacherView
        sessionId={params.id}
        activityTitle={activityTitle}
        sessionCode={sessionCode}
        classId={sessionClassId}
      />
    );
  }

  if (activityType === "pitch_duel") {
    return (
      <PitchDuelTeacherView
        sessionId={params.id}
        activityTitle={activityTitle}
        sessionCode={sessionCode}
        classId={sessionClassId}
        teamSize={activityTeamSize}
      />
    );
  }

  const currentQData = questions[currentQuestion];

  // ===== FINALE (only closed/finished, not paused) =====
  if (showFinale) {
    const top3 = leaderboard.slice(0, 3);
    const topCorrectors = [...leaderboard].sort((a, b) => b.correctedCount - a.correctedCount).filter((e) => e.correctedCount > 0).slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];
    const placeColors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
    const placeBgs = ["bg-yellow-400/20", "bg-gray-300/10", "bg-amber-600/10"];
    const doneAutoSequence = finaleStep >= 5;

    // Special awards - every student should appear at least once
    const specialAwards: SpecialAward[] = [];
    const fastest = [...leaderboard].filter((e) => e.score > 0).sort((a, b) => a.avgTime - b.avgTime)[0];
    const mostAccurate = [...leaderboard].sort((a, b) => b.accuracy - a.accuracy)[0];
    const deepThinker = [...leaderboard].filter((e) => e.score > 0).sort((a, b) => b.avgTime - a.avgTime)[0];
    const topGrowth = [...leaderboard].sort((a, b) => b.correctedCount - a.correctedCount)[0];
    if (fastest) specialAwards.push({ emoji: "⚡", label: "Nejrychlejší", studentName: fastest.displayName, studentEmoji: fastest.avatarEmoji, value: `${Math.round(fastest.avgTime / 1000)}s` });
    if (mostAccurate && mostAccurate.accuracy > 0) specialAwards.push({ emoji: "🎯", label: "Nejpřesnější", studentName: mostAccurate.displayName, studentEmoji: mostAccurate.avatarEmoji, value: `${mostAccurate.accuracy}%` });
    if (deepThinker && deepThinker !== fastest) specialAwards.push({ emoji: "🤔", label: "Nejhlubší přemýšlení", studentName: deepThinker.displayName, studentEmoji: deepThinker.avatarEmoji, value: `${Math.round(deepThinker.avgTime / 1000)}s` });
    if (topGrowth && topGrowth.correctedCount > 0) specialAwards.push({ emoji: "🧠", label: "Growth mindset", studentName: topGrowth.displayName, studentEmoji: topGrowth.avatarEmoji, value: `${topGrowth.correctedCount}x` });

    const rankingContent = (
      <div className="w-full max-w-lg animate-fade-in">
        <div className="flex flex-col gap-4 mb-6">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.studentId} className={`flex items-center gap-4 p-5 rounded-2xl ${i < 3 ? placeBgs[i] : "bg-white/5"}`}>
              <span className="text-4xl w-12 text-center">{i < 3 ? medals[i] : <span className="text-white/30 font-bold text-2xl">{i + 1}</span>}</span>
              <span className="text-3xl">{entry.avatarEmoji}</span>
              <div className="flex-1">
                <p className={`text-xl font-bold ${i < 3 ? placeColors[i] : "text-white"}`}>{entry.displayName}</p>
                <p className="text-white/40 text-sm">{entry.score}/{entry.total} správně</p>
              </div>
              <span className="text-2xl font-bold text-cyan-400">{entry.xp} <span className="text-sm text-white/30">XP</span></span>
            </div>
          ))}
        </div>
        {/* Special awards */}
        {specialAwards.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {specialAwards.map((a) => (
              <div key={a.label} className="p-3 rounded-xl bg-white/5 text-center">
                <div className="text-2xl mb-1">{a.emoji}</div>
                <div className="text-foreground/40 text-xs">{a.label}</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span>{a.studentEmoji}</span>
                  <span className="text-white text-sm font-medium">{a.studentName}</span>
                </div>
                <div className="text-accent text-xs font-bold">{a.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    const correctionsContent = (
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">&#128170;</div>
          <h2 className="text-2xl font-bold text-white mb-1">Práce s chybou</h2>
          <p className="text-white/40 text-sm">Ti, kteří se dokázali opravit</p>
        </div>
        {topCorrectors.length === 0 ? (
          <p className="text-center text-white/30">Tentokrát bez oprav</p>
        ) : (
          <div className="flex flex-col gap-4">
            {topCorrectors.map((entry) => (
              <div key={entry.studentId} className="flex items-center gap-4 p-5 rounded-2xl bg-green-400/10 border border-green-400/20">
                <span className="text-3xl">{entry.avatarEmoji}</span>
                <div className="flex-1 text-left">
                  <p className="text-xl font-bold text-green-400">{entry.displayName}</p>
                  <p className="text-white/40 text-sm">{entry.correctedCount}x opravil/a chybu</p>
                </div>
                <span className="text-2xl">&#127775;</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    const competencesContent = (
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">&#127891;</div>
          <h2 className="text-2xl font-bold text-white mb-1">Kompetence třídy</h2>
          <p className="text-white/40 text-sm">Co jsme dnes rozvíjeli</p>
        </div>
        {classCompetences.length === 0 ? (
          <p className="text-center text-white/30">Žádná data</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classCompetences.map((c, i) => (
              <div key={c.key} className="p-4 rounded-2xl bg-white/5 animate-fade-in" style={{ animationDelay: `${i * 150}ms`, animationFillMode: "both" }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.framework === "RVP" ? "bg-cyan-400/20 text-cyan-300" : "bg-orange-400/20 text-orange-300"}`}>
                      {c.framework}
                    </span>
                    <p className="text-white font-medium mt-1">{c.label}</p>
                  </div>
                  <span className={`text-2xl font-bold ${c.score >= 70 ? "text-green-400" : c.score >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                    {c.score}%
                  </span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${c.score >= 70 ? "bg-green-400" : c.score >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ width: `${c.score}%`, transitionDelay: `${i * 150 + 300}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <main className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-8">
        {/* AUTO SEQUENCE steps 0-4 */}
        {finaleStep === 0 && (
          <div className="text-center animate-fade-in">
            <div className="text-8xl mb-8">&#127942;</div>
            <h1 className="text-5xl font-bold text-white mb-4">Kvíz dokončen!</h1>
            <p className="text-2xl text-white/50">{activityTitle}</p>
            <p className="text-lg text-white/30 mt-4">{connectedStudents} žáků se zúčastnilo</p>
          </div>
        )}

        {finaleStep >= 1 && finaleStep <= 3 && (
          <div className="text-center w-full max-w-lg">
            <div className="flex flex-col gap-6">
              {[2, 1, 0].map((pi) => {
                const entry = top3[pi];
                if (!entry) return null;
                const showAt = 3 - pi;
                if (finaleStep < showAt) return null;
                const isNew = finaleStep === showAt;
                return (
                  <div key={entry.studentId}
                    className={`flex items-center gap-4 p-6 rounded-2xl transition-all duration-700 ${placeBgs[pi]} ${isNew ? "animate-fade-in scale-110" : "scale-100"} ${pi === 0 && isNew ? "ring-4 ring-yellow-400/50" : ""}`}>
                    <span className="text-5xl">{medals[pi]}</span>
                    <span className="text-4xl">{entry.avatarEmoji}</span>
                    <div className="flex-1 text-left">
                      <p className={`text-2xl font-bold ${placeColors[pi]}`}>{entry.displayName}</p>
                      <p className="text-white/40 text-sm">{entry.xp} XP · {entry.score}/{entry.total} správně</p>
                    </div>
                    <span className={`text-4xl font-bold ${placeColors[pi]}`}>{pi + 1}.</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {finaleStep === 4 && correctionsContent}

        {/* INTERACTIVE MODE (step 5+): tabs + content */}
        {doneAutoSequence && (
          <>
            {/* Tab bar */}
            <div className="flex justify-center gap-2 mb-8">
              {([
                { key: "ranking" as const, label: "Pořadí", icon: "🏆" },
                { key: "corrections" as const, label: "Práce s chybou", icon: "💪" },
                { key: "competences" as const, label: "Kompetence", icon: "🎓" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFinaleTab(t.key)}
                  className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    finaleTab === t.key
                      ? "bg-white/15 text-white scale-105"
                      : "bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  <span className="mr-2">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
            {finaleTab === "ranking" && rankingContent}
            {finaleTab === "corrections" && correctionsContent}
            {finaleTab === "competences" && competencesContent}
          </>
        )}
      </main>
    );
  }

  if (!currentQData) return null;

  // ===== LEADERBOARD (stays until teacher clicks next) =====
  if (phase === "leaderboard") {
    const top5 = leaderboard.slice(0, 5);
    const medals = ["🥇", "🥈", "🥉"];
    const placeBgs = [
      "bg-gradient-to-r from-yellow-400/20 to-yellow-400/5",
      "bg-gradient-to-r from-gray-300/15 to-gray-300/5",
      "bg-gradient-to-r from-amber-600/15 to-amber-600/5",
      "bg-white/5",
      "bg-white/5",
    ];

    return (
      <main className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-xl">
          <h2 className="text-center text-white/40 text-sm uppercase tracking-widest mb-2">Průběžné pořadí</h2>
          <h3 className="text-center text-2xl font-bold text-white mb-8">
            Po otázce {currentQuestion + 1} z {questions.length}
          </h3>
          <div className="flex flex-col gap-3">
            {top5.map((entry, i) => (
              <div
                key={entry.studentId}
                className={`flex items-center gap-4 p-5 rounded-2xl ${placeBgs[i]} animate-slide-in`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <span className="text-3xl w-10 text-center transition-all duration-500">
                  {i < 3 ? medals[i] : <span className="text-white/30 font-bold text-xl">{i + 1}</span>}
                </span>
                <span className="text-3xl">{entry.avatarEmoji}</span>
                <div className="flex-1">
                  <p className="text-xl font-bold text-white">{entry.displayName}</p>
                </div>
                <div className="text-right flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-cyan-400 animate-score-pop" style={{ animationDelay: `${i * 120 + 300}ms` }}>
                    {entry.xp}
                  </span>
                  <span className="text-white/40 text-sm">XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ===== QUESTION (answering / reveal) =====
  const isReveal = phase === "reveal";

  return (
    <main className="min-h-screen bg-[#1a1a2e] flex flex-col">
      <div className="flex items-center justify-between px-8 py-4">
        <span className="text-white/40 text-sm font-medium">{activityTitle}</span>
        <div className="flex items-center gap-4">
          <span className="text-white/50 text-sm">{connectedStudents} žáků · {totalAnswers} odpovědí</span>
          <span className="text-white/30 text-sm">Q{currentQuestion + 1}/{questions.length}</span>
          {/* Timer */}
          {timerSeconds && phase === "answering" && timeLeft > 0 && (
            <span className={`font-mono text-2xl font-bold px-3 py-1 rounded-xl ${
              timeLeft <= 5 ? "text-red-400 bg-red-400/20 animate-pulse" : timeLeft <= 10 ? "text-yellow-400 bg-yellow-400/10" : "text-white bg-white/10"
            }`}>
              {timeLeft}
            </span>
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${
            currentQData.difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300" : "bg-cyan-400/20 text-cyan-300"
          }`}>
            {currentQData.difficulty === "advanced" ? "Pokročilé" : "Základní"}
          </span>
          {isReveal && (
            <span className="px-3 py-1 rounded-full bg-green-400/20 text-green-400 text-sm font-bold animate-pulse">
              Správná odpověď
            </span>
          )}
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">{currentQData.text}</h2>
      </div>

      <div className="flex-1 px-8 pb-8">
        <div className="grid grid-cols-2 gap-4 h-full">
          {currentQData.options.map((opt) => {
            const count = optionCounts[opt.key] ?? 0;
            const pct = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
            const color = OPTION_COLORS[opt.key] || "bg-gray-500";
            const isCorrect = opt.key === currentQData.correct;
            const dimmed = isReveal && !isCorrect;
            const highlighted = isReveal && isCorrect;

            return (
              <div key={opt.key}
                className={`relative rounded-2xl overflow-hidden transition-all duration-700 ${
                  dimmed ? "opacity-20 scale-[0.97]" : ""
                } ${highlighted ? "scale-105 ring-4 ring-green-400 shadow-[0_0_40px_rgba(74,222,128,0.3)]" : ""}`}>
                <div className={`absolute inset-0 ${color} ${highlighted ? "opacity-40" : "opacity-20"} transition-opacity duration-700`} />
                <div className={`absolute bottom-0 left-0 right-0 ${color} opacity-30 transition-all duration-700`} style={{ height: `${pct}%` }} />
                <div className="relative h-full flex flex-col justify-between p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white font-bold text-lg`}>{opt.key}</span>
                      <span className="text-white text-lg font-medium">{opt.text}</span>
                    </div>
                    {highlighted && <span className="text-4xl animate-bounce">&#10003;</span>}
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-white/80 text-3xl font-bold">{count}</span>
                    <div className="flex flex-wrap gap-1 max-w-[250px] justify-end">
                      {playerAnswers.filter((p) => p.answer === opt.key).map((p) => (
                        <span key={p.studentId}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all duration-500 ${
                            isReveal ? (p.isCorrect ? "bg-green-400/30 text-green-300 scale-110" : "bg-red-400/20 text-red-300 opacity-60") : "bg-white/10 text-white/70"
                          }`}>
                          <span>{p.avatarEmoji}</span>
                          <span>{p.displayName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-8 pb-6">
        <div className="flex gap-1.5 justify-center">
          {questions.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${
              i < currentQuestion ? "bg-cyan-400" : i === currentQuestion ? "bg-white" : "bg-white/20"
            }`} />
          ))}
        </div>
      </div>
    </main>
  );
}
