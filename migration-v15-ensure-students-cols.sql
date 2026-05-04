-- =============================================
-- InJ migration v15 — Idempotentně doplň chybějící sloupce na students
-- =============================================
-- Tuto migraci spusť, pokud:
--   • Activity team_assembly hází 400 Bad Request při fetchu studenta
--     (chybí sloupec team_role)
--   • Žák profile crashuje (chybí avatar_emoji nebo competence_xp)
--
-- Všechny ALTER jsou IDEMPOTENTNÍ (ADD COLUMN IF NOT EXISTS) — bezpečné spustit
-- opakovaně. Sloupce, které už existují, se nezmění.
-- =============================================

-- 1) team_role — preferenční role z aktivity role_selection
--    (designer | engineer | communicator | innovator | manager)
ALTER TABLE students ADD COLUMN IF NOT EXISTS team_role VARCHAR(20) DEFAULT NULL;

-- 2) avatar_emoji — emoji avatar (přidává se v onboardingu / teacherem)
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_emoji TEXT NOT NULL DEFAULT '🦊';

-- 3) Sloupce z supabase-competence-migration.sql (pokud nebyly nikdy spuštěné)
ALTER TABLE students ADD COLUMN IF NOT EXISTS swot_profile JSONB NOT NULL DEFAULT '{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]}'::jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS role_confidence NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS growth_mindset_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS competence_xp JSONB NOT NULL DEFAULT '{}'::jsonb;
