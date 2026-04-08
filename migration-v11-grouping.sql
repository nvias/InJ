-- =============================================
-- InJ migration v11 — Group composition (lobby)
-- =============================================
-- Generický mechanismus pro aktivity, které vyžadují
-- skupiny žáků (páry, trojice, pětice, ...).
--
-- Aktivity se rozdělí na tři typy podle team_size:
--   1  -> sólo (kvíz, single-player team_forge)
--   2  -> páry (pitch_duel)
--   3+ -> týmovky (multiplayer team_forge, future)
--
-- Aktivity s requires_grouping=true vstupují do session
-- ve stavu 'lobby', kde učitel rozhází žáky do skupin
-- a teprve pak hra startuje (status -> 'active').
-- =============================================

-- 1) ACTIVITIES: team_size + requires_grouping
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requires_grouping BOOLEAN NOT NULL DEFAULT false;

-- 2) SESSION_GROUPS: jedna řada = jedna skupina v rámci session
CREATE TABLE IF NOT EXISTS session_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  group_index INTEGER NOT NULL,                 -- 1, 2, 3, ...
  group_name TEXT,                              -- volitelně "Tým modrých"
  state JSONB NOT NULL DEFAULT '{}'::jsonb,     -- per-aktivita stav (např. selected chars)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, group_index)
);

CREATE INDEX IF NOT EXISTS idx_session_groups_session ON session_groups(session_id);

-- 3) SESSION_GROUP_MEMBERS: napojení žáků na skupiny
CREATE TABLE IF NOT EXISTS session_group_members (
  group_id UUID NOT NULL REFERENCES session_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL DEFAULT 0,        -- pořadí v týmu (0..team_size-1)
  PRIMARY KEY (group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_student ON session_group_members(student_id);

-- 4) RLS - povolit pro pilot
ALTER TABLE session_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for pilot" ON session_groups;
DROP POLICY IF EXISTS "Allow all for pilot" ON session_group_members;
CREATE POLICY "Allow all for pilot" ON session_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON session_group_members FOR ALL USING (true) WITH CHECK (true);

-- 5) Default hodnoty pro existující aktivity
UPDATE activities SET team_size = 1, requires_grouping = false WHERE team_size IS NULL;

-- =============================================
-- 6) SEED: připravená Pitch Duel aktivita (placeholder)
-- =============================================
-- Mechaniku přidáme v dalším kroku (Phase B).
-- Pro teď nám slouží jen k otestování lobby flow.
INSERT INTO activities (id, title, type, description, questions, competence_weights, team_size, requires_grouping)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  'Pitch Duel: Souboj prezentací',
  'pitch_duel',
  'Dvojice žáků dostane stejné téma a stejný čas. Každý odpitchuje svou verzi a Claude AI rozhodne, kdo byl přesvědčivější. Trénuje rétoriku, strukturu argumentu, zvládání tlaku.',
  '[]'::jsonb,
  '{"entrecomp_mobilising_others": 0.9, "rvp_komunikacni": 0.9, "entrecomp_self_awareness": 0.5}'::jsonb,
  2,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  team_size = EXCLUDED.team_size,
  requires_grouping = EXCLUDED.requires_grouping,
  competence_weights = EXCLUDED.competence_weights;
