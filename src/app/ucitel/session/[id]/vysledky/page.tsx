"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Question, StudentEvent, ActivityMode, Activity } from "@/types";
import { calcXp as calcXpFn, getQuestionMode } from "@/types";
import { isQuizLikeActivity } from "@/lib/lesson-adapters";
import TeamForgeTeacherView from "@/components/TeamForgeTeacherView";
import PitchDuelTeacherView from "@/components/PitchDuelTeacherView";
import GroupingLobby from "@/components/GroupingLobby";
import TeamAssemblyTeacherPanel from "@/components/TeamAssemblyTeacherPanel";


interface StudentResult {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
  studentCode: string;
  score: number;
  total: number;
  xp: number;
  totalTime: number;
  totalAttempts: number;
  consecutiveWrong: number;
  correctedCount: number;
  answers: Map<string, { answer: string | null; isCorrect: boolean; attemptNo: number }>;
}

interface QuestionStat {
  questionId: string;
  text: string;
  totalAnswers: number;
  correctFirst: number;
  correctSecond: number;
  wrong: number;
  // Per-option counts
  optionCounts: Record<string, number>;
}

export default function VysledkyPage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState<string>("quiz");
  const [activityTeamSize, setActivityTeamSize] = useState<number>(1);
  const [activityRequiresGrouping, setActivityRequiresGrouping] = useState<boolean>(false);
  const [sessionStatus, setSessionStatus] = useState<string>("active");
  const [sessionClassId, setSessionClassId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [connectedStudents, setConnectedStudents] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [answeringOpen, setAnsweringOpen] = useState(true);
  const [activityMode, setActivityMode] = useState<ActivityMode>("learning");
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Lesson-mode state: učitel vidí progress lekce + tlačítko "Spustit další aktivitu"
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [lessonActivities, setLessonActivities] = useState<Activity[]>([]);
  const [currentActivityIdx, setCurrentActivityIdx] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [allTeamsApproved, setAllTeamsApproved] = useState(false);
  const [lessonActivityIds, setLessonActivityIds] = useState<string[]>([]);
  const [skippedLaIds, setSkippedLaIds] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);
  const router = useRouter();
  const isActiveRef = useRef(true);
  const currentQuestionRef = useRef(0);
  const pendingActionRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevQuestionForTimerRef = useRef(-1);

  const loadResults = useCallback(async () => {
    // Don't overwrite state while a user action is in progress
    if (pendingActionRef.current) return;

    const { data: session } = await supabase
      .from("sessions")
      .select("*, activities(*)")
      .eq("id", params.id)
      .single();

    if (!session) return;

    setSessionCode(session.code);
    setIsActive(session.is_active);
    isActiveRef.current = session.is_active;
    setAnsweringOpen(session.answering_open ?? true);
    setActivityMode((session.activity_mode as ActivityMode) || "learning");
    setTimerSeconds(session.timer_seconds ?? null);
    const dbQ = session.current_question ?? 0;
    setCurrentQuestion(dbQ);
    currentQuestionRef.current = dbQ;

    // LESSON MODE — pokud je session.lesson_id, current activity bereme z lesson_activities[idx],
    // ne ze session.activities (legacy column tam pořád ukazuje na první/uloženou aktivitu).
    let activity = session.activities as { title: string; questions: Question[]; type?: string; team_size?: number; requires_grouping?: boolean };
    const sessLessonId = (session as { lesson_id?: string | null }).lesson_id ?? null;
    const curActIdx = (session as { current_activity_index?: number }).current_activity_index ?? 0;
    setLessonId(sessLessonId);
    setCurrentActivityIdx(curActIdx);
    if (sessLessonId) {
      const [{ data: lRow }, { data: laRows }] = await Promise.all([
        supabase.from("lessons").select("title").eq("id", sessLessonId).single(),
        supabase
          .from("lesson_activities")
          .select("id, activity:activities(*)")
          .eq("lesson_id", sessLessonId)
          .order("order_index", { ascending: true }),
      ]);
      setLessonTitle(lRow?.title ?? "");
      const rows = (laRows ?? []) as unknown as Array<{ id: string; activity: Activity }>;
      const acts = rows.map((r) => r.activity).filter(Boolean);
      const ids = rows.map((r) => r.id);
      setLessonActivities(acts);
      setLessonActivityIds(ids);
      const skippedArr = (session as { skipped_activity_ids?: string[] }).skipped_activity_ids ?? [];
      setSkippedLaIds(new Set(Array.isArray(skippedArr) ? skippedArr : []));
      const curAct = acts[curActIdx];
      if (curAct) {
        activity = curAct as unknown as typeof activity;
      }
    }

    setActivityTitle(activity.title);
    setActivityType(activity.type || "quiz");
    setActivityTeamSize(activity.team_size || 1);
    setActivityRequiresGrouping(activity.requires_grouping || false);
    setSessionStatus(session.status || (session.is_active ? "active" : "closed"));
    setSessionClassId(session.class_id || "");
    setQuestions(activity.questions ?? []);

    const { data: students } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", session.class_id);

    if (!students) return;

    const { data: events } = await supabase
      .from("student_events")
      .select("*")
      .eq("session_id", params.id);

    const evts: StudentEvent[] = events || [];

    // Connected = unique students who have any event (including join)
    const participatingStudentIds = new Set(evts.map((e) => e.student_id));
    setConnectedStudents(participatingStudentIds.size);

    // Filter out join/skip events for scoring
    const answerEvts = evts.filter((e) => e.event_type === "answer");

    // Lesson mode: count submissions for non-quiz activities (text/photo/peer-rating per current activity)
    if (sessLessonId && activity.type && !isQuizLikeActivity(activity.type)) {
      const subEvts = evts.filter((e) =>
        ["text_submit", "photo_upload", "peer_rating", "activity_complete"].includes(e.event_type) &&
        e.question_id === (activity as Activity).id
      );
      const uniqueSubmitters = new Set(subEvts.map((e) => e.student_id));
      setSubmissionCount(uniqueSubmitters.size);
    } else {
      setSubmissionCount(0);
    }

    // Per-student results
    const results: StudentResult[] = [];
    for (const student of students) {
      // Check if student has ANY event (including join) to show them
      const hasAnyEvent = evts.some((e) => e.student_id === student.id);
      if (!hasAnyEvent) continue;

      const studentEvents = answerEvts.filter((e) => e.student_id === student.id);

      const questionBest = new Map<string, StudentEvent>();
      for (const ev of studentEvents) {
        const existing = questionBest.get(ev.question_id);
        if (!existing || (ev.is_correct && !existing.is_correct) || ev.attempt_no > existing.attempt_no) {
          questionBest.set(ev.question_id, ev);
        }
      }

      let score = 0;
      let totalTime = 0;
      let totalAttempts = 0;
      let correctedCount = 0;
      let xp = 0;
      const answers = new Map<string, { answer: string | null; isCorrect: boolean; attemptNo: number }>();
      const orderedResults: { isCorrect: boolean; attemptNo: number }[] = [];
      for (const [qId, best] of Array.from(questionBest.entries())) {
        if (best.is_correct) score++;
        if (best.is_correct && best.attempt_no > 1) correctedCount++;
        const qDef = activity.questions.find((qq: Question) => qq.id === qId);
        const qMode = qDef ? getQuestionMode((session.activity_mode as ActivityMode) || "learning", qDef) : "learning";
        xp += calcXpFn(qMode, best.is_correct, best.attempt_no, best.duration_ms);
        totalTime += best.duration_ms;
        totalAttempts += best.attempt_no;
        answers.set(qId, { answer: best.answer, isCorrect: best.is_correct, attemptNo: best.attempt_no });
        orderedResults.push({ isCorrect: best.is_correct, attemptNo: best.attempt_no });
      }

      // Count consecutive wrong from the end
      let consecutiveWrong = 0;
      for (let i = orderedResults.length - 1; i >= 0; i--) {
        if (!orderedResults[i].isCorrect) consecutiveWrong++;
        else break;
      }

      results.push({
        studentId: student.id,
        displayName: student.display_name,
        avatarEmoji: student.avatar_emoji || "🦊",
        studentCode: student.student_code,
        score,
        total: questionBest.size,
        xp,
        totalTime,
        totalAttempts,
        consecutiveWrong,
        correctedCount,
        answers,
      });
    }
    results.sort((a, b) => b.xp - a.xp);
    setStudentResults(results);

    // Per-question stats with option counts (only answer events)
    const qStats: QuestionStat[] = activity.questions.map((q: Question) => {
      const qEvents = answerEvts.filter((e) => e.question_id === q.id);
      const byStudent = new Map<string, StudentEvent>();
      for (const ev of qEvents) {
        const existing = byStudent.get(ev.student_id);
        if (!existing || ev.attempt_no > existing.attempt_no) {
          byStudent.set(ev.student_id, ev);
        }
      }

      let correctFirst = 0;
      let correctSecond = 0;
      let wrong = 0;
      const optionCounts: Record<string, number> = {};
      for (const opt of q.options) {
        optionCounts[opt.key] = 0;
      }

      for (const ev of Array.from(byStudent.values())) {
        if (ev.is_correct && ev.attempt_no === 1) correctFirst++;
        else if (ev.is_correct && ev.attempt_no === 2) correctSecond++;
        else wrong++;
        // Count first-attempt answers for Kahoot-style display
        if (ev.answer) {
          optionCounts[ev.answer] = (optionCounts[ev.answer] || 0) + 1;
        }
      }

      return {
        questionId: q.id,
        text: q.text,
        totalAnswers: byStudent.size,
        correctFirst,
        correctSecond,
        wrong,
        optionCounts,
      };
    });
    setQuestionStats(qStats);
  }, [params.id]);

  // Activate session + heartbeat every 5s + pause on unmount
  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);

    // Activate this session + pause others
    async function activateSession() {
      const { data: session } = await supabase
        .from("sessions")
        .select("class_id")
        .eq("id", params.id)
        .single();
      if (session) {
        await supabase
          .from("sessions")
          .update({ is_active: false, status: "paused" })
          .eq("class_id", session.class_id)
          .eq("is_active", true)
          .neq("id", params.id);
        await supabase
          .from("sessions")
          .update({ is_active: true, status: "active", teacher_heartbeat: new Date().toISOString() })
          .eq("id", params.id);
      }
    }
    activateSession();

    loadResults();
    const pollInterval = setInterval(loadResults, 3000);

    // Heartbeat every 5s - žáci kontrolují tento timestamp
    const heartbeatInterval = setInterval(() => {
      supabase.from("sessions")
        .update({ teacher_heartbeat: new Date().toISOString() })
        .eq("id", params.id)
        .then(() => {});
    }, 5000);

    // Pause on React unmount (in-app navigation)
    async function pauseSession() {
      // Only pause if still active - don't overwrite "closed"
      await supabase
        .from("sessions")
        .update({ is_active: false, status: "paused" })
        .eq("id", params.id)
        .eq("status", "active");
    }

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      pauseSession();
    };
  }, [router, loadResults, params.id]);

  // Timer countdown - starts when question changes, auto-closes when done
  useEffect(() => {
    if (!timerSeconds || !answeringOpen) return;
    if (currentQuestion === prevQuestionForTimerRef.current) return;
    prevQuestionForTimerRef.current = currentQuestion;

    let remaining = timerSeconds;
    setTimeLeft(remaining);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        // Auto-close answering when timer expires
        pendingActionRef.current = true;
        supabase.from("sessions").update({ answering_open: false }).eq("id", params.id)
          .then(() => {
            setAnsweringOpen(false);
            setTimeout(() => { pendingActionRef.current = false; }, 1000);
          });
      }
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerSeconds, currentQuestion, answeringOpen, params.id]);

  // Stop timer when answering manually closed
  useEffect(() => {
    if (!answeringOpen && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [answeringOpen]);

  async function toggleAnswering() {
    pendingActionRef.current = true;
    const newVal = !answeringOpen;
    await supabase.from("sessions").update({ answering_open: newVal }).eq("id", params.id);
    setAnsweringOpen(newVal);
    setTimeout(() => { pendingActionRef.current = false; }, 1000);
  }

  async function handleNextQuestion() {
    const next = currentQuestion + 1;
    if (next > questions.length) return;
    setAdvancing(true);
    pendingActionRef.current = true;

    const updates: Record<string, unknown> = { current_question: next, answering_open: true };
    if (next >= questions.length) {
      updates.is_active = false;
      updates.status = "closed";
    }

    const { error } = await supabase.from("sessions").update(updates).eq("id", params.id);
    if (error) {
      console.error("Failed to advance question:", error);
      alert("Chyba při posunu otázky: " + error.message + "\n\nSpustili jste migraci? ALTER TABLE sessions ADD COLUMN current_question INTEGER NOT NULL DEFAULT 0;");
      setAdvancing(false);
      pendingActionRef.current = false;
      return;
    }

    setCurrentQuestion(next);
    currentQuestionRef.current = next;
    if (next >= questions.length) {
      setIsActive(false);
      isActiveRef.current = false;
    }
    setAdvancing(false);

    // Small delay before allowing polls again to avoid race
    setTimeout(() => { pendingActionRef.current = false; }, 1000);
  }

  async function handleNextLessonActivity() {
    setAdvancing(true);
    pendingActionRef.current = true;
    // Najdi další ne-skipped aktivitu
    let next = currentActivityIdx + 1;
    while (next < lessonActivities.length && skippedLaIds.has(lessonActivityIds[next])) {
      next++;
    }
    if (next >= lessonActivities.length) {
      // Poslední aktivita dokončena → uzavři session
      await supabase.from("sessions").update({ is_active: false, status: "closed" }).eq("id", params.id);
      setIsActive(false);
      isActiveRef.current = false;
    } else {
      const nextAct = lessonActivities[next];
      // Pokud nová aktivita vyžaduje skupiny → spustí se lobby fáze (učitel rozdělí žáky)
      const newStatus = nextAct.requires_grouping ? "lobby" : "active";
      await supabase.from("sessions").update({
        current_activity_index: next,
        current_question: 0,
        answering_open: true,
        activity_id: nextAct.id,                  // legacy column v sync
        status: newStatus,
      }).eq("id", params.id);
      setCurrentActivityIdx(next);
      setCurrentQuestion(0);
      currentQuestionRef.current = 0;
      setAnsweringOpen(true);
      setSessionStatus(newStatus);
    }
    setAdvancing(false);
    setTimeout(() => { pendingActionRef.current = false; }, 1000);
    loadResults();
  }

  async function handleEndLesson() {
    pendingActionRef.current = true;
    await supabase
      .from("sessions")
      .update({ is_active: false, status: "closed" })
      .eq("id", params.id);
    setIsActive(false);
    isActiveRef.current = false;
    setTimeout(() => { pendingActionRef.current = false; }, 1500);
  }

  async function handleReactivate() {
    pendingActionRef.current = true;
    const { data: sess } = await supabase.from("sessions").select("class_id").eq("id", params.id).single();
    if (sess) {
      await supabase.from("sessions").update({ is_active: false, status: "paused" })
        .eq("class_id", sess.class_id).eq("is_active", true).neq("id", params.id);
    }
    await supabase.from("sessions").update({ is_active: true, status: "active" }).eq("id", params.id);
    setIsActive(true);
    isActiveRef.current = true;
    setTimeout(() => { pendingActionRef.current = false; }, 1000);
  }

  async function handleReset() {
    setResetting(true);
    pendingActionRef.current = true;

    // Delete all student events for this session
    await supabase
      .from("student_events")
      .delete()
      .eq("session_id", params.id);

    // Reset session to beginning
    await supabase
      .from("sessions")
      .update({ current_question: 0, is_active: true, status: "active", answering_open: true })
      .eq("id", params.id);

    setCurrentQuestion(0);
    setIsActive(true);
    setAnsweringOpen(true);
    isActiveRef.current = true;
    setStudentResults([]);
    setConnectedStudents(0);
    setQuestionStats((prev) => prev.map((q) => ({ ...q, totalAnswers: 0, correctFirst: 0, correctSecond: 0, wrong: 0, optionCounts: {} })));
    setShowResetConfirm(false);
    setResetting(false);
    pendingActionRef.current = false;
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }

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

  const isFinished = currentQuestion >= questions.length;
  const currentQStat = questionStats[currentQuestion];
  const currentQData = questions[currentQuestion];
  const answeredCurrent = currentQStat?.totalAnswers ?? 0;
  const maxBar = Math.max(...questionStats.map((q) => q.totalAnswers), 1);

  // Assessment módu během běžícího testu skryjeme správnost a leaderboard.
  // Zobrazí se až po ukončení (isActive=false / status=closed).
  const hideResults = activityMode === "assessment" && isActive;
  // Počet žáků, kteří dokončili VŠECHNY otázky aktuální aktivity (relevantní v assessment módu)
  const completedAll = studentResults.filter((s) => s.total >= questions.length).length;

  // Kahoot-style option colors
  const optionColors: Record<string, { bg: string; bar: string }> = {
    A: { bg: "bg-red-500", bar: "bg-red-500" },
    B: { bg: "bg-blue-500", bar: "bg-blue-500" },
    C: { bg: "bg-yellow-500", bar: "bg-yellow-500" },
    D: { bg: "bg-green-500", bar: "bg-green-500" },
  };

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/dashboard" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
            &larr; Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            {lessonId && (() => {
              const visibleIds = lessonActivityIds.filter((id) => !skippedLaIds.has(id));
              const visiblePos = lessonActivityIds.slice(0, currentActivityIdx + 1).filter((id) => !skippedLaIds.has(id)).length;
              return (
                <div className="text-xs uppercase tracking-wider text-foreground/40 mb-1">
                  Lekce: <span className="text-accent">{lessonTitle}</span> · aktivita {visiblePos}/{visibleIds.length}
                </div>
              );
            })()}
            <h1 className="text-3xl font-bold text-white mb-1">{activityTitle}</h1>
            <div className="flex items-center gap-4">
              <span className="font-mono text-2xl text-accent tracking-wider">{sessionCode}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-green-400/20 text-green-400" : "bg-foreground/20 text-foreground/40"}`}>
                {isActive ? "Aktivní" : "Ukončená"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2.5 rounded-xl font-semibold transition-colors border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-sm"
            >
              Reset
            </button>
            {isActive ? (
              <button
                onClick={handleEndLesson}
                className="px-5 py-2.5 rounded-xl font-semibold transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Ukončit lekci
              </button>
            ) : (
              <button
                onClick={handleReactivate}
                className="px-5 py-2.5 rounded-xl font-semibold transition-colors bg-green-500/20 text-green-400 hover:bg-green-500/30"
              >
                Znovu aktivovat
              </button>
            )}
          </div>
        </div>

        {/* Assessment banner — žák během testu nevidí výsledky, ani učitel kromě completion countu */}
        {hideResults && (
          <div className="mb-6 bg-purple-400/10 border border-purple-400/30 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div className="flex-1">
              <p className="text-purple-200 font-bold text-sm">Test probíhá</p>
              <p className="text-purple-200/70 text-xs">
                {completedAll}/{connectedStudents} žáků dokončilo · správnost odpovědí uvidíš po ukončení testu
              </p>
            </div>
          </div>
        )}

        {/* Lesson progress bar (only in lesson mode) — skipped aktivity vynechány */}
        {lessonId && lessonActivities.length > 0 && (() => {
          const visible = lessonActivities
            .map((a, i) => ({ a, i, laId: lessonActivityIds[i] }))
            .filter((x) => !skippedLaIds.has(x.laId));
          const skippedCount = lessonActivities.length - visible.length;
          return (
            <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 text-xs text-foreground/50">
                <span>Postup lekcí{skippedCount > 0 ? ` (${skippedCount} přeskočeno)` : ""}:</span>
              </div>
              <div className="flex items-center gap-2">
                {visible.map((x, vi) => {
                  const done = x.i < currentActivityIdx;
                  const active = x.i === currentActivityIdx;
                  return (
                    <div key={x.a.id} className="flex-1 flex items-center gap-2 min-w-0">
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          done
                            ? "bg-accent text-background"
                            : active
                            ? "bg-accent/20 text-accent border-2 border-accent"
                            : "bg-primary/20 text-foreground/40 border-2 border-primary/30"
                        }`}
                        title={x.a.title}
                      >
                        {done ? "✓" : vi + 1}
                      </div>
                      <span className={`text-xs truncate ${active ? "text-white font-medium" : "text-foreground/40"}`}>{x.a.title}</span>
                      {vi < visible.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-accent" : "bg-primary/20"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Reset confirm modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-yellow-400/30 rounded-2xl p-8 max-w-md w-full animate-fade-in">
              <h2 className="text-xl font-bold text-yellow-400 mb-3">Resetovat lekci?</h2>
              <p className="text-foreground/60 mb-6">Všechny odpovědi žáků budou smazány a lekce začne od první otázky. Tuto akci nelze vrátit.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-3 border border-primary/30 text-foreground/60 rounded-xl hover:text-white transition-colors"
                >
                  Zrušit
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 py-3 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-50 font-semibold rounded-xl transition-colors"
                >
                  {resetting ? "Resetuji..." : "Ano, resetovat"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Non-quiz lesson activity — zjednodušený panel s počtem odevzdání + tlačítkem na další aktivitu */}
        {isActive && lessonId && !isQuizLikeActivity(activityType) && (
          <div className="mb-8 border-2 border-accent/30 rounded-2xl p-6 bg-accent/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{activityTitle}</h2>
                <p className="text-foreground/50 text-sm mt-1">
                  {connectedStudents} žáků připojeno
                  {activityType === "team_assembly"
                    ? ""
                    : ` · ${submissionCount} odevzdalo`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/ucitel/session/${params.id}/prezentace`}
                  target="_blank"
                  className="px-4 py-3 bg-primary/30 text-foreground/70 hover:text-white hover:bg-primary/50 rounded-xl transition-colors text-sm font-medium"
                >
                  Prezentace ↗
                </Link>
                <button
                  onClick={handleNextLessonActivity}
                  disabled={advancing || (activityType === "team_assembly" && !allTeamsApproved)}
                  title={activityType === "team_assembly" && !allTeamsApproved ? "Nejdřív schval všechny týmy" : ""}
                  className="px-6 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-background font-bold rounded-xl transition-colors text-lg"
                >
                  {currentActivityIdx + 1 >= lessonActivities.length ? "Dokončit lekci" : "Spustit další aktivitu →"}
                </button>
              </div>
            </div>

            {/* Team assembly: panel se schvalováním týmů */}
            {activityType === "team_assembly" && (
              <TeamAssemblyTeacherPanel sessionId={params.id} onAllApproved={setAllTeamsApproved} />
            )}
          </div>
        )}

        {/* Teacher control panel — quiz Kahoot UI (skip pro non-quiz lesson aktivity) */}
        {isActive && (!lessonId || isQuizLikeActivity(activityType)) && (
          <div className="mb-8 border-2 border-accent/30 rounded-2xl p-6 bg-accent/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isFinished
                    ? "Všechny otázky zobrazeny"
                    : `Otázka ${currentQuestion + 1} / ${questions.length}`
                  }
                </h2>
                <p className="text-foreground/50 text-sm mt-1">
                  {connectedStudents} žáků připojeno
                  {!isFinished && ` · ${answeredCurrent} odpovědělo`}
                  {timerSeconds && <span className="ml-2 text-yellow-400">&#9202; {timerSeconds}s limit</span>}
                </p>
              </div>
              {!isFinished && (
                <div className="flex items-center gap-3">
                  {/* Prezentace - otevře nový tab */}
                  <Link
                    href={`/ucitel/session/${params.id}/prezentace`}
                    target="_blank"
                    className="px-4 py-3 bg-primary/30 text-foreground/70 hover:text-white hover:bg-primary/50 rounded-xl transition-colors text-sm font-medium"
                  >
                    Prezentace &#8599;
                  </Link>
                  {/* Timer countdown */}
                  {timerSeconds && answeringOpen && timeLeft > 0 && (
                    <div className={`px-4 py-3 rounded-xl font-mono text-2xl font-bold ${timeLeft <= 5 ? "text-red-400 bg-red-400/10" : timeLeft <= 10 ? "text-yellow-400 bg-yellow-400/10" : "text-white bg-primary/20"}`}>
                      {timeLeft}s
                    </div>
                  )}
                  {/* Uzavřít/Otevřít odpovědi */}
                  {answeringOpen ? (
                    <button
                      onClick={toggleAnswering}
                      className="px-5 py-3 border-2 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 font-semibold rounded-xl transition-colors"
                    >
                      Uzavřít odpovědi
                    </button>
                  ) : (
                    <button
                      onClick={toggleAnswering}
                      className="px-5 py-3 border-2 border-green-400/40 text-green-400 hover:bg-green-400/10 font-semibold rounded-xl transition-colors"
                    >
                      Otevřít odpovědi
                    </button>
                  )}
                  {(() => {
                    const isLastQ = currentQuestion + 1 >= questions.length;
                    const inLesson = !!lessonId;
                    const isLastActivity = currentActivityIdx + 1 >= lessonActivities.length;
                    // V lekci: poslední otázka aktivity → spustit další aktivitu (nebo ukončit lekci)
                    if (inLesson && isLastQ) {
                      return (
                        <button
                          onClick={handleNextLessonActivity}
                          disabled={advancing}
                          className="px-6 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-bold rounded-xl transition-colors text-lg"
                        >
                          {isLastActivity ? "Dokončit lekci" : "Spustit další aktivitu →"}
                        </button>
                      );
                    }
                    return (
                      <button
                        onClick={handleNextQuestion}
                        disabled={advancing}
                        className="px-6 py-3 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background font-bold rounded-xl transition-colors text-lg"
                      >
                        {isLastQ ? "Dokončit kvíz" : `Další → Otázka ${currentQuestion + 2}`}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Current question preview */}
            {!isFinished && currentQData && (
              <div className="p-4 bg-primary/10 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${currentQData.difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300" : "bg-accent/20 text-accent"}`}>
                    {currentQData.difficulty === "advanced" ? "Pokročilé" : "Základní"}
                  </span>
                </div>
                <p className="text-white font-medium mb-4">{currentQData.text}</p>

                {/* Kahoot-style option bars (v assessment módu zatajíme správnou odpověď + counts) */}
                <div className="grid grid-cols-2 gap-3">
                  {currentQData.options.map((opt) => {
                    const count = currentQStat?.optionCounts?.[opt.key] ?? 0;
                    const total = currentQStat?.totalAnswers ?? 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const colors = optionColors[opt.key] || { bg: "bg-gray-500", bar: "bg-gray-500" };
                    const isCorrect = opt.key === currentQData.correct;

                    return (
                      <div
                        key={opt.key}
                        className={`relative py-3 px-4 rounded-xl border-2 transition-all ${
                          !hideResults && isCorrect
                            ? "border-green-400/50 bg-green-400/5"
                            : "border-primary/20 bg-primary/5"
                        }`}
                      >
                        {/* Background fill bar — skryjeme v assessment módu (žádný hint kdo co odpovídá) */}
                        {!hideResults && (
                          <div
                            className={`absolute inset-0 rounded-xl opacity-15 ${colors.bar} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        )}
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center text-white font-bold text-sm`}>
                              {opt.key}
                            </span>
                            <span className="text-white text-sm">{opt.text}</span>
                          </div>
                          {!hideResults && (
                            <span className="text-foreground/60 font-bold text-sm ml-2">
                              {count > 0 ? count : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Who answered what — v assessment módu skryto, jinak detail */}
                {!hideResults && currentQStat && currentQStat.totalAnswers > 0 && (
                  <div className="mt-4 pt-3 border-t border-primary/20">
                    <p className="text-foreground/40 text-xs mb-2">Odpovědi žáků:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {studentResults.map((sr) => {
                        const ans = sr.answers.get(currentQData.id);
                        if (!ans) return null;
                        const colors = optionColors[ans.answer || ""] || { bg: "bg-gray-500", bar: "" };
                        return (
                          <span
                            key={sr.studentId}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                              ans.isCorrect ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
                            }`}
                            title={`${sr.displayName}: ${ans.answer} (${ans.isCorrect ? "správně" : "špatně"})`}
                          >
                            <span>{sr.avatarEmoji}</span>
                            <span className="font-medium">{sr.displayName}</span>
                            <span className={`w-4 h-4 rounded text-white text-[10px] flex items-center justify-center font-bold ${colors.bg}`}>
                              {ans.answer}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top 5 summary when answering is closed */}
            {!hideResults && !answeringOpen && !isFinished && studentResults.length > 0 && (
              <div className="mt-4 p-4 bg-primary/10 rounded-xl border border-primary/20">
                <h3 className="text-sm font-bold text-foreground/50 uppercase tracking-wider mb-3">Top 5 hráčů</h3>
                <div className="flex flex-col gap-2">
                  {studentResults.slice(0, 5).map((sr, i) => {
                    const pct = sr.total > 0 ? Math.round((sr.score / sr.total) * 100) : 0;
                    return (
                      <div key={sr.studentId} className="flex items-center gap-3 py-1.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? "bg-yellow-400 text-background" : i === 1 ? "bg-gray-300 text-background" : i === 2 ? "bg-amber-600 text-white" : "bg-primary/20 text-foreground/40"
                        }`}>{i + 1}</span>
                        <span className="text-lg">{sr.avatarEmoji}</span>
                        <span className="text-white font-medium flex-1">{sr.displayName}</span>
                        <span className="text-accent font-bold">{sr.score}/{sr.total}</span>
                        <span className="text-foreground/40 text-sm w-12 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      i < currentQuestion
                        ? "bg-accent"
                        : i === currentQuestion
                        ? "bg-accent/50"
                        : "bg-primary/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="border border-primary/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-accent">{connectedStudents}</p>
            <p className="text-foreground/50 text-sm">Žáků připojeno</p>
          </div>
          <div className="border border-primary/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-white">{questions.length}</p>
            <p className="text-foreground/50 text-sm">Otázek</p>
          </div>
          {hideResults ? (
            <>
              <div className="border border-purple-400/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-purple-300">{completedAll}</p>
                <p className="text-foreground/50 text-sm">Dokončilo test</p>
              </div>
              <div className="border border-primary/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-foreground/30">—</p>
                <p className="text-foreground/50 text-sm">Hodnocení po skončení</p>
              </div>
            </>
          ) : (
            <>
              <div className="border border-primary/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">
                  {questionStats.length > 0
                    ? Math.round(
                        (questionStats.reduce((s, q) => s + q.correctFirst + q.correctSecond, 0) /
                          Math.max(questionStats.reduce((s, q) => s + q.totalAnswers, 0), 1)) *
                          100
                      )
                    : 0}
                  %
                </p>
                <p className="text-foreground/50 text-sm">Správně celkem</p>
              </div>
              <div className="border border-primary/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {studentResults.filter((s) => s.consecutiveWrong >= 2).length}
                </p>
                <p className="text-foreground/50 text-sm">Potřebuje podporu</p>
              </div>
            </>
          )}
        </div>

        {/* Question stats — skip pro non-quiz lesson aktivity (nemá otázky) a v assessment módu během testu */}
        {questions.length > 0 && !hideResults && (
        <section className="border border-primary/30 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">Přehled otázek</h2>
          <div className="flex flex-col gap-3">
            {questionStats.map((qs, i) => {
              const correctPct = qs.totalAnswers > 0
                ? Math.round(((qs.correctFirst + qs.correctSecond) / qs.totalAnswers) * 100)
                : 0;
              const isProblematic = correctPct < 50 && qs.totalAnswers > 0;
              const isCurrent = i === currentQuestion;

              return (
                <div key={qs.questionId} className={`p-3 rounded-lg ${isCurrent ? "ring-2 ring-accent/40 bg-accent/5" : isProblematic ? "bg-red-400/5 border border-red-400/20" : "bg-primary/5"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-foreground/70 flex-1 mr-4 truncate">
                      <span className={`font-bold mr-2 ${isCurrent ? "text-accent" : "text-foreground/40"}`}>Q{i + 1}</span>
                      {qs.text}
                    </span>
                    <div className="flex items-center gap-2">
                      {qs.totalAnswers > 0 && (
                        <span className="text-xs text-foreground/30">{qs.totalAnswers} odp.</span>
                      )}
                      <span className={`text-sm font-bold ${qs.totalAnswers === 0 ? "text-foreground/20" : isProblematic ? "text-red-400" : "text-green-400"}`}>
                        {qs.totalAnswers > 0 ? `${correctPct}%` : "–"}
                      </span>
                    </div>
                  </div>
                  {qs.totalAnswers > 0 && (
                    <div className="flex h-4 rounded-full overflow-hidden bg-primary/10">
                      <div className="bg-green-400 transition-all duration-500" style={{ width: `${(qs.correctFirst / maxBar) * 100}%` }} />
                      <div className="bg-yellow-400 transition-all duration-500" style={{ width: `${(qs.correctSecond / maxBar) * 100}%` }} />
                      <div className="bg-red-400 transition-all duration-500" style={{ width: `${(qs.wrong / maxBar) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* Student table */}
        <section className="border border-primary/30 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-accent mb-4">Žáci</h2>
          {studentResults.length === 0 ? (
            <p className="text-foreground/40 text-sm">Zatím žádné odpovědi. Čekám na žáky...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/20">
                    <th className="py-2 px-3 text-left text-foreground/50">Žák</th>
                    {!hideResults && (
                      <>
                        <th className="py-2 px-3 text-left text-foreground/50">Skill 💎</th>
                        <th className="py-2 px-3 text-left text-foreground/50">Skill 🔄</th>
                        <th className="py-2 px-3 text-left text-foreground/50">Skóre</th>
                      </>
                    )}
                    <th className="py-2 px-3 text-left text-foreground/50">Čas</th>
                    <th className="py-2 px-3 text-left text-foreground/50">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {studentResults.map((sr) => {
                    const needsHelp = sr.consecutiveWrong >= 2;
                    // Skill counters z dual-skill systému
                    let presnost = 0;
                    let praceSChybou = 0;
                    for (const ans of Array.from(sr.answers.values())) {
                      if (ans.isCorrect && ans.attemptNo === 1) presnost++;
                      else if (ans.isCorrect && ans.attemptNo > 1) praceSChybou++;
                    }

                    return (
                      <tr key={sr.studentId} className={`border-b border-primary/10 ${!hideResults && needsHelp ? "bg-red-400/5" : ""}`}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{sr.avatarEmoji}</span>
                            <div>
                              <span className="text-white text-sm">{sr.displayName}</span>
                              <span className="text-foreground/30 text-xs ml-2 font-mono">{sr.studentCode}</span>
                            </div>
                          </div>
                        </td>
                        {!hideResults && (
                          <>
                            <td className="py-2 px-3">
                              <span className="text-cyan-300 font-bold">💎 {presnost}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-purple-300 font-bold">🔄 {praceSChybou}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-accent">{sr.xp} XP</span>
                              <span className="text-foreground/40 ml-1">({sr.score}/{sr.total})</span>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-3 text-foreground/60">{Math.round(sr.totalTime / 1000)}s</td>
                        <td className="py-2 px-3">
                          {hideResults ? (
                            sr.total >= questions.length ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300">Dokončil/a</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300">Probíhá ({sr.total}/{questions.length})</span>
                            )
                          ) : needsHelp ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/20 text-red-400">Potřebuje podporu</span>
                          ) : sr.total >= currentQuestion ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/20 text-green-400">Odpověděl/a</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300">Probíhá</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
