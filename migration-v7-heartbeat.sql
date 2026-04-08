-- Migration v7: teacher heartbeat + total_xp
-- Spusť v Supabase SQL editoru

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_heartbeat TIMESTAMPTZ DEFAULT now();
