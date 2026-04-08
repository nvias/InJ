-- Migration v5: Přidání assessment_mode do seed otázek
-- Mix: q1-q4 learning (procvičování), q5-q7 assessment (ověření), q8-q10 learning
-- Spusť v Supabase SQL editoru

UPDATE activities
SET questions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'id' IN ('q1','q2','q3','q4','q8','q9','q10')
        THEN elem || '{"assessment_mode": "learning"}'::jsonb
      WHEN elem->>'id' IN ('q5','q6','q7')
        THEN elem || '{"assessment_mode": "assessment"}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(questions) AS elem
)
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
