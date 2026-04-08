"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════
// TEAM FORGE - integrace hry z github.com/stepankapko/cestainovatora
// 3 kola: balance dovedností → + osobnostní diverzita → finále
// ═══════════════════════════════════════════════

type Theme = "blue" | "yellow" | "red" | "green";

interface Character {
  id: number;
  name: string;
  theme: Theme;
  typeName: string;
  emoji: string;
  stats: [number, number, number]; // Pečlivost, Nápady, Spolupráce (sum ~100)
}

const CHARACTERS: Character[] = [
  { id: 0, name: "SIMONA",  theme: "yellow", typeName: "Archer",    emoji: "🏹", stats: [31, 10, 59] },
  { id: 1, name: "ZUZANA",  theme: "blue",   typeName: "Bard",      emoji: "🎵", stats: [19, 64, 17] },
  { id: 2, name: "PETRA",   theme: "green",  typeName: "Healer",    emoji: "🌿", stats: [56, 39,  5] },
  { id: 3, name: "VIKTOR",  theme: "red",    typeName: "Scholar",   emoji: "📚", stats: [16, 75,  9] },
  { id: 4, name: "TOMAS",   theme: "green",  typeName: "Ninja",     emoji: "🥷", stats: [28, 15, 57] },
  { id: 5, name: "LUCIE",   theme: "green",  typeName: "Wizard",    emoji: "🔮", stats: [19, 64, 17] },
  { id: 6, name: "RENATA",  theme: "blue",   typeName: "Knight",    emoji: "🛡️", stats: [67, 24,  9] },
  { id: 7, name: "MARKETA", theme: "red",    typeName: "Berserker", emoji: "⚔️", stats: [19,  4, 77] },
  { id: 8, name: "RADEK",   theme: "red",    typeName: "Berserker", emoji: "🪓", stats: [ 7, 22, 71] },
  { id: 9, name: "FILIP",   theme: "yellow", typeName: "Sorceress", emoji: "✨", stats: [74,  5, 21] },
];

const STAT_NAMES = ["Pečlivost", "Nápady", "Spolupráce"] as const;
const STAT_COLORS = ["#4dd0e1", "#ffd740", "#a5d610"];

const THEME_COLORS: Record<Theme, string> = {
  blue:   "#2196f3",
  yellow: "#f5c800",
  red:    "#e53935",
  green:  "#2e7d32",
};

const ROUND_DEF = [
  { r: 1, title: "🎯 KOLO 1 — DOVEDNOSTNÍ BALANCE", desc: "Sestav tým 3 postav. Hodnotí se, jak rovnoměrně pokrýváte Pečlivost, Nápady a Spolupráci.", color: "#39ff14" },
  { r: 2, title: "🧠 KOLO 2 — DOVEDNOSTI + OSOBNOSTI", desc: "Stejné sestavení, ale navíc se hodnotí různorodost osobnostních typů. Různé barvy = bonus!", color: "#ffd700" },
  { r: 3, title: "🏆 KOLO 3 — FINÁLNÍ VÝZVA", desc: "Opět dovednosti + osobnosti. Dokážeš lepší skóre než v Kole 2?", color: "#ff006e" },
] as const;

interface Props {
  auth: { studentId: string; classId: string; displayName: string; avatarEmoji: string; avatarColor: string };
  sessionId: string;
  activityId: string;
}

interface RoundResult {
  round: 1 | 2 | 3;
  team: [Character, Character, Character];
  statTotals: [number, number, number];
  balanceScore: number;
  coverageBonus: number;
  round1Score: number;
  personalityScore: number;
  uniqueThemes: number;
  finalScore: number;
  maxScore: number;
}

type Slot = "me" | "t1" | "t2";

export default function TeamForge({ auth, sessionId, activityId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "select" | "result">("intro");
  const [currentRound, setCurrentRound] = useState<1 | 2 | 3>(1);
  const [completed, setCompleted] = useState<{ 1: number | null; 2: number | null; 3: number | null }>({ 1: null, 2: null, 3: null });
  const [team, setTeam] = useState<{ me: Character | null; t1: Character | null; t2: Character | null }>({ me: null, t1: null, t2: null });
  const [activeSlot, setActiveSlot] = useState<Slot>("me");
  const [result, setResult] = useState<RoundResult | null>(null);
  const startTimeRef = useState<{ ts: number }>({ ts: Date.now() })[0];

  // Load already-completed rounds for this student/session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("student_events")
        .select("question_id, answer")
        .eq("student_id", auth.studentId)
        .eq("session_id", sessionId)
        .eq("event_type", "team_forge_round");
      if (cancelled || !data) return;
      const next = { 1: null as number | null, 2: null as number | null, 3: null as number | null };
      for (const row of data) {
        const m = /^tf_round_([123])$/.exec(row.question_id);
        if (!m) continue;
        try {
          const parsed = JSON.parse(row.answer || "{}");
          next[Number(m[1]) as 1 | 2 | 3] = parsed.finalScore ?? null;
        } catch {}
      }
      setCompleted(next);
    })();
    return () => { cancelled = true; };
  }, [auth.studentId, sessionId]);

  function startRound(r: 1 | 2 | 3) {
    setCurrentRound(r);
    setTeam({ me: null, t1: null, t2: null });
    setActiveSlot("me");
    setResult(null);
    setPhase("select");
    startTimeRef.ts = Date.now();
  }

  function pickCharacter(c: Character) {
    // Prevent duplicate
    const used = [team.me?.id, team.t1?.id, team.t2?.id];
    if (used.includes(c.id)) return;
    const next = { ...team, [activeSlot]: c };
    setTeam(next);
    // Auto-advance to next empty slot
    if (!next.me) setActiveSlot("me");
    else if (!next.t1) setActiveSlot("t1");
    else if (!next.t2) setActiveSlot("t2");
  }

  function clearSlot(slot: Slot) {
    setTeam({ ...team, [slot]: null });
    setActiveSlot(slot);
  }

  function evaluate() {
    if (!team.me || !team.t1 || !team.t2) return;
    const chars: [Character, Character, Character] = [team.me, team.t1, team.t2];

    const statTotals: [number, number, number] = [0, 1, 2].map(
      (i) => chars.reduce((s, c) => s + c.stats[i], 0)
    ) as [number, number, number];
    const avg = statTotals.reduce((a, b) => a + b, 0) / 3;
    const variance = statTotals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / 3;
    const stdDev = Math.sqrt(variance);
    const balanceScore = Math.max(0, 100 - stdDev / 0.8);

    const coverage: number[] = [0, 1, 2].map((si) => (chars.some((c) => c.stats[si] > 40) ? 1 : 0));
    const coverageBonus = coverage.reduce((a: number, b: number) => a + b, 0) * 6;
    const round1Score = Math.round(Math.min(100, balanceScore + coverageBonus));

    const themes = chars.map((c) => c.theme);
    const uniqueThemes = new Set(themes).size;
    const personalityScore = uniqueThemes === 3 ? 100 : uniqueThemes === 2 ? 50 : 0;

    const finalScore = currentRound === 1 ? round1Score : round1Score + personalityScore;
    const maxScore = currentRound === 1 ? 100 : 200;

    const r: RoundResult = {
      round: currentRound,
      team: chars,
      statTotals,
      balanceScore: Math.round(balanceScore),
      coverageBonus,
      round1Score,
      personalityScore,
      uniqueThemes,
      finalScore,
      maxScore,
    };
    setResult(r);
    setPhase("result");
    setCompleted({ ...completed, [currentRound]: finalScore });

    // Persist to event log
    const durationMs = Date.now() - startTimeRef.ts;
    supabase
      .from("student_events")
      .insert({
        student_id: auth.studentId,
        session_id: sessionId,
        question_id: `tf_round_${currentRound}`,
        event_type: "team_forge_round",
        answer: JSON.stringify({
          round: currentRound,
          finalScore,
          maxScore,
          team: chars.map((c) => ({ id: c.id, name: c.name, theme: c.theme, type: c.typeName })),
          balanceScore: r.balanceScore,
          personalityScore,
          uniqueThemes,
        }),
        is_correct: finalScore / maxScore >= 0.6,
        attempt_no: 1,
        duration_ms: durationMs,
      })
      .then(() => {});
  }

  function backToIntro() {
    setPhase("intro");
    setResult(null);
  }

  // ─────────── render ───────────
  if (phase === "intro") {
    return <IntroScreen completed={completed} onStart={startRound} onExit={() => router.push("/zak/profil")} studentName={auth.displayName} activityId={activityId} />;
  }
  if (phase === "select") {
    return (
      <SelectScreen
        round={currentRound}
        team={team}
        activeSlot={activeSlot}
        onActivate={setActiveSlot}
        onPick={pickCharacter}
        onClear={clearSlot}
        onEvaluate={evaluate}
        onBack={backToIntro}
      />
    );
  }
  return <ResultScreen result={result!} onContinue={backToIntro} />;
}

// ═══════════════════════════════════════════════
// INTRO
// ═══════════════════════════════════════════════
function IntroScreen({ completed, onStart, onExit, studentName, activityId }: {
  completed: { 1: number | null; 2: number | null; 3: number | null };
  onStart: (r: 1 | 2 | 3) => void;
  onExit: () => void;
  studentName: string;
  activityId: string;
}) {
  void activityId;
  return (
    <div className="min-h-screen bg-[#0A0F2E] text-white p-4 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-black tracking-wider text-[#00D4FF]" style={{ textShadow: "0 0 20px #00D4FF, 0 0 60px #00D4FF" }}>
        TEAM FORGE
      </h1>
      <p className="text-xs tracking-[0.4em] text-pink-400 mt-2 mb-8">// {studentName.toUpperCase()} //</p>

      <div className="w-full max-w-lg bg-[#0A0F2E]/90 border border-[#00D4FF]/30 rounded p-6 backdrop-blur space-y-3">
        <div className="text-xs tracking-[0.3em] text-[#00D4FF]/70 uppercase mb-2">// VYBER KOLO</div>
        {ROUND_DEF.map((def) => {
          const score = completed[def.r as 1 | 2 | 3];
          const done = score !== null;
          const unlocked = def.r === 1 || completed[(def.r - 1) as 1 | 2 | 3] !== null;
          return (
            <div
              key={def.r}
              className={`rounded border-l-4 p-4 ${unlocked ? "bg-white/5" : "bg-white/[0.02] opacity-40"}`}
              style={{ borderLeftColor: done ? "#39ff14" : def.color }}
            >
              <div className="text-xs font-bold tracking-[0.18em]" style={{ color: done ? "#39ff14" : def.color }}>
                {def.title}
              </div>
              <div className="text-sm text-white/55 mt-1 leading-relaxed">{def.desc}</div>
              {done && (
                <div className="text-sm font-bold text-[#39ff14] mt-2 tracking-wider">
                  ✓ Skóre: {score} / {def.r === 1 ? 100 : 200}
                </div>
              )}
              {unlocked && (
                <button
                  onClick={() => onStart(def.r as 1 | 2 | 3)}
                  className="w-full mt-3 py-2 text-xs tracking-[0.15em] font-bold uppercase rounded transition hover:scale-[1.02]"
                  style={{ background: done ? "transparent" : def.color, color: done ? def.color : "#000", border: done ? `1px solid ${def.color}` : "none" }}
                >
                  {done ? "▶ ZKUSIT ZNOVU" : `▶ HRÁT KOLO ${def.r}`}
                </button>
              )}
              {!unlocked && (
                <div className="text-xs text-white/30 mt-2">🔒 Dokonči Kolo {def.r - 1} pro odemčení</div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={onExit} className="mt-6 text-xs text-white/40 hover:text-white/70 tracking-wider">
        ← Zpět na profil
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SELECT
// ═══════════════════════════════════════════════
function SelectScreen({ round, team, activeSlot, onActivate, onPick, onClear, onEvaluate, onBack }: {
  round: 1 | 2 | 3;
  team: { me: Character | null; t1: Character | null; t2: Character | null };
  activeSlot: Slot;
  onActivate: (s: Slot) => void;
  onPick: (c: Character) => void;
  onClear: (s: Slot) => void;
  onEvaluate: () => void;
  onBack: () => void;
}) {
  const usedIds = useMemo(() => new Set([team.me?.id, team.t1?.id, team.t2?.id].filter((x) => x !== undefined) as number[]), [team]);
  const ready = team.me && team.t1 && team.t2;
  const def = ROUND_DEF[round - 1];

  return (
    <div className="min-h-screen bg-[#0A0F2E] text-white p-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* LEFT: char grid */}
        <div className="bg-white/[0.03] border border-white/10 rounded p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="text-xl font-black text-[#00D4FF] tracking-wider">VYBER POSTAVY</div>
            <span className="text-[10px] tracking-[0.18em] font-bold px-3 py-1 rounded-full" style={{ background: `${def.color}22`, color: def.color, border: `1px solid ${def.color}` }}>
              KOLO {round}
            </span>
          </div>
          <div className="text-xs tracking-wider mb-4 px-3 py-2 rounded inline-block" style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.4)" }}>
            {activeSlot === "me" ? "Vyber SEBE" : activeSlot === "t1" ? "Vyber spoluhráče 1" : "Vyber spoluhráče 2"}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {CHARACTERS.map((c) => {
              const used = usedIds.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onPick(c)}
                  disabled={used}
                  className={`relative rounded p-3 border-2 transition text-left ${used ? "opacity-30 cursor-not-allowed" : "hover:scale-105 hover:border-[#00D4FF]"}`}
                  style={{ background: "rgba(0,0,20,0.6)", borderColor: used ? "rgba(255,255,255,0.1)" : `${THEME_COLORS[c.theme]}80` }}
                >
                  <div className="text-3xl text-center">{c.emoji}</div>
                  <div className="text-xs font-black text-center mt-1 tracking-wider">{c.name}</div>
                  <div className="text-[10px] text-center opacity-60 uppercase tracking-wider">{c.typeName}</div>
                  <div className="flex gap-0.5 mt-2 h-1">
                    {c.stats.map((s, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{ background: STAT_COLORS[i], opacity: 0.3 + s / 150 }} title={`${STAT_NAMES[i]}: ${s}`} />
                    ))}
                  </div>
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: THEME_COLORS[c.theme] }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: team panel */}
        <div className="bg-black/50 border border-[#00D4FF]/20 rounded p-5">
          <div className="text-base font-black tracking-wider mb-4">👥 MŮJ TÝM</div>
          {(["me", "t1", "t2"] as Slot[]).map((slot) => {
            const c = team[slot];
            const labels = { me: "// TY (povinný)", t1: "// SPOLUHRÁČ 1", t2: "// SPOLUHRÁČ 2" };
            return (
              <div key={slot} className="mb-3">
                <div className="text-[10px] text-white/40 mb-1 tracking-wider">{labels[slot]}</div>
                <div
                  onClick={() => !c && onActivate(slot)}
                  className={`rounded p-3 border ${c ? "border-[#00D4FF]/60 bg-[#00D4FF]/5" : "border-dashed border-white/20 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05]"} ${activeSlot === slot && !c ? "ring-2 ring-[#00D4FF]" : ""}`}
                >
                  {c ? (
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{c.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black tracking-wider truncate">{c.name}</div>
                        <div className="text-[10px] opacity-60 uppercase">{c.typeName}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onClear(slot); }}
                        className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500 text-pink-400 text-xs hover:bg-pink-500 hover:text-white"
                      >×</button>
                    </div>
                  ) : (
                    <div className="text-center text-white/40 text-xs py-1">👤 Klikni a vyber →</div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            disabled={!ready}
            onClick={onEvaluate}
            className="w-full mt-4 py-3 font-bold text-sm tracking-[0.15em] uppercase rounded bg-[#00D4FF] text-black disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_30px_#00D4FF]"
          >
            ⚡ Ohodnotit tým
          </button>
          <button onClick={onBack} className="w-full mt-2 py-2 text-xs text-pink-400 border border-pink-400 rounded hover:bg-pink-500/10">
            ← Zpět
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// RESULT
// ═══════════════════════════════════════════════
function ResultScreen({ result, onContinue }: { result: RoundResult; onContinue: () => void }) {
  const pct = result.finalScore / result.maxScore;
  const verdict =
    result.round === 1
      ? pct >= 0.8 ? "🏆 Výborně vyvážený tým!" : pct >= 0.6 ? "✅ Dobrý tým s pár mezerami" : pct >= 0.4 ? "⚠️ Průměrná balance — dá se zlepšit" : "❌ Nevyvážený tým — zkus jiné složení"
      : result.round === 2
      ? pct >= 0.8 ? "🌟 Perfektní kombinace!" : pct >= 0.6 ? "✅ Solidní tým" : pct >= 0.4 ? "⚠️ Slabá diverzita" : "❌ Mono-tým — chybí různé pohledy"
      : pct >= 0.8 ? "🏅 Mistr sestavování týmu!" : pct >= 0.6 ? "✅ Dobrý finální výsledek" : pct >= 0.4 ? "⚠️ Stále je co zlepšovat" : "❌ Sestav tým jinak!";

  return (
    <div className="min-h-screen bg-[#0A0F2E] text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="text-center mt-6">
          <div className="text-xs tracking-[0.3em] text-[#00D4FF]/70 uppercase">// Výsledek Kola {result.round}</div>
          <div className="text-7xl font-black my-3" style={{ color: pct >= 0.6 ? "#39ff14" : pct >= 0.4 ? "#ffd700" : "#ff006e" }}>
            {result.finalScore}
            <span className="text-2xl opacity-50">/{result.maxScore}</span>
          </div>
          <div className="text-lg">{verdict}</div>
        </div>

        {/* Team */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {result.team.map((c, i) => (
            <div key={i} className="bg-white/5 border rounded p-3 text-center" style={{ borderColor: `${THEME_COLORS[c.theme]}80` }}>
              <div className="text-3xl">{c.emoji}</div>
              <div className="text-xs font-black tracking-wider mt-1">{c.name}</div>
              <div className="text-[10px] opacity-60">{c.typeName}</div>
            </div>
          ))}
        </div>

        {/* Stats breakdown */}
        <div className="bg-white/[0.03] border border-white/10 rounded p-4 mt-4">
          <div className="text-xs tracking-wider text-[#00D4FF]/70 mb-3">// DOVEDNOSTI TÝMU</div>
          {STAT_NAMES.map((name, i) => {
            const total = result.statTotals[i];
            const pctBar = Math.min(100, total);
            return (
              <div key={name} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{name}</span>
                  <span className="opacity-60">{total}</span>
                </div>
                <div className="h-2 bg-white/10 rounded overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${pctBar}%`, background: STAT_COLORS[i] }} />
                </div>
              </div>
            );
          })}
          <div className="text-[11px] text-white/50 mt-3">
            Balance: {result.balanceScore} • Coverage bonus: +{result.coverageBonus}
          </div>
        </div>

        {/* Personality (rounds 2/3) */}
        {result.round > 1 && (
          <div className="bg-white/[0.03] border border-white/10 rounded p-4 mt-3">
            <div className="text-xs tracking-wider text-[#00D4FF]/70 mb-2">// OSOBNOSTNÍ DIVERZITA</div>
            <div className="flex gap-2 items-center">
              {result.team.map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full" style={{ background: THEME_COLORS[c.theme] }} />
              ))}
              <div className="ml-3 text-sm">
                {result.uniqueThemes} {result.uniqueThemes === 1 ? "typ" : result.uniqueThemes < 5 ? "typy" : "typů"} → +{result.personalityScore}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onContinue}
          className="w-full mt-6 py-3 font-bold text-sm tracking-[0.15em] uppercase rounded bg-[#00D4FF] text-black hover:shadow-[0_0_30px_#00D4FF]"
        >
          ▶ Pokračovat
        </button>
      </div>
    </div>
  );
}
