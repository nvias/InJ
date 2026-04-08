"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Activity, Question } from "@/types";
import QuizDetail from "@/components/activity-details/QuizDetail";
import TeamForgeDetail from "@/components/activity-details/TeamForgeDetail";
import PitchDuelDetail from "@/components/activity-details/PitchDuelDetail";

export default function AktivitaDetailPage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") { router.replace("/ucitel"); return; }
    setAuthorized(true);
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, params.id]);

  async function loadActivity() {
    const { data } = await supabase.from("activities").select("*").eq("id", params.id).single();
    if (data) setActivity(data);
  }

  if (!authorized || !activity) {
    return <main className="min-h-screen flex items-center justify-center bg-background"><p className="text-foreground/60">Načítání...</p></main>;
  }

  // Type label for header badge
  const typeBadges: Record<string, { label: string; color: string }> = {
    quiz: { label: "Kvíz", color: "bg-accent/20 text-accent border-accent/40" },
    team_forge: { label: "Team Forge", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
    pitch_duel: { label: "Pitch Duel", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
  };
  const badge = typeBadges[activity.type] || { label: activity.type, color: "bg-primary/20 text-foreground/50 border-primary/40" };

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/dashboard" className="text-sm text-foreground/60 hover:text-foreground">&larr; Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${badge.color}`}>
              {badge.label}
            </span>
            {activity.team_size > 1 && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-foreground/50">
                👥 {activity.team_size} žáci
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white">{activity.title}</h1>
          {activity.description && <p className="text-foreground/50 mt-2">{activity.description}</p>}
        </div>

        {/* Type-specific detail view */}
        {activity.type === "team_forge" && <TeamForgeDetail activity={activity} />}
        {activity.type === "pitch_duel" && <PitchDuelDetail activity={activity} />}
        {(activity.type === "quiz" || !["team_forge", "pitch_duel"].includes(activity.type)) && (
          <QuizDetail activity={activity} onUpdate={(qs: Question[]) => setActivity({ ...activity, questions: qs })} />
        )}
      </div>
    </main>
  );
}
