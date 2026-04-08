"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Activity, QuestionType, AssessmentMode } from "@/types";
import { RVP_COMPETENCES, ENTRECOMP_COMPETENCES } from "@/lib/competences";
import ImageDropZone from "@/components/ImageDropZone";

const QUESTION_TYPES: { value: QuestionType; label: string; desc: string }[] = [
  { value: "click", label: "Kvíz (A/B/C/D)", desc: "Klasický výběr ze 4 možností" },
  { value: "ab_decision", label: "AB rozhodnutí", desc: "Dvě karty - vyber A nebo B" },
  { value: "ab_with_explanation", label: "AB s vysvětlením", desc: "AB + žák napíše proč" },
  { value: "scale", label: "Škála", desc: "Hodnocení na stupnici" },
  { value: "open", label: "Otevřená odpověď", desc: "Textová odpověď" },
];

function NovaOtazkaContent() {
  const [authorized, setAuthorized] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const searchParams = useSearchParams();

  // Form state
  const [questionType, setQuestionType] = useState<QuestionType>("click");
  const [difficulty, setDifficulty] = useState<"basic" | "advanced">("basic");
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("learning");
  const [questionText, setQuestionText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correct, setCorrect] = useState("A");
  const [explanation, setExplanation] = useState("");
  const [hint1, setHint1] = useState("");
  const [hint2, setHint2] = useState("");
  const [hint3, setHint3] = useState("");
  const [skipInterpretation, setSkipInterpretation] = useState("");
  const [explanationPrompt, setExplanationPrompt] = useState("");
  const [rvpSelected, setRvpSelected] = useState<string[]>([]);
  const [entreSelected, setEntreSelected] = useState<string[]>([]);
  const [imageUrlA, setImageUrlA] = useState("");
  const [imageUrlB, setImageUrlB] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    supabase.from("activities").select("*").then(({ data }) => {
      if (!data) return;
      setActivities(data);
      const preselect = searchParams.get("activity");
      if (preselect) {
        setSelectedActivity(preselect);
        // Load existing question for editing
        const editId = searchParams.get("edit");
        if (editId) {
          const act = data.find((a) => a.id === preselect);
          const q = act?.questions?.find((qq: { id: string }) => qq.id === editId);
          if (q) {
            setQuestionText(q.text);
            setQuestionType(q.question_type || "click");
            setDifficulty(q.difficulty || "basic");
            setAssessmentMode(q.assessment_mode || "learning");
            setCorrect(q.correct);
            setExplanation(q.explanation || "");
            setHint1(q.hint_level_1 || "");
            setHint2(q.hint_level_2 || "");
            setHint3(q.hint_level_3 || "");
            setSkipInterpretation(q.skip_interpretation || "");
            setExplanationPrompt(q.explanation_prompt || "");
            if (q.options?.[0]) setOptionA(q.options[0].text);
            if (q.options?.[1]) setOptionB(q.options[1].text);
            if (q.options?.[2]) setOptionC(q.options[2].text);
            if (q.options?.[3]) setOptionD(q.options[3].text);
            if (q.options?.[0]?.image_url) setImageUrlA(q.options[0].image_url);
            if (q.options?.[1]?.image_url) setImageUrlB(q.options[1].image_url);
            const cw = q.competence_weights || {};
            setRvpSelected(Object.keys(cw).filter((k: string) => k.startsWith("rvp_")));
            setEntreSelected(Object.keys(cw).filter((k: string) => k.startsWith("entrecomp_")));
          }
        }
      }
    });
  }, [router, searchParams]);

  const isAB = questionType === "ab_decision" || questionType === "ab_with_explanation";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedActivity || !questionText) return;
    setSaving(true);

    // Build options
    const options = isAB
      ? [
          { key: "A", text: optionA, ...(imageUrlA ? { image_url: imageUrlA } : {}) },
          { key: "B", text: optionB, ...(imageUrlB ? { image_url: imageUrlB } : {}) },
        ]
      : [{ key: "A", text: optionA }, { key: "B", text: optionB }, { key: "C", text: optionC }, { key: "D", text: optionD }].filter((o) => o.text);

    // Build competence weights
    const weights: Record<string, number> = {};
    for (const key of rvpSelected) weights[key] = 0.7;
    for (const key of entreSelected) weights[key] = 0.8;

    const editId = searchParams.get("edit");
    const newQuestion = {
      id: editId || `q_${Date.now()}`,
      text: questionText,
      difficulty,
      assessment_mode: assessmentMode,
      question_type: questionType,
      options,
      correct,
      explanation,
      hint_level_1: hint1,
      hint_level_2: hint2 || undefined,
      hint_level_3: hint3 || undefined,
      requires_explanation: questionType === "ab_with_explanation" || undefined,
      explanation_prompt: explanationPrompt || undefined,
      skip_interpretation: skipInterpretation || undefined,
      competence_weights: weights,
    };

    // Append to activity's questions array
    const { data: activity } = await supabase
      .from("activities")
      .select("questions")
      .eq("id", selectedActivity)
      .single();

    if (!activity) {
      alert("Aktivita nenalezena");
      setSaving(false);
      return;
    }

    const existingQuestions = activity.questions as unknown[];
    const questions = editId
      ? existingQuestions.map((q: unknown) => (q as { id: string }).id === editId ? newQuestion : q)
      : [...existingQuestions, newQuestion];
    const { error } = await supabase
      .from("activities")
      .update({ questions })
      .eq("id", selectedActivity);

    if (error) {
      alert("Chyba: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/ucitel/aktivita/${selectedActivity}`);
  }

  function toggleCompetence(key: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  if (!authorized) return <main className="min-h-screen flex items-center justify-center bg-background"><p className="text-foreground/60">Načítání...</p></main>;

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/dashboard" className="text-sm text-foreground/60 hover:text-foreground">&larr; Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-white mb-8">{searchParams.get("edit") ? "Upravit otázku" : "Nová otázka"}</h1>

        <form onSubmit={handleSave} className="flex flex-col gap-8">
          {/* Sekce 1: Základní */}
          <section className="border border-primary/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-accent mb-4">Základní info</h2>

            <div className="mb-4">
              <label className="block text-foreground/80 text-sm mb-1.5">Aktivita (kam přidat)</label>
              <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} required
                className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none">
                <option value="">Vyber aktivitu</option>
                {activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-foreground/80 text-sm mb-1.5">Typ otázky</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUESTION_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setQuestionType(t.value)}
                    className={`p-3 rounded-xl text-left text-sm transition-all ${
                      questionType === t.value ? "bg-accent/20 border-2 border-accent" : "border-2 border-primary/20 hover:border-primary/40"
                    }`}>
                    <div className="text-white font-medium">{t.label}</div>
                    <div className="text-foreground/30 text-xs mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-foreground/80 text-sm mb-1.5">Obtížnost</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDifficulty("basic")}
                    className={`flex-1 py-2 rounded-lg text-sm ${difficulty === "basic" ? "bg-accent/20 text-accent border border-accent" : "border border-primary/30 text-foreground/50"}`}>
                    Základní
                  </button>
                  <button type="button" onClick={() => setDifficulty("advanced")}
                    className={`flex-1 py-2 rounded-lg text-sm ${difficulty === "advanced" ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400" : "border border-primary/30 text-foreground/50"}`}>
                    Pokročilá
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-foreground/80 text-sm mb-1.5">Režim</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAssessmentMode("learning")}
                    className={`flex-1 py-2 rounded-lg text-sm ${assessmentMode === "learning" ? "bg-accent/20 text-accent border border-accent" : "border border-primary/30 text-foreground/50"}`}>
                    🎓 Procvičování
                  </button>
                  <button type="button" onClick={() => setAssessmentMode("assessment")}
                    className={`flex-1 py-2 rounded-lg text-sm ${assessmentMode === "assessment" ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400" : "border border-primary/30 text-foreground/50"}`}>
                    📊 Ověření
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Sekce 2: Obsah */}
          <section className="border border-primary/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-accent mb-4">Obsah otázky</h2>

            <div className="mb-4">
              <label className="block text-foreground/80 text-sm mb-1.5">Text otázky</label>
              <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} required rows={2}
                className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none resize-none" />
            </div>

            {isAB ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-foreground/80 text-sm mb-1.5">Možnost A</label>
                  <textarea value={optionA} onChange={(e) => setOptionA(e.target.value)} required rows={3}
                    className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none resize-none mb-2" />
                  <ImageDropZone value={imageUrlA} onChange={setImageUrlA} label="A" />
                </div>
                <div>
                  <label className="block text-foreground/80 text-sm mb-1.5">Možnost B</label>
                  <textarea value={optionB} onChange={(e) => setOptionB(e.target.value)} required rows={3}
                    className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none resize-none mb-2" />
                  <ImageDropZone value={imageUrlB} onChange={setImageUrlB} label="B" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {[
                  { key: "A", val: optionA, set: setOptionA },
                  { key: "B", val: optionB, set: setOptionB },
                  { key: "C", val: optionC, set: setOptionC },
                  { key: "D", val: optionD, set: setOptionD },
                ].map((o) => (
                  <div key={o.key} className="flex items-center gap-3">
                    <button type="button" onClick={() => setCorrect(o.key)}
                      className={`w-10 h-10 rounded-lg font-bold text-sm shrink-0 ${correct === o.key ? "bg-green-400 text-background" : "bg-primary/20 text-foreground/50"}`}>
                      {o.key}
                    </button>
                    <input value={o.val} onChange={(e) => o.set(e.target.value)} placeholder={`Možnost ${o.key}`}
                      className="flex-1 py-2.5 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none text-sm" />
                  </div>
                ))}
                <p className="text-foreground/30 text-xs">Klikni na písmeno pro označení správné odpovědi</p>
              </div>
            )}

            {isAB && (
              <div className="mt-3">
                <label className="block text-foreground/80 text-sm mb-1.5">Správná odpověď</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setCorrect("A")}
                    className={`flex-1 py-2 rounded-lg font-bold ${correct === "A" ? "bg-green-400 text-background" : "border border-primary/30 text-foreground/50"}`}>A</button>
                  <button type="button" onClick={() => setCorrect("B")}
                    className={`flex-1 py-2 rounded-lg font-bold ${correct === "B" ? "bg-green-400 text-background" : "border border-primary/30 text-foreground/50"}`}>B</button>
                </div>
              </div>
            )}

            {questionType === "ab_with_explanation" && (
              <div className="mt-3">
                <label className="block text-foreground/80 text-sm mb-1.5">Otázka pro vysvětlení</label>
                <input value={explanationPrompt} onChange={(e) => setExplanationPrompt(e.target.value)}
                  placeholder="Proč sis vybral/a tuto možnost?"
                  className="w-full py-2.5 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none text-sm" />
              </div>
            )}
          </section>

          {/* Sekce 3: Kompetence */}
          <section className="border border-primary/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-accent mb-4">Kompetence</h2>
            <div className="mb-4">
              <h3 className="text-sm font-medium text-foreground/60 mb-2">RVP</h3>
              <div className="flex flex-wrap gap-2">
                {RVP_COMPETENCES.map((c) => (
                  <button key={c.key} type="button" onClick={() => toggleCompetence(c.key, rvpSelected, setRvpSelected)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      rvpSelected.includes(c.key) ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400" : "border border-primary/20 text-foreground/40"
                    }`}>
                    {c.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground/60 mb-2">EntreComp</h3>
              <div className="flex flex-wrap gap-2">
                {ENTRECOMP_COMPETENCES.map((c) => (
                  <button key={c.key} type="button" onClick={() => toggleCompetence(c.key, entreSelected, setEntreSelected)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      entreSelected.includes(c.key) ? "bg-orange-400/20 text-orange-300 border border-orange-400" : "border border-primary/20 text-foreground/40"
                    }`}>
                    {c.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Sekce 4: Feedback */}
          <section className="border border-primary/20 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-accent mb-4">Feedback</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-foreground/80 text-sm mb-1">Vysvětlení (po odpovědi)</label>
                <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2}
                  className="w-full py-2 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none resize-none text-sm" />
              </div>
              <div>
                <label className="block text-foreground/80 text-sm mb-1">Nápověda 1 (návodná otázka)</label>
                <input value={hint1} onChange={(e) => setHint1(e.target.value)}
                  className="w-full py-2 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none text-sm" />
              </div>
              <div>
                <label className="block text-foreground/80 text-sm mb-1">Nápověda 2 (konkrétnější)</label>
                <input value={hint2} onChange={(e) => setHint2(e.target.value)}
                  className="w-full py-2 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none text-sm" />
              </div>
              <div>
                <label className="block text-foreground/80 text-sm mb-1">Skip interpretace (pro učitele)</label>
                <input value={skipInterpretation} onChange={(e) => setSkipInterpretation(e.target.value)}
                  placeholder="Žák potřebuje podporu v oblasti..."
                  className="w-full py-2 px-4 bg-background border border-primary/40 focus:border-accent rounded-xl text-white outline-none text-sm" />
              </div>
            </div>
          </section>

          {/* Submit */}
          <button type="submit" disabled={saving || !selectedActivity || !questionText}
            className="w-full py-4 bg-accent hover:bg-accent/80 disabled:opacity-30 text-background font-bold text-lg rounded-xl transition-colors">
            {saving ? "Ukládám..." : searchParams.get("edit") ? "Uložit změny" : "Přidat otázku"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NovaOtazkaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-background"><p className="text-foreground/60">Načítání...</p></main>}>
      <NovaOtazkaContent />
    </Suspense>
  );
}
