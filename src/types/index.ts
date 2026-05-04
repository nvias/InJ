// ---- Database row types ----

export interface Class {
  id: string;
  name: string;
  teacher_id: string;
  created_at: string;
}

// Týmové role — preferenční taxonomie (žák si volí v aktivitě role_selection).
// Nahrazuje původní behaviorální taxonomii (leader/analyst/creative/mediator/executor),
// která nebyla v reálných flow používaná.
export type TeamRole = "designer" | "engineer" | "communicator" | "innovator" | "manager";

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
  learning_goal?: string | null;
  default_duration_min?: number | null;
  assessment_mode?: AssessmentMode | null;
  is_public?: boolean;
  created_by?: string | null;
  instructions?: string | null;
  config?: ActivityConfig;
  sub_activities?: SubActivity[];   // legacy: multi_activity JSONB
  created_at: string;
}

// Atomická aktivita ne-quiz typu má svoji konfiguraci v `config` JSONB.
// Quiz pravidla zůstávají v questions[].
export interface ActivityConfig {
  // Quiz bonusy
  xp_complete_bonus?: number;
  xp_correct_phrasing_bonus?: number;
  xp_growth_correction_bonus?: number;
  // Open
  min_items?: number;
  max_items?: number;
  event_type?: string;
  ai_feedback?: boolean;
  teacher_review?: boolean;
  ai_check_criteria?: string;
  skip_interpretation?: string;
  xp_complete?: number;
  // Peer review
  anonymize?: boolean;
  votes_per_student?: number;
  select_top_n?: number;
  source_activity_id?: string;
  result?: string;
  // Photo upload / group_work
  deliverable?: {
    type: "photo_upload" | "video_upload";
    min_photos?: number;
    max_photos?: number;
    required: boolean;
    description?: string;
  };
  ai_verification?: {
    enabled: boolean;
    checks?: string[];
    prompt?: string;
  };
  team_size_hint?: number;
  // Volné rozšíření
  [key: string]: unknown;
}

// ---- Lekce (kontejner aktivit) ----

export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  lesson_number: number | null;
  phase: number | null;
  total_duration_min: number | null;
  learning_goal: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
}

export interface LessonActivity {
  id: string;
  lesson_id: string;
  activity_id: string;
  order_index: number;
  is_optional: boolean;
  custom_duration_min: number | null;
  teacher_note: string | null;
  /** ID jiných lesson_activities (ze stejné lekce), které tato aktivita vyžaduje. */
  requires_lesson_activity_ids: string[];
  created_at: string;
}

// In-memory: položka editoru lekce (LessonActivity + hydratovaná Activity)
export interface LessonActivityWithActivity extends LessonActivity {
  activity: Activity;
}

// ---- Multi-activity sub-steps ----

export type SubActivityType = "quiz" | "open" | "peer_review" | "group_work";

interface BaseSubActivity {
  order: number;
  id: string;
  title: string;
  description?: string;
  duration_min?: number;
  competence_weights?: Record<string, number>;
}

export interface QuizSubActivity extends BaseSubActivity {
  type: "quiz";
  assessment_mode?: AssessmentMode;
  questions: Question[];
  xp_complete_bonus?: number;
  xp_correct_phrasing_bonus?: number;
  xp_growth_correction_bonus?: number;
}

export interface OpenSubActivity extends BaseSubActivity {
  type: "open";
  instructions?: string;
  min_items: number;
  max_items: number;
  event_type?: string;
  ai_feedback?: boolean;
  teacher_review?: boolean;
  skip_interpretation?: string;
  xp_complete?: number;
}

export interface PeerReviewSubActivity extends BaseSubActivity {
  type: "peer_review";
  anonymize?: boolean;
  votes_per_student: number;
  select_top_n?: number;
  source_activity_id?: string;
  xp_complete?: number;
}

export interface GroupWorkSubActivity extends BaseSubActivity {
  type: "group_work";
  instructions?: string;
  deliverable: {
    type: "photo_upload";
    min_photos: number;
    max_photos: number;
    required: boolean;
    description?: string;
  };
  ai_verification?: {
    enabled: boolean;
    checks?: string[];
    prompt?: string;
  };
  teacher_review?: boolean;
  xp_complete?: number;
}

export type SubActivity = QuizSubActivity | OpenSubActivity | PeerReviewSubActivity | GroupWorkSubActivity;

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
  activity_id: string;                          // legacy single-activity ref (vždy vyplněno)
  lesson_id: string | null;                     // nový dvouúrovňový flow (NULL = starý single-activity)
  current_activity_index: number;               // index v lesson_activities (jen pokud lesson_id)
  completed_activity_ids: string[];             // UUID dokončených aktivit
  skipped_activity_ids: string[];               // lesson_activity.id přeskočené pro tuto session
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
export const GROWTH_ASSESSMENT_MSG = "Odpověď uložena ✓";

// Dual-skill primary messages (krátké, hlavní, vždy stejné)
export const SKILL_MSG_PRESNOST = "💎 Přesná odpověď! Skill Přesnost +1";
export const SKILL_MSG_PRACE_S_CHYBOU = "🔄 Skvělá oprava! Skill Práce s chybou +1";
export const SKILL_MSG_WRONG = "Příště to zkus znovu 💪";

// ---- Team Role Labels ----

export const TEAM_ROLE_INFO: Record<TeamRole, { label: string; emoji: string; description: string; tagline: string }> = {
  designer:     { label: "Designér",    emoji: "🎨", tagline: "Mám rád vizuál a kreativitu",       description: "Rád vymýšlíš jak věci vypadají a působí na lidi" },
  engineer:     { label: "Technik",     emoji: "⚙️", tagline: "Mám rád analýzu a realizaci",       description: "Rád promýšlíš jak něco funguje a doděláš to do konce" },
  communicator: { label: "Komunikátor", emoji: "📢", tagline: "Mám rád prezentování a diplomacii", description: "Rád mluvíš s lidmi a vysvětluješ nápady ostatním" },
  innovator:    { label: "Inovátor",    emoji: "💡", tagline: "Mám rád nápady a vize",             description: "Rád přicházíš s úplně novými nápady" },
  manager:      { label: "Manažer",     emoji: "📋", tagline: "Mám rád organizaci a plánování",    description: "Rád organizuješ tým a držíš harmonogram" },
};

export const ALL_TEAM_ROLES: TeamRole[] = ["designer", "engineer", "communicator", "innovator", "manager"];

// ---- Scoring helpers (dual-skill systém) ----
//
// XP body jsou VŽDY stejné — rozdíl mezi „správně napoprvé" a „chyba → oprava"
// se projeví v nezávislých skill counterech, ne v bodech:
//   • skill_presnost          ← správně napoprvé
//   • skill_prace_s_chybou    ← chyba → oprava → správně
//
// V assessment módu funguje stejné bodování, jen žák vidí výsledky až po dokončení testu.

export const XP_CORRECT_FIRST_TRY = 100;
export const XP_CORRECTED = 100;     // chyba → oprava
export const XP_WRONG = 30;           // pokus se počítá

export type AnswerOutcome = "correct_first" | "corrected" | "wrong";

export function classifyOutcome(isCorrect: boolean, attemptNo: number): AnswerOutcome {
  if (isCorrect && attemptNo === 1) return "correct_first";
  if (isCorrect && attemptNo > 1) return "corrected";
  return "wrong";
}

export function calcXp(_mode: AssessmentMode, isCorrect: boolean, attemptNo: number, _durationMs: number): number {
  // mode i durationMs ponechány v signatuře pro zpětnou kompatibilitu — nový dual-skill systém
  // je nepoužívá. Tip pro lint: eslint je vypnutý při buildu.
  void _mode;
  void _durationMs;
  const outcome = classifyOutcome(isCorrect, attemptNo);
  if (outcome === "correct_first") return XP_CORRECT_FIRST_TRY;
  if (outcome === "corrected") return XP_CORRECTED;
  return XP_WRONG;
}

export function getQuestionMode(sessionMode: ActivityMode, question: Question): AssessmentMode {
  if (sessionMode === "mixed") return question.assessment_mode || "learning";
  return sessionMode === "assessment" ? "assessment" : "learning";
}

// Compute skill counters from a list of best events per question.
// Vstup: pole "best" eventů (po deduplikaci podle question_id).
export function computeSkillCounters(events: Array<{ is_correct: boolean; attempt_no: number }>): {
  presnost: number;
  prace_s_chybou: number;
} {
  let presnost = 0;
  let praceSChybou = 0;
  for (const ev of events) {
    if (ev.is_correct && ev.attempt_no === 1) presnost++;
    else if (ev.is_correct && ev.attempt_no > 1) praceSChybou++;
  }
  return { presnost, prace_s_chybou: praceSChybou };
}

// Mapping skill → kompetence (pro reporting)
export const SKILL_TO_COMPETENCE = {
  presnost: "rvp_reseni_problemu",
  prace_s_chybou: "entrecomp_learning_through_experience",
} as const;

// Pick a random message from array, deterministic by seed
export function pickMessage(messages: string[], seed: number): string {
  return messages[seed % messages.length];
}

// Detekce týmové role z behaviorálních dat — REMOVED.
// Původní mapping na leader/analyst/creative/mediator/executor; nahrazeno preferenční
// taxonomií (designer/engineer/communicator/innovator/manager) volenou žákem v aktivitě role_selection.

// ─────────────────────────────────────────────
// Team (sestavený tým z aktivity team_assembly)
// ─────────────────────────────────────────────
export interface Team {
  id: string;
  session_id: string;
  lesson_id: string | null;
  activity_id: string | null;
  opportunity_text: string;
  source_event_id: string | null;
  leader_student_id: string;
  member_ids: string[];
  roles_summary: Partial<Record<TeamRole, number>>;
  is_leader_confirmed: boolean;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}
