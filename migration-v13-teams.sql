-- =============================================
-- InJ migration v13 — Teams (sestavené týmy z team_assembly)
-- =============================================
-- Tabulka teams ukládá konečné složení týmů, které vznikne v aktivitě 'team_assembly'.
-- Liší se od session_groups: session_groups je generický grouping (voting groups,
-- pitch_duel páry, …); teams je výsledek role-aware self-organizace, kde lídr =
-- vlastník vítězné příležitosti a ostatní žáci se k němu přidávají podle preference.
--
-- students.team_role (VARCHAR(20)) byl přidán dřív (supabase-competence-migration.sql).
-- Zde nemění schéma — jen se začnou ukládat hodnoty z nové taxonomie:
--   designer | engineer | communicator | innovator | manager
-- =============================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
                                                       -- která team_assembly aktivita tým vytvořila
  opportunity_text TEXT NOT NULL,                      -- vítězná příležitost (z předchozího hlasování)
  source_event_id UUID,                                -- id text_submit eventu, který získal nejvíc hlasů
  leader_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,       -- array studentových id (včetně lídra)
  roles_summary JSONB NOT NULL DEFAULT '{}'::jsonb,    -- { "designer": 2, "engineer": 1, ... }
  is_leader_confirmed BOOLEAN NOT NULL DEFAULT false,  -- lídr potvrdil složení
  is_approved BOOLEAN NOT NULL DEFAULT false,          -- učitel schválil
  approved_by TEXT,                                    -- teacher_id (volné textové pole — pilot)
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_student_id);
CREATE INDEX IF NOT EXISTS idx_teams_lesson ON teams(lesson_id);

-- 1 lídr per session (žák může vést max 1 tým ve své session)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_teams_session_leader ON teams(session_id, leader_student_id);

-- RLS — pilot mode
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for pilot" ON teams;
CREATE POLICY "Allow all for pilot" ON teams FOR ALL USING (true) WITH CHECK (true);
