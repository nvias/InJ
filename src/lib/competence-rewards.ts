import { supabase } from "./supabase";
import { ENTRECOMP_LEVELS } from "./entrecomp";

// ═══════════════════════════════════════════════
// Helper pro ukládání XP do tabulky competence_scores.
// Pracuje s upsert: přečte aktuální stav, přičte XP, přepočítá level.
// ═══════════════════════════════════════════════

interface AwardedScore {
  competence_key: string;
  framework: string;
  xp_added: number;
  xp_total: number;
  level: number;
  level_name: string;
  level_group: string;
}

/**
 * Připíše XP do jedné kompetence pro jednoho žáka.
 * Vrací updated row s novým total + level info.
 */
export async function awardCompetenceXp(
  studentId: string,
  competenceKey: string,
  xpToAdd: number
): Promise<AwardedScore | null> {
  if (xpToAdd <= 0) return null;

  const framework = competenceKey.startsWith("rvp_") ? "rvp" : "entrecomp";
  const competenceName = competenceKey.replace(/^(rvp_|entrecomp_)/, "");
  const area = "general"; // pole 'area' je povinné, ale pro jednoduchost zde dáváme generic

  // Read current
  const { data: existing } = await supabase
    .from("competence_scores")
    .select("xp_total")
    .eq("student_id", studentId)
    .eq("framework", framework)
    .eq("competence", competenceName)
    .maybeSingle();

  const newTotal = (existing?.xp_total ?? 0) + xpToAdd;

  // Compute level
  let level = 1;
  let levelInfo = ENTRECOMP_LEVELS[0];
  for (let i = ENTRECOMP_LEVELS.length - 1; i >= 0; i--) {
    if (newTotal >= ENTRECOMP_LEVELS[i].xpRequired) {
      level = ENTRECOMP_LEVELS[i].level;
      levelInfo = ENTRECOMP_LEVELS[i];
      break;
    }
  }

  // Upsert
  await supabase
    .from("competence_scores")
    .upsert(
      {
        student_id: studentId,
        framework,
        area,
        competence: competenceName,
        xp_total: newTotal,
        level,
        level_name: levelInfo.name,
        level_group: levelInfo.group,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,framework,competence" }
    );

  return {
    competence_key: competenceKey,
    framework,
    xp_added: xpToAdd,
    xp_total: newTotal,
    level,
    level_name: levelInfo.name,
    level_group: levelInfo.group,
  };
}

/**
 * Připíše více kompetencí najednou pro jednoho žáka.
 * Hodnoty v `weights` jsou váhy 0–1, baseXp je násobitel.
 */
export async function awardCompetencesByWeights(
  studentId: string,
  baseXp: number,
  weights: Record<string, number>
): Promise<AwardedScore[]> {
  const results: AwardedScore[] = [];
  for (const [key, weight] of Object.entries(weights)) {
    const xp = Math.round(baseXp * weight);
    const r = await awardCompetenceXp(studentId, key, xp);
    if (r) results.push(r);
  }
  return results;
}
