-- Migration v4: activity_mode na session
-- Spusť v Supabase SQL editoru

-- Režim aktivity: learning (procvičování), assessment (ověření), mixed (smíšený)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS activity_mode TEXT NOT NULL DEFAULT 'learning';
