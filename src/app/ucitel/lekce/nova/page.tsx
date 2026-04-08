"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { generateCode } from "@/lib/utils";
import type { Activity, Class } from "@/types";

function NovaLekceContent() {
  const [authorized, setAuthorized] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [timerMode, setTimerMode] = useState<"none" | "30" | "60">("none");
  const [activityMode, setActivityMode] = useState<"learning" | "assessment" | "mixed">("learning");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);

    Promise.all([
      supabase.from("activities").select("*"),
      supabase.from("classes").select("*").order("created_at", { ascending: false }),
    ]).then(([actRes, clsRes]) => {
      if (actRes.data) setActivities(actRes.data);
      if (clsRes.data) {
        setClasses(clsRes.data);
        const preselect = searchParams.get("class");
        if (preselect) setSelectedClass(preselect);
        else if (clsRes.data.length > 0) setSelectedClass(clsRes.data[0].id);
      }
    });
  }, [router, searchParams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedActivity || !selectedClass) return;
    setCreating(true);

    const code = generateCode(6);
    const timerSeconds = timerMode === "none" ? null : Number(timerMode);
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        class_id: selectedClass,
        activity_id: selectedActivity,
        code,
        is_active: true,
        timer_seconds: timerSeconds,
        activity_mode: activityMode,
      })
      .select()
      .single();

    if (error || !data) {
      alert("Chyba: " + (error?.message ?? ""));
      setCreating(false);
      return;
    }

    router.push(`/ucitel/lekce/${data.id}/vysledky`);
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
        <h1 className="text-3xl font-bold text-white mb-8">Nová lekce</h1>

        <form onSubmit={handleCreate} className="flex flex-col gap-6">
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

          <div>
            <label className="block text-foreground/80 text-sm mb-1.5">Režim aktivity</label>
            <div className="flex gap-3">
              {([
                ["learning", "🎓 Procvičování", "Více pokusů, nápovědy, práce s chybou"] as const,
                ["assessment", "📊 Ověření", "Jeden pokus, bez nápověd"] as const,
                ["mixed", "🔀 Smíšený", "Každá otázka má vlastní režim"] as const,
              ]).map(([val, label, desc]) => (
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

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3.5 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors mt-2"
          >
            {creating ? "Vytvářím..." : "Spustit lekci"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function NovaLekcePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    }>
      <NovaLekceContent />
    </Suspense>
  );
}
