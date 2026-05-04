-- =============================================
-- Migration v13 — RLS fix
-- Zapne Row Level Security na VŠECH tabulkách v public schema
-- a přidá "Allow all for pilot" politiku (idempotentně).
--
-- Řeší Supabase security alert: rls_disabled_in_public
-- =============================================

-- 1) Diagnostika: které tabulky NEMAJÍ RLS?
-- (pro informaci, spusť samostatně pokud chceš vidět výstup)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- 2) Zapni RLS na všech známých tabulkách (idempotentní — opakované spuštění je no-op)
ALTER TABLE IF EXISTS classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS competence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entrecomp_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rvp_competences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_group_members ENABLE ROW LEVEL SECURITY;

-- 3) Přidej "Allow all for pilot" policy tam kde chybí
-- DROP + CREATE zajistí že policy existuje a je správná
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'classes', 'students', 'activities', 'sessions', 'student_events',
      'peer_reviews', 'competence_scores', 'entrecomp_matrix', 'rvp_competences',
      'session_groups', 'session_group_members'
    ])
  LOOP
    -- Smaž existující policy (pokud je)
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow all for pilot" ON %I', tbl
    );
    -- Vytvoř novou
    EXECUTE format(
      'CREATE POLICY "Allow all for pilot" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl
    );
  END LOOP;
END
$$;

-- 4) Ověření — po spuštění by tento dotaz měl ukázat rowsecurity = true pro všechny tabulky:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
