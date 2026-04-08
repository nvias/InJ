-- =============================================
-- InJ (Cesta inovátora) - Supabase SQL Schema
-- Vlož tento SQL do Supabase SQL editoru
-- =============================================

-- 1. TABULKY

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id TEXT NOT NULL DEFAULT 'pilot-teacher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_code VARCHAR(8) NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT 'Anonym',
  avatar_color VARCHAR(7) NOT NULL DEFAULT '#00D4FF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'quiz',
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  competence_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'answer',
  answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. INDEXY

CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_code ON students(student_code);
CREATE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_sessions_class ON sessions(class_id);
CREATE INDEX idx_events_session ON student_events(session_id);
CREATE INDEX idx_events_student ON student_events(student_id);

-- 3. RLS (Row Level Security) - pro pilot vypnuto

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;

-- Povolíme vše pro anon key (pilot mode)
CREATE POLICY "Allow all for pilot" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pilot" ON student_events FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 4. SEED DATA - Kvíz: Prezentační dovednosti
-- =============================================

INSERT INTO activities (id, title, type, description, questions, competence_weights) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Prezentační dovednosti',
  'quiz',
  'Kvíz pro 6. třídu zaměřený na základy prezentování - struktura, oční kontakt, práce s nervozitou a zapojení publika.',
  '[
    {
      "id": "q1",
      "text": "Jak by měla správná prezentace začínat?",
      "difficulty": "basic",
      "options": [
        {"key": "A", "text": "Hned prvním snímkem s textem"},
        {"key": "B", "text": "Zajímavou otázkou nebo příběhem, který zaujme publikum"},
        {"key": "C", "text": "Omluvou, že jsem nervózní"},
        {"key": "D", "text": "Přečtením celého obsahu prezentace"}
      ],
      "correct": "B",
      "explanation": "Silný úvod (otázka, příběh, překvapivý fakt) okamžitě zaujme publikum a motivuje je poslouchat dál.",
      "hint_level_1": "Vzpomeň si - co tě zaujme, když někdo začne mluvit? Něco nudného, nebo něco, co tě překvapí?",
      "competence_weights": {"rvp_komunikacni": 0.8, "entrecomp_mobilising_others": 0.6}
    },
    {
      "id": "q2",
      "text": "Kam by ses měl/a dívat během prezentace?",
      "difficulty": "basic",
      "options": [
        {"key": "A", "text": "Na své poznámky po celou dobu"},
        {"key": "B", "text": "Na strop nebo okno"},
        {"key": "C", "text": "Střídavě na různé lidi v publiku"},
        {"key": "D", "text": "Pouze na učitele"}
      ],
      "correct": "C",
      "explanation": "Oční kontakt s různými lidmi v publiku vytváří pocit, že mluvíš ke každému osobně. Publikum se pak cítí zapojené.",
      "hint_level_1": "Představ si, že ti někdo vypráví příběh, ale vůbec se na tebe nedívá. Jak se cítíš? Co by bylo lepší?",
      "competence_weights": {"rvp_komunikacni": 0.9, "entrecomp_mobilising_others": 0.7}
    },
    {
      "id": "q3",
      "text": "Jaké je nejlepší tempo řeči při prezentaci?",
      "difficulty": "basic",
      "options": [
        {"key": "A", "text": "Co nejrychlejší, ať to mám rychle za sebou"},
        {"key": "B", "text": "Přiměřené tempo s pauzami na důležitých místech"},
        {"key": "C", "text": "Hodně pomalé, aby každý pochopil každé slovo"},
        {"key": "D", "text": "Na tempu vůbec nezáleží"}
      ],
      "correct": "B",
      "explanation": "Přiměřené tempo s pauzami pomáhá publiku zpracovat informace. Pauzy také zdůrazňují důležité body a dodávají ti čas na nadechnutí.",
      "hint_level_1": "Když posloucháš svého oblíbeného youtubera - mluví příliš rychle, příliš pomalu, nebo má příjemné tempo s přestávkami?",
      "competence_weights": {"rvp_komunikacni": 0.7, "entrecomp_mobilising_others": 0.5}
    },
    {
      "id": "q4",
      "text": "Co pomáhá nejvíc proti nervozitě před prezentací?",
      "difficulty": "basic",
      "options": [
        {"key": "A", "text": "Nemyslet na to a doufat, že to bude dobré"},
        {"key": "B", "text": "Dobře se připravit a prezentaci si několikrát nacvičit"},
        {"key": "C", "text": "Přečíst si celý text z papíru"},
        {"key": "D", "text": "Říct publiku, že to neumím"}
      ],
      "correct": "B",
      "explanation": "Nejlepší lék na nervozitu je příprava. Když svůj obsah znáš, cítíš se jistěji. Nervozita nikdy úplně nezmizí, ale příprava ji výrazně sníží.",
      "hint_level_1": "Vzpomeň si na test ve škole - kdy jsi měl/a menší strach? Když ses učil/a, nebo když jsi nečekal/a co přijde?",
      "competence_weights": {"rvp_komunikacni": 0.6, "entrecomp_mobilising_others": 0.4}
    },
    {
      "id": "q5",
      "text": "Jak by měla prezentace končit?",
      "difficulty": "basic",
      "options": [
        {"key": "A", "text": "Slovy: To je vše, děkuji... ehm... to je konec"},
        {"key": "B", "text": "Prostě přestat mluvit"},
        {"key": "C", "text": "Shrnutím hlavních bodů a silnou závěrečnou větou"},
        {"key": "D", "text": "Omluvou za chyby, které jsem udělal/a"}
      ],
      "correct": "C",
      "explanation": "Silný závěr zanechá dojem. Shrň hlavní myšlenky a zakonči výzvou, otázkou nebo inspirativní větou - to si lidé zapamatují nejlépe.",
      "hint_level_1": "U filmů si nejvíc pamatuješ začátek a konec. Co myslíš, platí to i u prezentací? Jaký závěr by byl nejsilnější?",
      "competence_weights": {"rvp_komunikacni": 0.8, "entrecomp_mobilising_others": 0.6}
    },
    {
      "id": "q6",
      "text": "Kolik textu by mělo být na jednom snímku prezentace?",
      "difficulty": "advanced",
      "options": [
        {"key": "A", "text": "Co nejvíc, aby si publikum mohlo vše přečíst"},
        {"key": "B", "text": "Jen pár klíčových slov nebo krátkých bodů"},
        {"key": "C", "text": "Celé věty, které budu předčítat"},
        {"key": "D", "text": "Žádný text, pouze obrázky"}
      ],
      "correct": "B",
      "explanation": "Snímky mají podporovat tvé slova, ne je nahrazovat. Pár klíčových slov + obrázek pomůže publiku sledovat, co říkáš, aniž by četli místo poslouchání.",
      "hint_level_1": "Představ si dva snímky: jeden plný textu a druhý s jedním obrázkem a třemi slovy. Který tě více zaujme?",
      "competence_weights": {"rvp_komunikacni": 0.7, "entrecomp_mobilising_others": 0.5}
    },
    {
      "id": "q7",
      "text": "Spolužák při prezentaci čte celý text z papíru a nedívá se na třídu. Co bys mu poradil/a?",
      "difficulty": "advanced",
      "options": [
        {"key": "A", "text": "Ať se naučí celý text nazpaměť slovo od slova"},
        {"key": "B", "text": "Ať si napíše jen klíčová slova a zkusí vyprávět vlastními slovy"},
        {"key": "C", "text": "Ať čte dál, hlavně že má vše správně"},
        {"key": "D", "text": "Ať papír úplně zahodí"}
      ],
      "correct": "B",
      "explanation": "Klíčová slova fungují jako záchytné body - pomáhají si vzpomenout, co chceš říct, ale nutí tě mluvit přirozeně vlastními slovy. To je mnohem poutavější než čtení.",
      "hint_level_1": "Když kamarádovi vyprávíš o filmu - čteš z papíru, nebo prostě vyprávíš? Co myslíš, co by pomohlo mluvit přirozeněji?",
      "competence_weights": {"rvp_komunikacni": 0.8, "entrecomp_mobilising_others": 0.7}
    },
    {
      "id": "q8",
      "text": "Jak můžeš zapojit publikum během své prezentace?",
      "difficulty": "advanced",
      "options": [
        {"key": "A", "text": "Mluvit hlasitěji, aby dávali pozor"},
        {"key": "B", "text": "Položit otázku, udělat anketu nebo požádat o zdvižení ruky"},
        {"key": "C", "text": "Říct jim, ať si dělají poznámky"},
        {"key": "D", "text": "Publikum zapojovat nemusím, stačí dobře mluvit"}
      ],
      "correct": "B",
      "explanation": "Interakce s publikem (otázky, ankety, zdvižení ruky) udržuje pozornost a zapojuje posluchače. Cítí se jako součást prezentace, ne jen pasivní diváci.",
      "hint_level_1": "Ve škole - kdy tě hodina baví víc? Když jen posloucháš, nebo když se můžeš zapojit a říct svůj názor?",
      "competence_weights": {"rvp_komunikacni": 0.7, "entrecomp_mobilising_others": 0.9}
    },
    {
      "id": "q9",
      "text": "Během prezentace ti spadne ukazovátko a všichni se smějí. Co uděláš?",
      "difficulty": "advanced",
      "options": [
        {"key": "A", "text": "Zčervenám a začnu se omlouvat"},
        {"key": "B", "text": "Budu to ignorovat a tvářit se, že se nic nestalo"},
        {"key": "C", "text": "Usměju se, zvednu ho a s humorem pokračuji dál"},
        {"key": "D", "text": "Přestanu prezentovat, je to příliš trapné"}
      ],
      "correct": "C",
      "explanation": "Každému se stane chybička. Humor a sebejistá reakce ukáže, že máš situaci pod kontrolou. Publikum tě za to bude obdivovat víc, než kdyby vše šlo hladce.",
      "hint_level_1": "Když se něco zvláštního stane ve videu tvého oblíbeného youtubera - líbí se ti víc, když to s humorem okomentuje, nebo když se tváří trapně?",
      "competence_weights": {"rvp_komunikacni": 0.6, "entrecomp_mobilising_others": 0.8}
    },
    {
      "id": "q10",
      "text": "Tvůj tým má prezentovat společný projekt. Jak si nejlépe rozdělíte role?",
      "difficulty": "advanced",
      "options": [
        {"key": "A", "text": "Nejlepší řečník odprezentuje vše sám"},
        {"key": "B", "text": "Každý prezentuje část, kterou zpracoval, a předem si nacvičí přechody mezi mluvčími"},
        {"key": "C", "text": "Rozdělíme se náhodně těsně před prezentací"},
        {"key": "D", "text": "Jeden mluví a ostatní stojí vedle"}
      ],
      "correct": "B",
      "explanation": "Když každý prezentuje svou část, ukáže to týmovou práci. Nacvičené přechody mezi mluvčími působí profesionálně a každý člen má šanci zazářit.",
      "hint_level_1": "V dobrém týmu hraje každý svou roli. Co myslíš, vypadá lépe, když mluví jeden za všechny, nebo když se všichni podílejí?",
      "competence_weights": {"rvp_komunikacni": 0.7, "entrecomp_mobilising_others": 0.9}
    }
  ]'::jsonb,
  '{"rvp_komunikacni": 0.75, "entrecomp_mobilising_others": 0.65}'::jsonb
);
