"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Activity, Session,
  QuizSubActivity, OpenSubActivity, PeerReviewSubActivity, GroupWorkSubActivity,
  AssessmentMode,
} from "@/types";
import QuizStep from "@/components/multi-activity/QuizStep";
import BrainstormStep from "@/components/multi-activity/BrainstormStep";
import VotingStep from "@/components/multi-activity/VotingStep";
import PhotoStep from "@/components/multi-activity/PhotoStep";

interface LessonRunnerProps {
  lessonTitle: string;
  activities: Activity[];                 // sorted by order_index
  session: Session;
  studentId: string;
  studentEmoji: string;
}

function storageKey(sessionId: string, studentId: string) {
  return `inj_lesson_step_${sessionId}_${studentId}`;
}

// Adapt Activity row to the SubActivity shape consumed by step components.
// SubActivity is the shape multi-activity components were built around;
// this adapter lets us reuse them without rewriting the step UIs.
function toQuizSub(a: Activity, order: number): QuizSubActivity {
  return {
    type: "quiz",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    assessment_mode: (a.assessment_mode as AssessmentMode) ?? "learning",
    questions: a.questions,
    xp_complete_bonus: a.config?.xp_complete_bonus as number | undefined,
    xp_correct_phrasing_bonus: a.config?.xp_correct_phrasing_bonus as number | undefined,
    xp_growth_correction_bonus: a.config?.xp_growth_correction_bonus as number | undefined,
  };
}

function toOpenSub(a: Activity, order: number): OpenSubActivity {
  return {
    type: "open",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    instructions: a.instructions ?? undefined,
    min_items: (a.config?.min_items as number) ?? 3,
    max_items: (a.config?.max_items as number) ?? 5,
    event_type: a.config?.event_type as string | undefined,
    ai_feedback: a.config?.ai_feedback as boolean | undefined,
    teacher_review: a.config?.teacher_review as boolean | undefined,
    skip_interpretation: a.config?.skip_interpretation as string | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

function toPeerReviewSub(a: Activity, order: number): PeerReviewSubActivity {
  return {
    type: "peer_review",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    anonymize: a.config?.anonymize as boolean | undefined,
    votes_per_student: (a.config?.votes_per_student as number) ?? 3,
    select_top_n: a.config?.select_top_n as number | undefined,
    source_activity_id: a.config?.source_activity_id as string | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

function toGroupWorkSub(a: Activity, order: number): GroupWorkSubActivity | null {
  const deliverable = a.config?.deliverable as GroupWorkSubActivity["deliverable"] | undefined;
  if (!deliverable) return null;
  return {
    type: "group_work",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    instructions: a.instructions ?? undefined,
    deliverable: {
      type: "photo_upload",
      min_photos: deliverable.min_photos ?? 1,
      max_photos: deliverable.max_photos ?? 3,
      required: deliverable.required ?? true,
      description: deliverable.description,
    },
    ai_verification: a.config?.ai_verification as GroupWorkSubActivity["ai_verification"],
    teacher_review: a.config?.teacher_review as boolean | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

export default function LessonRunner({
  lessonTitle, activities, session, studentId, studentEmoji,
}: LessonRunnerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(session.id, studentId));
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < activities.length) {
        setCurrentStep(parsed);
      }
    }
    setHydrated(true);
  }, [session.id, studentId, activities.length]);

  function persistStep(next: number) {
    const k = storageKey(session.id, studentId);
    if (next >= activities.length) localStorage.removeItem(k);
    else localStorage.setItem(k, String(next));
  }

  function handleStepComplete(xpGained: number) {
    setTotalXp((p) => p + xpGained);
    const next = currentStep + 1;
    persistStep(next);
    setCurrentStep(next);
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground/50">Načítám lekci...</div>
      </main>
    );
  }

  if (activities.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center text-foreground/60">Tato lekce nemá nakonfigurované žádné aktivity.</div>
      </main>
    );
  }

  const stepDone = currentStep >= activities.length;
  const a = activities[currentStep];
  const order = currentStep + 1;

  return (
    <main className="min-h-screen bg-background">
      <header className="px-4 pt-4 pb-3 border-b border-primary/20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{lessonTitle}</h1>
              {a && !stepDone && (
                <p className="text-foreground/50 text-xs mt-0.5">
                  Krok {currentStep + 1} z {activities.length} · {a.title}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl">{studentEmoji}</div>
              <div className="text-accent font-bold text-sm">{totalXp} XP</div>
            </div>
          </div>
          <ProgressDots total={activities.length} current={currentStep} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {stepDone ? (
          <AllDoneScreen totalXp={totalXp} />
        ) : (
          <StepRouter
            activity={a}
            order={order}
            studentId={studentId}
            sessionId={session.id}
            onComplete={handleStepComplete}
          />
        )}
      </div>
    </main>
  );
}

function StepRouter({
  activity, order, studentId, sessionId, onComplete,
}: {
  activity: Activity; order: number; studentId: string; sessionId: string;
  onComplete: (xp: number) => void;
}) {
  // photo_upload is normalized to group_work subactivity shape.
  const renderable = useMemo(() => {
    switch (activity.type) {
      case "quiz":
      case "ab_decision":
      case "ab_with_explanation":
      case "scale":
        return { kind: "quiz" as const, sub: toQuizSub(activity, order) };
      case "open":
        return { kind: "open" as const, sub: toOpenSub(activity, order) };
      case "peer_review":
        return { kind: "peer_review" as const, sub: toPeerReviewSub(activity, order) };
      case "group_work":
      case "photo_upload": {
        const sub = toGroupWorkSub(activity, order);
        return sub ? { kind: "group_work" as const, sub } : null;
      }
      default:
        return null;
    }
  }, [activity, order]);

  if (!renderable) {
    return (
      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-5 text-yellow-200/80 text-sm">
        Aktivita typu <code className="bg-background/60 px-1.5 py-0.5 rounded">{activity.type}</code> není
        v žákovském flow lekce zatím podporována. Přeskoč na další.
        <button
          onClick={() => onComplete(0)}
          className="block mt-3 px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30"
        >
          Přeskočit krok
        </button>
      </div>
    );
  }

  if (renderable.kind === "quiz") {
    return <QuizStep key={activity.id} subActivity={renderable.sub} studentId={studentId} sessionId={sessionId} onComplete={onComplete} />;
  }
  if (renderable.kind === "open") {
    return <BrainstormStep key={activity.id} subActivity={renderable.sub} studentId={studentId} sessionId={sessionId} onComplete={onComplete} />;
  }
  if (renderable.kind === "peer_review") {
    return <VotingStep key={activity.id} subActivity={renderable.sub} studentId={studentId} sessionId={sessionId} onComplete={onComplete} />;
  }
  return <PhotoStep key={activity.id} subActivity={renderable.sub} studentId={studentId} sessionId={sessionId} onComplete={onComplete} />;
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

function AllDoneScreen({ totalXp }: { totalXp: number }) {
  return (
    <div className="text-center py-12 animate-fade-in">
      <div className="text-7xl mb-4">🏆</div>
      <h2 className="text-3xl font-bold text-white mb-3">Všechny kroky dokončeny!</h2>
      <div className="text-4xl font-bold text-accent mb-6">{totalXp} XP</div>
      <a
        href="/zak/profil"
        className="inline-block px-6 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
      >
        Zpět na profil
      </a>
    </div>
  );
}
