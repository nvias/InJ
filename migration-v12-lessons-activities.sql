-- =============================================
-- InJ migration v12 — Dvouúrovňová struktura: lessons → lesson_activities → activities
-- =============================================
-- Lekce (lessons) je kontejner aktivit. Aktivita (activities) je atomická
-- jednotka (kvíz, brainstorm, foto upload, …) a může být znovupoužita
-- napříč lekcemi přes propojovací tabulku lesson_activities.
--
-- Stará tabulka activities zůstává beze změny — jen přibývají sloupce
-- (learning_goal, default_duration_min, is_public) které jsou idempotentně
-- přidány, pokud chybí.
--
-- Sessions: nové sloupce lesson_id + current_activity_index +
-- completed_activity_ids zachovávají zpětnou kompatibilitu (NULL lesson_id =
-- starý flow s jednou activity, plný lesson_id = nový dvouúrovňový flow).
-- =============================================

-- 1) ACTIVITIES — doplnit metadata sloupce (idempotentně, beze ztráty dat)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS learning_goal TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS default_duration_min INTEGER;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS assessment_mode TEXT;        -- 'learning' | 'assessment' | NULL (per-question)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_by UUID;             -- FK volitelně později
ALTER TABLE activities ADD COLUMN IF NOT EXISTS instructions TEXT;           -- pro open / group_work / peer_review
ALTER TABLE activities ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
                                                                              -- type-specific data (min_items, votes_per_student, deliverable, ai_verification…)

-- 2) LESSONS — kontejner pro 1..N aktivit
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  lesson_number INTEGER,                                  -- pořadí v programu (L1..L15)
  phase INTEGER,                                          -- 1..4 fáze Cesty inovátora
  total_duration_min INTEGER,                             -- override; jinak součet aktivit
  learning_goal TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessons_phase ON lessons(phase);
CREATE INDEX IF NOT EXISTS idx_lessons_published ON lessons(is_published);

-- 3) LESSON_ACTIVITIES — junction (s pořadím)
CREATE TABLE IF NOT EXISTS lesson_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,                           -- 1, 2, 3, …
  is_optional BOOLEAN NOT NULL DEFAULT false,
  custom_duration_min INTEGER,                            -- přepíše default_duration_min
  teacher_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson ON lesson_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_activity ON lesson_activities(activity_id);

-- 4) SESSIONS — přidat lesson_id + per-cohort progres (zpětná kompatibilita zachována)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_activity_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed_activity_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- activity_id zůstává (NOT NULL z původního schematu) — pro zpětnou kompat dál ukazuje
-- na první aktivitu lekce nebo na single-aktivitu (ne-lesson session).

CREATE INDEX IF NOT EXISTS idx_sessions_lesson ON sessions(lesson_id);

-- 5) RLS — povolit pro pilot
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for pilot" ON lessons;
DROP POLICY IF EXISTS "Allow all for pilot" ON lesson_activities;
CREATE POLICY "Allow all for pilot" ON lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON lesson_activities FOR ALL USING (true) WITH CHECK (true);
