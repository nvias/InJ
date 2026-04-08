// ---- Database row types ----

export interface Class {
  id: string;
  name: string;
  teacher_id: string;
  created_at: string;
}

export type TeamRole = "leader" | "analyst" | "creative" | "mediator" | "executor";

export interface SwotProfile {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface Student {
  id: string;
  class_id: string;
  student_code: string;
  display_name: string;
  avatar_color: string;
  avatar_emoji: string;
  swot_profile: SwotProfile;
  team_role: TeamRole | null;
  role_confidence: number;
  growth_mindset_score: number;
  created_at: string;
}

export interface Activity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  questions: Question[];
  competence_weights: Record<string, number>;
  team_size: number;             // 1=solo, 2=pair, 3=trio, ...
  requires_grouping: boolean;    // true => session starts in 'lobby' state
  created_at: string;
}

export type ActivityMode = "learning" | "assessment" | "mixed";
export type SessionStatus = "lobby" | "active" | "paused" | "closed";

export interface SessionGroup {
  id: string;
  session_id: string;
  group_index: number;
  group_name: string | null;
  state: Record<string, unknown>;
  created_at: string;
}

export interface SessionGroupMember {
  group_id: string;
  student_id: string;
  slot_index: number;
}

// In-memory shape used by the lobby UI: a group with its hydrated members
export interface GroupWithMembers {
  id: string;
  group_index: number;
  group_name: string | null;
  members: Array<{
    student_id: string;
    display_name: string;
    avatar_emoji: string;
    avatar_color: string;
    slot_index: number;
  }>;
}

export interface Session {
  id: string;
  class_id: string;
  activity_id: string;
  code: string;
  is_active: boolean;
  status: SessionStatus;
  current_question: number;
  timer_seconds: number | null;
  answering_open: boolean;
  activity_mode: ActivityMode;
  created_at: string;
}

export type PeerRating = "strong" | "interesting" | "needs_work";

export interface PeerReview {
  id: string;
  reviewer_student_id: string;
  reviewed_student_id: string;
  session_id: string;
  question_id: string;
  rating: PeerRating;
  created_at: string;
}

export interface StudentEvent {
  id: string;
  student_id: string;
  session_id: string;
  question_id: string;
  event_type: string;
  answer: string | null;
  is_correct: boolean;
  attempt_no: number;
  duration_ms: number;
  created_at: string;
}

// ---- Question structure (stored in activities.questions JSONB) ----

export type AssessmentMode = "learning" | "assessment";
export type QuestionType = "click" | "ab_decision" | "ab_with_explanation" | "scale" | "open" | "logic_trap" | "pattern" | "peer_review";

export interface QuestionOption {
  key: string;
  text: string;
  image_url?: string;
}

export interface Question {
  id: string;
  text: string;
  difficulty: "basic" | "advanced";
  assessment_mode?: AssessmentMode;
  question_type?: QuestionType;
  options: QuestionOption[];
  correct: string;
  explanation: string;
  hint_level_1: string;
  hint_level_2?: string;
  hint_level_3?: string;
  requires_explanation?: boolean;
  explanation_prompt?: string;
  peer_review_enabled?: boolean;
  competence_weights: Record<string, number>;
  swot_mapping?: Record<string, string>; // key → "category:trait"
  entrecomp_competence?: string;
  rvp_competence?: string;
  skip_interpretation?: string;
}

// ---- Growth Mindset Messages ----

export const GROWTH_CORRECT_MSGS = [
  "Výborně! Jistá odpověď",
  "Paráda! Máš to!",
  "Super práce! Tak držet!",
  "Jedničkář/ka! Bezchybně!",
];

export const GROWTH_CORRECTED_MSGS = [
  "TOHLE je growth mindset v akci! 🚀",
  "Mozek se právě posílil!",
  "Takhle se učí ti nejúspěšnější lidé",
  "Nevzdal/a jsi to = superpower 💪",
  "Skvělá oprava! Tak se to dělá!",
  "Super comeback! Oprava = síla!",
];

export const GROWTH_WRONG_MSGS = [
  "Mozek roste nejvíc když se něco nedaří 🧠",
  "Zkus to jinak! Blížíš se!",
  "Tohle je přesně ten moment kdy se učíš nejvíc",
  "Každý expert byl jednou začátečník",
  "Další bude lepší!",
  "Hlavu vzhůru, to dáš!",
];

export const GROWTH_SKIP_MSG = "Přeskočeno, vrátíme se k tomu";
export const GROWTH_TIMEOUT_MSG = "Čas vypršel!";
export const GROWTH_ASSESSMENT_MSG = "Odpověď zaznamenána";

// ---- Team Role Labels ----

export const TEAM_ROLE_INFO: Record<TeamRole, { label: string; emoji: string; description: string }> = {
  leader: { label: "Vůdce", emoji: "👑", description: "Přirozeně přebíráš iniciativu a organizuješ ostatní" },
  analyst: { label: "Analytik", emoji: "🔍", description: "Přemýšlíš do hloubky a opravuješ chyby" },
  creative: { label: "Kreativec", emoji: "💡", description: "Přicházíš s originálními nápady" },
  mediator: { label: "Mediátor", emoji: "🤝", description: "Pomáháš najít shodu a podporuješ ostatní" },
  executor: { label: "Realizátor", emoji: "⚡", description: "Spolehlivě dokončuješ úkoly" },
};

// ---- Scoring helpers ----

export function calcXp(mode: AssessmentMode, isCorrect: boolean, attemptNo: number, durationMs: number): number {
  if (mode === "assessment") {
    return isCorrect ? 100 : 0;
  }
  if (isCorrect && attemptNo > 1) return 100;
  if (isCorrect && attemptNo === 1) return durationMs > 10000 ? 90 : 85;
  return 20;
}

export function getQuestionMode(sessionMode: ActivityMode, question: Question): AssessmentMode {
  if (sessionMode === "mixed") return question.assessment_mode || "learning";
  return sessionMode === "assessment" ? "assessment" : "learning";
}

// Pick a random message from array, deterministic by seed
export function pickMessage(messages: string[], seed: number): string {
  return messages[seed % messages.length];
}

// Detect team role from behavioral data
export function detectTeamRole(stats: {
  avgResponseTime: number;
  correctionRate: number; // % of wrong→correct
  skipRate: number;
  firstResponder: number; // how often answered first
}): { role: TeamRole; confidence: number } {
  const scores: Record<TeamRole, number> = {
    leader: stats.firstResponder * 0.6 + (1 - stats.avgResponseTime / 30000) * 0.4,
    analyst: stats.correctionRate * 0.5 + (stats.avgResponseTime / 30000) * 0.5,
    creative: stats.correctionRate * 0.3 + (1 - stats.skipRate) * 0.3 + 0.4 * Math.random(),
    mediator: stats.skipRate * 0.3 + (1 - stats.firstResponder) * 0.4 + stats.avgResponseTime / 30000 * 0.3,
    executor: (1 - stats.skipRate) * 0.5 + (1 - stats.correctionRate) * 0.3 + (stats.avgResponseTime < 15000 ? 0.2 : 0),
  };

  let bestRole: TeamRole = "executor";
  let bestScore = 0;
  for (const [role, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestRole = role as TeamRole;
      bestScore = score;
    }
  }

  return { role: bestRole, confidence: Math.min(bestScore, 1) };
}
