"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateCode } from "@/lib/utils";
import type { Activity, Class, Lesson } from "@/types";

type SourceMode = "lesson" | "activity";

interface LessonActivityWithReqs {
  la_id: string;
  order_index: number;
  is_optional: boolean;
  teacher_note: string | null;
  custom_duration_min: number | null;
  requires: string[];           // ids jiných lesson_activity z této lekce
  activity: Activity;
}

// Cascade: pokud je X přeskočeno a Y vyžaduje X, přeskoč i Y (tranzitivně).
function applySkipCascade(skipped: Set<string>, all: LessonActivityWithReqs[]): Set<string> {
  const next = new Set(skipped);
  let changed = true;
  while (changed) {
    changed = false;
    for (const la of all) {
      if (next.has(la.la_id)) continue;
      if (la.requires.some((reqId) => next.has(reqId))) {
        next.add(la.la_id);
        changed = true;
      }
    }
  }
  return next;
}

function NovaSessionContent() {
  const [authorized, setAuthorized] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("lesson");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [timerMode, setTimerMode] = useState<"none" | "30" | "60">("none");
  const [activityMode, setActivityMode] = useState<"learning" | "assessment" | "mixed">("learning");
  const [creating, setCreating] = useState(false);
  // Lesson checklist + skip cascade
  const [lessonActivitiesList, setLessonActivitiesList] = useState<LessonActivityWithReqs[]>([]);
  const [skippedSet, setSkippedSet] = useState<Set<string>>(new Set());
  const [loadingLessonActs, setLoadingLessonActs] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Když se vybere lekce v lesson módu, načti její lesson_activities + reset skip
  useEffect(() => {
    if (sourceMode !== "lesson" || !selectedLesson) {
      setLessonActivitiesList([]);
      setSkippedSet(new Set());
      return;
    }
    let cancelled = false;
    setLoadingLessonActs(true);
    supabase
      .from("lesson_activities")
      .select("id, order_index, is_optional, teacher_note, custom_duration_min, requires_lesson_activity_ids, activity:activities(*)")
      .eq("lesson_id", selectedLesson)
      .order("order_index", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const list: LessonActivityWithReqs[] = (data ?? []).map((row) => {
          const r = row as unknown as {
            id: string;
            order_index: number;
            is_optional: boolean;
            teacher_note: string | null;
            custom_duration_min: number | null;
            requires_lesson_activity_ids: string[] | null;
            activity: Activity;
          };
          return {
            la_id: r.id,
            order_index: r.order_index,
            is_optional: r.is_optional,
            teacher_note: r.teacher_note,
            custom_duration_min: r.custom_duration_min,
            requires: Array.isArray(r.requires_lesson_activity_ids) ? r.requires_lesson_activity_ids : [],
            activity: r.activity,
          };
        });
        setLessonActivitiesList(list);
        setSkippedSet(new Set());           // default: vše zaškrtnuto
        setLoadingLessonActs(false);
      });
    return () => { cancelled = true; };
  }, [sourceMode, selectedLesson]);

  function toggleSkip(la_id: string) {
    setSkippedSet((prev) => {
      const next = new Set(prev);
      if (next.has(la_id)) {
        // Re-include: jen vlastní + dependents zůstávají skipped (nepřišlapuju ručně)
        next.delete(la_id);
        return next;
      }
      next.add(la_id);
      return applySkipCascade(next, lessonActivitiesList);
    });
  }

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);

    Promise.all([
      supabase.from("activities").select("*").order("title"),
      supabase.from("lessons").select("*").eq("is_published", true).order("lesson_number", { ascending: true, nullsFirst: false }),
      supabase.from("classes").select("*").order("created_at", { ascending: false }),
    ]).then(([actRes, lsnRes, clsRes]) => {
      if (actRes.data) setActivities(actRes.data);
      if (lsnRes.data) {
        setLessons(lsnRes.data);
        const preLesson = searchParams.get("lesson");
        if (preLesson) {
          setSourceMode("lesson");
          setSelectedLesson(preLesson);
        } else if (lsnRes.data.length > 0 && !searchParams.get("activity")) {
          setSelectedLesson(lsnRes.data[0].id);
        }
      }
      const preActivity = searchParams.get("activity");
      if (preActivity) {
        setSourceMode("activity");
        setSelectedActivity(preActivity);
      }
      if (clsRes.data) {
        setClasses(clsRes.data);
        const preClass = searchParams.get("class");
        if (preClass) setSelectedClass(preClass);
        else if (clsRes.data.length > 0) setSelectedClass(clsRes.data[0].id);
      }
    });
  }, [router, searchParams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClass) return;
    if (sourceMode === "activity" && !selectedActivity) return;
    if (sourceMode === "lesson" && !selectedLesson) return;
    setCreating(true);

    let activityId = selectedActivity;
    let lessonId: string | null = null;
    let requiresGrouping = false;

    if (sourceMode === "lesson") {
      // First non-skipped activity = co se reálně spustí jako první.
      // Index v lesson_activities → použij ho jako current_activity_index.
      const firstNonSkipped = lessonActivitiesList.find((la) => !skippedSet.has(la.la_id));
      if (!firstNonSkipped) {
        alert("Žádná aktivita lekce není zaškrtnutá. Vyber aspoň jednu nebo zruš přeskočení.");
        setCreating(false);
        return;
      }
      activityId = firstNonSkipped.activity.id;
      lessonId = selectedLesson;
      requiresGrouping = firstNonSkipped.activity.requires_grouping ?? false;
    } else {
      const { data: act } = await supabase
        .from("activities")
        .select("requires_grouping")
        .eq("id", selectedActivity)
        .single();
      requiresGrouping = act?.requires_grouping ?? false;
    }

    const code = generateCode(6);
    const timerSeconds = timerMode === "none" ? null : Number(timerMode);
    // Najdi index první ne-skipped aktivity (current_activity_index)
    let startIdx = 0;
    if (sourceMode === "lesson") {
      startIdx = lessonActivitiesList.findIndex((la) => !skippedSet.has(la.la_id));
      if (startIdx < 0) startIdx = 0;
    }
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        class_id: selectedClass,
        activity_id: activityId,
        lesson_id: lessonId,
        code,
        is_active: true,
        status: requiresGrouping ? "lobby" : "active",
        timer_seconds: timerSeconds,
        activity_mode: activityMode,
        current_activity_index: startIdx,
        skipped_activity_ids: sourceMode === "lesson" ? Array.from(skippedSet) : [],
      })
      .select()
      .single();

    if (error || !data) {
      alert("Chyba: " + (error?.message ?? ""));
      setCreating(false);
      return;
    }

    const dest = requiresGrouping ? "prezentace" : "vysledky";
    router.push(`/ucitel/session/${data.id}/${dest}`);
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/dashboard" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
            &larr; Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Spustit session</h1>
        <p className="text-foreground/50 text-sm mb-8">Vyber lekci nebo jednotlivou aktivitu, kterou chceš pustit třídě.</p>

        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          {/* Source toggle */}
          <div>
            <label className="block text-foreground/80 text-sm mb-1.5">Zdroj</label>
            <div className="flex gap-2">
              {([["lesson", "📚 Lekce", "Sekvence aktivit"], ["activity", "🧩 Aktivita", "Jediný blok"]] as const).map(([val, label, desc]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSourceMode(val)}
                  className={`flex-1 py-3 px-3 rounded-xl text-sm transition-colors ${
                    sourceMode === val
                      ? "bg-accent/20 border-2 border-accent text-accent"
                      : "border-2 border-primary/30 text-foreground/50 hover:text-white"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[10px] text-foreground/40 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-foreground/80 text-sm mb-1.5">Třída</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              required
              className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
            >
              <option value="">Vyber třídu</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {sourceMode === "lesson" ? (
            <div>
              <label className="block text-foreground/80 text-sm mb-1.5">Lekce</label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                required
                className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
              >
                <option value="">Vyber lekci</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lesson_number != null ? `L${l.lesson_number} — ` : ""}{l.title}
                  </option>
                ))}
              </select>
              {lessons.length === 0 && (
                <p className="text-yellow-400/70 text-xs mt-1.5">Žádná publikovaná lekce — vytvoř ji v <Link href="/ucitel/lekce" className="underline">knihovně lekcí</Link>.</p>
              )}

              {/* Activities checklist for the selected lesson */}
              {selectedLesson && (
                <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-foreground/50">Aktivity v této session</span>
                    <span className="text-xs text-foreground/40">
                      {lessonActivitiesList.length - skippedSet.size}/{lessonActivitiesList.length} zapnuto
                    </span>
                  </div>
                  {loadingLessonActs ? (
                    <p className="text-foreground/40 text-xs">Načítám…</p>
                  ) : lessonActivitiesList.length === 0 ? (
                    <p className="text-foreground/40 text-xs">Lekce nemá žádnou aktivitu.</p>
                  ) : (
                    <div className="space-y-1">
                      {lessonActivitiesList.map((la, idx) => {
                        const isSkipped = skippedSet.has(la.la_id);
                        // Detekuj proč je skipped: pokud má skipped requirement, je to cascade
                        const cascadedFrom = la.requires.filter((r) => skippedSet.has(r));
                        const isCascade = isSkipped && cascadedFrom.length > 0;
                        // Najdi aktivity, které vyžadují TUTO (zobrazit warning)
                        const dependents = lessonActivitiesList
                          .filter((other) => other.requires.includes(la.la_id))
                          .map((other) => other.activity.title);
                        return (
                          <label
                            key={la.la_id}
                            className={`flex items-start gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                              isSkipped ? "opacity-50 bg-primary/5" : "hover:bg-primary/10"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!isSkipped}
                              onChange={() => toggleSkip(la.la_id)}
                              className="mt-1 accent-accent flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${isSkipped ? "line-through text-foreground/40" : "text-white"}`}>
                                  {idx + 1}. {la.activity.title}
                                </span>
                                {la.activity.default_duration_min != null && (
                                  <span className="text-[10px] text-foreground/40">{la.activity.default_duration_min} min</span>
                                )}
                              </div>
                              {isCascade && (
                                <p className="text-[10px] text-yellow-300/70 mt-0.5">
                                  Auto-vypnuto (vyžaduje předchozí aktivitu)
                                </p>
                              )}
                              {!isSkipped && dependents.length > 0 && (
                                <p className="text-[10px] text-foreground/40 mt-0.5">
                                  Vyžaduje: {dependents.join(", ")}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-foreground/40 mt-2">
                    Odškrtnutí ovlivní jen tuto session — šablona lekce zůstane beze změny.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-foreground/80 text-sm mb-1.5">Aktivita</label>
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                required
                className="w-full py-3 px-4 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors"
              >
                <option value="">Vyber aktivitu</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Režim kvízu — pro obě varianty (lesson i activity).
              Procvičování = hinty + okamžitý feedback. Test = bez hodnocení během, výsledky až po skončení. */}
          <div>
            <label className="block text-foreground/80 text-sm mb-1.5">Režim kvízu</label>
            <div className="flex gap-3">
              {(sourceMode === "activity"
                ? ([
                    ["learning", "🎓 Procvičování", "Hinty, okamžitá zpětná vazba, dual-skill"] as const,
                    ["assessment", "📊 Test", "Bez hintů, výsledky až po skončení"] as const,
                    ["mixed", "🔀 Smíšený", "Každá otázka má vlastní režim"] as const,
                  ])
                : ([
                    ["learning", "🎓 Procvičování", "Hinty, okamžitá zpětná vazba, dual-skill"] as const,
                    ["assessment", "📊 Test", "Bez hintů, výsledky až po skončení"] as const,
                  ])
              ).map(([val, label, desc]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setActivityMode(val)}
                  className={`flex-1 py-3 px-2 rounded-xl text-sm transition-colors ${
                    activityMode === val
                      ? "bg-accent/20 border-2 border-accent text-accent"
                      : "border-2 border-primary/30 text-foreground/50 hover:text-white"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-[10px] text-foreground/30 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {sourceMode === "activity" && (
            <>

              <div>
                <label className="block text-foreground/80 text-sm mb-1.5">Časovač na otázku</label>
                <div className="flex gap-3">
                  {([["none", "Bez limitu"], ["30", "30 sekund"], ["60", "60 sekund"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTimerMode(val as "none" | "30" | "60")}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                        timerMode === val
                          ? "bg-accent/20 border-2 border-accent text-accent"
                          : "border-2 border-primary/30 text-foreground/50 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {timerMode === "none" && (
                  <p className="text-foreground/30 text-xs mt-1.5">Učitel uzavírá odpovědi manuálně</p>
                )}
              </div>
            </>
          )}

          {sourceMode === "lesson" && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-foreground/60">
              Lekce běží <strong>postupně pod vedením učitele</strong>. Každou aktivitu spouštíš ručně
              — žáci společně procházejí kvíz po jedné otázce, mezi aktivitami čekají na pokyn.
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3.5 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors mt-2"
          >
            {creating ? "Vytvářím..." : "Spustit"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NovaSessionPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    }>
      <NovaSessionContent />
    </Suspense>
  );
}
