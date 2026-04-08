// ═══════════════════════════════════════════════
// Pitch Duel — sdílená konfigurace
// Zdroj: github.com/stepankapko/cestainovatora/blob/main/pitch-duel.html
// ═══════════════════════════════════════════════

export interface PitchType {
  id: "startup" | "business" | "inspire";
  emoji: string;
  name: string;
  desc: string;
  topics: string[];
  focus_tips: string[];   // krátká hesla, na co se soustředit
}

export const PITCH_TYPES: PitchType[] = [
  {
    id: "startup",
    emoji: "🚀",
    name: "Startup Pitch",
    desc: "Prodej nápad investorům",
    focus_tips: ["Problém", "Řešení", "Cílovka", "Co je unikátní", "Volání po akci"],
    topics: [
      "Aplikace, která propojuje sousedy pro sdílení nářadí",
      "AI asistent pro plánování svateb",
      "Platforma pro pronájem zahrad ve městě",
      "Chytré zrcadlo s personalizovaným tréninkem",
      "Doručování jídla pomocí dronů na vesnicích",
      "Předplatné na neomezenou kávu v kavárnách",
      "Aplikace, která učí děti finanční gramotnosti hrou",
      "Marketplace pro výměnu dovedností místo peněz",
    ],
  },
  {
    id: "business",
    emoji: "📊",
    name: "Business Presentation",
    desc: "Strategie, data, plán",
    focus_tips: ["Data a fakta", "Jasná struktura", "Doporučení", "Rizika", "Akční plán"],
    topics: [
      "Proč firma musí letos vstoupit na německý trh",
      "Plán snížení provozních nákladů o 20 %",
      "Strategie přechodu na 4denní pracovní týden",
      "Q4 výsledky: růst, rizika a další kroky",
      "Návrh restrukturalizace marketingového oddělení",
      "Investice do AI nástrojů pro celý tým",
      "Plán expanze do tří nových měst",
      "Změna cenové strategie pro prémiový segment",
    ],
  },
  {
    id: "inspire",
    emoji: "🎤",
    name: "Inspirational Speech",
    desc: "TED-style, motivuj a inspiruj",
    focus_tips: ["Osobní příběh", "Emoce", "Obraz v hlavě", "Univerzální pravda", "Volání k činu"],
    topics: [
      "Proč je selhání nejlepší učitel",
      "Síla malých každodenních návyků",
      "Jak strach může být tvůj nejlepší kompas",
      "Proč zvědavost mění svět víc než talent",
      "Odvaha říct ne věcem, které tě brzdí",
      "Co nás naučí ticho v hlučném světě",
      "Proč být začátečník je superschopnost",
      "Když sníš, sni větší než to, co si dovolíš",
    ],
  },
];

export const PITCH_DURATION_SECONDS = 60;

/**
 * Mapování typu pitche → kompetence (váhy 0–1).
 * Tyto váhy se násobí XP odměnou (viz competence-rewards.ts).
 * Klíče respektují konvenci `rvp_*` a `entrecomp_*`.
 */
export const PITCH_COMPETENCE_WEIGHTS: Record<PitchType["id"], Record<string, number>> = {
  startup: {
    entrecomp_creativity: 1.0,
    entrecomp_spotting_opportunities: 0.8,
    entrecomp_mobilising_others: 0.7,
    rvp_komunikacni: 0.8,
  },
  business: {
    entrecomp_planning: 1.0,
    entrecomp_financial_literacy: 0.6,
    entrecomp_taking_initiative: 0.5,
    rvp_komunikacni: 0.9,
  },
  inspire: {
    entrecomp_mobilising_others: 1.0,
    entrecomp_vision: 0.9,
    entrecomp_self_awareness: 0.6,
    rvp_komunikacni: 0.9,
  },
};

/** Vrací bázové XP za výsledek kola (verdict). */
export function pitchXpForVerdict(role: "winner" | "loser" | "tie"): number {
  if (role === "winner") return 80;
  if (role === "tie") return 50;
  return 30; // poražený dostává XP za účast
}

/** Pořadí kol v Pitch Duelu — odpovídá indexu kola 0/1/2 */
export const PITCH_ROUND_ORDER: PitchType["id"][] = ["startup", "business", "inspire"];

export function pitchTypeById(id?: string) {
  return PITCH_TYPES.find((p) => p.id === id);
}

export function pickRandomTopic(typeId: PitchType["id"]): string {
  const t = pitchTypeById(typeId)!;
  return t.topics[Math.floor(Math.random() * t.topics.length)];
}
