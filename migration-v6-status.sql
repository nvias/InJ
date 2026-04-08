-- Migration v6: session status (active/paused/closed) místo is_active boolean
-- Spusť v Supabase SQL editoru

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paused';

-- Migruj existující data
UPDATE sessions SET status = CASE WHEN is_active THEN 'active' ELSE 'closed' END;
