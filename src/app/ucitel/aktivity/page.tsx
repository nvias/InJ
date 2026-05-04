"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Activity } from "@/types";

const TYPE_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  quiz: { emoji: "🎯", label: "Kvíz", color: "bg-accent/20 text-accent border-accent/40" },
  open: { emoji: "✍️", label: "Brainstorm", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
  peer_review: { emoji: "🗳️", label: "Hlasování", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
  group_work: { emoji: "👥", label: "Skupinová", color: "bg-green-400/20 text-green-300 border-green-400/40" },
  photo_upload: { emoji: "📸", label: "Foto", color: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40" },
  video_upload: { emoji: "🎥", label: "Video", color: "bg-rose-400/20 text-rose-300 border-rose-400/40" },
  ab_decision: { emoji: "⚖️", label: "AB Decision", color: "bg-blue-400/20 text-blue-300 border-blue-400/40" },
  ab_with_explanation: { emoji: "📝", label: "AB+Vysv.", color: "bg-blue-400/20 text-blue-300 border-blue-400/40" },
  scale: { emoji: "📊", label: "Škála", color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40" },
  team_forge: { emoji: "🛡️", label: "Team Forge", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
  pitch_duel: { emoji: "🎤", label: "Pitch Duel", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
  multi_activity: { emoji: "🧩", label: "Multi (legacy)", color: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40" },
};

function badgeFor(type: string) {
  return TYPE_BADGE[type] ?? { emoji: "📦", label: type, color: "bg-primary/20 text-foreground/60 border-primary/40" };
}

const TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "Vše" },
  { key: "quiz", label: "Kvíz" },
  { key: "open", label: "Brainstorm" },
  { key: "peer_review", label: "Hlasování" },
  { key: "photo_upload", label: "Foto" },
  { key: "team_forge", label: "Team Forge" },
  { key: "pitch_duel", label: "Pitch Duel" },
];

const DURATION_FILTERS: Array<{ key: string; label: string; max: number | null }> = [
  { key: "all", label: "Jakákoliv délka", max: null },
  { key: "short", label: "≤ 15 min", max: 15 },
  { key: "medium", label: "≤ 30 min", max: 30 },
  { key: "long", label: "≤ 60 min", max: 60 },
];

export default function AktivityKnihovnaPage() {
  const [authorized, setAuthorized] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [usageCounts, setUsageCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    loadActivities();
  }, [router]);

  async function loadActivities() {
    setLoading(true);
    const [{ data: acts }, { data: links }] = await Promise.all([
      supabase.from("activities").select("*").order("title"),
      supabase.from("lesson_activities").select("activity_id"),
    ]);
    setActivities((acts ?? []) as Activity[]);
    const counts = new Map<string, number>();
    for (const link of (links ?? []) as Array<{ activity_id: string }>) {
      counts.set(link.activity_id, (counts.get(link.activity_id) ?? 0) + 1);
    }
    setUsageCounts(counts);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const durMax = DURATION_FILTERS.find((f) => f.key === durationFilter)?.max ?? null;
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (durMax != null && (a.default_duration_min ?? 0) > durMax) return false;
      if (q && !a.title.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, typeFilter, durationFilter, search]);

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
            <h1 className="text-2xl font-bold text-white">Knihovna aktivit</h1>
            <p className="text-foreground/50 text-sm mt-1">Atomické bloky, ze kterých se skládají lekce.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/ucitel/lekce"
              className="px-4 py-2.5 border border-primary/40 text-foreground/70 hover:text-white rounded-xl transition-colors font-medium"
            >
              Knihovna lekcí
            </Link>
            <Link
              href="/ucitel/otazky/nova"
              className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-background font-semibold rounded-xl transition-colors"
            >
              + Nová aktivita
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 space-y-3">
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle názvu nebo popisu…"
              className="w-full bg-background border border-primary/30 focus:border-accent rounded-lg px-4 py-2 text-white outline-none transition-colors text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] uppercase tracking-wider text-foreground/40 self-center mr-1">Typ:</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  typeFilter === f.key
                    ? "bg-accent text-background font-bold"
                    : "bg-primary/10 text-foreground/60 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] uppercase tracking-wider text-foreground/40 self-center mr-1">Délka:</span>
            {DURATION_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setDurationFilter(f.key)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  durationFilter === f.key
                    ? "bg-accent text-background font-bold"
                    : "bg-primary/10 text-foreground/60 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-foreground/40 text-sm">Načítám aktivity...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-primary/30 rounded-2xl">
            <p className="text-foreground/40 text-lg">Žádná aktivita neodpovídá filtru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((a) => {
              const badge = badgeFor(a.type);
              const usage = usageCounts.get(a.id) ?? 0;
              return (
                <Link
                  key={a.id}
                  href={`/ucitel/aktivita/${a.id}`}
                  className="block border border-primary/30 rounded-xl p-4 hover:border-accent/50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider whitespace-nowrap ${badge.color}`}>
                      {badge.emoji} {badge.label}
                    </span>
                    {usage > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-foreground/50">
                        v {usage} {usage === 1 ? "lekci" : usage < 5 ? "lekcích" : "lekcích"}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-white group-hover:text-accent transition-colors mt-2 mb-1">
                    {a.title}
                  </h2>
                  {a.description && (
                    <p className="text-foreground/50 text-xs line-clamp-2">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-foreground/40 mt-2">
                    {a.default_duration_min ? <span>⏱ {a.default_duration_min} min</span> : null}
                    {a.questions?.length ? <span>{a.questions.length} otázek</span> : null}
                    {a.team_size > 1 ? <span>👥 {a.team_size}</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
