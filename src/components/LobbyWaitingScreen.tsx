"use client";

import { useEffect, useState } from "react";
import { findStudentGroup } from "@/lib/groups";
import type { GroupWithMembers } from "@/types";

// ═══════════════════════════════════════════════
// LobbyWaitingScreen — žák čeká, až učitel rozdělí
// třídu do skupin a spustí hru.
// Zobrazí svou aktuální skupinu (pokud už byla přiřazena).
// ═══════════════════════════════════════════════

interface Props {
  sessionId: string;
  studentId: string;
  studentName: string;
  studentEmoji: string;
  activityTitle: string;
}

export default function LobbyWaitingScreen({ sessionId, studentId, studentName, studentEmoji, activityTitle }: Props) {
  const [myGroup, setMyGroup] = useState<GroupWithMembers | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const g = await findStudentGroup(sessionId, studentId);
      if (!cancelled) setMyGroup(g);
    };
    tick();
    const i = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(i); };
  }, [sessionId, studentId]);

  return (
    <main className="min-h-screen bg-[#0A0F2E] text-white p-6 flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">{studentEmoji}</div>
        <div className="text-xs tracking-[0.3em] text-[#00D4FF]/70 uppercase">// LOBBY</div>
        <h1 className="text-2xl font-black tracking-wider mt-1 max-w-md">{activityTitle}</h1>
      </div>

      {myGroup ? (
        <div className="bg-white/[0.04] border border-[#00D4FF]/40 rounded-xl p-6 w-full max-w-md">
          <div className="text-xs tracking-[0.18em] text-[#00D4FF] font-bold mb-3 text-center">
            TY JSI VE SKUPINĚ {myGroup.group_index}
          </div>
          <div className="space-y-2">
            {myGroup.members.map((m) => {
              const isMe = m.student_id === studentId;
              return (
                <div
                  key={m.student_id}
                  className={`flex items-center gap-3 p-3 rounded ${isMe ? "bg-[#00D4FF]/10 border border-[#00D4FF]/40" : "bg-white/5 border border-white/10"}`}
                  style={{ borderLeftWidth: 4, borderLeftColor: m.avatar_color }}
                >
                  <span className="text-2xl">{m.avatar_emoji}</span>
                  <span className="flex-1 font-bold">{m.display_name}</span>
                  {isMe && <span className="text-xs text-[#00D4FF] tracking-wider">TY</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-5 text-center text-sm text-white/50 animate-pulse">
            Čekáme až učitel spustí hru…
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-8 w-full max-w-md text-center">
          <div className="text-3xl mb-4">👥</div>
          <div className="text-sm text-white/70 mb-2">Připojen jako</div>
          <div className="text-lg font-bold text-[#00D4FF] mb-4">{studentName}</div>
          <div className="text-sm text-white/50 animate-pulse">
            Učitel rozhází žáky do skupin…
          </div>
        </div>
      )}
    </main>
  );
}
