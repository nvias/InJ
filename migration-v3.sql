-- Migration v3: timer, answering_open
-- Spusť v Supabase SQL editoru

-- Volitelný časovač (null = bez limitu, učitel uzavírá manuálně)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timer_seconds INTEGER DEFAULT NULL;

-- Učitel může uzavřít/otevřít odpovídání na aktuální otázku
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS answering_open BOOLEAN NOT NULL DEFAULT true;
