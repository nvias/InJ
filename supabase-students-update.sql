-- =============================================
-- Students profile fields — idempotentní záruka
-- (display_name + avatar_emoji už v projektu existují
--  z dřívějších migrací; tahle migrace je no-op pojistka)
-- =============================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_emoji VARCHAR(10) DEFAULT '🦊';
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#1A3BE8';

-- Defaultní hodnoty pro existující řádky kde je null
UPDATE students SET avatar_emoji = '🦊' WHERE avatar_emoji IS NULL;
UPDATE students SET avatar_color = '#1A3BE8' WHERE avatar_color IS NULL;
