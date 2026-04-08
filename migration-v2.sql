-- Migration: přidání current_question a avatar_emoji
-- Spusť v Supabase SQL editoru

-- Učitel řídí tempo - číslo aktuální otázky
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_question INTEGER NOT NULL DEFAULT 0;

-- Žák si vybere emoji avatara
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_emoji TEXT NOT NULL DEFAULT '🦊';
