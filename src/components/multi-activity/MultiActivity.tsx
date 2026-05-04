"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, Session, SubActivity } from "@/types";
import QuizStep from "./QuizStep";
import BrainstormStep from "./BrainstormStep";
import VotingStep from "./VotingStep";
import PhotoStep from "./PhotoStep";

interface MultiActivityProps {
  activity: Activity;
  session: Session;
  studentId: string;
  studentEmoji: string;
}

function storageKey(sessionId: string) {
  return `inj_lesson_step_${sessionId}`;
}

export default function MultiActivity({ activity, session, studentId, studentEmoji }: MultiActivityProps) {
  const subActivities = useMemo<SubActivity[]>(() => {
    return [...(activity.sub_activities ?? [])].sort((a, b) => a.order - b.order);
  }, [activity.sub_activities]);

  const [currentStep, setCurrentStep] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(session.id));
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < subActivities.length) {
        setCurrentStep(parsed);
      }
    }
    setHydrated(true);
  }, [session.id, subActivities.length]);

  function persistStep(next: number) {
    if (next >= subActivities.length) {
      localStorage.removeItem(storageKey(session.id));
    } else {
      localStorage.setItem(storageKey(session.id), String(next));
    }
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

  if (subActivities.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center text-foreground/60">
          Tato lekce nemá nakonfigurované žádné aktivity.
        </div>
      </main>
    );
  }

  const stepDone = currentStep >= subActivities.length;
  const sub = subActivities[currentStep];

  return (
    <main className="min-h-screen bg-background">
      <header className="px-4 pt-4 pb-3 border-b border-primary/20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">{activity.title}</h1>
              {sub && !stepDone && (
                <p className="text-foreground/50 text-xs mt-0.5">
                  Krok {currentStep + 1} z {subActivities.length} · {sub.title}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl">{studentEmoji}</div>
              <div className="text-accent font-bold text-sm">{totalXp} XP</div>
            </div>
          </div>

          <ProgressDots total={subActivities.length} current={currentStep} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {stepDone ? (
          <AllDoneScreen totalXp={totalXp} />
        ) : sub.type === "quiz" ? (
          <QuizStep
            key={sub.id}
            subActivity={sub}
            studentId={studentId}
            sessionId={session.id}
            onComplete={handleStepComplete}
          />
        ) : sub.type === "open" ? (
          <BrainstormStep
            key={sub.id}
            subActivity={sub}
            studentId={studentId}
            sessionId={session.id}
            onComplete={handleStepComplete}
          />
        ) : sub.type === "peer_review" ? (
          <VotingStep
            key={sub.id}
            subActivity={sub}
            studentId={studentId}
            sessionId={session.id}
            onComplete={handleStepComplete}
          />
        ) : sub.type === "group_work" ? (
          <PhotoStep
            key={sub.id}
            subActivity={sub}
            studentId={studentId}
            sessionId={session.id}
            onComplete={handleStepComplete}
          />
        ) : (
          <div className="text-foreground/60">Neznámý typ aktivity: {(sub as SubActivity).type}</div>
        )}
      </div>
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
