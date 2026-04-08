-- Migration v8: Nové typy otázek + peer_reviews
-- Spusť v Supabase SQL editoru

-- 1. PEER REVIEWS tabulka
CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reviewed_student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('strong', 'interesting', 'needs_work')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_session ON peer_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewed ON peer_reviews(reviewed_student_id);

ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pilot" ON peer_reviews FOR ALL USING (true) WITH CHECK (true);

-- 2. Supabase Storage bucket pro obrázky otázek
-- POZOR: Toto spusť přes Supabase Dashboard → Storage → New bucket
-- Název: question-images, Public: true

-- 3. SEED: AB otázky pro Prezentační dovednosti
-- Přidáme do existující aktivity

UPDATE activities
SET questions = questions || '[
  {
    "id": "ab1",
    "text": "Který úvod prezentace je lepší?",
    "difficulty": "basic",
    "assessment_mode": "learning",
    "question_type": "ab_decision",
    "options": [
      {"key": "A", "text": "Dobrý den, jmenuji se Pavel a dnes vám budu prezentovat téma klimatické změny."},
      {"key": "B", "text": "Věděli jste, že za posledních 50 let zmizelo 50% světových ledovců? Já Pavel vám dnes řeknu proč."}
    ],
    "correct": "B",
    "explanation": "B používá silný hook - šokující fakta která okamžitě zaujmou publikum. Formální úvod (A) je nudný a publikum ztratí pozornost.",
    "hint_level_1": "Která odpověď tě jako posluchače víc zaujme hned na začátku?",
    "hint_level_2": "Vzpomeň si na nejlepší přednášku nebo video co jsi viděl/a. Začínalo nudně, nebo něčím zajímavým?",
    "competence_weights": {"rvp_komunikacni": 0.9, "entrecomp_mobilising_others": 0.8},
    "skip_interpretation": "Žák si není jistý co dělá dobrý úvod prezentace"
  },
  {
    "id": "ab2",
    "text": "Jak zareaguješ když zapomeneš co říct?",
    "difficulty": "advanced",
    "assessment_mode": "learning",
    "question_type": "ab_with_explanation",
    "options": [
      {"key": "A", "text": "Omlouvám se, zapomněl jsem co jsem chtěl říct..."},
      {"key": "B", "text": "Pojďme se na chvíli zamyslet... (pauza) Co myslíte, jak byste to vyřešili vy?"}
    ],
    "correct": "B",
    "requires_explanation": true,
    "explanation_prompt": "Proč si myslíš že B je lepší? Napiš vlastními slovy.",
    "explanation": "B přetvoří problém v příležitost - zapojí publikum otázkou a pauza působí přirozeně. Omluva (A) upozorní na chybu a sníží sebevědomí.",
    "hint_level_1": "Jak se cítíš jako posluchač když prezentující řekne A? A když řekne B?",
    "hint_level_2": "Co vypadá profesionálněji - přiznat chybu, nebo ji proměnit v interakci?",
    "competence_weights": {"rvp_komunikacni": 0.8, "entrecomp_coping_with_uncertainty": 0.9, "rvp_osobnostni": 0.6},
    "skip_interpretation": "Žák se možná bojí situací kdy ztratí kontrolu"
  }
]'::jsonb
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
