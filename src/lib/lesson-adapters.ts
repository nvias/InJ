// Adaptéry mezi atomickou Activity (z DB) a SubActivity (tvar očekávaný step komponentami).
// Step komponenty (BrainstormStep, VotingStep, PhotoStep) vznikly pro legacy multi_activity
// JSONB strukturu — namísto jejich přepisování konvertujeme Activity → SubActivity tvar.

import type {
  Activity,
  AssessmentMode,
  GroupWorkSubActivity,
  OpenSubActivity,
  PeerReviewSubActivity,
  QuizSubActivity,
} from "@/types";

export function toQuizSub(a: Activity, order: number): QuizSubActivity {
  return {
    type: "quiz",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    assessment_mode: (a.assessment_mode as AssessmentMode) ?? "learning",
    questions: a.questions,
    xp_complete_bonus: a.config?.xp_complete_bonus as number | undefined,
    xp_correct_phrasing_bonus: a.config?.xp_correct_phrasing_bonus as number | undefined,
    xp_growth_correction_bonus: a.config?.xp_growth_correction_bonus as number | undefined,
  };
}

export function toOpenSub(a: Activity, order: number): OpenSubActivity {
  return {
    type: "open",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    instructions: a.instructions ?? undefined,
    min_items: (a.config?.min_items as number) ?? 3,
    max_items: (a.config?.max_items as number) ?? 5,
    event_type: a.config?.event_type as string | undefined,
    ai_feedback: a.config?.ai_feedback as boolean | undefined,
    teacher_review: a.config?.teacher_review as boolean | undefined,
    skip_interpretation: a.config?.skip_interpretation as string | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

export function toPeerReviewSub(a: Activity, order: number): PeerReviewSubActivity {
  return {
    type: "peer_review",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    anonymize: a.config?.anonymize as boolean | undefined,
    votes_per_student: (a.config?.votes_per_student as number) ?? 3,
    select_top_n: a.config?.select_top_n as number | undefined,
    source_activity_id: a.config?.source_activity_id as string | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

export function toGroupWorkSub(a: Activity, order: number): GroupWorkSubActivity | null {
  const deliverable = a.config?.deliverable as GroupWorkSubActivity["deliverable"] | undefined;
  if (!deliverable) return null;
  return {
    type: "group_work",
    id: a.id,
    order,
    title: a.title,
    description: a.description ?? undefined,
    duration_min: a.default_duration_min ?? undefined,
    competence_weights: a.competence_weights,
    instructions: a.instructions ?? undefined,
    deliverable: {
      type: "photo_upload",
      min_photos: deliverable.min_photos ?? 1,
      max_photos: deliverable.max_photos ?? 3,
      required: deliverable.required ?? true,
      description: deliverable.description,
    },
    ai_verification: a.config?.ai_verification as GroupWorkSubActivity["ai_verification"],
    teacher_review: a.config?.teacher_review as boolean | undefined,
    xp_complete: a.config?.xp_complete as number | undefined,
  };
}

export const QUIZ_LIKE_TYPES = new Set(["quiz", "ab_decision", "ab_with_explanation", "scale"]);
export const NON_QUIZ_LESSON_TYPES = new Set([
  "open", "peer_review", "photo_upload", "group_work",
  "role_selection", "team_assembly",
]);

export function isQuizLikeActivity(type: string): boolean {
  return QUIZ_LIKE_TYPES.has(type);
}
