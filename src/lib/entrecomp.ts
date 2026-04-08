// Officiální EntreComp struktura s kalibrovaným progression systémem
// 3 oblasti × 5 kompetencí × 8 úrovní × 4 skupiny

export type LevelGroup = "foundation" | "intermediate" | "advanced" | "expert";

export interface EntreCompLevel {
  level: number;
  name: string;
  nameCZ: string;
  group: LevelGroup;
  description: string;
  xpRequired: number; // celkové XP pro dosažení této úrovně
}

export interface EntreCompCompetence {
  key: string;
  name: string;
  nameCZ: string;
  description: string;
}

export interface EntreCompArea {
  key: string;
  name: string;
  nameCZ: string;
  color: string;
  colorLight: string;
  competences: EntreCompCompetence[];
}

// 8 úrovní EntreComp s XP prahy
export const ENTRECOMP_LEVELS: EntreCompLevel[] = [
  { level: 1, name: "Discover",   nameCZ: "Objevuji",       group: "foundation",    description: "Objevuješ nové věci a zkušenosti",               xpRequired: 0 },
  { level: 2, name: "Explore",    nameCZ: "Prozkoumávám",   group: "foundation",    description: "Zkoumáš nápady a příležitosti",                   xpRequired: 150 },
  { level: 3, name: "Experiment", nameCZ: "Experimentuji",  group: "intermediate",  description: "Zkoušíš nové přístupy a učíš se z nich",          xpRequired: 400 },
  { level: 4, name: "Dare",       nameCZ: "Odvažuji se",    group: "intermediate",  description: "Nebojíš se výzev a přijímáš rizika",              xpRequired: 800 },
  { level: 5, name: "Improve",    nameCZ: "Zlepšuji se",    group: "advanced",      description: "Cíleně rozvíjíš své dovednosti",                  xpRequired: 1400 },
  { level: 6, name: "Reinforce",  nameCZ: "Posiluji",       group: "advanced",      description: "Upevňuješ a prohlubueš kompetence",               xpRequired: 2200 },
  { level: 7, name: "Expand",     nameCZ: "Rozšiřuji",      group: "expert",        description: "Aplikuješ dovednosti v nových kontextech",        xpRequired: 3200 },
  { level: 8, name: "Transform",  nameCZ: "Transformuji",   group: "expert",        description: "Měníš okolí svými kompetencemi",                  xpRequired: 4500 },
];

// Barvy skupin
export const GROUP_COLORS: Record<LevelGroup, { color: string; bg: string; label: string; labelCZ: string }> = {
  foundation:   { color: "#7C3AED", bg: "#7C3AED20", label: "Foundation",   labelCZ: "Základy" },
  intermediate: { color: "#0F6E56", bg: "#0F6E5620", label: "Intermediate", labelCZ: "Pokročilý" },
  advanced:     { color: "#1A3BE8", bg: "#1A3BE820", label: "Advanced",     labelCZ: "Pokročilý+" },
  expert:       { color: "#D97706", bg: "#D9770620", label: "Expert",       labelCZ: "Expert" },
};

// Etalon pro InJ (6.-9. třída)
// Třída (6-9) → očekávaná úroveň
export function getEtalonLevel(grade: number): number {
  if (grade <= 6) return 1;  // 6. třída: Discover
  if (grade <= 7) return 2;  // 7. třída: Explore
  if (grade <= 8) return 2;  // 8. třída: Explore-Experiment
  return 3;                  // 9. třída: Experiment-Dare
}

// XP za aktivitu do kompetence
export function calcCompetenceXp(eventType: string, isCorrect: boolean, attemptNo: number): number {
  if (eventType === "text_submit") return 20;        // open odpověď
  if (eventType === "skip" || eventType === "timeout") return 0;
  // answer events
  if (isCorrect && attemptNo > 1) return 15;         // chyba → oprava = growth mindset bonus
  if (isCorrect && attemptNo === 1) return 10;       // správně napoprvé
  return 3;                                           // špatně = trocha XP za pokus
}

// XP → level
export function xpToLevel(xp: number): { level: number; levelInfo: EntreCompLevel; xpInLevel: number; xpToNext: number; progress: number } {
  let current = ENTRECOMP_LEVELS[0];
  for (let i = ENTRECOMP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= ENTRECOMP_LEVELS[i].xpRequired) {
      current = ENTRECOMP_LEVELS[i];
      break;
    }
  }
  const nextLevel = ENTRECOMP_LEVELS.find((l) => l.level === current.level + 1);
  const xpInLevel = xp - current.xpRequired;
  const xpSpan = nextLevel ? nextLevel.xpRequired - current.xpRequired : 1;
  const xpToNext = nextLevel ? nextLevel.xpRequired - xp : 0;
  const progress = nextLevel ? Math.min((xpInLevel / xpSpan) * 100, 100) : 100;

  return { level: current.level, levelInfo: current, xpInLevel, xpToNext, progress };
}

// 3 oblasti
export const ENTRECOMP_AREAS: EntreCompArea[] = [
  {
    key: "ideas",
    name: "Ideas & Opportunities",
    nameCZ: "Nápady a příležitosti",
    color: "#7C3AED",
    colorLight: "#7C3AED20",
    competences: [
      { key: "spotting_opportunities", name: "Spotting Opportunities", nameCZ: "Hledání příležitostí", description: "Využíváš příležitosti k tvorbě hodnoty" },
      { key: "creativity", name: "Creativity", nameCZ: "Kreativita", description: "Rozvíjíš kreativní a cílevědomé nápady" },
      { key: "vision", name: "Vision", nameCZ: "Vize", description: "Pracuješ směrem k budoucnosti" },
      { key: "valuing_ideas", name: "Valuing Ideas", nameCZ: "Hodnocení nápadů", description: "Rozpoznáváš hodnotu nápadů" },
      { key: "ethical_thinking", name: "Ethical & Sustainable Thinking", nameCZ: "Etické myšlení", description: "Posuzuješ důsledky svých nápadů a činů" },
    ],
  },
  {
    key: "resources",
    name: "Resources",
    nameCZ: "Zdroje",
    color: "#0F6E56",
    colorLight: "#0F6E5620",
    competences: [
      { key: "self_awareness", name: "Self-Awareness & Self-Efficacy", nameCZ: "Sebeuvědomění", description: "Věříš ve své schopnosti a znáš své silné stránky" },
      { key: "motivation", name: "Motivation & Perseverance", nameCZ: "Motivace a vytrvalost", description: "Jsi odhodlaný/á a nevzdáváš se" },
      { key: "mobilising_resources", name: "Mobilising Resources", nameCZ: "Mobilizace zdrojů", description: "Získáváš a řídíš potřebné zdroje" },
      { key: "financial_literacy", name: "Financial & Economic Literacy", nameCZ: "Finanční gramotnost", description: "Rozumíš základům financí a ekonomiky" },
      { key: "mobilising_others", name: "Mobilising Others", nameCZ: "Mobilizace ostatních", description: "Inspiruješ a motivuješ ostatní" },
    ],
  },
  {
    key: "action",
    name: "Into Action",
    nameCZ: "Do akce",
    color: "#1A3BE8",
    colorLight: "#1A3BE820",
    competences: [
      { key: "taking_initiative", name: "Taking the Initiative", nameCZ: "Iniciativa", description: "Chápeš se příležitostí a přicházíš s nápady" },
      { key: "planning", name: "Planning & Management", nameCZ: "Plánování", description: "Stanovuješ cíle a plány k jejich dosažení" },
      { key: "coping_with_uncertainty", name: "Coping with Uncertainty", nameCZ: "Zvládání nejistoty", description: "Zvládáš nejistotu a přizpůsobuješ se změnám" },
      { key: "working_with_others", name: "Working with Others", nameCZ: "Spolupráce", description: "Spolupracuješ a řešíš konflikty" },
      { key: "learning_through_experience", name: "Learning Through Experience", nameCZ: "Učení zkušeností", description: "Učíš se ze svých činností a zkušeností" },
    ],
  },
];

// Map flat key → area+competence
export function mapFlatKeyToEntreComp(flatKey: string): { area: string; competence: string } | null {
  const key = flatKey.replace("entrecomp_", "");
  for (const area of ENTRECOMP_AREAS) {
    const comp = area.competences.find((c) => c.key === key);
    if (comp) return { area: area.key, competence: comp.key };
  }
  return null;
}
