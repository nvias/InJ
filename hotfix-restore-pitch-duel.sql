-- =============================================
-- HOTFIX: Obnova aktivity Pitch Duel
-- =============================================
-- Důvod: seed-lekce-L5-prilezitost.sql původně používal stejné
-- UUID jako pitch_duel z migration-v11-grouping.sql
-- (c3d4e5f6-a7b8-9012-cdef-345678901234), takže ON CONFLICT DO UPDATE
-- přepsal pitch_duel na L5.
--
-- Tento hotfix:
--   1) přepíše řádek c3d4e5f6-… zpět na pitch_duel (vyčistí sub_activities, learning_goal, default_duration_min)
--
-- Po spuštění hotfixu pak znovu spusť opravený seed-lekce-L5-prilezitost.sql,
-- který už používá nové UUID 7a1f9b3c-4e2d-4c5a-8f1b-0a2c3d4e5f60.
-- =============================================

INSERT INTO activities (
  id,
  title,
  type,
  description,
  questions,
  competence_weights,
  team_size,
  requires_grouping,
  sub_activities,
  learning_goal,
  default_duration_min
) VALUES (
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  'Pitch Duel: Souboj prezentací',
  'pitch_duel',
  'Dvojice žáků dostane stejné téma a stejný čas. Každý odpitchuje svou verzi a Claude AI rozhodne, kdo byl přesvědčivější. Trénuje rétoriku, strukturu argumentu, zvládání tlaku.',
  '[]'::jsonb,
  '{"entrecomp_mobilising_others": 0.9, "rvp_komunikacni": 0.9, "entrecomp_self_awareness": 0.5}'::jsonb,
  2,
  true,
  '[]'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  title                = EXCLUDED.title,
  type                 = EXCLUDED.type,
  description          = EXCLUDED.description,
  questions            = EXCLUDED.questions,
  competence_weights   = EXCLUDED.competence_weights,
  team_size            = EXCLUDED.team_size,
  requires_grouping    = EXCLUDED.requires_grouping,
  sub_activities       = EXCLUDED.sub_activities,
  learning_goal        = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min;
