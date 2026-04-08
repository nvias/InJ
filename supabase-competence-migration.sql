-- =============================================
-- InJ Competence Migration
-- Rozšířené schéma + SWOT/EntreComp seed data
-- Spusť v Supabase SQL editoru
-- =============================================

-- 1. ROZŠÍŘENÍ TABULKY STUDENTS
-- swot_profile, team_role, role_confidence, growth_mindset_score

ALTER TABLE students ADD COLUMN IF NOT EXISTS swot_profile JSONB NOT NULL DEFAULT '{
  "strengths": [],
  "weaknesses": [],
  "opportunities": [],
  "threats": []
}'::jsonb;

ALTER TABLE students ADD COLUMN IF NOT EXISTS team_role VARCHAR(20) DEFAULT NULL;
-- Hodnoty: 'leader', 'analyst', 'creative', 'mediator', 'executor'

ALTER TABLE students ADD COLUMN IF NOT EXISTS role_confidence FLOAT DEFAULT 0;
-- 0-1, jak jistá je detekce role

ALTER TABLE students ADD COLUMN IF NOT EXISTS growth_mindset_score FLOAT DEFAULT 0;
-- 0-1, odvozeno z poměru oprav chyb k celkovým pokusům

-- 2. SEED: Aktivita "Poznej sám sebe" - SWOT + EntreComp + logické chytáky
-- 13 otázek: 5 SWOT sebehodnocení, 5 EntreComp situační, 3 logické chytáky

INSERT INTO activities (id, title, type, description, questions, competence_weights) VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Poznej sám sebe',
  'quiz',
  'Kvíz pro sebepoznání - zjisti své silné stránky, jak přemýšlíš v týmu a jak řešíš problémy. Každá odpověď prozradí něco o tvém stylu!',
  '[
    {
      "id": "swot1",
      "text": "Třída plánuje projekt. Jaká je tvoje přirozená reakce?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Hned navrhuji plán a rozdělím úkoly"},
        {"key": "B", "text": "Přemýšlím, co by se mohlo pokazit a jak to řešit"},
        {"key": "C", "text": "Vymyslím 5 originálních nápadů"},
        {"key": "D", "text": "Počkám, co navrhnou ostatní, a pak pomohu najít shodu"}
      ],
      "correct": "A",
      "explanation": "Všechny přístupy jsou cenné! A = Vůdce, B = Analytik, C = Kreativec, D = Mediátor. Každý tým potřebuje všechny typy.",
      "hint_level_1": "Neexistuje špatná odpověď - vyber tu, která tě nejvíc vystihuje. Co děláš PŘIROZENĚ?",
      "competence_weights": {"rvp_k_podnikavosti": 0.8, "entrecomp_taking_initiative": 0.9},
      "swot_mapping": {"A": "strengths:leadership", "B": "strengths:analysis", "C": "strengths:creativity", "D": "strengths:empathy"},
      "skip_interpretation": "Žák si není jistý svou rolí v týmu - potřebuje více zkušeností se skupinovou prací"
    },
    {
      "id": "swot2",
      "text": "Když dostaneš těžký úkol, co uděláš NEJDŘÍV?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Hned se do toho pustím a uvidím"},
        {"key": "B", "text": "Rozmyslím si postup krok za krokem"},
        {"key": "C", "text": "Zeptám se kamaráda na radu"},
        {"key": "D", "text": "Hledám informace na internetu"}
      ],
      "correct": "B",
      "explanation": "Plánování je skvělá strategie! Ale každý přístup má svou hodnotu - důležité je, že se do toho vůbec pustíš.",
      "hint_level_1": "Přemýšlej co OBVYKLE děláš, ne co by bylo nejlepší. Jde o sebepoznání!",
      "competence_weights": {"rvp_k_uceni": 0.7, "entrecomp_planning": 0.8, "rvp_k_reseni_problemu": 0.6},
      "swot_mapping": {"A": "strengths:initiative", "B": "strengths:planning", "C": "strengths:collaboration", "D": "strengths:research"},
      "skip_interpretation": "Žák si není jistý svým přístupem k problémům"
    },
    {
      "id": "swot3",
      "text": "Co tě nejvíc motivuje ve škole?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Když se naučím něco nového a zajímavého"},
        {"key": "B", "text": "Když dostanu dobrou známku"},
        {"key": "C", "text": "Když mi něco jde líp než ostatním"},
        {"key": "D", "text": "Když můžu pomoct kamarádovi"}
      ],
      "correct": "A",
      "explanation": "Vnitřní motivace (učení se pro radost) je nejsilnější typ motivace. Ale všechny motivace jsou platné!",
      "hint_level_1": "Buď upřímný/á - co tě OPRAVDU pohání? Všechny odpovědi jsou v pořádku.",
      "competence_weights": {"rvp_k_uceni": 0.9, "entrecomp_motivation": 0.8, "entrecomp_self_awareness": 0.7},
      "swot_mapping": {"A": "strengths:curiosity", "B": "opportunities:external_motivation", "C": "threats:comparison", "D": "strengths:empathy"},
      "skip_interpretation": "Žák možná nemá jasno ve svých motivacích - téma pro reflexi"
    },
    {
      "id": "swot4",
      "text": "Spolužák prezentuje a udělá chybu. Jak reaguješ?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Tiše si to opravím v hlavě"},
        {"key": "B", "text": "Po prezentaci mu řeknu, kde byla chyba"},
        {"key": "C", "text": "Řeknu něco povzbudivého, chyba se může stát"},
        {"key": "D", "text": "Nevšimnu si, soustředím se na obsah"}
      ],
      "correct": "C",
      "explanation": "Povzbuzení po chybě = growth mindset v akci. Ale i zpětná vazba po prezentaci (B) je cenná, pokud je laskavá.",
      "hint_level_1": "Co by ti pomohlo, kdyby ses spletl/a ty? Co bys chtěl/a slyšet?",
      "competence_weights": {"rvp_osobnostni": 0.9, "entrecomp_working_with_others": 0.8, "rvp_komunikacni": 0.6},
      "swot_mapping": {"A": "strengths:attention", "B": "strengths:feedback", "C": "strengths:empathy", "D": "weaknesses:attention"},
      "skip_interpretation": "Žák se možná vyhýbá sociálním situacím"
    },
    {
      "id": "swot5",
      "text": "Co bys chtěl/a na sobě nejvíc zlepšit?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Umět lépe mluvit před lidmi"},
        {"key": "B", "text": "Být lepší v organizování času"},
        {"key": "C", "text": "Nebát se říct svůj názor"},
        {"key": "D", "text": "Lépe spolupracovat s ostatními"}
      ],
      "correct": "A",
      "explanation": "To, že víš co chceš zlepšit, je první krok! Sebeuvědomění je superschopnost.",
      "hint_level_1": "Všechny oblasti se dají rozvíjet. Co tě napadne jako první?",
      "competence_weights": {"entrecomp_self_awareness": 0.9, "rvp_osobnostni": 0.7},
      "swot_mapping": {"A": "weaknesses:public_speaking", "B": "weaknesses:time_management", "C": "weaknesses:assertiveness", "D": "weaknesses:collaboration"},
      "skip_interpretation": "Žák se možná bojí přiznat slabiny - téma pro bezpečné prostředí"
    },
    {
      "id": "ec1",
      "text": "Kamarád chce založit YouTube kanál o hrách. Řekne ti o tom. Co uděláš?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Navrhnu mu, jak by mohl začít a co potřebuje"},
        {"key": "B", "text": "Řeknu mu, že to je těžké a asi to nevyjde"},
        {"key": "C", "text": "Nabídnu, že mu pomůžu s editováním videí"},
        {"key": "D", "text": "Zeptám se, co přesně chce natáčet a pro koho"}
      ],
      "correct": "D",
      "explanation": "Klást otázky = nejlepší podpora nápadu. Pomůžeš kamarádovi promyslet projekt, místo abys ho buď zahltil radami nebo odradil.",
      "hint_level_1": "Co je nejužitečnější pro někoho, kdo má nový nápad? Rady? Kritika? Nebo dobré otázky?",
      "competence_weights": {"entrecomp_spotting_opportunities": 0.7, "entrecomp_valuing_ideas": 0.9, "rvp_komunikacni": 0.6},
      "skip_interpretation": "Žák si není jistý jak reagovat na nápady ostatních"
    },
    {
      "id": "ec2",
      "text": "Skupina 4 lidí má za 20 minut připravit prezentaci. Všichni mluví najednou. Co uděláš?",
      "difficulty": "advanced",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Řeknu: Pojďme si rozdělit role - kdo co udělá"},
        {"key": "B", "text": "Počkám, až se uklidní, a pak navrhnu řešení"},
        {"key": "C", "text": "Začnu sám/sama dělat prezentaci, ať se stihne"},
        {"key": "D", "text": "Navrhnu hlasování o nejlepším nápadu"}
      ],
      "correct": "A",
      "explanation": "Rozdělení rolí je nejefektivnější způsob. Za 20 minut nemůžete diskutovat - potřebujete akci s jasnou strukturou.",
      "hint_level_1": "Máte málo času a hodně lidí. Co pomůže nejvíc? Víc diskuse, nebo jasný plán?",
      "competence_weights": {"entrecomp_mobilising_others": 0.9, "entrecomp_planning": 0.7, "rvp_k_podnikavosti": 0.8},
      "skip_interpretation": "Žák se cítí nejistě v chaotických skupinových situacích"
    },
    {
      "id": "ec3",
      "text": "Máš skvělý nápad na školní projekt, ale nikdo tě neposlouchá. Co uděláš?",
      "difficulty": "advanced",
      "assessment_mode": "assessment",
      "options": [
        {"key": "A", "text": "Vzdám to - asi to nebyl tak dobrý nápad"},
        {"key": "B", "text": "Udělám si jednoduchý náčrt a ukážu ho třídě"},
        {"key": "C", "text": "Najdu jednoho spojence a přesvědčím ho/ji nejdřív"},
        {"key": "D", "text": "Řeknu to hlasitěji, aby mě slyšeli"}
      ],
      "correct": "C",
      "explanation": "Najít prvního spojence je nejchytřejší strategie. Jeden přesvědčený člověk ti pomůže přesvědčit ostatní. Vizualizace (B) je také skvělá!",
      "hint_level_1": "Jak se šíří dobré nápady? Křičením, nebo tím, že přesvědčíš jednoho člověka po druhém?",
      "competence_weights": {"entrecomp_mobilising_others": 0.9, "entrecomp_creativity": 0.5, "rvp_komunikacni": 0.7},
      "skip_interpretation": "Žák se možná bojí prosazovat své nápady"
    },
    {
      "id": "ec4",
      "text": "Dostal/a jsi za úkol něco, co jsi nikdy nedělal/a. Jak se cítíš?",
      "difficulty": "basic",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Nervózně - co když to nezvládnu?"},
        {"key": "B", "text": "Zvědavě - konečně něco nového!"},
        {"key": "C", "text": "Klidně - nějak to dopadne"},
        {"key": "D", "text": "Frustrovaně - proč zrovna já?"}
      ],
      "correct": "B",
      "explanation": "Zvědavost je superschopnost! Ale nervozita (A) je taky normální - znamená, že ti na tom záleží. Growth mindset = vidět výzvu místo hrozby.",
      "hint_level_1": "Neexistuje špatná odpověď na to, jak se cítíš. Co je ti nejblíž?",
      "competence_weights": {"entrecomp_coping_with_uncertainty": 0.9, "entrecomp_self_awareness": 0.8, "rvp_osobnostni": 0.7},
      "swot_mapping": {"A": "threats:anxiety", "B": "strengths:curiosity", "C": "strengths:resilience", "D": "threats:resistance_to_change"},
      "skip_interpretation": "Žák se nechce přiznat ke svým pocitům - potřebuje bezpečné prostředí"
    },
    {
      "id": "ec5",
      "text": "Tvůj tým prohrál soutěž. Co řekneš spolužákům?",
      "difficulty": "advanced",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Příště to dáme! Co můžeme udělat líp?"},
        {"key": "B", "text": "To nevadí, hlavně že jsme to zkusili"},
        {"key": "C", "text": "Vyhráli ti druzí, protože měli víc času"},
        {"key": "D", "text": "Raději nic neříkám, ať se nikdo necítí blbě"}
      ],
      "correct": "A",
      "explanation": "Konstruktivní pohled vpřed (A) je growth mindset v praxi. Ale i ocenění snahy (B) je důležité! Výmluvy (C) nás neposunou.",
      "hint_level_1": "Co by chtěl tvůj tým slyšet? Co by vám pomohlo příště?",
      "competence_weights": {"entrecomp_learning_through_experience": 0.9, "entrecomp_working_with_others": 0.7, "rvp_osobnostni": 0.6},
      "skip_interpretation": "Žák se možná vyhýbá zpracování neúspěchu"
    },
    {
      "id": "lt1",
      "text": "Učitel řekne: Kdo neumí matematiku, neumí myslet. Souhlasíš?",
      "difficulty": "advanced",
      "assessment_mode": "assessment",
      "options": [
        {"key": "A", "text": "Ano, matematika je základ všeho"},
        {"key": "B", "text": "Ne, myslet se dá i bez matematiky - třeba umělci"},
        {"key": "C", "text": "Částečně - matematika pomáhá, ale není jediný způsob"},
        {"key": "D", "text": "Nevím, nikdy jsem o tom nepřemýšlel/a"}
      ],
      "correct": "C",
      "explanation": "Kritické myšlení = nesouhlasit automaticky ANI automaticky souhlasit. Nejlepší odpověď uznává hodnotu matematiky, ale zároveň vidí širší obraz.",
      "hint_level_1": "Když někdo řekne něco absolutního (VŽDY, NIKDY, VŠICHNI) - je to obvykle pravda?",
      "competence_weights": {"rvp_k_reseni_problemu": 0.9, "entrecomp_ethical_thinking": 0.7, "entrecomp_creativity": 0.5},
      "skip_interpretation": "Žák se možná bojí nesouhlasit s autoritou"
    },
    {
      "id": "lt2",
      "text": "V obchodě je sleva 50% + dalších 20% navíc. Kolik celkem ušetříš?",
      "difficulty": "advanced",
      "assessment_mode": "assessment",
      "options": [
        {"key": "A", "text": "70% - to se prostě sečte"},
        {"key": "B", "text": "60% - druhá sleva se počítá ze snížené ceny"},
        {"key": "C", "text": "50% - ta druhá sleva je jen reklamní trik"},
        {"key": "D", "text": "Záleží na původní ceně"}
      ],
      "correct": "B",
      "explanation": "50% z 100 Kč = 50 Kč. Pak 20% z 50 Kč = 10 Kč. Celkem ušetříš 60 Kč = 60%. Pozor na sčítání procent - to je častý trik!",
      "hint_level_1": "Zkus si to představit na příkladu: věc stojí 100 Kč. Nejdřív sleva 50%... a pak?",
      "competence_weights": {"rvp_k_reseni_problemu": 0.8, "entrecomp_financial_literacy": 0.9, "rvp_k_uceni": 0.5},
      "skip_interpretation": "Žák se možná bojí matematických úloh"
    },
    {
      "id": "lt3",
      "text": "Všichni tví kamarádi říkají, že nový film je skvělý. Ty jsi ho viděl/a a nelíbil se ti. Co řekneš?",
      "difficulty": "advanced",
      "assessment_mode": "learning",
      "options": [
        {"key": "A", "text": "Řeknu, že se mi líbil, ať nezkazím atmosféru"},
        {"key": "B", "text": "Řeknu svůj názor a vysvětlím proč"},
        {"key": "C", "text": "Řeknu, že byl OK, nic extra"},
        {"key": "D", "text": "Změním téma, nechci se hádat"}
      ],
      "correct": "B",
      "explanation": "Říct svůj názor s vysvětlením = asertivita. Nemusíš souhlasit s davem, ale pomáhá říct PROČ. Kompromis (C) je taky OK, ale přiznání pravdy je nejsilnější.",
      "hint_level_1": "Co se stane, když vždy říkáš to, co chtějí ostatní slyšet? A co když řekneš pravdu s respektem?",
      "competence_weights": {"rvp_komunikacni": 0.8, "entrecomp_ethical_thinking": 0.7, "rvp_osobnostni": 0.6},
      "swot_mapping": {"A": "weaknesses:assertiveness", "B": "strengths:assertiveness", "C": "opportunities:diplomacy", "D": "threats:conflict_avoidance"},
      "skip_interpretation": "Žák se možná bojí vyjádřit odlišný názor"
    }
  ]'::jsonb,
  '{"rvp_osobnostni": 0.7, "rvp_komunikacni": 0.6, "rvp_k_reseni_problemu": 0.5, "entrecomp_self_awareness": 0.8, "entrecomp_working_with_others": 0.6}'::jsonb
);

-- 3. TESTOVACÍ TŘÍDA s 5 žáky
INSERT INTO classes (id, name) VALUES
  ('test-class-0001-0001-000000000001', 'Testovací 6.A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (class_id, student_code, display_name, avatar_emoji, avatar_color) VALUES
  ('test-class-0001-0001-000000000001', 'TEST0001', 'Anna', '🦊', '#FF6B6B'),
  ('test-class-0001-0001-000000000001', 'TEST0002', 'Bořek', '🐯', '#4ECDC4'),
  ('test-class-0001-0001-000000000001', 'TEST0003', 'Cecílie', '🦁', '#45B7D1'),
  ('test-class-0001-0001-000000000001', 'TEST0004', 'David', '🐸', '#96CEB4'),
  ('test-class-0001-0001-000000000001', 'TEST0005', 'Ema', '🦅', '#DDA0DD')
ON CONFLICT (student_code) DO NOTHING;
