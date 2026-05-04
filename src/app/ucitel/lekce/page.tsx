"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Lesson, LessonActivity, Activity } from "@/types";

interface LessonRow extends Lesson {
  activity_count: number;
  activities_total_duration: number;
}

export default function LekceKnihovnaPage() {
  const [authorized, setAuthorized] = useState(false);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    loadLessons();
  }, [router]);

  async function loadLessons() {
    setLoading(true);
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("*")
      .order("lesson_number", { ascending: true, nullsFirst: false });

    if (!lessonRows) {
      setLessons([]);
      setLoading(false);
      return;
    }

    // Hydrate counts + duration in one query
    const lessonIds = lessonRows.map((l) => l.id);
    const { data: links } = await supabase
      .from("lesson_activities")
      .select("lesson_id, custom_duration_min, activity_id, activities(default_duration_min)")
      .in("lesson_id", lessonIds);

    const counts = new Map<string, { count: number; duration: number }>();
    for (const link of (links ?? []) as unknown as Array<{ lesson_id: string; custom_duration_min: number | null; activities: { default_duration_min: number | null } | null }>) {
      const c = counts.get(link.lesson_id) ?? { count: 0, duration: 0 };
      c.count++;
      const dur = link.custom_duration_min ?? link.activities?.default_duration_min ?? 0;
      c.duration += dur;
      counts.set(link.lesson_id, c);
    }

    const rows: LessonRow[] = lessonRows.map((l) => {
      const c = counts.get(l.id) ?? { count: 0, duration: 0 };
      return { ...l, activity_count: c.count, activities_total_duration: c.duration };
    });
    setLessons(rows);
    setLoading(false);
  }

  async function handleCreate() {
    setCreating(true);
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        title: "Nová lekce",
        description: null,
        is_published: false,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      alert("Chyba při vytváření lekce: " + (error?.message ?? ""));
      return;
    }
    router.push(`/ucitel/lekce/${data.id}`);
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

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Knihovna lekcí</h1>
            <p className="text-foreground/50 text-sm mt-1">Lekce sdružují více aktivit do jednoho učebního bloku.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/ucitel/aktivity"
              className="px-4 py-2.5 border border-primary/40 text-foreground/70 hover:text-white rounded-xl transition-colors font-medium"
            >
              Knihovna aktivit
            </Link>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-background font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {creating ? "Vytvářím..." : "+ Nová lekce"}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-foreground/40 text-sm">Načítám lekce...</p>
        ) : lessons.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-primary/30 rounded-2xl">
            <p className="text-foreground/40 text-lg">Zatím žádná lekce.</p>
            <p className="text-foreground/30 text-sm mt-2">Začni tlačítkem „+ Nová lekce" nebo spusť seed-L5-dvouurovnova.sql.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessons.map((l) => (
              <Link
                key={l.id}
                href={`/ucitel/lekce/${l.id}`}
                className="block border border-primary/30 rounded-xl p-5 hover:border-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {l.lesson_number != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono">
                        L{l.lesson_number}
                      </span>
                    )}
                    {l.phase != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300">
                        Fáze {l.phase}
                      </span>
                    )}
                    {!l.is_published && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300">
                        Koncept
                      </span>
                    )}
                  </div>
                  <span className="text-foreground/30 text-xs group-hover:text-accent transition-colors">→</span>
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-accent transition-colors mb-1">
                  {l.title}
                </h2>
                {l.description && (
                  <p className="text-foreground/50 text-sm mb-3 line-clamp-2">{l.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-foreground/50">
                  <span>📋 {l.activity_count} {l.activity_count === 1 ? "aktivita" : l.activity_count < 5 ? "aktivity" : "aktivit"}</span>
                  <span>⏱ {l.total_duration_min ?? l.activities_total_duration} min</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
