-- =============================================
-- InJ migration v14 — Per-session activity skip + závislosti aktivit
-- =============================================
-- Dvě nové schopnosti:
--
-- 1) PER-SESSION SKIP — učitel může před spuštěním session vyhodit některé aktivity
--    z proběhu (např. méně času = bez focení). Šablona lekce zůstává nezměněná,
--    jen daná session ignoruje vybraná lesson_activities.
--    `sessions.skipped_activity_ids` = JSONB array UUID lesson_activity.id
--
-- 2) ZÁVISLOSTI AKTIVIT — některé aktivity vyžadují předchozí (hlasování → brainstorm,
--    sestavení týmů → hlasování + volba role, Strom → sestavení týmů).
--    `lesson_activities.requires_lesson_activity_ids` = JSONB array UUID lesson_activity.id
--    UI při skip cascade unchecknu všechny závislé.
-- =============================================

-- 1) Sessions: per-session skip list
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS skipped_activity_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Lesson_activities: dependency graf
ALTER TABLE lesson_activities
  ADD COLUMN IF NOT EXISTS requires_lesson_activity_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
