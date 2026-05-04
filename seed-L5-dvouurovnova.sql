-- =============================================
-- ⚠️  SUPERSEDED — použij seed-L5-aktivity.sql
-- =============================================
-- Tento seed má 4 aktivity (quiz/open/peer_review/photo_upload).
-- Nový seed-L5-aktivity.sql má 6 aktivit (přidává role_selection a team_assembly
-- před foto Stromu). Je nadřazený; tento ponecháváme pro historii.
-- =============================================
-- InJ - Seed lekce L5 (dvouúrovňová struktura, 4 aktivity)
-- =============================================
-- Vyžaduje: migration-v12-lessons-activities.sql
--
-- Přepíše původní multi_activity řádek L5 na novou strukturu:
--   1× lessons (kontejner)
--   4× activities (atomické: quiz, open, peer_review, photo_upload)
--   4× lesson_activities (propojení v pořadí)
-- =============================================

-- 0) Smaž starý multi_activity řádek L5 (UUID 7a1f9b3c… z předchozího seedu)
--    Bezpečné — ON DELETE CASCADE shodí závislé sessions.
DELETE FROM activities WHERE id = '7a1f9b3c-4e2d-4c5a-8f1b-0a2c3d4e5f60';

-- =============================================
-- 1) LESSON L5 — kontejner
-- =============================================
INSERT INTO lessons (id, title, description, lesson_number, phase, total_duration_min, learning_goal, is_published)
VALUES (
  'a5e50001-0000-4000-8000-000000000005',
  'Hledání příležitostí',
  'Žáci se naučí vidět svět očima inovátora — místo stížností hledají příležitosti ke zlepšení.',
  5,
  1,
  90,
  'Žák dokáže popsat příležitost pozitivní rétorikou (Vidím, že... místo Štve mě...) a sestavit Strom příležitosti.',
  true
)
ON CONFLICT (id) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  lesson_number      = EXCLUDED.lesson_number,
  phase              = EXCLUDED.phase,
  total_duration_min = EXCLUDED.total_duration_min,
  learning_goal      = EXCLUDED.learning_goal,
  is_published       = EXCLUDED.is_published;

-- Vyčisti případné staré propojení (před re-seedem aktivit)
DELETE FROM lesson_activities WHERE lesson_id = 'a5e50001-0000-4000-8000-000000000005';

-- =============================================
-- 2) ACTIVITY 1 — Kvíz Inovátor vs. Stěžovatel
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min, assessment_mode,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000001',
  'Kvíz: Inovátor vs. Stěžovatel',
  'quiz',
  '10 AB rozhodnutí — která formulace je správná? Procvičení rétoriky inovátora.',
  'Žák rozliší pozorovací formulaci (Vidím, že...) od stížnosti (Štve mě...).',
  15,
  'learning',
  '[
    {"id":"l5q1","text":"Vyberte správnou formulaci inovátora:","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Štve mě, že v jídelně je vždy hluk."},{"key":"B","text":"Vidím, že v jídelně je hluk — co by to zlepšilo?"}],
     "correct":"B",
     "explanation":"Inovátor začíná pozorováním a hledá zlepšení.",
     "hint_level_1":"Která věta míří k řešení?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_podnikavost":0.6}},
    {"id":"l5q2","text":"Jak inovátor popisuje situaci?","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Naši spolužáci nikdy neuklízí třídu."},{"key":"B","text":"Všiml jsem si, že třída bývá neuklizená po přestávce."}],
     "correct":"B",
     "explanation":"Slovo nikdy je generalizace; pozorování je konkrétní.",
     "hint_level_1":"Která formulace popisuje fakt a která soudí lidi?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_komunikacni":0.4}},
    {"id":"l5q3","text":"Co inovátor vidí místo problému?","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Stížnost která nikomu nepomůže"},{"key":"B","text":"Příležitost ke zlepšení"}],
     "correct":"B",
     "explanation":"Inovátor reframuje problém jako příležitost.",
     "hint_level_1":"Co dělá inovátor jinak než stěžovatel?",
     "competence_weights":{"rvp_podnikavost":0.8,"entrecomp_spotting_opportunities":0.7}},
    {"id":"l5q4","text":"Strom příležitosti má:","difficulty":"basic","assessment_mode":"learning","question_type":"click",
     "options":[
       {"key":"A","text":"Kořeny = příčiny / Kmen = příležitost / Koruna = co se zlepší"},
       {"key":"B","text":"Kořeny = důsledky / Kmen = stížnost / Koruna = viníci"},
       {"key":"C","text":"Kořeny = nápady / Kmen = problém / Koruna = výmluvy"},
       {"key":"D","text":"Kořeny = lidé / Kmen = peníze / Koruna = sláva"}
     ],
     "correct":"A",
     "explanation":"Kořeny = příčiny, kmen = formulovaná příležitost, koruna = hodnota.",
     "hint_level_1":"K čemu slouží kořeny v reálném stromu?",
     "competence_weights":{"entrecomp_vision":0.7,"rvp_podnikavost":0.6}},
    {"id":"l5q5","text":"Persona je:","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Vymyšlená postava která reprezentuje lidi jimž chceme pomoci"},{"key":"B","text":"Člen týmu který má nejlepší nápad"}],
     "correct":"A",
     "explanation":"Persona pomáhá zaměřit se na konkrétního uživatele.",
     "hint_level_1":"Pro koho příležitost řešíme?",
     "competence_weights":{"entrecomp_working_with_others":0.8,"entrecomp_spotting_opportunities":0.5}},
    {"id":"l5q6","text":"Co říká growth mindset o chybném nápadu?","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Špatný nápad = zbytečná práce"},{"key":"B","text":"Každý nápad přináší data a učení"}],
     "correct":"B",
     "explanation":"I nepoužitelný nápad ukazuje hranice a inspiruje další pokusy.",
     "hint_level_1":"Kdy ses naučil/a nejvíc?",
     "competence_weights":{"rvp_k_uceni":0.9,"entrecomp_learning_through_experience":0.7}},
    {"id":"l5q7","text":"Proč inovátor říká Vidím, že... místo Štve mě...?","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Aby byl zdvořilý"},{"key":"B","text":"Protože pozorování vede k řešení, stížnost ne"}],
     "correct":"B",
     "explanation":"Pozorování je první krok k akci.",
     "hint_level_1":"Co se stane potom, když řekneš Vidím, že...?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_reseni_problemu":0.7}},
    {"id":"l5q8","text":"Hlasování o příležitostech v týmu je:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Soutěž kdo má nejlepší nápad"},{"key":"B","text":"Výběr 5 témat pro společnou práci"}],
     "correct":"B",
     "explanation":"Hlasování slouží týmu k zúžení mnoha nápadů.",
     "hint_level_1":"Co s nápady děláme po hlasování?",
     "competence_weights":{"entrecomp_working_with_others":0.9,"entrecomp_valuing_ideas":0.6}},
    {"id":"l5q9","text":"Koruna Stromu příležitosti ukazuje:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Co nás štve"},{"key":"B","text":"Komu pomůžeme a jak se situace zlepší"}],
     "correct":"B",
     "explanation":"Koruna ukazuje hodnotu, kterou strom přináší.",
     "hint_level_1":"Co je nejvíc nahoře a co je vidět?",
     "competence_weights":{"entrecomp_vision":0.9,"entrecomp_valuing_ideas":0.6}},
    {"id":"l5q10","text":"Dobrá příležitost ke zlepšení musí být:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Co největší a nejsložitější"},{"key":"B","text":"Konkrétní, pozorovatelná a řešitelná"}],
     "correct":"B",
     "explanation":"Velké a vágní příležitosti se nedají uchopit.",
     "hint_level_1":"Co se snadněji řeší?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_reseni_problemu":0.6}}
  ]'::jsonb,
  '{"entrecomp_spotting_opportunities":0.9,"entrecomp_creativity":0.5,"rvp_podnikavost":0.7}'::jsonb,
  NULL,
  '{"xp_complete_bonus":150,"xp_correct_phrasing_bonus":25,"xp_growth_correction_bonus":30}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title                = EXCLUDED.title,
  type                 = EXCLUDED.type,
  description          = EXCLUDED.description,
  learning_goal        = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min,
  assessment_mode      = EXCLUDED.assessment_mode,
  questions            = EXCLUDED.questions,
  competence_weights   = EXCLUDED.competence_weights,
  config               = EXCLUDED.config,
  is_public            = EXCLUDED.is_public;

-- =============================================
-- 3) ACTIVITY 2 — Brainstorm Moje příležitosti (open)
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000002',
  'Brainstorm: Moje příležitost',
  'open',
  'Žák popíše JEDNU vlastní příležitost formulací „Vidím, že..." (min 20 slov).',
  'Žák samostatně formuluje vlastní příležitost pozorovací rétorikou.',
  20,
  '[]'::jsonb,
  '{"entrecomp_spotting_opportunities":1.0,"rvp_podnikavost":0.8,"rvp_komunikacni":0.4}'::jsonb,
  'Začni větou: „Vidím, že..." — popiš pozorování, ne stížnost. Co konkrétně bys chtěl/a zlepšit? (min 20 slov)',
  '{"min_items":1,"max_items":1,"min_words":20,"event_type":"text_submit","ai_feedback":true,"teacher_review":true,
    "ai_check_criteria":"Věta začíná pozorovací formulací (Vidím, že / Všiml jsem si). Není to stížnost. Je konkrétní a pozorovatelná.",
    "skip_interpretation":"Žák má problém s přechodem od stížnosti k pozorování — potřebuje individuální podporu",
    "xp_complete":100,"xp_correct_phrasing_bonus":25}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title                = EXCLUDED.title,
  type                 = EXCLUDED.type,
  description          = EXCLUDED.description,
  learning_goal        = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min,
  competence_weights   = EXCLUDED.competence_weights,
  instructions         = EXCLUDED.instructions,
  config               = EXCLUDED.config,
  is_public            = EXCLUDED.is_public;

-- =============================================
-- 4) ACTIVITY 3 — Hlasování o příležitostech (peer_review)
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public,
  team_size, requires_grouping
) VALUES (
  'a5e50001-0000-4000-8001-000000000003',
  'Hlasování o příležitostech',
  'peer_review',
  'Žáci ve skupinách 4–5 si postupně přečtou své nápady, pak anonymně hlasují pro 1–2 nejlepší. Vítězný = týmová příležitost.',
  'Žák zhodnotí cizí formulace, ocení dobrý nápad a zodpovědně se rozhodne ve skupině.',
  15,
  '[]'::jsonb,
  '{"entrecomp_valuing_ideas":0.9,"entrecomp_working_with_others":0.8,"rvp_podnikavost":0.5}'::jsonb,
  'Ve skupině si postupně přečtěte své nápady (1–2 min na žáka), pak anonymně vyberte max 2 nápady, které vás nejvíc zaujaly. Vítězný se stane týmovou příležitostí.',
  '{"anonymize":true,"votes_per_student":2,"select_top_n":1,
    "source_activity_id":"a5e50001-0000-4000-8001-000000000002",
    "presentation_duration_ms":360000,
    "result":"Týmová příležitost (nápad s nejvíce hlasy)","xp_complete":50}'::jsonb,
  true,
  4,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title                = EXCLUDED.title,
  type                 = EXCLUDED.type,
  description          = EXCLUDED.description,
  learning_goal        = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min,
  competence_weights   = EXCLUDED.competence_weights,
  instructions         = EXCLUDED.instructions,
  config               = EXCLUDED.config,
  is_public            = EXCLUDED.is_public,
  team_size            = EXCLUDED.team_size,
  requires_grouping    = EXCLUDED.requires_grouping;

-- =============================================
-- 5) ACTIVITY 4 — Strom příležitosti (photo_upload / group_work)
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000004',
  'Strom příležitosti',
  'photo_upload',
  'Tým pracuje na papírovém A3 plakátu — kořeny (příčiny), kmen (příležitost), koruna (komu pomůžeme a jak). Na konci nafotí plakát.',
  'Tým vizualizuje příležitost jako Strom (kořeny/kmen/koruna) a doloží fotografií.',
  45,
  '[]'::jsonb,
  '{"entrecomp_creativity":0.8,"entrecomp_vision":0.7,"rvp_podnikavost":0.9,"entrecomp_working_with_others":0.6,"rvp_kulturni":0.3}'::jsonb,
  '1) Vyberte si jednu z 5 nejhlasovanějších příležitostí. 2) Na A3 papír namalujte strom. 3) Kořeny = proč situace existuje. 4) Kmen = formulace příležitosti (Vidím, že...). 5) Koruna = komu pomůžeme. 6) Vyfoťte a nahrajte.',
  '{"deliverable":{"type":"photo_upload","min_photos":1,"max_photos":3,"required":true,"description":"Foto A3 plakátu Stromu příležitosti"},
    "ai_verification":{"enabled":true,"checks":["ma_koreny","ma_kmen_s_textem","ma_korunu","obsahuje_pozorovaci_formulaci"],
      "prompt":"Zkontroluj, jestli foto obsahuje kresbu stromu se třemi částmi: kořeny (s textem příčin), kmen (s formulovanou příležitostí typu Vidím, že...) a korunu. Vrať JSON {koreny:bool,kmen:bool,koruna:bool,formulace:bool,poznamka:string}."},
    "teacher_review":true,"team_size_hint":3,
    "skip_interpretation":"Tým neodevzdal foto — možná konflikt v týmu nebo chybí podpora",
    "xp_complete":200}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title                = EXCLUDED.title,
  type                 = EXCLUDED.type,
  description          = EXCLUDED.description,
  learning_goal        = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min,
  competence_weights   = EXCLUDED.competence_weights,
  instructions         = EXCLUDED.instructions,
  config               = EXCLUDED.config,
  is_public            = EXCLUDED.is_public;

-- =============================================
-- 6) LESSON_ACTIVITIES — propojení v pořadí 1-4
-- =============================================
INSERT INTO lesson_activities (id, lesson_id, activity_id, order_index, is_optional, custom_duration_min, teacher_note) VALUES
  ('a5e50002-0000-4000-9000-000000000001', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000001', 1, false, NULL, 'Otevírací kvíz — naladění na rétoriku inovátora'),
  ('a5e50002-0000-4000-9000-000000000002', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000002', 2, false, NULL, 'Žáci pracují individuálně, AI dá feedback na formulace'),
  ('a5e50002-0000-4000-9000-000000000003', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000003', 3, false, NULL, 'Anonymizace povinná — chrání křehké nápady'),
  ('a5e50002-0000-4000-9000-000000000004', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000004', 4, false, NULL, 'Týmová práce — A3 plakát, foto, AI verifikace tří částí stromu')
ON CONFLICT (id) DO UPDATE SET
  lesson_id           = EXCLUDED.lesson_id,
  activity_id         = EXCLUDED.activity_id,
  order_index         = EXCLUDED.order_index,
  is_optional         = EXCLUDED.is_optional,
  custom_duration_min = EXCLUDED.custom_duration_min,
  teacher_note        = EXCLUDED.teacher_note;

-- =============================================
-- XP odměny pro L5:
--   Kvíz (a1):       150 XP + 25 / správná formulace + 30 / oprava chyby
--   Brainstorm (a2): 100 XP + 25 / správná formulace bonus
--   Hlasování (a3):  50 XP
--   Strom foto (a4): 200 XP
-- Celkem max: ~525 XP
-- =============================================
