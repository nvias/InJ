"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Activity, Question } from "@/types";

// ═══════════════════════════════════════════════
// Detail kvízové aktivity — list otázek + inline edit
// (extrahováno z původní /ucitel/aktivita/[id]/page.tsx)
// ═══════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  click: "Kvíz", ab_decision: "AB rozhodnutí", ab_with_explanation: "AB + vysvětlení",
  scale: "Škála", open: "Otevřená", logic_trap: "Chyták", pattern: "Vzor", peer_review: "Peer review",
};

interface Props {
  activity: Activity;
  onUpdate: (questions: Question[]) => void;
}

export default function QuizDetail({ activity, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<{ key: string; text: string }[]>([]);
  const [editCorrect, setEditCorrect] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editHint, setEditHint] = useState("");

  const questions = activity.questions as Question[];

  async function saveQuestions(updated: Question[]) {
    await supabase.from("activities").update({ questions: updated }).eq("id", activity.id);
    onUpdate(updated);
  }

  async function handleDelete(qId: string) {
    if (!confirm("Opravdu smazat?")) return;
    saveQuestions(questions.filter((q) => q.id !== qId));
  }

  function handleMove(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const qs = [...questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    saveQuestions(qs);
  }

  function startInlineEdit(q: Question) {
    setEditingId(q.id);
    setEditText(q.text);
    setEditOptions(q.options.map((o) => ({ key: o.key, text: o.text })));
    setEditCorrect(q.correct);
    setEditExplanation(q.explanation);
    setEditHint(q.hint_level_1);
  }

  async function saveInlineEdit() {
    if (!editingId) return;
    const updated = questions.map((q) =>
      q.id !== editingId ? q : { ...q, text: editText, options: editOptions, correct: editCorrect, explanation: editExplanation, hint_level_1: editHint }
    );
    await saveQuestions(updated);
    setEditingId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-foreground/30 text-sm">{questions.length} otázek</p>
        <Link href={`/ucitel/otazky/nova?activity=${activity.id}`}
          className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-background font-semibold rounded-xl transition-colors">
          + Přidat otázku
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const isEditing = editingId === q.id;
          const typeLabel = TYPE_LABELS[q.question_type || "click"] || q.question_type || "Kvíz";
          const modeIcon = q.assessment_mode === "assessment" ? "📊" : "🎓";
          const hasImages = q.options.some((o) => o.image_url);

          return (
            <div key={q.id} className={`border rounded-xl transition-colors ${isEditing ? "border-accent/40 bg-accent/5 p-5" : "border-primary/20 p-4"}`}>
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-foreground/50 text-xs mb-1 block">Text otázky</label>
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2}
                      className="w-full py-2 px-3 bg-background border border-primary/40 focus:border-accent rounded-lg text-white outline-none text-sm resize-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-foreground/50 text-xs">Odpovědi (klikni písmeno = správná)</label>
                    {editOptions.map((opt, oi) => (
                      <div key={opt.key} className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditCorrect(opt.key)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs shrink-0 ${editCorrect === opt.key ? "bg-green-400 text-background" : "bg-primary/20 text-foreground/40"}`}>
                          {opt.key}
                        </button>
                        <input value={opt.text} onChange={(e) => {
                          const upd = [...editOptions]; upd[oi] = { ...upd[oi], text: e.target.value }; setEditOptions(upd);
                        }} className="flex-1 py-1.5 px-3 bg-background border border-primary/30 rounded-lg text-white outline-none text-sm" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-foreground/50 text-xs mb-1 block">Vysvětlení</label>
                    <textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={2}
                      className="w-full py-2 px-3 bg-background border border-primary/40 rounded-lg text-white outline-none text-sm resize-none" />
                  </div>
                  <div>
                    <label className="text-foreground/50 text-xs mb-1 block">Nápověda</label>
                    <input value={editHint} onChange={(e) => setEditHint(e.target.value)}
                      className="w-full py-1.5 px-3 bg-background border border-primary/30 rounded-lg text-white outline-none text-sm" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Link href={`/ucitel/otazky/nova?activity=${activity.id}&edit=${q.id}`} className="text-accent text-xs hover:underline">
                      Plná editace (typ, obrázky, kompetence) &rarr;
                    </Link>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-primary/30 text-foreground/50 rounded-lg text-sm">Zrušit</button>
                      <button onClick={saveInlineEdit} className="px-4 py-2 bg-accent text-background font-semibold rounded-lg text-sm">Uložit</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                    <button onClick={() => handleMove(i, -1)} disabled={i === 0}
                      className="w-6 h-5 flex items-center justify-center text-foreground/20 hover:text-accent disabled:opacity-20 text-xs">▲</button>
                    <span className="text-foreground/30 text-xs font-mono">{i + 1}</span>
                    <button onClick={() => handleMove(i, 1)} disabled={i === questions.length - 1}
                      className="w-6 h-5 flex items-center justify-center text-foreground/20 hover:text-accent disabled:opacity-20 text-xs">▼</button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${q.difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300" : "bg-accent/20 text-accent"}`}>
                        {q.difficulty === "advanced" ? "Pokročilá" : "Základní"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-foreground/50">{typeLabel}</span>
                      <span className="text-sm">{modeIcon}</span>
                      {hasImages && <span className="text-xs text-foreground/30">📷</span>}
                      {q.requires_explanation && <span className="text-xs text-foreground/30">✏️ vysvětlení</span>}
                    </div>
                    <p className="text-white font-medium">{q.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((opt) => (
                        <span key={opt.key} className={`text-xs px-2 py-1 rounded-lg ${opt.key === q.correct ? "bg-green-400/15 text-green-400 border border-green-400/30" : "bg-primary/10 text-foreground/40"}`}>
                          {opt.key}: {opt.text.length > 60 ? opt.text.slice(0, 60) + "…" : opt.text}
                          {opt.image_url && " 📷"}
                        </span>
                      ))}
                    </div>
                    {q.competence_weights && Object.keys(q.competence_weights).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.keys(q.competence_weights).map((k) => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-foreground/25">
                            {k.replace("rvp_", "").replace("entrecomp_", "").replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => startInlineEdit(q)} className="text-foreground/30 hover:text-accent transition-colors text-xs px-2 py-1">Upravit</button>
                    <button onClick={() => handleDelete(q.id)} className="text-foreground/20 hover:text-red-400 transition-colors text-xs px-2 py-1">Smazat</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {questions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground/30 text-lg">Žádné otázky</p>
          <Link href={`/ucitel/otazky/nova?activity=${activity.id}`} className="text-accent text-sm mt-2 inline-block hover:underline">
            Přidat první otázku
          </Link>
        </div>
      )}
    </>
  );
}
