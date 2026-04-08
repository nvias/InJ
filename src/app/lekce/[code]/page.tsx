"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Question, Activity, Session, ActivityMode, AssessmentMode, QuestionType } from "@/types";
import ABDecision from "@/components/ABDecision";
import TeamForge from "@/components/TeamForge";
import LobbyWaitingScreen from "@/components/LobbyWaitingScreen";
import PitchDuel from "@/components/PitchDuel";
import {
  calcXp, getQuestionMode, pickMessage,
  GROWTH_CORRECT_MSGS, GROWTH_CORRECTED_MSGS, GROWTH_WRONG_MSGS,
  GROWTH_SKIP_MSG, GROWTH_TIMEOUT_MSG, GROWTH_ASSESSMENT_MSG,
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
      const act = sess.activities as unknown as Activity;
      setActivity(act);
      setQuestions(act.questions);
      setTeacherQ(sess.current_question ?? 0);

      // Record join event so teacher sees this student
      // Check if already joined to avoid duplicates
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

      // Load already answered questions
      const { data: events } = await supabase
        .from("student_events")
        .select("question_id")
        .eq("student_id", parsed.studentId)
        .eq("session_id", sess.id)
        .neq("event_type", "join");

      const answered = new Set<number>();
      if (events) {
        for (const e of events) {
          const idx = act.questions.findIndex((q: Question) => q.id === e.question_id);
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

  // Poll teacher's current_question every 3 seconds
  const pollSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    const { data } = await supabase
      .from("sessions")
      .select("current_question, is_active, answering_open, status, teacher_heartbeat")
      .eq("id", sessionIdRef.current)
      .single();

    if (!data) return;

    // Check teacher heartbeat - if > 15s old, teacher disconnected
    if (data.teacher_heartbeat) {
      const hbAge = Date.now() - new Date(data.teacher_heartbeat).getTime();
      if (hbAge > 15000 && data.is_active) {
        // Teacher disconnected but session not yet paused
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

    const newQ = data.current_question ?? 0;
    const open = data.answering_open ?? true;

    setTeacherQ((prevQ) => {
      if (newQ !== prevQ) {
        if (newQ >= questions.length) {
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
        // Teacher closed answering while student hasn't answered yet
        setPhase("waiting-next");
      }
      return newQ;
    });
  }, [questions.length]);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(pollSession, 3000);
    return () => clearInterval(interval);
  }, [loading, pollSession]);

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
      // Assessment: jeden pokus, bez hintu
      const xp = calcXp("assessment", isCorrect, 1, durationMs);
      setXpGained(xp);
      setTotalXp((prev) => prev + xp);
      if (xp > 0) { setShowXp(true); setTimeout(() => setShowXp(false), 1200); }
      saveEvent(key, isCorrect, 1, durationMs);
      answeredRef.current = new Set(answeredRef.current).add(teacherQ);
      setLastResult(isCorrect ? "correct" : "wrong");
      setQuestionNumber((n) => n + 1);
      setPhase("result");
      setTimeout(() => setPhase("waiting-next"), 2000);
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

  // Finished screen
  if (phase === "finished") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center animate-fade-in max-w-md">
          <div className="text-6xl mb-6">&#127942;</div>
          <h1 className="text-3xl font-bold text-white mb-4">Kvíz dokončen!</h1>
          <div className="text-5xl font-bold text-accent mb-2">{totalXp} XP</div>
          <p className="text-foreground/50 mb-8">{activity?.title}</p>
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

  // Waiting for teacher - one message per question, based on last result
  if (phase === "waiting" || phase === "waiting-next") {
    const messages = lastResult === "corrected" ? GROWTH_CORRECTED_MSGS
      : lastResult === "correct" ? GROWTH_CORRECT_MSGS
      : GROWTH_WRONG_MSGS;
    const msg = phase === "waiting" ? "Připojeno!" : pickMessage(messages, questionNumber);

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
          <div className="mt-6 text-3xl font-bold text-accent">{totalXp} XP</div>
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
          <span className="text-accent font-bold text-sm">{totalXp} XP</span>
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
                ? "bg-primary/10 border border-primary/30"
                : selected === q.correct && attempt > 1
                ? "bg-green-400/10 border border-green-400/30"
                : selected === q.correct
                ? "bg-accent/10 border border-accent/30"
                : "bg-yellow-400/10 border border-yellow-400/30"
            }`}>
              <div className="text-center mb-3">
                {xpGained > 0 && <div className="text-3xl font-bold text-accent mb-1">+{xpGained} XP</div>}
                {isAssessment ? (
                  <p className="text-foreground/60 font-bold">{GROWTH_ASSESSMENT_MSG}</p>
                ) : lastResult === "timeout" ? (
                  <p className="text-red-400 font-bold">{GROWTH_TIMEOUT_MSG}</p>
                ) : lastResult === "corrected" ? (
                  <>
                    <p className="text-green-400 font-bold text-lg">{pickMessage(GROWTH_CORRECTED_MSGS, questionNumber)}</p>
                    <p className="text-foreground/50 text-xs mt-1">Chyba je příležitost k učení</p>
                  </>
                ) : selected === q.correct ? (
                  <p className="text-accent font-bold">{pickMessage(GROWTH_CORRECT_MSGS, questionNumber)}</p>
                ) : (
                  <>
                    <p className="text-yellow-300 font-bold">{pickMessage(GROWTH_WRONG_MSGS, questionNumber)}</p>
                    {xpGained > 0 && <p className="text-foreground/50 text-xs mt-1">+{xpGained} XP za odvahu to zkusit</p>}
                  </>
                )}
              </div>
              {/* V assessment mode neukazujeme vysvětlení */}
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
