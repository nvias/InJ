"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QuizSubActivity, Question } from "@/types";
import {
  calcXp, getQuestionMode, pickMessage,
  GROWTH_CORRECT_MSGS, GROWTH_CORRECTED_MSGS, GROWTH_WRONG_MSGS,
} from "@/types";
import ABDecision from "@/components/ABDecision";

interface QuizStepProps {
  subActivity: QuizSubActivity;
  studentId: string;
  sessionId: string;
  onComplete: (xpGained: number) => void;
}

type Phase = "answering" | "explaining" | "hint" | "result";

export default function QuizStep({ subActivity, studentId, sessionId, onComplete }: QuizStepProps) {
  const questions = subActivity.questions;
  const sessionMode = subActivity.assessment_mode || "learning";
  const completionBonus = subActivity.xp_complete_bonus ?? 150;

  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [xpGained, setXpGained] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [showXp, setShowXp] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "corrected" | "wrong">("correct");
  const startTimeRef = useRef(Date.now());
  const pendingAnswerRef = useRef<{ key: string; durationMs: number } | null>(null);

  const q: Question | undefined = questions[qIdx];

  async function saveEvent(answer: string | null, isCorrect: boolean, attemptNo: number, durationMs: number) {
    if (!q) return;
    await supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: q.id,
      event_type: "answer",
      answer,
      is_correct: isCorrect,
      attempt_no: attemptNo,
      duration_ms: durationMs,
    });
  }

  function advance(addXp: number, result: "correct" | "corrected" | "wrong") {
    setLastResult(result);
    setXpGained(addXp);
    setTotalXp((p) => p + addXp);
    if (addXp > 0) {
      setShowXp(true);
      setTimeout(() => setShowXp(false), 1200);
    }
    setPhase("result");
  }

  function evaluate(key: string, durationMs: number) {
    if (!q) return;
    const isCorrect = key === q.correct;
    const mode = getQuestionMode(sessionMode, q);

    if (mode === "assessment") {
      const xp = calcXp("assessment", isCorrect, 1, durationMs);
      saveEvent(key, isCorrect, 1, durationMs);
      advance(xp, isCorrect ? "correct" : "wrong");
      return;
    }

    if (isCorrect) {
      const xp = calcXp("learning", true, attempt, durationMs);
      saveEvent(key, true, attempt, durationMs);
      advance(xp, attempt > 1 ? "corrected" : "correct");
    } else if (attempt === 1) {
      saveEvent(key, false, 1, durationMs);
      setPhase("hint");
    } else {
      const xp = calcXp("learning", false, attempt, durationMs);
      saveEvent(key, false, 2, durationMs);
      advance(xp, "wrong");
    }
  }

  function handleSelect(key: string) {
    if (phase !== "answering" || !q) return;
    const durationMs = Date.now() - startTimeRef.current;
    setSelected(key);

    if (q.question_type === "ab_with_explanation" && q.requires_explanation) {
      pendingAnswerRef.current = { key, durationMs };
      setPhase("explaining");
      return;
    }

    evaluate(key, durationMs);
  }

  function handleExplanationSubmit(text: string) {
    if (!q) return;
    supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: q.id,
      event_type: "text_submit",
      answer: text,
      is_correct: false,
      attempt_no: 0,
      duration_ms: 0,
    });
    const pending = pendingAnswerRef.current;
    pendingAnswerRef.current = null;
    if (pending) evaluate(pending.key, pending.durationMs);
  }

  function handleRetry() {
    setAttempt(2);
    setSelected(null);
    setPhase("answering");
    startTimeRef.current = Date.now();
  }

  function handleSkip() {
    if (!q) return;
    supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: q.id,
      event_type: "skip",
      answer: null,
      is_correct: false,
      attempt_no: attempt,
      duration_ms: Date.now() - startTimeRef.current,
    });
    setLastResult("wrong");
    setXpGained(0);
    setPhase("result");
  }

  async function handleNext() {
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1);
      setPhase("answering");
      setSelected(null);
      setAttempt(1);
      startTimeRef.current = Date.now();
    } else {
      // Quiz complete — save bonus event and notify parent
      await supabase.from("student_events").insert({
        student_id: studentId,
        session_id: sessionId,
        question_id: subActivity.id,
        event_type: "sub_activity_complete",
        answer: JSON.stringify({ sub_activity: subActivity.id, xp: totalXp + completionBonus }),
        is_correct: true,
        attempt_no: 1,
        duration_ms: 0,
      });
      onComplete(totalXp + completionBonus);
    }
  }

  if (!q) return null;

  const progressPct = ((qIdx) / questions.length) * 100;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-foreground/50 text-sm">Otázka {qIdx + 1} / {questions.length}</span>
        <span className="text-accent font-bold text-sm">{totalXp} XP</span>
      </div>
      <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${q.difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300" : "bg-accent/20 text-accent"}`}>
            {q.difficulty === "advanced" ? "Pokročilé" : "Základní"}
          </span>
          <span className="text-sm">🎓</span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 leading-relaxed">{q.text}</h2>
      </div>

      {(q.question_type === "ab_decision" || q.question_type === "ab_with_explanation") ? (
        <ABDecision
          options={q.options}
          correct={q.correct}
          selected={selected}
          phase={phase === "result" ? "result" : phase}
          attempt={attempt}
          requiresExplanation={q.question_type === "ab_with_explanation" && q.requires_explanation}
          explanationPrompt={q.explanation_prompt}
          onSelect={handleSelect}
          onExplanationSubmit={handleExplanationSubmit}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {q.options.map((opt) => {
            let btnClass = "border-2 border-primary/40 hover:border-accent/60 hover:bg-primary/10";
            if (phase === "result" || phase === "hint") {
              if (opt.key === q.correct && phase === "result") btnClass = "border-2 border-green-400 bg-green-400/10";
              else if (opt.key === selected && selected !== q.correct) btnClass = "border-2 border-red-400 bg-red-400/10";
              else btnClass = "border-2 border-primary/20 opacity-50";
            }
            return (
              <button
                key={opt.key}
                onClick={() => handleSelect(opt.key)}
                disabled={phase !== "answering"}
                className={`w-full text-left py-4 px-5 rounded-xl transition-all duration-200 ${btnClass}`}
              >
                <span className="font-bold text-accent mr-3">{opt.key}</span>
                <span className="text-white">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {phase === "answering" && (
        <button onClick={handleSkip} className="mt-3 text-sm text-foreground/30 hover:text-foreground/50 transition-colors text-center py-2">
          Přeskočit otázku
        </button>
      )}

      {showXp && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
          <div className="text-4xl font-bold text-accent animate-xp-pop">+{xpGained} XP</div>
        </div>
      )}

      {phase === "hint" && (
        <div className="mt-4 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-xl animate-fade-in">
          <p className="text-yellow-300 font-semibold text-sm mb-2">Nápověda:</p>
          <p className="text-foreground/80">{q.hint_level_1}</p>
          <div className="flex gap-3 mt-4">
            <button onClick={handleRetry} className="flex-1 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors">
              Zkusit znovu
            </button>
            <button onClick={handleSkip} className="py-3 px-5 border border-primary/30 text-foreground/50 hover:text-white rounded-xl transition-colors text-sm">
              Přeskočit
            </button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className={`mt-4 p-5 rounded-xl animate-fade-in ${
          lastResult === "corrected" ? "bg-green-400/10 border border-green-400/30"
          : lastResult === "correct" ? "bg-accent/10 border border-accent/30"
          : "bg-yellow-400/10 border border-yellow-400/30"
        }`}>
          <div className="text-center mb-3">
            {xpGained > 0 && <div className="text-3xl font-bold text-accent mb-1">+{xpGained} XP</div>}
            {lastResult === "corrected" ? (
              <>
                <p className="text-green-400 font-bold text-lg">{pickMessage(GROWTH_CORRECTED_MSGS, qIdx)}</p>
                <p className="text-foreground/50 text-xs mt-1">Chyba je příležitost k učení</p>
              </>
            ) : lastResult === "correct" ? (
              <p className="text-accent font-bold">{pickMessage(GROWTH_CORRECT_MSGS, qIdx)}</p>
            ) : (
              <p className="text-yellow-300 font-bold">{pickMessage(GROWTH_WRONG_MSGS, qIdx)}</p>
            )}
          </div>
          <p className="text-foreground/60 text-sm text-center">{q.explanation}</p>
          <button
            onClick={handleNext}
            className="mt-4 w-full py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
          >
            {qIdx + 1 < questions.length ? "Další otázka →" : "Dokončit kvíz →"}
          </button>
        </div>
      )}
    </div>
  );
}
