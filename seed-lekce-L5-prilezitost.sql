-- =============================================
-- InJ - Seed lekce L5: HLEDÁNÍ PŘÍLEŽITOSTI
-- Cesta inovátora, 6. třída, 2×45 min (90 min celkem)
-- =============================================
-- Žáci se učí vidět svět očima inovátora — místo stížností hledají
-- příležitosti ke zlepšení (rétorika "Vidím, že..." + Strom příležitosti).
--
-- Lekce má strukturu multi_activity: jedna activities row se 4 fázemi
-- uloženými v sub_activities JSONB (kvíz / brainstorm / hlasování / strom).
--
-- Render switch: src/app/lekce/[code]/page.tsx kontroluje activity.type:
--   - 'quiz'           -> klasická Kahoot UI (využije questions)
--   - 'team_forge'     -> <TeamForge>
--   - 'pitch_duel'     -> <PitchDuel>
--   - 'multi_activity' -> sekvenčně přepíná mezi sub_activities[]
-- =============================================

-- 1. SCHÉMOVÉ ROZŠÍŘENÍ (idempotentně) — meta pole pro lekci
ALTER TABLE activities ADD COLUMN IF NOT EXISTS learning_goal TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS default_duration_min INTEGER;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sub_activities JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. INSERT lekce L5
INSERT INTO activities (
  id,
  title,
  type,
  description,
  learning_goal,
  default_duration_min,
  questions,
  sub_activities,
  competence_weights
) VALUES (
  '7a1f9b3c-4e2d-4c5a-8f1b-0a2c3d4e5f60',
  'L5 — Hledání příležitosti',
  'multi_activity',
  'Žáci se naučí vidět svět očima inovátora — místo stížností hledají příležitosti ke zlepšení.',
  'Žák dokáže popsat příležitost pozitivní rétorikou (Vidím, že... místo Štve mě...) a sestavit Strom příležitosti.',
  90,
  '[]'::jsonb,
  '[
    {
      "order": 1,
      "id": "l5_a1_kviz",
      "title": "Kvíz: Inovátor vs. Stěžovatel",
      "type": "quiz",
      "duration_min": 15,
      "assessment_mode": "learning",
      "description": "10 AB rozhodnutí — která formulace je správná? Procvičení rétoriky inovátora.",
      "competence_weights": {"entrecomp_spotting_opportunities": 0.9, "entrecomp_creativity": 0.5, "rvp_podnikavost": 0.7},
      "xp_complete_bonus": 150,
      "xp_correct_phrasing_bonus": 25,
      "xp_growth_correction_bonus": 30,
      "questions": [
        {
          "id": "l5q1",
          "text": "Vyberte správnou formulaci inovátora:",
          "difficulty": "basic",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Štve mě, že v jídelně je vždy hluk."},
            {"key": "B", "text": "Vidím, že v jídelně je hluk — co by to zlepšilo?"}
          ],
          "correct": "B",
          "explanation": "Inovátor začíná pozorováním (Vidím, že...) a hned hledá zlepšení. Stížnost (Štve mě...) zůstává u problému.",
          "hint_level_1": "Která věta míří dopředu k řešení a která zůstává u problému?",
          "hint_level_2": "Všimni si slovesa: Štve mě = pocit / Vidím, že = pozorování + otázka co dál.",
          "competence_weights": {"entrecomp_spotting_opportunities": 0.9, "rvp_podnikavost": 0.6},
          "skip_interpretation": "Žák možná neumí oddělit pozorování od emoční reakce"
        },
        {
          "id": "l5q2",
          "text": "Jak inovátor popisuje situaci?",
          "difficulty": "basic",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Naši spolužáci nikdy neuklízí třídu."},
            {"key": "B", "text": "Všiml jsem si, že třída bývá neuklizená po přestávce."}
          ],
          "correct": "B",
          "explanation": "Slovo nikdy je generalizace, která uzavírá dveře k řešení. Pozorování (všiml jsem si) je konkrétní a otevřené.",
          "hint_level_1": "Která formulace popisuje fakt a která soudí lidi?",
          "hint_level_2": "Slovo nikdy + spolužáci = obvinění. Všiml jsem si + třída = pozorování.",
          "competence_weights": {"entrecomp_spotting_opportunities": 0.9, "rvp_komunikacni": 0.4},
          "skip_interpretation": "Žák možná nevidí rozdíl mezi pozorováním a obviněním"
        },
        {
          "id": "l5q3",
          "text": "Co inovátor vidí místo problému?",
          "difficulty": "basic",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Stížnost která nikomu nepomůže"},
            {"key": "B", "text": "Příležitost ke zlepšení"}
          ],
          "correct": "B",
          "explanation": "Inovátor reframuje problém jako příležitost — to je první krok k akci.",
          "hint_level_1": "Co dělá inovátor jinak než stěžovatel?",
          "hint_level_2": "Stěžovatel zůstává u problému, inovátor jde za něj k řešení.",
          "competence_weights": {"rvp_podnikavost": 0.8, "entrecomp_spotting_opportunities": 0.7},
          "skip_interpretation": "Žák ještě neumí přerámovat problém na příležitost"
        },
        {
          "id": "l5q4",
          "text": "Strom příležitosti má:",
          "difficulty": "basic",
          "assessment_mode": "learning",
          "question_type": "click",
          "options": [
            {"key": "A", "text": "Kořeny = příčiny / Kmen = příležitost / Koruna = co se zlepší"},
            {"key": "B", "text": "Kořeny = důsledky / Kmen = stížnost / Koruna = viníci"},
            {"key": "C", "text": "Kořeny = nápady / Kmen = problém / Koruna = výmluvy"},
            {"key": "D", "text": "Kořeny = lidé / Kmen = peníze / Koruna = sláva"}
          ],
          "correct": "A",
          "explanation": "Kořeny drží strom = příčiny situace. Kmen = formulovaná příležitost. Koruna = hodnota, kterou strom přináší (komu pomůžeme, co se zlepší).",
          "hint_level_1": "K čemu slouží kořeny v reálném stromu? A koruna?",
          "hint_level_2": "Kořeny = co je pod povrchem (proč). Koruna = co je vidět nahoře (výsledek).",
          "competence_weights": {"entrecomp_vision": 0.7, "rvp_podnikavost": 0.6},
          "skip_interpretation": "Žák nezná metaforu Strom příležitosti — je třeba ji zopakovat"
        },
        {
          "id": "l5q5",
          "text": "Persona je:",
          "difficulty": "basic",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Vymyšlená postava která reprezentuje lidi jimž chceme pomoci"},
            {"key": "B", "text": "Člen týmu který má nejlepší nápad"}
          ],
          "correct": "A",
          "explanation": "Persona pomáhá inovátorovi zaměřit se na konkrétního uživatele. Není to skutečná osoba, ale ztělesnění cílové skupiny.",
          "hint_level_1": "Pro koho vlastně příležitost řešíme?",
          "hint_level_2": "Persona má jméno, věk, problém — ale je vymyšlená.",
          "competence_weights": {"entrecomp_working_with_others": 0.8, "entrecomp_spotting_opportunities": 0.5},
          "skip_interpretation": "Žák neví co je persona — vysvětli na příkladu (Anička, 6. třída, ...)"
        },
        {
          "id": "l5q6",
          "text": "Co říká growth mindset o chybném nápadu?",
          "difficulty": "advanced",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Špatný nápad = zbytečná práce"},
            {"key": "B", "text": "Každý nápad přináší data a učení"}
          ],
          "correct": "B",
          "explanation": "I nepoužitelný nápad ukazuje hranice, dává nám zpětnou vazbu a inspiruje další pokusy. Žádný nápad není zbytečný.",
          "hint_level_1": "Vzpomeň si — kdy ses naučil nejvíc, když ti to šlo, nebo když to nešlo?",
          "hint_level_2": "Edison řekl: nezklamal jsem se 10 000krát, našel jsem 10 000 způsobů jak to nedělat.",
          "competence_weights": {"rvp_k_uceni": 0.9, "entrecomp_learning_through_experience": 0.7},
          "skip_interpretation": "Žák je ještě v fixed mindset — neumí ocenit chybu jako učení"
        },
        {
          "id": "l5q7",
          "text": "Proč inovátor říká Vidím, že... místo Štve mě...?",
          "difficulty": "advanced",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Aby byl zdvořilý"},
            {"key": "B", "text": "Protože pozorování vede k řešení, stížnost ne"}
          ],
          "correct": "B",
          "explanation": "Pozorování je první krok k akci. Stížnost zůstává u emoce a obvykle nikam nevede. Není to o zdvořilosti, ale o směru myšlení.",
          "hint_level_1": "Co se stane potom, když řekneš Vidím, že...? A co když řekneš Štve mě...?",
          "hint_level_2": "Po pozorování přirozeně přichází otázka co s tím. Po stížnosti obvykle žádná otázka nepřijde.",
          "competence_weights": {"entrecomp_spotting_opportunities": 0.9, "rvp_reseni_problemu": 0.7},
          "skip_interpretation": "Žák chápe rétoriku jen povrchně (zdvořilost) — nedochází mu funkční rozdíl"
        },
        {
          "id": "l5q8",
          "text": "Hlasování o příležitostech v týmu je:",
          "difficulty": "advanced",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Soutěž kdo má nejlepší nápad"},
            {"key": "B", "text": "Výběr 5 témat pro společnou práci"}
          ],
          "correct": "B",
          "explanation": "Hlasování není o vítězích a poražených — slouží týmu k zúžení mnoha nápadů na pár, na kterých se dá pracovat společně.",
          "hint_level_1": "Co s nápady děláme po hlasování — vyhazujeme je, nebo na nich pracujeme?",
          "hint_level_2": "Hlasování = nástroj rozhodnutí. Cílem je posun, ne vítěz.",
          "competence_weights": {"entrecomp_working_with_others": 0.9, "entrecomp_valuing_ideas": 0.6},
          "skip_interpretation": "Žák vnímá hlasování soutěživě — vysvětli kolaborativní účel"
        },
        {
          "id": "l5q9",
          "text": "Koruna Stromu příležitosti ukazuje:",
          "difficulty": "advanced",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Co nás štve"},
            {"key": "B", "text": "Komu pomůžeme a jak se situace zlepší"}
          ],
          "correct": "B",
          "explanation": "Koruna je nejvýše viditelná část — ukazuje hodnotu, kterou strom přináší světu (komu a jak pomůže).",
          "hint_level_1": "Vrať se k metafoře — kořeny / kmen / koruna. Co je nejvíc nahoře a co je vidět?",
          "hint_level_2": "Koruna = budoucnost po zlepšení. Co se změní, kdo bude rád?",
          "competence_weights": {"entrecomp_vision": 0.9, "entrecomp_valuing_ideas": 0.6},
          "skip_interpretation": "Žák si plete části stromu — zopakuj metaforu"
        },
        {
          "id": "l5q10",
          "text": "Dobrá příležitost ke zlepšení musí být:",
          "difficulty": "advanced",
          "assessment_mode": "learning",
          "question_type": "ab_decision",
          "options": [
            {"key": "A", "text": "Co největší a nejsložitější"},
            {"key": "B", "text": "Konkrétní, pozorovatelná a řešitelná"}
          ],
          "correct": "B",
          "explanation": "Velké a vágní příležitosti se nedají uchopit. Inovátor začíná konkrétně — to, co si můžu sám/sama všimnout a co můžu zkusit zlepšit.",
          "hint_level_1": "Co se snadněji řeší — Zachráním svět nebo Snížíme hluk v jídelně?",
          "hint_level_2": "Konkrétní = vidím to. Pozorovatelné = můžu to změřit. Řešitelné = můžu s tím něco udělat.",
          "competence_weights": {"entrecomp_spotting_opportunities": 0.9, "entrecomp_planning": 0.5, "rvp_reseni_problemu": 0.6},
          "skip_interpretation": "Žák ještě nezná kritéria dobré příležitosti (SMART-light pro děti)"
        }
      ]
    },
    {
      "order": 2,
      "id": "l5_a2_brainstorm",
      "title": "Brainstorm: Moje příležitosti",
      "type": "open",
      "duration_min": 20,
      "description": "Každý žák napíše 3 příležitosti formulací Vidím, že... — vlastní pozorování ze školy nebo okolí.",
      "instructions": "Napiš 3 věty které začínají Vidím, že.... Mají to být tvoje pozorování — věci, kterých sis všiml/a a které by se mohly zlepšit.",
      "min_items": 3,
      "max_items": 5,
      "event_type": "text_submit",
      "ai_feedback": true,
      "teacher_review": true,
      "ai_check_criteria": "Věty začínají pozorovací formulací (Vidím, že / Všiml jsem si / Pozoruji, že). Nejsou to stížnosti (Štve mě / Nesnáším). Jsou konkrétní a pozorovatelné.",
      "competence_weights": {"entrecomp_spotting_opportunities": 1.0, "rvp_podnikavost": 0.8, "rvp_komunikacni": 0.4},
      "skip_interpretation": "Žák má problém s přechodem od stížnosti k pozorování — potřebuje individuální podporu",
      "xp_complete": 100,
      "xp_correct_phrasing_bonus": 25
    },
    {
      "order": 3,
      "id": "l5_a3_hlasovani",
      "title": "Hlasování o příležitostech",
      "type": "peer_review",
      "duration_min": 10,
      "description": "Žáci vidí anonymizované příležitosti spolužáků a hlasují pro 3 které by chtěli společně řešit.",
      "peer_review_enabled": true,
      "anonymize": true,
      "votes_per_student": 3,
      "select_top_n": 5,
      "result": "5 nejhlasovanějších příležitostí pro tým",
      "source_activity_id": "l5_a2_brainstorm",
      "competence_weights": {"entrecomp_valuing_ideas": 0.9, "entrecomp_working_with_others": 0.8, "rvp_podnikavost": 0.5},
      "xp_complete": 50
    },
    {
      "order": 4,
      "id": "l5_a4_strom",
      "title": "Strom příležitosti",
      "type": "group_work",
      "duration_min": 45,
      "description": "Tým pracuje na papírovém A3 plakátu — kořeny (příčiny), kmen (příležitost), koruna (komu pomůžeme a jak). Na konci nafotí plakát a nahraje do aplikace.",
      "instructions": "1) Vyberte si jednu z 5 nejhlasovanějších příležitostí. 2) Na A3 papír namalujte strom. 3) Kořeny = proč situace existuje (3-5 příčin). 4) Kmen = formulace příležitosti (Vidím, že...). 5) Koruna = komu pomůžeme a jak se situace zlepší. 6) Vyfoťte a nahrajte.",
      "deliverable": {
        "type": "photo_upload",
        "min_photos": 1,
        "max_photos": 3,
        "required": true,
        "description": "Foto A3 plakátu Stromu příležitosti"
      },
      "ai_verification": {
        "enabled": true,
        "checks": ["má_koreny", "má_kmen_s_textem", "má_korunu", "obsahuje_pozorovaci_formulaci"],
        "prompt": "Zkontroluj, jestli foto obsahuje kresbu stromu se třemi částmi: kořeny (s textem příčin), kmen (s formulovanou příležitostí typu Vidím, že...) a korunu (s textem o tom komu pomůže). Vrať JSON {kořeny: bool, kmen: bool, koruna: bool, formulace: bool, poznámka: string}."
      },
      "teacher_review": true,
      "competence_weights": {"entrecomp_creativity": 0.8, "entrecomp_vision": 0.7, "rvp_podnikavost": 0.9, "entrecomp_working_with_others": 0.6, "rvp_kulturni": 0.3},
      "skip_interpretation": "Tým neodevzdal foto — možná konflikt v týmu nebo chybí podpora",
      "xp_complete": 200
    }
  ]'::jsonb,
  '{
    "entrecomp_spotting_opportunities": 0.9,
    "entrecomp_creativity": 0.7,
    "entrecomp_vision": 0.6,
    "rvp_podnikavost": 0.8,
    "rvp_reseni_problemu": 0.6
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  learning_goal = EXCLUDED.learning_goal,
  default_duration_min = EXCLUDED.default_duration_min,
  questions = EXCLUDED.questions,
  sub_activities = EXCLUDED.sub_activities,
  competence_weights = EXCLUDED.competence_weights;

-- =============================================
-- XP odměny pro L5 (souhrn pro orientaci učitele):
--   Kvíz dokončen:                +150 XP
--   Správná formulace v kvízu:    +25 XP bonus / otázku
--   Brainstorm 3 příležitosti:    +100 XP
--   Hlasování:                    +50 XP
--   Foto Stromu nahráno:          +200 XP
--   Growth mindset bonus (oprava formulace): +30 XP
--
-- Etalon pro 6. třídu: cíl Lv.1 Discover → Lv.2 Explore u
-- Spotting Opportunities a K podnikavosti.
-- =============================================
