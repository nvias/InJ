-- =============================================
-- InJ - Seed lekce L5 (5 aktivit, dvouúrovňová struktura)
-- =============================================
-- Vyžaduje:
--   migration-v12-lessons-activities.sql
--   migration-v13-teams.sql
--
-- Tento soubor NAHRAZUJE seed-L5-dvouurovnova.sql (4-aktivita verze).
-- Idempotentní (ON CONFLICT DO UPDATE) — bezpečné spustit opakovaně.
--
-- Sekvence aktivit lekce „Hledání příležitostí" (5 kroků, ~110 min):
--   1. Kvíz: Inovátor vs. Stěžovatel        (15 min, learning quiz)
--   2. Brainstorm: Moje příležitost          (20 min, open, 1× min 20 slov)
--   3. Představení příležitostí a hlasování  (15 min, peer_review, group of 4 + ready gate)
--   4. Volba role                            (5 min, role_selection)
--   5. Sestavení týmů                        (15 min, team_assembly)
--   6. Strom příležitosti                    (45 min, photo_upload, group_work)
-- =============================================

-- 0) Smaž starý multi_activity řádek L5 (stará legacy UUID)
DELETE FROM activities WHERE id = '7a1f9b3c-4e2d-4c5a-8f1b-0a2c3d4e5f60';

-- =============================================
-- 1) LESSON L5 — kontejner
-- =============================================
INSERT INTO lessons (id, title, description, lesson_number, phase, total_duration_min, learning_goal, is_published)
VALUES (
  'a5e50001-0000-4000-8000-000000000005',
  'Hledání příležitostí',
  'Žáci se naučí vidět svět očima inovátora — místo stížností hledají příležitosti, hlasují o nich a sestaví týmy podle rolí, aby je společně vyřešili.',
  5,
  1,
  115,
  'Žák popíše příležitost pozitivní rétorikou, vybere si týmovou roli a se spolužáky sestaví Strom příležitosti.',
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

-- Vyčisti staré propojení (před re-seedem aktivit)
DELETE FROM lesson_activities WHERE lesson_id = 'a5e50001-0000-4000-8000-000000000005';

-- =============================================
-- 2) ACTIVITY 1 — Kvíz Inovátor vs. Stěžovatel  (BEZE ZMĚNY z předchozího seedu)
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
     "correct":"B","explanation":"Inovátor začíná pozorováním a hledá zlepšení.","hint_level_1":"Která věta míří k řešení?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_podnikavost":0.6}},
    {"id":"l5q2","text":"Jak inovátor popisuje situaci?","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Naši spolužáci nikdy neuklízí třídu."},{"key":"B","text":"Všiml jsem si, že třída bývá neuklizená po přestávce."}],
     "correct":"B","explanation":"Slovo nikdy je generalizace; pozorování je konkrétní.","hint_level_1":"Která formulace popisuje fakt a která soudí lidi?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_komunikacni":0.4}},
    {"id":"l5q3","text":"Co inovátor vidí místo problému?","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Stížnost která nikomu nepomůže"},{"key":"B","text":"Příležitost ke zlepšení"}],
     "correct":"B","explanation":"Inovátor reframuje problém jako příležitost.","hint_level_1":"Co dělá inovátor jinak než stěžovatel?",
     "competence_weights":{"rvp_podnikavost":0.8,"entrecomp_spotting_opportunities":0.7}},
    {"id":"l5q4","text":"Strom příležitosti má:","difficulty":"basic","assessment_mode":"learning","question_type":"click",
     "options":[
       {"key":"A","text":"Kořeny = příčiny / Kmen = příležitost / Koruna = co se zlepší"},
       {"key":"B","text":"Kořeny = důsledky / Kmen = stížnost / Koruna = viníci"},
       {"key":"C","text":"Kořeny = nápady / Kmen = problém / Koruna = výmluvy"},
       {"key":"D","text":"Kořeny = lidé / Kmen = peníze / Koruna = sláva"}
     ],
     "correct":"A","explanation":"Kořeny = příčiny, kmen = formulovaná příležitost, koruna = hodnota.","hint_level_1":"K čemu slouží kořeny v reálném stromu?",
     "competence_weights":{"entrecomp_vision":0.7,"rvp_podnikavost":0.6}},
    {"id":"l5q5","text":"Persona je:","difficulty":"basic","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Vymyšlená postava která reprezentuje lidi jimž chceme pomoci"},{"key":"B","text":"Člen týmu který má nejlepší nápad"}],
     "correct":"A","explanation":"Persona pomáhá zaměřit se na konkrétního uživatele.","hint_level_1":"Pro koho příležitost řešíme?",
     "competence_weights":{"entrecomp_working_with_others":0.8,"entrecomp_spotting_opportunities":0.5}},
    {"id":"l5q6","text":"Co říká growth mindset o chybném nápadu?","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Špatný nápad = zbytečná práce"},{"key":"B","text":"Každý nápad přináší data a učení"}],
     "correct":"B","explanation":"I nepoužitelný nápad ukazuje hranice a inspiruje další pokusy.","hint_level_1":"Kdy ses naučil/a nejvíc?",
     "competence_weights":{"rvp_k_uceni":0.9,"entrecomp_learning_through_experience":0.7}},
    {"id":"l5q7","text":"Proč inovátor říká Vidím, že... místo Štve mě...?","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Aby byl zdvořilý"},{"key":"B","text":"Protože pozorování vede k řešení, stížnost ne"}],
     "correct":"B","explanation":"Pozorování je první krok k akci.","hint_level_1":"Co se stane potom, když řekneš Vidím, že...?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_reseni_problemu":0.7}},
    {"id":"l5q8","text":"Hlasování o příležitostech v týmu je:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Soutěž kdo má nejlepší nápad"},{"key":"B","text":"Výběr 5 témat pro společnou práci"}],
     "correct":"B","explanation":"Hlasování slouží týmu k zúžení mnoha nápadů.","hint_level_1":"Co s nápady děláme po hlasování?",
     "competence_weights":{"entrecomp_working_with_others":0.9,"entrecomp_valuing_ideas":0.6}},
    {"id":"l5q9","text":"Koruna Stromu příležitosti ukazuje:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Co nás štve"},{"key":"B","text":"Komu pomůžeme a jak se situace zlepší"}],
     "correct":"B","explanation":"Koruna ukazuje hodnotu, kterou strom přináší.","hint_level_1":"Co je nejvíc nahoře a co je vidět?",
     "competence_weights":{"entrecomp_vision":0.9,"entrecomp_valuing_ideas":0.6}},
    {"id":"l5q10","text":"Dobrá příležitost ke zlepšení musí být:","difficulty":"advanced","assessment_mode":"learning","question_type":"ab_decision",
     "options":[{"key":"A","text":"Co největší a nejsložitější"},{"key":"B","text":"Konkrétní, pozorovatelná a řešitelná"}],
     "correct":"B","explanation":"Velké a vágní příležitosti se nedají uchopit.","hint_level_1":"Co se snadněji řeší?",
     "competence_weights":{"entrecomp_spotting_opportunities":0.9,"rvp_reseni_problemu":0.6}}
  ]'::jsonb,
  '{"entrecomp_spotting_opportunities":0.9,"entrecomp_creativity":0.5,"rvp_podnikavost":0.7}'::jsonb,
  NULL,
  '{"xp_complete_bonus":150,"xp_correct_phrasing_bonus":25,"xp_growth_correction_bonus":30}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  assessment_mode=EXCLUDED.assessment_mode, questions=EXCLUDED.questions,
  competence_weights=EXCLUDED.competence_weights, config=EXCLUDED.config, is_public=EXCLUDED.is_public;

-- =============================================
-- 3) ACTIVITY 2 — Brainstorm: Moje příležitost (1× min 20 slov)
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
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  competence_weights=EXCLUDED.competence_weights, instructions=EXCLUDED.instructions,
  config=EXCLUDED.config, is_public=EXCLUDED.is_public;

-- =============================================
-- 4) ACTIVITY 3 — Hlasování o příležitostech (group of 4, 3-fázové)
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public,
  team_size, requires_grouping
) VALUES (
  'a5e50001-0000-4000-8001-000000000003',
  'Představení příležitostí a hlasování',
  'peer_review',
  'Žáci ve skupinách 4–5 postupně představí svůj nápad (1 min každý, na výzvu „Jsi připraven?"), pak anonymně hlasují pro 1–2 nejlepší. Vítězný = týmová příležitost.',
  'Žák představí svůj nápad pod tlakem času, ocení cizí formulace a zodpovědně se rozhodne ve skupině.',
  15,
  '[]'::jsonb,
  '{"entrecomp_valuing_ideas":0.9,"entrecomp_working_with_others":0.8,"entrecomp_mobilising_others":0.5,"rvp_podnikavost":0.5,"rvp_komunikacni":0.6}'::jsonb,
  'Pořadí prezentujících je náhodné. Když je řada na tobě, klikni „Jsem ready" a máš 1 minutu. Po skončení všech prezentací anonymně hlasuj pro max 2 nápady.',
  '{"anonymize":true,"votes_per_student":2,"select_top_n":1,
    "source_activity_id":"a5e50001-0000-4000-8001-000000000002",
    "per_speaker_ms":60000,
    "result":"Týmová příležitost (nápad s nejvíce hlasy)","xp_complete":50}'::jsonb,
  true,
  4,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  competence_weights=EXCLUDED.competence_weights, instructions=EXCLUDED.instructions,
  config=EXCLUDED.config, is_public=EXCLUDED.is_public,
  team_size=EXCLUDED.team_size, requires_grouping=EXCLUDED.requires_grouping;

-- =============================================
-- 5) ACTIVITY 4 — Volba role (NOVÉ, role_selection)
-- =============================================
-- competence_weights jsou vážený průměr — ovlivňují rozvoj kompetencí podle zvolené role.
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000004',
  'Volba role v týmu',
  'role_selection',
  'Každý žák si vybere 1 z 5 týmových rolí (Designér / Technik / Komunikátor / Inovátor / Manažer). Volba se uloží do students.team_role.',
  'Žák zreflektuje svou silnou stránku a vybere si roli, kterou chce v týmu zastávat.',
  5,
  '[]'::jsonb,
  '{"entrecomp_self_awareness":0.9,"entrecomp_working_with_others":0.6,"rvp_osobnostni_socialni":0.5}'::jsonb,
  'Vyber jednu z pěti rolí, která ti sedí nejvíc. Žádná není „lepší" — různé role tvoří silný tým.',
  '{"event_type":"role_select","xp_complete":50,
    "show_class_distribution":true,
    "roles":["designer","engineer","communicator","innovator","manager"]}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  competence_weights=EXCLUDED.competence_weights, instructions=EXCLUDED.instructions,
  config=EXCLUDED.config, is_public=EXCLUDED.is_public;

-- =============================================
-- 6) ACTIVITY 5 — Sestavení týmů (NOVÉ, team_assembly)
-- =============================================
-- 4 fáze: A) lídři = vlastníci vítězných příležitostí, B) ostatní si vybírají,
-- C) lídr potvrdí složení, D) učitel schválí ve vysledky panelu.
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000005',
  'Sestavení týmů',
  'team_assembly',
  'Vlastníci vítězných příležitostí jsou lídry. Ostatní žáci se přidají k tomu lídrovi/příležitosti, na které chtějí pracovat. Učitel finálně schválí složení.',
  'Žák se rozhodne, na které příležitosti chce pracovat, a sestaví funkční tým s rozmanitými rolemi.',
  15,
  '[]'::jsonb,
  '{"entrecomp_working_with_others":0.9,"entrecomp_mobilising_others":0.7,"entrecomp_self_awareness":0.5,"rvp_podnikavost":0.6}'::jsonb,
  'Lídr (vlastník vítězné příležitosti) vidí svou příležitost. Ostatní vyberou tým, ke kterému se chtějí přidat. Lídr potvrdí složení a učitel schválí.',
  '{"voting_activity_id":"a5e50001-0000-4000-8001-000000000003",
    "brainstorm_activity_id":"a5e50001-0000-4000-8001-000000000002",
    "min_unique_roles":3,
    "xp_complete":60}'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  competence_weights=EXCLUDED.competence_weights, instructions=EXCLUDED.instructions,
  config=EXCLUDED.config, is_public=EXCLUDED.is_public;

-- =============================================
-- 7) ACTIVITY 6 — Strom příležitosti (foto, beze změny — jen nové UUID-ko zachovat)
-- =============================================
INSERT INTO activities (
  id, title, type, description,
  learning_goal, default_duration_min,
  questions, competence_weights, instructions, config, is_public
) VALUES (
  'a5e50001-0000-4000-8001-000000000006',
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
  title=EXCLUDED.title, type=EXCLUDED.type, description=EXCLUDED.description,
  learning_goal=EXCLUDED.learning_goal, default_duration_min=EXCLUDED.default_duration_min,
  competence_weights=EXCLUDED.competence_weights, instructions=EXCLUDED.instructions,
  config=EXCLUDED.config, is_public=EXCLUDED.is_public;

-- (Smaž starou A4 = strom UUID z předchozího seedu, byl photo_upload — je nahrazen novou A6.)
DELETE FROM activities WHERE id = 'a5e50001-0000-4000-8001-000000000004' AND type = 'photo_upload';

-- =============================================
-- 8) LESSON_ACTIVITIES — propojení v pořadí 1-6 + závislosti
-- =============================================
-- requires_lesson_activity_ids: pole ID jiných lesson_activities (z této lekce),
-- které tato aktivita potřebuje. UI při skip cascade vypne i závislé.
--
-- Závislosti L5:
--   1. Kvíz                           → standalone
--   2. Brainstorm                     → standalone
--   3. Hlasování     → vyžaduje 2 (Brainstorm, zdroj nápadů)
--   4. Volba role                     → standalone
--   5. Sestavení týmů → vyžaduje 3 (Hlasování — vítěz = lídr) + 4 (role pro diversity)
--   6. Strom         → vyžaduje 5 (sestavený tým maluje strom)
-- =============================================
INSERT INTO lesson_activities (id, lesson_id, activity_id, order_index, is_optional, custom_duration_min, teacher_note, requires_lesson_activity_ids) VALUES
  ('a5e50002-0000-4000-9000-000000000001', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000001', 1, false, NULL,
   'Otevírací kvíz — naladění na rétoriku inovátora',
   '[]'::jsonb),
  ('a5e50002-0000-4000-9000-000000000002', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000002', 2, false, NULL,
   'Žáci pracují individuálně, AI dá feedback na formulaci',
   '[]'::jsonb),
  ('a5e50002-0000-4000-9000-000000000003', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000003', 3, false, NULL,
   'Sekvenční představení (1 min/žák, ready gate), pak anonymizované hlasování — vznikne týmová příležitost',
   '["a5e50002-0000-4000-9000-000000000002"]'::jsonb),
  ('a5e50002-0000-4000-9000-000000000004', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000004', 4, false, NULL,
   'Volba týmové role — ovlivní složení týmů v dalším kroku',
   '[]'::jsonb),
  ('a5e50002-0000-4000-9000-000000000005', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000005', 5, false, NULL,
   'Sestavení týmů kolem vítězných příležitostí, učitel schvaluje',
   '["a5e50002-0000-4000-9000-000000000003","a5e50002-0000-4000-9000-000000000004"]'::jsonb),
  ('a5e50002-0000-4000-9000-000000000006', 'a5e50001-0000-4000-8000-000000000005', 'a5e50001-0000-4000-8001-000000000006', 6, false, NULL,
   'Týmová práce — A3 plakát, foto, AI verifikace tří částí stromu',
   '["a5e50002-0000-4000-9000-000000000005"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  lesson_id                    = EXCLUDED.lesson_id,
  activity_id                  = EXCLUDED.activity_id,
  order_index                  = EXCLUDED.order_index,
  is_optional                  = EXCLUDED.is_optional,
  custom_duration_min          = EXCLUDED.custom_duration_min,
  teacher_note                 = EXCLUDED.teacher_note,
  requires_lesson_activity_ids = EXCLUDED.requires_lesson_activity_ids;

-- =============================================
-- XP odměny pro celou lekci L5 (~525 XP):
--   Kvíz (a1):        150 XP + 25/správně + 30/oprava
--   Brainstorm (a2):  100 XP
--   Hlasování (a3):    50 XP
--   Volba role (a4):   50 XP
--   Sestavení (a5):    60 XP
--   Strom foto (a6):  200 XP
-- =============================================
