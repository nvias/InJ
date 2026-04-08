"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Class, Activity, Session } from "@/types";
import PitchDuelPresentation from "@/components/PitchDuelPresentation";
import TeamForgeTeacherView from "@/components/TeamForgeTeacherView";
import GroupingLobby from "@/components/GroupingLobby";

// ═══════════════════════════════════════════════
// /ucitel/prezentace — generická projektor stránka
// Učitel ji nechá otevřenou na projektoru, ona automaticky:
//   - sleduje aktivní session ve zvolené třídě
//   - vykreslí příslušnou prezentaci podle activity.type
//   - když nic neběží, ukazuje výchozí "idle" obrazovku
// ═══════════════════════════════════════════════

const STORAGE_KEY = "inj-projector-class";

interface SessionWithActivity extends Session {
  activities: Activity | null;
}

export default function ProjectorPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SessionWithActivity | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth + load classes + restore selection from localStorage
  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") { router.replace("/ucitel"); return; }
    setAuthorized(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedClass(stored);
    supabase.from("classes").select("*").order("name").then(({ data }) => {
      if (data) setClasses(data);
      setLoading(false);
    });
  }, [router]);

  // Polling: aktivní session ve vybrané třídě
  const refresh = useCallback(async () => {
    if (!selectedClass) { setActiveSession(null); return; }
    const { data } = await supabase
      .from("sessions")
      .select("*, activities(*)")
      .eq("class_id", selectedClass)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    setActiveSession(data && data.length > 0 ? (data[0] as SessionWithActivity) : null);
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;
    refresh();
    const i = setInterval(refresh, 2000);
    return () => clearInterval(i);
  }, [selectedClass, refresh]);

  function pickClass(id: string) {
    setSelectedClass(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  if (!authorized || loading) {
    return <main className="min-h-screen bg-[#0A0F2E] flex items-center justify-center text-white"><div className="opacity-60">Načítám…</div></main>;
  }

  // Pokud není zvolená třída, zobraz výběr
  if (!selectedClass) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] text-white p-8 flex flex-col items-center justify-center">
        <div className="text-xs tracking-[0.4em] text-cyan-400 uppercase mb-3">// PROJEKTOR</div>
        <h1 className="text-5xl font-black tracking-wider mb-2 bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
          Cesta inovátora
        </h1>
        <p className="text-white/50 mb-8">Vyber třídu, kterou chceš sledovat na projektoru</p>
        <div className="w-full max-w-md space-y-2">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => pickClass(c.id)}
              className="w-full p-4 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-cyan-400/10 hover:border-cyan-400 transition text-left"
            >
              <div className="font-bold text-lg">{c.name}</div>
            </button>
          ))}
          {classes.length === 0 && (
            <div className="text-center text-white/40 py-8">Žádné třídy. Nejdřív vytvoř třídu v dashboardu.</div>
          )}
        </div>
        <Link href="/ucitel/dashboard" className="mt-6 text-xs text-white/40 hover:text-white tracking-wider">← Dashboard</Link>
      </main>
    );
  }

  const className = classes.find((c) => c.id === selectedClass)?.name || "—";

  // Žádná aktivní session — výchozí obrazovka
  if (!activeSession || !activeSession.activities) {
    return (
      <main className="min-h-screen bg-[#0A0F2E] text-white p-8 relative">
        <div className="absolute top-4 right-4 flex gap-2 items-center">
          <span className="text-xs text-white/40">Třída: <span className="text-cyan-400 font-bold">{className}</span></span>
          <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setSelectedClass(null); }} className="text-[10px] text-white/30 hover:text-white">změnit</button>
        </div>
        <div className="min-h-screen flex flex-col items-center justify-center -mt-16">
          <div className="text-xs tracking-[0.4em] text-cyan-400 uppercase mb-4">// CESTA INOVÁTORA</div>
          <h1 className="text-7xl font-black tracking-wider text-center bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent mb-6">
            Hraj si chytře
          </h1>
          <p className="text-2xl text-white/50 mb-12">Think better, live better</p>
          <div className="text-base text-white/40 animate-pulse">
            Žádná aktivní lekce. Spusť aktivitu z dashboardu…
          </div>
        </div>
      </main>
    );
  }

  const activity = activeSession.activities;
  const status = activeSession.status || "active";

  // Lobby fáze
  if (activity.requires_grouping && status === "lobby") {
    return (
      <GroupingLobby
        sessionId={activeSession.id}
        sessionCode={activeSession.code}
        classId={selectedClass}
        activityTitle={activity.title}
        teamSize={activity.team_size || 2}
      />
    );
  }

  // Pitch Duel
  if (activity.type === "pitch_duel") {
    return <PitchDuelPresentation sessionId={activeSession.id} activityTitle={activity.title} />;
  }

  // Team Forge — zatím využijeme TeacherView (single-player, není potřeba speciální projektor)
  if (activity.type === "team_forge") {
    return (
      <TeamForgeTeacherView
        sessionId={activeSession.id}
        activityTitle={activity.title}
        sessionCode={activeSession.code}
        classId={selectedClass}
      />
    );
  }

  // Quiz a další — placeholder, vrátí učitele do plné prezentace
  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white flex flex-col items-center justify-center p-8">
      <div className="text-xs tracking-[0.4em] text-cyan-400 uppercase mb-3">// LEKCE BĚŽÍ</div>
      <h1 className="text-5xl font-black tracking-wider mb-4">{activity.title}</h1>
      <p className="text-white/50 mb-8">Tento typ aktivity zatím nemá projektor view</p>
      <Link
        href={`/ucitel/lekce/${activeSession.id}/prezentace`}
        className="px-6 py-3 bg-cyan-400 text-black font-bold rounded-lg tracking-wider hover:shadow-[0_0_20px_#00D4FF]"
      >
        Otevřít plnou prezentaci →
      </Link>
    </main>
  );
}
