"use client";

import { useMemo } from "react";
import type { Activity, SubActivity } from "@/types";

interface Props {
  activity: Activity;
}

const TYPE_BADGE: Record<SubActivity["type"], { label: string; color: string; emoji: string }> = {
  quiz: { label: "Kvíz", emoji: "🎯", color: "bg-accent/20 text-accent border-accent/40" },
  open: { label: "Brainstorm", emoji: "✍️", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
  peer_review: { label: "Hlasování", emoji: "🗳️", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
  group_work: { label: "Skupinová práce", emoji: "📸", color: "bg-green-400/20 text-green-300 border-green-400/40" },
};

export default function MultiActivityDetail({ activity }: Props) {
  const subs = useMemo<SubActivity[]>(
    () => [...(activity.sub_activities ?? [])].sort((a, b) => a.order - b.order),
    [activity.sub_activities]
  );

  const totalDuration = subs.reduce((s, x) => s + (x.duration_min ?? 0), 0);
  const totalXp = subs.reduce((s, x) => s + xpFor(x), 0);

  return (
    <div className="space-y-6">
      {/* Hlavička lekce */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🎓</span>
          <div>
            <div className="text-xs uppercase tracking-wider text-accent/70">Multi-aktivita — sekvence fází</div>
            <div className="text-lg font-bold text-white">
              {subs.length} {subs.length === 1 ? "fáze" : subs.length < 5 ? "fáze" : "fází"} · vlastním tempem (legacy)
            </div>
          </div>
        </div>
        {activity.learning_goal && (
          <div className="bg-background/50 rounded p-3 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Cíl lekce</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{activity.learning_goal}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <Stat label="Délka" value={`${activity.default_duration_min ?? totalDuration} min`} />
          <Stat label="XP odměna" value={`${totalXp} XP`} />
          <Stat label="Velikost skupiny" value={String(activity.team_size)} />
        </div>
      </div>

      {/* Fáze */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-accent uppercase tracking-wider">Fáze lekce</h3>
        {subs.length === 0 && (
          <div className="text-sm text-foreground/50 italic bg-primary/5 border border-primary/20 rounded-xl p-5">
            Lekce zatím nemá žádné fáze. Doplň je v <code className="bg-background/60 px-1.5 py-0.5 rounded">sub_activities</code> JSONB.
          </div>
        )}
        {subs.map((sub, idx) => {
          const badge = TYPE_BADGE[sub.type];
          return (
            <div key={sub.id} className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-lg">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.color}`}>
                      {badge.emoji} {badge.label}
                    </span>
                    {sub.duration_min != null && (
                      <span className="text-[10px] text-foreground/50">⏱ {sub.duration_min} min</span>
                    )}
                    <span className="text-[10px] text-foreground/50">+{xpFor(sub)} XP</span>
                  </div>
                  <h4 className="text-base font-bold text-white">{sub.title}</h4>
                  {sub.description && (
                    <p className="text-sm text-foreground/60 mt-1 leading-relaxed">{sub.description}</p>
                  )}

                  {/* Type-specific preview */}
                  <div className="mt-3">
                    {sub.type === "quiz" && <QuizPreview sub={sub} />}
                    {sub.type === "open" && <OpenPreview sub={sub} />}
                    {sub.type === "peer_review" && <PeerReviewPreview sub={sub} />}
                    {sub.type === "group_work" && <GroupWorkPreview sub={sub} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit hint */}
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-xs text-yellow-200/70">
        💡 Obsah multi-aktivity je v <code className="bg-background/60 px-1.5 py-0.5 rounded">sub_activities</code> JSONB
        (seed: <code className="bg-background/60 px-1.5 py-0.5 rounded">seed-lekce-L5-prilezitost.sql</code>). UI editor přijde později.
      </div>
    </div>
  );
}

function xpFor(sub: SubActivity): number {
  if (sub.type === "quiz") return sub.xp_complete_bonus ?? 0;
  return sub.xp_complete ?? 0;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/50 rounded p-2">
      <div className="text-foreground/40 uppercase tracking-wider text-[10px]">{label}</div>
      <div className="text-white font-bold mt-1">{value}</div>
    </div>
  );
}

function QuizPreview({ sub }: { sub: Extract<SubActivity, { type: "quiz" }> }) {
  return (
    <div className="bg-background/40 rounded p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-foreground/50">{sub.questions.length} otázek · režim {sub.assessment_mode ?? "learning"}</span>
      </div>
      <ol className="space-y-1 text-foreground/70 list-decimal list-inside">
        {sub.questions.slice(0, 5).map((q) => (
          <li key={q.id} className="truncate">{q.text}</li>
        ))}
        {sub.questions.length > 5 && (
          <li className="list-none text-foreground/40 italic">… a další {sub.questions.length - 5}</li>
        )}
      </ol>
    </div>
  );
}

function OpenPreview({ sub }: { sub: Extract<SubActivity, { type: "open" }> }) {
  return (
    <div className="bg-background/40 rounded p-3 text-xs space-y-2">
      <div className="text-foreground/50">
        Žák napíše {sub.min_items}–{sub.max_items} položek
        {sub.ai_feedback && " · AI feedback"}
        {sub.teacher_review && " · learner review"}
      </div>
      {sub.instructions && (
        <div className="text-foreground/70 italic">„{sub.instructions}"</div>
      )}
    </div>
  );
}

function PeerReviewPreview({ sub }: { sub: Extract<SubActivity, { type: "peer_review" }> }) {
  return (
    <div className="bg-background/40 rounded p-3 text-xs text-foreground/70">
      Každý žák hlasuje pro {sub.votes_per_student}, vybere se top {sub.select_top_n ?? "?"}
      {sub.anonymize && " · anonymizováno"}
    </div>
  );
}

function GroupWorkPreview({ sub }: { sub: Extract<SubActivity, { type: "group_work" }> }) {
  return (
    <div className="bg-background/40 rounded p-3 text-xs space-y-2">
      <div className="text-foreground/50">
        Foto upload: {sub.deliverable.min_photos}–{sub.deliverable.max_photos} fotek
        {sub.ai_verification?.enabled && " · AI verifikace"}
        {sub.teacher_review && " · review učitelem"}
      </div>
      {sub.instructions && (
        <div className="text-foreground/70 italic whitespace-pre-line">{sub.instructions}</div>
      )}
      {sub.ai_verification?.checks && sub.ai_verification.checks.length > 0 && (
        <div className="text-foreground/50">
          AI kontroluje: {sub.ai_verification.checks.join(", ")}
        </div>
      )}
    </div>
  );
}
