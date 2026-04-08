-- =============================================
-- InJ - Seed lekce: TEAM FORGE (game integration)
-- Zdroj: https://github.com/stepankapko/cestainovatora
-- =============================================
-- Originál byl samostatná HTML hra napojená na vlastní Supabase.
-- Tato lekce je INTEGRACE - hra běží přímo v InJ jako React komponenta
-- (src/components/TeamForge.tsx) a session/scoring jdou do InJ databáze.
--
-- Render switch: src/app/lekce/[code]/page.tsx kontroluje activity.type:
--   - 'quiz'       -> klasická Kahoot UI
--   - 'team_forge' -> <TeamForge> komponenta
--
-- Výsledky kol se ukládají do student_events:
--   event_type = 'team_forge_round'
--   question_id = 'tf_round_1' | 'tf_round_2' | 'tf_round_3'
--   answer = JSON { round, finalScore, maxScore, team[], balanceScore, personalityScore, uniqueThemes }
--   is_correct = finalScore/maxScore >= 0.6
-- =============================================

INSERT INTO activities (id, title, type, description, questions, competence_weights) VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Team Forge: Sestav silný tým',
  'team_forge',
  'Interaktivní hra ze 3 kol. Sestav tým 3 postav (sebe + 2 spoluhráče) a sleduj, jak rovnoměrně pokrýváte tři dovednosti (Pečlivost, Nápady, Spolupráce). V kolech 2-3 přibyde i bonus za různorodost osobnostních typů. Učí komplementaritu týmu, sebepoznání a reflexi.',
  '[]'::jsonb,
  '{"entrecomp_working_with_others": 0.85, "entrecomp_self_awareness": 0.75, "entrecomp_learning_through_experience": 0.4, "rvp_osobnostni_socialni": 0.8}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  questions = EXCLUDED.questions,
  competence_weights = EXCLUDED.competence_weights;

-- =============================================
-- Hint pro učitele:
-- Vytvoření session pro tuto lekci probíhá normálně přes /ucitel/dashboard.
-- Žáci se připojí svým kódem, /lekce/[code] detekuje type='team_forge'
-- a místo kvízu vykreslí hru. Po dokončení kol se vrátí na /zak/profil.
-- =============================================
