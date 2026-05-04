"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamRole } from "@/types";
import { TEAM_ROLE_INFO, ALL_TEAM_ROLES } from "@/types";

interface RoleSelectionStepProps {
  activityId: string;
  studentId: string;
  sessionId: string;
  classId: string;
  xp?: number;
  onComplete: (xpGained: number) => void;
}

interface RoleCount {
  role: TeamRole;
  count: number;
}

export default function RoleSelectionStep({
  activityId, studentId, sessionId, classId, xp = 50, onComplete,
}: RoleSelectionStepProps) {
  const [selected, setSelected] = useState<TeamRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [counts, setCounts] = useState<RoleCount[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // Pokud žák tuto aktivitu už dokončil v této session, načti rozložení rolí třídy.
  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      const { data } = await supabase
        .from("student_events")
        .select("answer")
        .eq("student_id", studentId)
        .eq("session_id", sessionId)
        .eq("question_id", activityId)
        .eq("event_type", "role_select")
        .maybeSingle();
      if (cancelled) return;
      if (data?.answer && ALL_TEAM_ROLES.includes(data.answer as TeamRole)) {
        setSelected(data.answer as TeamRole);
        setSubmitted(true);
        loadCounts();
      }
    }
    checkExisting();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, sessionId, activityId]);

  async function loadCounts() {
    setLoadingCounts(true);
    const { data: classmates } = await supabase
      .from("students")
      .select("team_role")
      .eq("class_id", classId);
    const map = new Map<TeamRole, number>();
    for (const role of ALL_TEAM_ROLES) map.set(role, 0);
    for (const s of (classmates ?? [])) {
      const r = s.team_role as TeamRole | null;
      if (r && ALL_TEAM_ROLES.includes(r)) map.set(r, (map.get(r) ?? 0) + 1);
    }
    setCounts(ALL_TEAM_ROLES.map((role) => ({ role, count: map.get(role) ?? 0 })));
    setLoadingCounts(false);
  }

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);

    // 1) Ulož event
    await supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: activityId,
      event_type: "role_select",
      answer: selected,
      is_correct: false,
      attempt_no: 1,
      duration_ms: 0,
    });
    // 2) Update students.team_role (přepíše předchozí volbu)
    await supabase.from("students").update({ team_role: selected }).eq("id", studentId);

    setSubmitted(true);
    setSubmitting(false);
    await loadCounts();
    setTimeout(() => onComplete(xp), 2500);
  }

  if (submitted) {
    const meInfo = selected ? TEAM_ROLE_INFO[selected] : null;
    const total = counts.reduce((s, c) => s + c.count, 0);
    return (
      <div className="animate-fade-in">
        <div className="text-center py-6">
          <div className="text-6xl mb-3">{meInfo?.emoji ?? "🎉"}</div>
          <h2 className="text-2xl font-bold text-white mb-1">Tvoje role: {meInfo?.label}</h2>
          <p className="text-foreground/60 text-sm">{meInfo?.tagline}</p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3">Role ve třídě</h3>
          {loadingCounts ? (
            <p className="text-foreground/40 text-sm">Načítám...</p>
          ) : (
            <div className="space-y-2">
              {counts.map((rc) => {
                const info = TEAM_ROLE_INFO[rc.role];
                const pct = total > 0 ? (rc.count / total) * 100 : 0;
                const isMe = rc.role === selected;
                return (
                  <div key={rc.role} className="flex items-center gap-3">
                    <span className="text-xl">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm ${isMe ? "text-accent font-bold" : "text-white"}`}>{info.label}</span>
                        <span className={`text-xs ${isMe ? "text-accent font-bold" : "text-foreground/50"}`}>{rc.count}</span>
                      </div>
                      <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ${isMe ? "bg-accent" : "bg-primary/60"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <div className="text-3xl font-bold text-accent">+{xp} XP</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-2">Jakou roli v týmu si vybíráš?</h2>
      <p className="text-foreground/60 text-sm mb-5">
        Vyber jednu roli, která ti sedí nejvíc. Pomůže to při sestavování týmů.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {ALL_TEAM_ROLES.map((role) => {
          const info = TEAM_ROLE_INFO[role];
          const isSelected = selected === role;
          return (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={`text-left rounded-xl px-4 py-3 transition-all border-2 ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-primary/30 hover:border-accent/60 hover:bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">{info.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold ${isSelected ? "text-accent" : "text-white"}`}>{info.label}</div>
                  <div className="text-xs text-foreground/60 mt-0.5">„{info.tagline}"</div>
                </div>
                {isSelected && <span className="text-accent text-xl">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className={`mt-6 py-4 rounded-xl font-bold transition-all ${
          selected && !submitting
            ? "bg-accent text-background hover:bg-accent/90"
            : "bg-primary/20 text-foreground/30 cursor-not-allowed"
        }`}
      >
        {submitting ? "Ukládám..." : "Potvrdit roli"}
      </button>
    </div>
  );
}
