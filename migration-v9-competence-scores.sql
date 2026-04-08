-- Migration v9: Competence XP progression systém
-- Spusť v Supabase SQL editoru

CREATE TABLE IF NOT EXISTS competence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  framework TEXT NOT NULL DEFAULT 'entrecomp',
  area TEXT NOT NULL,
  competence TEXT NOT NULL,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  level_name TEXT NOT NULL DEFAULT 'Discover',
  level_group TEXT NOT NULL DEFAULT 'foundation',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, framework, competence)
);

CREATE INDEX IF NOT EXISTS idx_comp_scores_student ON competence_scores(student_id);

ALTER TABLE competence_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pilot" ON competence_scores FOR ALL USING (true) WITH CHECK (true);

-- Přidej grade (ročník) do třídy pro etalon výpočet
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grade INTEGER DEFAULT 6;
