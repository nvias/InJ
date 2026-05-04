"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PeerReviewSubActivity } from "@/types";

interface VotingStepProps {
  subActivity: PeerReviewSubActivity;
  studentId: string;
  sessionId: string;
  onComplete: (xpGained: number) => void;
}

interface Member {
  studentId: string;
  displayName: string;
  avatarEmoji: string;
}

interface Idea {
  eventId: string;
  authorStudentId: string;
  authorName: string;
  authorEmoji: string;
  text: string;
}

type Phase = "presenting" | "voting" | "submitted";

interface GroupState {
  presenter_order?: string[];
  current_presenter_idx?: number;
  current_presenter_ready_at?: number | null;
}

const DEFAULT_PER_SPEAKER_MS = 60_000;            // 1 minuta na žáka
const ADVANCE_GRACE_MS = 1500;                    // krátký přesah, ať timer doběhne plynule

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VotingStep({ subActivity, studentId, sessionId, onComplete }: VotingStepProps) {
  const sourceId = subActivity.source_activity_id;
  const xp = subActivity.xp_complete ?? 50;
  const maxVotes = Math.min(subActivity.votes_per_student ?? 2, 2);
  // Per-speaker length: lookup via subActivity if available; fallback default
  // (config field name `per_speaker_ms` v activity.config se sem nenese — adapter by ho mohl
  // přilepit; pro pilot použijeme default a config volitelně později.)
  const perSpeakerMs = DEFAULT_PER_SPEAKER_MS;

  const [phase, setPhase] = useState<Phase>("presenting");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [presenterOrder, setPresenterOrder] = useState<string[]>([]);
  const [currentPresenterIdx, setCurrentPresenterIdx] = useState(0);
  const [currentReadyAt, setCurrentReadyAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [winner, setWinner] = useState<{ idea: Idea | null; votes: number; total: number } | null>(null);
  const orderInitRef = useRef(false);

  // ─── Load group + members + ideas + state ─────────────────────────
  const loadAll = useCallback(async () => {
    // Najdi skupinu
    const { data: groups } = await supabase
      .from("session_groups")
      .select("id")
      .eq("session_id", sessionId);
    const groupIds = (groups ?? []).map((g) => g.id as string);
    if (groupIds.length === 0) {
      setLoading(false);
      return;
    }
    const { data: memberRow } = await supabase
      .from("session_group_members")
      .select("group_id")
      .eq("student_id", studentId)
      .in("group_id", groupIds)
      .limit(1)
      .maybeSingle();

    if (!memberRow) {
      setLoading(false);
      return;
    }
    const gid = memberRow.group_id as string;
    setGroupId(gid);

    const { data: groupRow } = await supabase
      .from("session_groups")
      .select("group_name, state")
      .eq("id", gid)
      .single();
    if (groupRow) {
      setGroupName(groupRow.group_name ?? "");
      const state = (groupRow.state ?? {}) as GroupState;
      setPresenterOrder(Array.isArray(state.presenter_order) ? state.presenter_order : []);
      setCurrentPresenterIdx(state.current_presenter_idx ?? 0);
      setCurrentReadyAt(state.current_presenter_ready_at ?? null);
    }

    // Členové skupiny
    const { data: groupMembers } = await supabase
      .from("session_group_members")
      .select("student_id, students(display_name, avatar_emoji)")
      .eq("group_id", gid);

    const mems: Member[] = (groupMembers ?? []).map((row) => {
      const r = row as unknown as { student_id: string; students: { display_name: string; avatar_emoji: string } | null };
      return {
        studentId: r.student_id,
        displayName: r.students?.display_name ?? "Žák",
        avatarEmoji: r.students?.avatar_emoji ?? "🦊",
      };
    });
    setMembers(mems);

    // Nápady (text_submit) jen od členů
    if (sourceId && mems.length > 0) {
      const memberIds = mems.map((m) => m.studentId);
      const { data: events } = await supabase
        .from("student_events")
        .select("id, answer, student_id")
        .eq("session_id", sessionId)
        .eq("question_id", sourceId)
        .eq("event_type", "text_submit")
        .in("student_id", memberIds);

      const ideaList: Idea[] = (events ?? [])
        .filter((e) => typeof e.answer === "string" && (e.answer as string).trim().length > 0)
        .map((e) => {
          const author = mems.find((m) => m.studentId === e.student_id);
          return {
            eventId: e.id as string,
            authorStudentId: e.student_id as string,
            authorName: author?.displayName ?? "Žák",
            authorEmoji: author?.avatarEmoji ?? "🦊",
            text: (e.answer as string).trim(),
          };
        });
      setIdeas(ideaList);
    }

    setLoading(false);
  }, [sessionId, studentId, sourceId]);

  // Initial load + polling 2 s
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 2000);
    return () => clearInterval(id);
  }, [loadAll]);

  // Pravidelný "now" tick pro countdown
  useEffect(() => {
    if (phase !== "presenting") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  // Inicializuj presenter_order na první načtení (pokud chybí). Pouze první klient,
  // kdo načte se členy a bez orderu — race-condition tolerantní (last write wins,
  // všichni klienti pak na dalším pollu uvidí stejný order).
  useEffect(() => {
    if (loading || !groupId || orderInitRef.current) return;
    if (presenterOrder.length > 0) return;
    if (members.length === 0) return;
    // Jen členové, kteří mají nápad (jinak nemá co prezentovat)
    const memberIdsWithIdeas = members
      .map((m) => m.studentId)
      .filter((mid) => ideas.some((i) => i.authorStudentId === mid));
    if (memberIdsWithIdeas.length === 0) return;

    orderInitRef.current = true;
    const order = shuffle(memberIdsWithIdeas);
    setPresenterOrder(order);
    supabase.from("session_groups")
      .update({ state: { presenter_order: order, current_presenter_idx: 0, current_presenter_ready_at: null } })
      .eq("id", groupId)
      .then(() => {});
  }, [loading, groupId, presenterOrder.length, members, ideas]);

  // Auto-advance, když current presenter dokončí svůj čas
  useEffect(() => {
    if (phase !== "presenting") return;
    if (!groupId || presenterOrder.length === 0) return;
    if (currentReadyAt == null) return;
    const elapsed = now - currentReadyAt;
    if (elapsed < perSpeakerMs + ADVANCE_GRACE_MS) return;
    // Pokus se advancovat: přepočítáno z nuly, last write wins
    const nextIdx = currentPresenterIdx + 1;
    supabase.from("session_groups")
      .update({ state: { presenter_order: presenterOrder, current_presenter_idx: nextIdx, current_presenter_ready_at: null } })
      .eq("id", groupId)
      .then(() => {
        setCurrentPresenterIdx(nextIdx);
        setCurrentReadyAt(null);
      });
  }, [phase, now, currentReadyAt, currentPresenterIdx, presenterOrder, groupId, perSpeakerMs]);

  // Když jsou všichni presentující hotoví → přepni do voting
  useEffect(() => {
    if (phase !== "presenting") return;
    if (presenterOrder.length === 0) return;
    if (currentPresenterIdx >= presenterOrder.length) {
      setPhase("voting");
    }
  }, [phase, currentPresenterIdx, presenterOrder.length]);

  // ─── Akce ─────────────────────────────────────────────────────────
  async function markReady() {
    if (!groupId) return;
    const ts = Date.now();
    setCurrentReadyAt(ts);
    await supabase.from("session_groups")
      .update({ state: { presenter_order: presenterOrder, current_presenter_idx: currentPresenterIdx, current_presenter_ready_at: ts } })
      .eq("id", groupId);
  }

  // Manuální posun na dalšího presentera (presenter klikne "Hotovo" když je rychlejší než limit)
  async function advanceNow() {
    if (!groupId) return;
    const nextIdx = currentPresenterIdx + 1;
    setCurrentPresenterIdx(nextIdx);
    setCurrentReadyAt(null);
    await supabase.from("session_groups")
      .update({ state: { presenter_order: presenterOrder, current_presenter_idx: nextIdx, current_presenter_ready_at: null } })
      .eq("id", groupId);
  }

  function toggleVote(eventId: string) {
    if (phase !== "voting") return;
    setSelected((prev) => {
      if (prev.includes(eventId)) return prev.filter((x) => x !== eventId);
      if (prev.length >= maxVotes) return prev;
      return [...prev, eventId];
    });
  }

  async function handleSubmitVotes() {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);

    const rows = selected.map((eventId, idx) => {
      const idea = ideas.find((i) => i.eventId === eventId);
      return {
        student_id: studentId,
        session_id: sessionId,
        question_id: subActivity.id,
        event_type: "vote",
        answer: JSON.stringify({ voted_event_id: eventId, voted_text: idea?.text ?? "" }),
        is_correct: false,
        attempt_no: idx + 1,
        duration_ms: 0,
      };
    });
    await supabase.from("student_events").insert(rows);

    const { data: allVotes } = await supabase
      .from("student_events")
      .select("student_id")
      .eq("session_id", sessionId)
      .eq("question_id", subActivity.id)
      .eq("event_type", "vote");

    const uniqueVoters = new Set((allVotes ?? []).map((v) => v.student_id));
    const allVoted = members.every((m) => uniqueVoters.has(m.studentId));
    if (allVoted) await computeAndShowWinner();

    setPhase("submitted");
    setSubmitting(false);
    setTimeout(() => onComplete(xp), 2000);
  }

  async function computeAndShowWinner() {
    const { data: voteEvents } = await supabase
      .from("student_events")
      .select("answer")
      .eq("session_id", sessionId)
      .eq("question_id", subActivity.id)
      .eq("event_type", "vote");
    if (!voteEvents) return;
    const counts = new Map<string, number>();
    for (const v of voteEvents) {
      try {
        const parsed = JSON.parse(v.answer as string) as { voted_event_id: string };
        counts.set(parsed.voted_event_id, (counts.get(parsed.voted_event_id) ?? 0) + 1);
      } catch { /* ignore */ }
    }
    let winnerId: string | null = null;
    let winnerVotes = 0;
    for (const [id, c] of Array.from(counts.entries())) {
      if (c > winnerVotes) { winnerId = id; winnerVotes = c; }
    }
    const winningIdea = ideas.find((i) => i.eventId === winnerId) ?? null;
    setWinner({ idea: winningIdea, votes: winnerVotes, total: voteEvents.length });
  }

  // ─── Computed ─────────────────────────────────────────────────────
  const myIdea = useMemo(() => ideas.find((i) => i.authorStudentId === studentId), [ideas, studentId]);
  const currentPresenterId = presenterOrder[currentPresenterIdx];
  const currentPresenter = members.find((m) => m.studentId === currentPresenterId);
  const currentIdea = ideas.find((i) => i.authorStudentId === currentPresenterId);
  const iAmCurrent = currentPresenterId === studentId;
  const presentationActive = currentReadyAt != null;
  const remainingMs = presentationActive ? Math.max(0, perSpeakerMs - (now - (currentReadyAt ?? 0))) : perSpeakerMs;
  const remainingSec = Math.ceil(remainingMs / 1000);

  // (revealedAuthorIds bývalo použito pro zobrazení už představených nápadů během prezentace —
  // odstraněno na základě UX feedbacku: žák během prezentací vidí jen svůj nápad, ostatní
  // se odhalí až ve voting fázi.)

  // ─── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-foreground/50 text-sm">Načítám tvou skupinu...</p>
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-5 text-yellow-200/80 text-sm text-center">
        <div className="text-3xl mb-3">⚠️</div>
        Nejsi zařazen/a do žádné skupiny. Učitel by měl/a nejdřív rozdělit třídu do týmů.
      </div>
    );
  }

  if (presenterOrder.length === 0) {
    return (
      <div className="text-center py-10 animate-fade-in">
        <div className="text-4xl mb-3">⏳</div>
        <p className="text-foreground/60">Připravuji prezentace ve skupině...</p>
      </div>
    );
  }

  // ─ PHASE: PRESENTING ─────────────────────────────────────────────
  if (phase === "presenting") {
    const upcoming = !presentationActive;     // ještě se nepřišlo na "ready"
    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-wider text-foreground/40 mb-1">
            Představení příležitostí{groupName ? ` · ${groupName}` : ""}
          </div>
          <p className="text-foreground/50 text-sm">
            Prezentuje {currentPresenterIdx + 1} z {presenterOrder.length}
          </p>
        </div>

        {/* Centerpiece — ready gate / countdown / waiting */}
        {iAmCurrent && upcoming ? (
          <ReadyGate presenterName="ty" perSpeakerSec={Math.round(perSpeakerMs / 1000)} onReady={markReady} />
        ) : iAmCurrent && presentationActive ? (
          <>
            <PresentingNow
              isMe
              ideaText={currentIdea?.text ?? ""}
              remainingSec={remainingSec}
              perSpeakerSec={Math.round(perSpeakerMs / 1000)}
            />
            <button
              onClick={advanceNow}
              className="mt-3 w-full py-3 border-2 border-accent/40 text-accent hover:bg-accent/10 font-bold rounded-xl transition-colors"
            >
              ✓ Hotovo, posunout dál
            </button>
          </>
        ) : !iAmCurrent && upcoming ? (
          <UpcomingWait
            presenterName={currentPresenter?.displayName ?? "Spolužák"}
            presenterEmoji={currentPresenter?.avatarEmoji ?? "🦊"}
          />
        ) : (
          <PresentingNow
            isMe={false}
            presenterName={currentPresenter?.displayName ?? "Spolužák"}
            presenterEmoji={currentPresenter?.avatarEmoji ?? "🦊"}
            ideaText={currentIdea?.text ?? ""}
            remainingSec={remainingSec}
            perSpeakerSec={Math.round(perSpeakerMs / 1000)}
          />
        )}

        {/* Pořadí prezentujících (status) */}
        <div className="mt-5 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2">Pořadí</div>
          <div className="flex flex-wrap gap-1.5">
            {presenterOrder.map((sid, i) => {
              const m = members.find((mm) => mm.studentId === sid);
              const isDone = i < currentPresenterIdx;
              const isActive = i === currentPresenterIdx;
              return (
                <div
                  key={sid}
                  className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                    isDone
                      ? "bg-accent/15 text-accent/70"
                      : isActive
                      ? "bg-accent/30 text-accent font-bold"
                      : "bg-primary/10 text-foreground/40"
                  }`}
                >
                  <span>{m?.avatarEmoji ?? "🦊"}</span>
                  <span>{sid === studentId ? "ty" : (m?.displayName ?? "Žák")}</span>
                  {isDone && <span>✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Žák během prezentací vidí jen svůj vlastní nápad — ostatní (i ty už představené)
            se zobrazí až ve voting fázi, ať to neruší pozornost. */}
        {myIdea && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-2">
              Tvůj nápad
            </div>
            <IdeaCard idea={myIdea} highlight="me" />
          </div>
        )}
      </div>
    );
  }

  // ─ PHASE: VOTING ─────────────────────────────────────────────────
  if (phase === "voting") {
    const votable = ideas.filter((i) => i.authorStudentId !== studentId);
    return (
      <div className="flex flex-col">
        <h2 className="text-2xl font-bold text-white mb-2">Hlasování ve skupině</h2>
        <p className="text-foreground/60 text-sm mb-3">
          Všichni už představili své nápady. Vyber max <span className="text-accent font-bold">{maxVotes}</span> nápady,
          které tě nejvíc zaujaly. Vlastní nápad nemůžeš volit. Hlasování je <span className="font-semibold">anonymní</span>.
        </p>
        <p className="text-foreground/50 text-xs mb-4">
          Vybráno: <span className="text-accent font-bold">{selected.length}/{maxVotes}</span>
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {votable.length === 0 ? (
            <p className="text-foreground/40 text-sm text-center py-6">Není pro koho hlasovat — ostatní nenapsali žádné nápady.</p>
          ) : (
            votable.map((idea, i) => {
              const isSelected = selected.includes(idea.eventId);
              const isFull = selected.length >= maxVotes && !isSelected;
              return (
                <button
                  key={idea.eventId}
                  onClick={() => toggleVote(idea.eventId)}
                  disabled={isFull}
                  className={`text-left rounded-xl px-4 py-3 transition-all border-2 ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : isFull
                      ? "border-primary/20 opacity-40 cursor-not-allowed"
                      : "border-primary/30 hover:border-accent/60 hover:bg-primary/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? "bg-accent text-background" : "bg-primary/20 text-foreground/60"
                    }`}>
                      {isSelected ? "✓" : String.fromCharCode(65 + i)}
                    </div>
                    <p className="text-white text-sm leading-relaxed">{idea.text}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={handleSubmitVotes}
          disabled={selected.length === 0 || submitting || votable.length === 0}
          className={`py-4 rounded-xl font-bold transition-all ${
            selected.length > 0 && !submitting && votable.length > 0
              ? "bg-accent text-background hover:bg-accent/90"
              : "bg-primary/20 text-foreground/30 cursor-not-allowed"
          }`}
        >
          {submitting ? "Odesílám..." : `Potvrdit hlasování (${selected.length})`}
        </button>
      </div>
    );
  }

  // ─ PHASE: SUBMITTED ─────────────────────────────────────────────
  return (
    <div className="text-center py-12 animate-fade-in">
      <div className="text-6xl mb-4">🗳️</div>
      <h2 className="text-2xl font-bold text-accent mb-3">Hlasy odeslány!</h2>
      {winner?.idea ? (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-4 text-left">
          <p className="text-xs uppercase tracking-wider text-accent mb-2">Týmová příležitost</p>
          <p className="text-white text-sm leading-relaxed">{winner.idea.text}</p>
          <p className="text-foreground/50 text-xs mt-2">{winner.votes} z {winner.total} hlasů</p>
        </div>
      ) : (
        <p className="text-foreground/60 mb-6">Čekáme až dohlasují i ostatní.</p>
      )}
      <div className="text-4xl font-bold text-accent">+{xp} XP</div>
    </div>
  );
}

// ─── Sub-komponenty ────────────────────────────────────────────────

function ReadyGate({ presenterName, perSpeakerSec, onReady }: {
  presenterName: string; perSpeakerSec: number; onReady: () => void;
}) {
  return (
    <div className="bg-yellow-400/10 border-2 border-yellow-400/40 rounded-2xl p-6 text-center animate-fade-in">
      <div className="text-5xl mb-3">⏰</div>
      <p className="text-yellow-200 font-bold text-lg mb-1">Pozor, {presenterName} budeš prezentovat!</p>
      <p className="text-foreground/70 text-sm mb-5">
        Máš na to <span className="text-yellow-200 font-bold">{perSpeakerSec} sekund</span>. Než kliknu, mám chvíli na přípravu.
      </p>
      <button
        onClick={onReady}
        className="px-8 py-4 bg-yellow-400 text-background font-bold rounded-xl hover:bg-yellow-300 transition-colors text-lg"
      >
        Jdu na to ▶
      </button>
    </div>
  );
}

function UpcomingWait({ presenterName, presenterEmoji }: { presenterName: string; presenterEmoji: string }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center animate-fade-in">
      <div className="text-5xl mb-3">{presenterEmoji}</div>
      <p className="text-foreground/70 font-medium">Spolužák <span className="text-white font-bold">{presenterName}</span> se připravuje na prezentaci</p>
      <p className="text-foreground/40 text-sm mt-2">Čekej, než klikne „Jdu na to"…</p>
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-foreground/40 text-xs">Sleduji</span>
      </div>
    </div>
  );
}

function PresentingNow({
  isMe, presenterName, presenterEmoji, ideaText, remainingSec, perSpeakerSec,
}: {
  isMe: boolean;
  presenterName?: string;
  presenterEmoji?: string;
  ideaText: string;
  remainingSec: number;
  perSpeakerSec: number;
}) {
  const pct = Math.max(0, Math.min(100, (remainingSec / perSpeakerSec) * 100));
  const lowTime = remainingSec <= 10;
  return (
    <div className={`border-2 rounded-2xl p-5 animate-fade-in ${isMe ? "border-accent/50 bg-accent/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isMe ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase tracking-wider">Prezentuješ</span>
          ) : (
            <>
              <span className="text-2xl">{presenterEmoji}</span>
              <span className="text-white font-bold">{presenterName}</span>
              <span className="text-xs text-foreground/40">prezentuje</span>
            </>
          )}
        </div>
        <span className={`font-mono font-bold text-2xl ${lowTime ? "text-red-400 animate-pulse" : "text-accent"}`}>
          {remainingSec}s
        </span>
      </div>
      {/* Text nápadu vidí JEN samotný presenter (sám sobě) — listener má poslouchat mluvčího, ne číst */}
      {isMe ? (
        <p className="text-white text-sm leading-relaxed mb-3 whitespace-pre-line">{ideaText || "(prázdný nápad)"}</p>
      ) : (
        <p className="text-foreground/40 text-sm italic mb-3 text-center">Poslouchej, co mluvčí říká…</p>
      )}
      <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${lowTime ? "bg-red-400" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function IdeaCard({ idea, highlight }: { idea: Idea; highlight: "me" | "other" }) {
  return (
    <div className={`rounded-xl px-3 py-2 border ${highlight === "me" ? "border-accent/40 bg-accent/5" : "border-primary/20 bg-primary/5"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{idea.authorEmoji}</span>
        <span className="text-xs text-foreground/60">
          {highlight === "me" ? "Tvůj nápad" : idea.authorName}
        </span>
      </div>
      <p className="text-foreground/80 text-sm leading-relaxed">{idea.text}</p>
    </div>
  );
}
