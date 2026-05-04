"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Question, Activity, Session, ActivityMode } from "@/types";
import ABDecision from "@/components/ABDecision";
import TeamForge from "@/components/TeamForge";
import LobbyWaitingScreen from "@/components/LobbyWaitingScreen";
import PitchDuel from "@/components/PitchDuel";
import MultiActivity from "@/components/multi-activity/MultiActivity";
import BrainstormStep from "@/components/multi-activity/BrainstormStep";
import VotingStep from "@/components/multi-activity/VotingStep";
import PhotoStep from "@/components/multi-activity/PhotoStep";
import RoleSelectionStep from "@/components/multi-activity/RoleSelectionStep";
import TeamAssemblyStep from "@/components/multi-activity/TeamAssemblyStep";
import { toOpenSub, toPeerReviewSub, toGroupWorkSub, isQuizLikeActivity } from "@/lib/lesson-adapters";
import {
  calcXp, getQuestionMode,
  GROWTH_CORRECTED_MSGS,
  GROWTH_TIMEOUT_MSG, GROWTH_ASSESSMENT_MSG,
  SKILL_MSG_PRESNOST, SKILL_MSG_PRACE_S_CHYBOU, SKILL_MSG_WRONG,
} from "@/types";

interface StudentAuth {
  studentId: string;
  classId: string;
  code: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
}

export default function LekcePage({ params }: { params: { code: string } }) {
  const [auth, setAuth] = useState<StudentAuth | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  // Lesson-mode state (when session.lesson_id is set). Lesson běží lockstep s učitelem:
  // server `current_activity_index` je zdroj pravdy, polling detekuje změnu a překlopí UI.
  const [lessonTitle, setLessonTitle] = useState<string>("");
  const [lessonActivities, setLessonActivities] = useState<Activity[]>([]);
  const [lessonActivityIds, setLessonActivityIds] = useState<string[]>([]);   // la_id per index
  const [skippedLaIds, setSkippedLaIds] = useState<Set<string>>(new Set());   // skipped lesson_activity ids
  const [currentActivityIdx, setCurrentActivityIdx] = useState(0);
  const currentActivityIdxRef = useRef(0);
  const [activityCompleted, setActivityCompleted] = useState(false);
  const lessonActivitiesRef = useRef<Activity[]>([]);
  const lessonActivityIdsRef = useRef<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teacherQ, setTeacherQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [phase, setPhase] = useState<"waiting" | "answering" | "explaining" | "hint" | "result" | "waiting-next" | "finished">("waiting");
  const [xpGained, setXpGained] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [showXp, setShowXp] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "corrected" | "wrong" | "skip" | "timeout">("correct");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [activityMode, setActivityMode] = useState<ActivityMode>("learning");
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const answeredRef = useRef<Set<number>>(new Set());
  const pendingAnswerRef = useRef<{ key: string; durationMs: number } | null>(null);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string>("");
  const router = useRouter();

  // Load session + activity
  useEffect(() => {
    const stored = localStorage.getItem("inj-student");
    if (!stored) {
      router.replace("/");
      return;
    }
    const parsed: StudentAuth = JSON.parse(stored);
    setAuth(parsed);

    async function load() {
      // Don't filter by is_active - student might join while session is temporarily toggled
      const { data: sess } = await supabase
        .from("sessions")
        .select("*, activities(*)")
        .eq("code", params.code)
        .single();

      if (!sess || !sess.activities) {
        router.replace("/zak/profil");
        return;
      }

      setSession(sess as Session);
      sessionIdRef.current = sess.id;
      setActivityMode((sess.activity_mode as ActivityMode) || "learning");
      setTimerSeconds(sess.timer_seconds ?? null);
      let act = sess.activities as unknown as Activity;

      // Record join event so teacher sees this student (avoid duplicates)
      const { data: existing } = await supabase
        .from("student_events")
        .select("id")
        .eq("student_id", parsed.studentId)
        .eq("session_id", sess.id)
        .eq("event_type", "join")
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("student_events").insert({
          student_id: parsed.studentId,
          session_id: sess.id,
          question_id: "__join__",
          event_type: "join",
          answer: null,
          is_correct: false,
          attempt_no: 0,
          duration_ms: 0,
        });
      }

      // LESSON MODE — načti lesson_activities a překlop `act` na current activity.
      // Dál pokračuje normální init (kvíz se chová jako single-activity Kahoot).
      if (sess.lesson_id) {
        const [{ data: lRow }, { data: laRows }] = await Promise.all([
          supabase.from("lessons").select("title").eq("id", sess.lesson_id).single(),
          supabase
            .from("lesson_activities")
            .select("id, activity:activities(*)")
            .eq("lesson_id", sess.lesson_id)
            .order("order_index", { ascending: true }),
        ]);
        setLessonTitle(lRow?.title ?? act.title);
        const rows = (laRows ?? []) as unknown as Array<{ id: string; activity: Activity }>;
        const acts = rows.map((r) => r.activity).filter(Boolean);
        const ids = rows.map((r) => r.id);
        setLessonActivities(acts);
        setLessonActivityIds(ids);
        lessonActivitiesRef.current = acts;
        lessonActivityIdsRef.current = ids;
        // Skipped activities pro tuto session (per-session override)
        const skippedArr = Array.isArray(sess.skipped_activity_ids) ? sess.skipped_activity_ids as string[] : [];
        setSkippedLaIds(new Set(skippedArr));
        const idx = sess.current_activity_index ?? 0;
        setCurrentActivityIdx(idx);
        currentActivityIdxRef.current = idx;
        if (acts[idx]) act = acts[idx];
      }

      setActivity(act);
      setQuestions(act.questions ?? []);
      setTeacherQ(sess.current_question ?? 0);

      // Legacy multi-activity (sub_activities JSONB) — vlastní self-paced runner
      if (act.type === "multi_activity") {
        setLoading(false);
        return;
      }

      // Non-quiz aktivita v rámci lekce — žádné Kahoot otázky, render step.
      if (sess.lesson_id && !isQuizLikeActivity(act.type)) {
        // Detekce zda už student v této session aktivitu odevzdal
        const { data: completionEvents } = await supabase
          .from("student_events")
          .select("event_type")
          .eq("student_id", parsed.studentId)
          .eq("session_id", sess.id)
          .eq("question_id", act.id)
          .in("event_type", ["text_submit", "photo_upload", "peer_rating", "activity_complete"])
          .limit(1);
        setActivityCompleted((completionEvents?.length ?? 0) > 0);
        setLoading(false);
        return;
      }

      // Quiz-like aktivita: standardní Kahoot init.
      // Načti už zodpovězené otázky (filtrované podle current activity ID — pro lekce).
      let answeredQ = supabase
        .from("student_events")
        .select("question_id")
        .eq("student_id", parsed.studentId)
        .eq("session_id", sess.id)
        .eq("event_type", "answer");
      if (sess.lesson_id) {
        // Otázky z předchozích aktivit ignoruj — patří jiné aktivitě.
        const currentQuestionIds = (act.questions ?? []).map((q: Question) => q.id);
        if (currentQuestionIds.length > 0) {
          answeredQ = answeredQ.in("question_id", currentQuestionIds);
        }
      }
      const { data: events } = await answeredQ;

      const answered = new Set<number>();
      if (events) {
        for (const e of events) {
          const idx = (act.questions ?? []).findIndex((q: Question) => q.id === e.question_id);
          if (idx >= 0) answered.add(idx);
        }
      }
      answeredRef.current = answered;

      const cq = sess.current_question ?? 0;
      const isOpen = sess.answering_open ?? true;
      if (answered.has(cq) || !isOpen) {
        setPhase("waiting-next");
      } else {
        setPhase("answering");
        startTimeRef.current = Date.now();
      }

      setLoading(false);
    }

    load();
  }, [router, params.code]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "answering" || !timerSeconds) return;
    setTimeLeft(timerSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time up - auto-submit as skip
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, teacherQ, timerSeconds]);

  function handleTimeUp() {
    if (!auth || !questions[teacherQ]) return;
    const durationMs = timerSeconds ? timerSeconds * 1000 : 0;
    supabase.from("student_events").insert({
      student_id: auth.studentId,
      session_id: sessionIdRef.current,
      question_id: questions[teacherQ].id,
      event_type: "timeout",
      answer: null,
      is_correct: false,
      attempt_no: attempt,
      duration_ms: durationMs,
    });
    answeredRef.current = new Set(answeredRef.current).add(teacherQ);
    setLastResult("timeout");
    setQuestionNumber((n) => n + 1);
    setXpGained(0);
    setPhase("result");
    setTimeout(() => setPhase("waiting-next"), 2000);
  }

  // Poll teacher's session state every 3 seconds.
  // V lesson módu sleduje navíc `current_activity_index` — když se změní, překlopí UI na novou aktivitu.
  const pollSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    const { data } = await supabase
      .from("sessions")
      .select("current_question, current_activity_index, lesson_id, is_active, answering_open, status, teacher_heartbeat, skipped_activity_ids")
      .eq("id", sessionIdRef.current)
      .single();

    if (!data) return;

    // Heartbeat — pokud učitel "umřel" (>15 s bez heartbeat), pošli žáka na profil
    if (data.teacher_heartbeat) {
      const hbAge = Date.now() - new Date(data.teacher_heartbeat).getTime();
      if (hbAge > 15000 && data.is_active) {
        router.replace("/zak/profil");
        return;
      }
    }

    if (!data.is_active) {
      const status = data.status || "closed";
      if (status === "closed") {
        setPhase("finished");
      } else {
        router.replace("/zak/profil");
      }
      return;
    }

    // Synchronizuj session.status do local state (kvůli lobby fázi mid-lesson)
    setSession((prev) => prev && prev.status !== data.status ? { ...prev, status: data.status } : prev);

    // LESSON MODE — detekuj změnu current_activity_index, překlop na novou aktivitu.
    // Při každé změně načti FRESH lesson_activities z DB (učitel mohl mezitím editovat
    // aktivity nebo update typ — držet stale cache by způsobilo "není podporována" fallback).
    const newActIdx = data.current_activity_index ?? 0;
    if (data.lesson_id) {
      const prevIdx = currentActivityIdxRef.current;
      // Refresh skipped IDs (učitel mohl mezitím upravit; dohrát i pro stávající session)
      const skippedArr = Array.isArray(data.skipped_activity_ids) ? data.skipped_activity_ids as string[] : [];
      setSkippedLaIds(new Set(skippedArr));
      if (newActIdx !== prevIdx) {
        const { data: laRows } = await supabase
          .from("lesson_activities")
          .select("id, activity:activities(*)")
          .eq("lesson_id", data.lesson_id)
          .order("order_index", { ascending: true });
        const rows = (laRows ?? []) as unknown as Array<{ id: string; activity: Activity }>;
        const freshActs = rows.map((r) => r.activity).filter(Boolean);
        const freshIds = rows.map((r) => r.id);
        if (freshActs.length > 0) {
          setLessonActivities(freshActs);
          setLessonActivityIds(freshIds);
          lessonActivitiesRef.current = freshActs;
          lessonActivityIdsRef.current = freshIds;
        }
        const newAct = (freshActs[newActIdx] ?? lessonActivitiesRef.current[newActIdx]);
        if (newAct) {
          setActivity(newAct);
          setQuestions(newAct.questions ?? []);
          setSelected(null);
          setAttempt(1);
          setActivityCompleted(false);
          answeredRef.current = new Set();
          setTeacherQ(0);
          if (isQuizLikeActivity(newAct.type)) {
            setPhase((data.answering_open ?? true) ? "answering" : "waiting-next");
            startTimeRef.current = Date.now();
          } else {
            setPhase("answering"); // step component se vyrenderuje
          }
          setCurrentActivityIdx(newActIdx);
          currentActivityIdxRef.current = newActIdx;
        }
      }
      // V non-quiz lesson aktivitě dál nesleduj current_question
      const acts = lessonActivitiesRef.current;
      const curAct = acts[newActIdx];
      if (curAct && !isQuizLikeActivity(curAct.type)) return;
    }

    const newQ = data.current_question ?? 0;
    const open = data.answering_open ?? true;

    setTeacherQ((prevQ) => {
      if (newQ !== prevQ) {
        if (newQ >= questions.length) {
          // V lesson módu to znamená "kvíz dokončen, čeká se na učitele další aktivitu"
          // — ale finished phase je vyloženě konec celé session, takže to vyřešíme renderingem.
          setPhase("finished");
        } else if (!answeredRef.current.has(newQ)) {
          setSelected(null);
          setAttempt(1);
          setPhase(open ? "answering" : "waiting-next");
          startTimeRef.current = Date.now();
        } else {
          setPhase("waiting-next");
        }
      } else if (!open && !answeredRef.current.has(newQ)) {
        setPhase("waiting-next");
      }
      return newQ;
    });
  }, [questions.length, router]);

  useEffect(() => {
    if (loading) return;
    if (activity?.type === "multi_activity" && !session?.lesson_id) return;   // legacy self-paced bez lesson_id
    const interval = setInterval(pollSession, 3000);
    return () => clearInterval(interval);
  }, [loading, pollSession, activity?.type, session?.lesson_id]);

  const saveEvent = useCallback(
    async (answer: string | null, isCorrect: boolean, attemptNo: number, durationMs: number) => {
      if (!auth || !questions[teacherQ]) return;
      await supabase.from("student_events").insert({
        student_id: auth.studentId,
        session_id: sessionIdRef.current,
        question_id: questions[teacherQ].id,
        event_type: "answer",
        answer,
        is_correct: isCorrect,
        attempt_no: attemptNo,
        duration_ms: durationMs,
      });
    },
    [auth, questions, teacherQ]
  );

  // Called after explanation is submitted for ab_with_explanation
  function finishAnswer() {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    pendingAnswerRef.current = null;
    evaluateAnswer(pending.key, pending.durationMs);
  }

  function handleAnswer(key: string) {
    if (phase !== "answering") return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[teacherQ];
    const durationMs = Date.now() - startTimeRef.current;

    setSelected(key);

    // AB with explanation: pause for explanation before evaluation
    if (q.question_type === "ab_with_explanation" && q.requires_explanation) {
      pendingAnswerRef.current = { key, durationMs };
      setPhase("explaining");
      return;
    }

    evaluateAnswer(key, durationMs);
  }

  function evaluateAnswer(key: string, durationMs: number) {
    const q = questions[teacherQ];
    const isCorrect = key === q.correct;
    const mode = getQuestionMode(activityMode, q);

    if (mode === "assessment") {
      // Assessment: jeden pokus, bez hintu, BEZ feedback (žádné XP popup, žádný správně/špatně)
      // XP a skill countery se počítají na pozadí — žák je uvidí až po dokončení testu.
      const xp = calcXp("assessment", isCorrect, 1, durationMs);
      setXpGained(xp);
      setTotalXp((prev) => prev + xp);
      saveEvent(key, isCorrect, 1, durationMs);
      answeredRef.current = new Set(answeredRef.current).add(teacherQ);
      setLastResult(isCorrect ? "correct" : "wrong");
      setQuestionNumber((n) => n + 1);
      setPhase("result");
      setTimeout(() => setPhase("waiting-next"), 1500);
    } else {
      // Learning: více pokusů, hint, socratic feedback
      if (isCorrect) {
        const xp = calcXp("learning", true, attempt, durationMs);
        setXpGained(xp);
        setTotalXp((prev) => prev + xp);
        setShowXp(true);
        setTimeout(() => setShowXp(false), 1200);
        saveEvent(key, true, attempt, durationMs);
        answeredRef.current = new Set(answeredRef.current).add(teacherQ);
        setLastResult(attempt > 1 ? "corrected" : "correct");
        setQuestionNumber((n) => n + 1);
        setPhase("result");
        setTimeout(() => setPhase("waiting-next"), 3000);
      } else if (attempt === 1) {
        saveEvent(key, false, 1, durationMs);
        setPhase("hint");
      } else {
        const xp = calcXp("learning", false, attempt, durationMs);
        setXpGained(xp);
        setTotalXp((prev) => prev + xp);
        saveEvent(key, false, 2, durationMs);
        answeredRef.current = new Set(answeredRef.current).add(teacherQ);
        setLastResult("wrong");
        setQuestionNumber((n) => n + 1);
        setPhase("result");
        setTimeout(() => setPhase("waiting-next"), 3000);
      }
    }
  }

  function handleRetry() {
    setAttempt(2);
    setSelected(null);
    setPhase("answering");
    startTimeRef.current = Date.now();
  }

  function handleSkip() {
    if (!auth || !questions[teacherQ]) return;
    if (timerRef.current) clearInterval(timerRef.current);
    supabase.from("student_events").insert({
      student_id: auth.studentId,
      session_id: sessionIdRef.current,
      question_id: questions[teacherQ].id,
      event_type: "skip",
      answer: null,
      is_correct: false,
      attempt_no: attempt,
      duration_ms: Date.now() - startTimeRef.current,
    });
    answeredRef.current = new Set(answeredRef.current).add(teacherQ);
    setLastResult("skip");
    setQuestionNumber((n) => n + 1);
    setPhase("waiting-next");
  }

  function handleWaitNext() {
    setPhase("waiting-next");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl font-bold text-accent mb-4">Cesta inovátora</div>
          <p className="text-foreground/60">Načítání kvízu...</p>
        </div>
      </main>
    );
  }

  // Lobby phase: student waits for teacher to compose groups
  if (activity?.requires_grouping && session?.status === "lobby" && auth) {
    return (
      <LobbyWaitingScreen
        sessionId={session.id}
        studentId={auth.studentId}
        studentName={auth.displayName}
        studentEmoji={auth.avatarEmoji}
        activityTitle={activity.title}
      />
    );
  }

  // Game-type activities have their own UI
  if (activity?.type === "team_forge" && auth && session) {
    return (
      <TeamForge
        auth={{
          studentId: auth.studentId,
          classId: auth.classId,
          displayName: auth.displayName,
          avatarEmoji: auth.avatarEmoji,
          avatarColor: auth.avatarColor,
        }}
        sessionId={session.id}
        activityId={activity.id}
      />
    );
  }

  if (activity?.type === "pitch_duel" && auth && session) {
    return (
      <PitchDuel
        auth={{
          studentId: auth.studentId,
          classId: auth.classId,
          displayName: auth.displayName,
          avatarEmoji: auth.avatarEmoji,
          avatarColor: auth.avatarColor,
        }}
        sessionId={session.id}
      />
    );
  }

  // LESSON MODE — non-quiz aktivita: render step komponentu nebo "Hotovo, čekej" screen
  if (session?.lesson_id && activity && auth && !isQuizLikeActivity(activity.type)) {
    const order = currentActivityIdx + 1;

    if (activityCompleted) {
      return (
        <LessonShell
          lessonTitle={lessonTitle}
          activities={lessonActivities}
          activityIds={lessonActivityIds}
          skipped={skippedLaIds}
          currentIdx={currentActivityIdx}
          studentEmoji={auth.avatarEmoji}
          totalXp={totalXp}
        >
          <ActivityWaitingScreen activityTitle={activity.title} />
        </LessonShell>
      );
    }

    const onComplete = (xpGained: number) => {
      setTotalXp((p) => p + xpGained);
      setActivityCompleted(true);
    };

    let stepEl: React.ReactNode = null;
    if (activity.type === "open") {
      const sub = toOpenSub(activity, order);
      stepEl = <BrainstormStep subActivity={sub} studentId={auth.studentId} sessionId={session.id} onComplete={onComplete} />;
    } else if (activity.type === "peer_review") {
      const sub = toPeerReviewSub(activity, order);
      stepEl = <VotingStep subActivity={sub} studentId={auth.studentId} sessionId={session.id} onComplete={onComplete} />;
    } else if (activity.type === "photo_upload" || activity.type === "group_work") {
      const sub = toGroupWorkSub(activity, order);
      if (sub) {
        stepEl = <PhotoStep subActivity={sub} studentId={auth.studentId} sessionId={session.id} onComplete={onComplete} />;
      }
    } else if (activity.type === "role_selection") {
      stepEl = (
        <RoleSelectionStep
          activityId={activity.id}
          studentId={auth.studentId}
          sessionId={session.id}
          classId={auth.classId}
          xp={(activity.config?.xp_complete as number | undefined) ?? 50}
          onComplete={onComplete}
        />
      );
    } else if (activity.type === "team_assembly") {
      stepEl = (
        <TeamAssemblyStep
          activityId={activity.id}
          studentId={auth.studentId}
          sessionId={session.id}
          lessonId={session.lesson_id ?? null}
          votingActivityId={activity.config?.voting_activity_id as string | undefined}
          brainstormActivityId={activity.config?.brainstorm_activity_id as string | undefined}
          xp={(activity.config?.xp_complete as number | undefined) ?? 60}
          onComplete={onComplete}
        />
      );
    }

    if (!stepEl) {
      stepEl = (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-5 text-yellow-200/80 text-sm">
          Aktivita typu <code className="bg-background/60 px-1.5 py-0.5 rounded">{activity.type}</code> není v žákovském flow lekce zatím podporována.
        </div>
      );
    }

    return (
      <LessonShell
        lessonTitle={lessonTitle}
        activities={lessonActivities}
        activityIds={lessonActivityIds}
        skipped={skippedLaIds}
        currentIdx={currentActivityIdx}
        studentEmoji={auth.avatarEmoji}
        totalXp={totalXp}
      >
        {stepEl}
      </LessonShell>
    );
  }

  // LEGACY: multi_activity (sub_activities JSONB)
  if (activity?.type === "multi_activity" && auth && session) {
    return (
      <MultiActivity
        activity={activity}
        session={session}
        studentId={auth.studentId}
        studentEmoji={auth.avatarEmoji}
      />
    );
  }

  // Finished screen
  if (phase === "finished") {
    // LESSON MODE: pokud jsme dokončili kvíz uvnitř lekce, ale lekce ještě běží
    // (session je is_active=true), čekáme na učitele, který spustí další aktivitu.
    // Je ještě některá další (ne-skipped) aktivita za aktuální? (Pokud ne, jsme na poslední.)
    const hasMoreNonSkipped = lessonActivityIds.some((laId, idx) => idx > currentActivityIdx && !skippedLaIds.has(laId));
    const lessonStillRunning = !!session?.lesson_id && session.is_active && hasMoreNonSkipped;
    if (lessonStillRunning && auth) {
      return (
        <LessonShell
          lessonTitle={lessonTitle}
          activities={lessonActivities}
          activityIds={lessonActivityIds}
          skipped={skippedLaIds}
          currentIdx={currentActivityIdx}
          studentEmoji={auth.avatarEmoji}
          totalXp={totalXp}
        >
          <ActivityWaitingScreen activityTitle={activity?.title ?? "Aktivita"} />
        </LessonShell>
      );
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center animate-fade-in max-w-md">
          <div className="text-6xl mb-6">&#127942;</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            {session?.lesson_id ? "Lekce dokončena!" : "Kvíz dokončen!"}
          </h1>
          <div className="text-5xl font-bold text-accent mb-2">{totalXp} XP</div>
          <p className="text-foreground/50 mb-8">{session?.lesson_id ? lessonTitle : activity?.title}</p>
          <button
            onClick={() => router.push("/zak/profil")}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
          >
            Zpět na profil
          </button>
        </div>
      </main>
    );
  }

  // Waiting for teacher — krátká zpráva podle posledního výsledku.
  // V assessment módu nedáváme hodnocení (žák nezná správnost) — jen "Odpověď uložena ✓".
  if (phase === "waiting" || phase === "waiting-next") {
    const isAssessment = activityMode === "assessment";
    let msg = "Připojeno!";
    if (phase === "waiting-next") {
      if (isAssessment) {
        msg = GROWTH_ASSESSMENT_MSG;
      } else if (lastResult === "corrected") {
        msg = SKILL_MSG_PRACE_S_CHYBOU;
      } else if (lastResult === "correct") {
        msg = SKILL_MSG_PRESNOST;
      } else {
        msg = SKILL_MSG_WRONG;
      }
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-6">{auth?.avatarEmoji || "🦊"}</div>
          {phase === "waiting" ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-3">Připojeno!</h2>
              <p className="text-foreground/50 mb-2">Čekej na učitele, až spustí první otázku</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-accent mb-3 animate-fade-in">{msg}</h2>
              <p className="text-foreground/50 mb-2">Čekej na další otázku</p>
            </>
          )}
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-foreground/40 text-sm">Sleduji...</span>
          </div>
          {!isAssessment && (
            <div className="mt-6 text-3xl font-bold text-accent">{totalXp} XP</div>
          )}
        </div>
      </main>
    );
  }

  const q = questions[teacherQ];
  if (!q) return null;

  const progress = ((answeredRef.current.size) / questions.length) * 100;

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-foreground/50 text-sm">
            Otázka {teacherQ + 1} / {questions.length}
          </span>
          {/* Assessment: žák nevidí XP počítadlo během testu (žádný feedback) */}
          {activityMode !== "assessment" && (
            <span className="text-accent font-bold text-sm">{totalXp} XP</span>
          )}
        </div>
        <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timer */}
      {timerSeconds && phase === "answering" && (
        <div className="px-4 pt-2">
          <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? "bg-red-500" : timeLeft <= 10 ? "bg-yellow-400" : "bg-accent"}`}
              style={{ width: `${(timeLeft / timerSeconds) * 100}%` }}
            />
          </div>
          <p className={`text-right text-xs mt-1 ${timeLeft <= 5 ? "text-red-400 font-bold" : "text-foreground/40"}`}>{timeLeft}s</p>
        </div>
      )}

      {/* Question */}
      <div className="flex-1 flex flex-col px-4 pb-6 pt-4">
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${q.difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300" : "bg-accent/20 text-accent"}`}>
              {q.difficulty === "advanced" ? "Pokročilé" : "Základní"}
            </span>
            <span className="text-sm" title={getQuestionMode(activityMode, q) === "assessment" ? "Ověření" : "Procvičování"}>
              {getQuestionMode(activityMode, q) === "assessment" ? "📊" : "🎓"}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 leading-relaxed">
            {q.text}
          </h2>
        </div>

        {/* Options - different render by question type */}
        {(q.question_type === "ab_decision" || q.question_type === "ab_with_explanation") ? (
          <ABDecision
            options={q.options}
            correct={q.correct}
            selected={selected}
            phase={phase as "answering" | "explaining" | "hint" | "result" | "waiting-next"}
            attempt={attempt}
            requiresExplanation={q.question_type === "ab_with_explanation" && q.requires_explanation}
            explanationPrompt={q.explanation_prompt}
            onSelect={(key) => handleAnswer(key)}
            onExplanationSubmit={(text) => {
              if (!auth) return;
              // Save explanation
              supabase.from("student_events").insert({
                student_id: auth.studentId,
                session_id: sessionIdRef.current,
                question_id: q.id,
                event_type: "text_submit",
                answer: text,
                is_correct: false,
                attempt_no: 0,
                duration_ms: 0,
              });
              // Now evaluate the answer
              finishAnswer();
            }}
          />
        ) : (
          <div className="flex flex-col gap-3 flex-1">
            {q.options.map((opt) => {
              let btnClass = "border-2 border-primary/40 hover:border-accent/60 hover:bg-primary/10";
              const qMode = getQuestionMode(activityMode, q);

              if (phase === "result" || phase === "hint") {
                if (qMode === "assessment") {
                  if (opt.key === selected) btnClass = "border-2 border-accent bg-accent/10";
                  else btnClass = "border-2 border-primary/20 opacity-50";
                } else {
                  if (opt.key === q.correct && phase === "result") btnClass = "border-2 border-green-400 bg-green-400/10";
                  else if (opt.key === selected && selected !== q.correct) btnClass = "border-2 border-red-400 bg-red-400/10";
                  else btnClass = "border-2 border-primary/20 opacity-50";
                }
              }
              if (phase === "hint" && opt.key === selected) btnClass = "border-2 border-red-400 bg-red-400/10";

              return (
                <button key={opt.key} onClick={() => handleAnswer(opt.key)} disabled={phase !== "answering"}
                  className={`w-full text-left py-4 px-5 rounded-xl transition-all duration-200 ${btnClass}`}>
                  <span className="font-bold text-accent mr-3">{opt.key}</span>
                  <span className="text-white">{opt.text}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Skip button - only in learning mode */}
        {(phase === "answering" || phase === "hint") && getQuestionMode(activityMode, q) === "learning" && (
          <button
            onClick={handleSkip}
            className="mt-3 text-sm text-foreground/30 hover:text-foreground/50 transition-colors text-center py-2"
          >
            Přeskočit otázku
          </button>
        )}

        {/* XP popup */}
        {showXp && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="text-4xl font-bold text-accent animate-xp-pop">
              +{xpGained} XP
            </div>
          </div>
        )}

        {/* Hint phase */}
        {phase === "hint" && (
          <div className="mt-4 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-xl animate-fade-in">
            <p className="text-yellow-300 font-semibold text-sm mb-2">Nápověda:</p>
            <p className="text-foreground/80">{q.hint_level_1}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
              >
                Zkusit znovu
              </button>
              <button
                onClick={handleSkip}
                className="py-3 px-5 border border-primary/30 text-foreground/50 hover:text-white rounded-xl transition-colors text-sm"
              >
                Přeskočit
              </button>
            </div>
          </div>
        )}

        {/* Result phase - auto-transitions to waiting */}
        {phase === "result" && (() => {
          const qMode = getQuestionMode(activityMode, q);
          const isAssessment = qMode === "assessment";
          const countdownDuration = isAssessment ? 2 : 3;

          return (
            <div className={`mt-4 p-5 rounded-xl animate-fade-in ${
              isAssessment
                ? "bg-primary/10 border border-primary/30"  // neutral — neprozradí správnost
                : selected === q.correct && attempt > 1
                ? "bg-green-400/10 border border-green-400/30"
                : selected === q.correct
                ? "bg-accent/10 border border-accent/30"
                : "bg-yellow-400/10 border border-yellow-400/30"
            }`}>
              <div className="text-center mb-3">
                {/* Assessment: žádné XP ani hodnocení v průběhu — výsledky až po dokončení testu */}
                {!isAssessment && xpGained > 0 && (
                  <div className="text-3xl font-bold text-accent mb-1">+{xpGained} XP</div>
                )}
                {isAssessment ? (
                  <p className="text-foreground/60 font-bold">{GROWTH_ASSESSMENT_MSG}</p>
                ) : lastResult === "timeout" ? (
                  <p className="text-red-400 font-bold">{GROWTH_TIMEOUT_MSG}</p>
                ) : lastResult === "corrected" ? (
                  <p className="text-green-400 font-bold text-lg">{SKILL_MSG_PRACE_S_CHYBOU}</p>
                ) : selected === q.correct ? (
                  <p className="text-accent font-bold">{SKILL_MSG_PRESNOST}</p>
                ) : (
                  <p className="text-yellow-300 font-bold">{SKILL_MSG_WRONG}</p>
                )}
              </div>
              {/* V assessment módu neukazujeme vysvětlení (žák nemá vědět správnost během testu) */}
              {!isAssessment && <p className="text-foreground/60 text-sm text-center">{q.explanation}</p>}
              <div className="mt-4 w-full h-1 bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ animation: `countdown ${countdownDuration}s linear forwards` }} />
              </div>
            </div>
          );
        })()}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lesson UI helpers — společný shell pro non-quiz aktivity v lekci.
// (Quiz aktivita má vlastní top bar s otázkami uvnitř hlavního renderu.)
// ─────────────────────────────────────────────────────────────────────────

function LessonShell({
  lessonTitle, activities, activityIds, skipped, currentIdx, studentEmoji, totalXp, children,
}: {
  lessonTitle: string;
  activities: Activity[];
  activityIds: string[];      // la_id at same index
  skipped: Set<string>;
  currentIdx: number;
  studentEmoji: string;
  totalXp: number;
  children: React.ReactNode;
}) {
  // Filtruj jen non-skipped aktivity (skip se v UI ignoruje úplně)
  const visibleIdx: number[] = [];
  for (let i = 0; i < activities.length; i++) {
    if (!skipped.has(activityIds[i])) visibleIdx.push(i);
  }
  const visibleTotal = visibleIdx.length;
  const visibleCurrent = visibleIdx.indexOf(currentIdx);
  const current = activities[currentIdx];
  return (
    <main className="min-h-screen bg-background">
      <header className="px-4 pt-4 pb-3 border-b border-primary/20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{lessonTitle}</h1>
              {current && (
                <p className="text-foreground/50 text-xs mt-0.5">
                  Aktivita {Math.max(visibleCurrent, 0) + 1} z {visibleTotal} · {current.title}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl">{studentEmoji}</div>
              <div className="text-accent font-bold text-sm">{totalXp} XP</div>
            </div>
          </div>
          <ProgressDots total={visibleTotal} current={Math.max(visibleCurrent, 0)} />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
    </main>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2 w-full">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done
                  ? "bg-accent text-background"
                  : active
                  ? "bg-accent/20 text-accent border-2 border-accent"
                  : "bg-primary/20 text-foreground/40 border-2 border-primary/30"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-1 rounded-full ${done ? "bg-accent" : "bg-primary/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityWaitingScreen({ activityTitle }: { activityTitle: string }) {
  return (
    <div className="text-center py-12 animate-fade-in">
      <div className="text-6xl mb-4">⏸️</div>
      <h2 className="text-2xl font-bold text-white mb-2">Aktivita dokončena</h2>
      <p className="text-foreground/60 text-sm mb-1">{activityTitle}</p>
      <p className="text-foreground/40 text-sm mt-4">Čekej, až učitel spustí další aktivitu…</p>
      <div className="flex items-center justify-center gap-2 mt-6">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-foreground/40 text-xs">Sleduji</span>
      </div>
    </div>
  );
}
