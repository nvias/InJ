"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { OpenSubActivity } from "@/types";

interface BrainstormStepProps {
  subActivity: OpenSubActivity;
  studentId: string;
  sessionId: string;
  onComplete: (xpGained: number) => void;
}

const MIN_WORDS = 20;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function BrainstormStep({ subActivity, studentId, sessionId, onComplete }: BrainstormStepProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const xp = subActivity.xp_complete ?? 100;

  const wordCount = countWords(text);
  const valid = wordCount >= MIN_WORDS;

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);

    await supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: subActivity.id,
      event_type: "text_submit",
      answer: text.trim(),
      is_correct: false,
      attempt_no: 1,
      duration_ms: 0,
    });

    setSubmitted(true);
    setSubmitting(false);

    setTimeout(() => onComplete(xp), 2200);
  }

  if (submitted) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="text-6xl mb-4">🌱</div>
        <h2 className="text-2xl font-bold text-accent mb-3">Tvoje příležitost je zaznamenaná</h2>
        <p className="text-foreground/60 mb-6">Mozek právě roste 🧠</p>
        <div className="text-4xl font-bold text-accent">+{xp} XP</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-2">Popiš svoji příležitost</h2>
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-5">
        <p className="text-accent font-semibold text-sm">💡 Začni větou:</p>
        <p className="text-foreground/80 text-sm mt-1">
          <span className="font-semibold text-accent">„Vidím, že..."</span> — popiš pozorování, ne stížnost. Co by se mohlo zlepšit?
        </p>
      </div>

      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Vidím, že..."
          rows={6}
          className="w-full bg-primary/5 border-2 border-primary/30 focus:border-accent rounded-xl px-4 py-3 text-white placeholder:text-foreground/30 outline-none transition-colors resize-none"
        />
        <div className="flex justify-between text-xs mt-2">
          <span className={valid ? "text-accent" : "text-foreground/40"}>
            {valid ? "✓ Stačí" : `Min ${MIN_WORDS} slov`}
          </span>
          <span className={valid ? "text-accent" : "text-foreground/40"}>{wordCount} slov</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className={`mt-6 py-4 rounded-xl font-bold transition-all ${
          valid && !submitting
            ? "bg-accent text-background hover:bg-accent/90"
            : "bg-primary/20 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {submitting ? "Odesílám..." : "Odeslat"}
      </button>
    </div>
  );
}
