-- Migration v10: EntreComp matrix + RVP kompetence popisy
-- Spusť v Supabase SQL editoru

-- 1. ENTRECOMP MATRIX - popisy úrovní pro každou kompetenci × vlákno
CREATE TABLE IF NOT EXISTS entrecomp_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,           -- 'ideas' | 'resources' | 'action'
  competence TEXT NOT NULL,     -- 'spotting_opportunities' etc.
  thread TEXT NOT NULL,         -- vlákno/aspekt kompetence
  thread_cz TEXT NOT NULL,      -- český název vlákna
  level_1 TEXT NOT NULL DEFAULT '',  -- Discover
  level_2 TEXT NOT NULL DEFAULT '',  -- Explore
  level_3 TEXT NOT NULL DEFAULT '',  -- Experiment
  level_4 TEXT NOT NULL DEFAULT '',  -- Dare
  level_5 TEXT NOT NULL DEFAULT '',  -- Improve
  level_6 TEXT NOT NULL DEFAULT '',  -- Reinforce
  level_7 TEXT NOT NULL DEFAULT '',  -- Expand
  level_8 TEXT NOT NULL DEFAULT '',  -- Transform
  UNIQUE(competence, thread)
);

ALTER TABLE entrecomp_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pilot" ON entrecomp_matrix FOR ALL USING (true) WITH CHECK (true);

-- 2. RVP KOMPETENCE - popisy úrovní
CREATE TABLE IF NOT EXISTS rvp_competences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competence TEXT NOT NULL,     -- 'k_uceni' etc.
  competence_cz TEXT NOT NULL,  -- 'K učení'
  area TEXT NOT NULL DEFAULT '',-- oblast kompetence
  area_cz TEXT NOT NULL DEFAULT '',
  level_1 TEXT NOT NULL DEFAULT '',  -- základní
  level_2 TEXT NOT NULL DEFAULT '',  -- rozvinutá
  level_3 TEXT NOT NULL DEFAULT '',  -- pokročilá
  UNIQUE(competence, area)
);

ALTER TABLE rvp_competences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for pilot" ON rvp_competences FOR ALL USING (true) WITH CHECK (true);

-- 3. SEED: EntreComp matrix - Ideas & Opportunities
INSERT INTO entrecomp_matrix (area, competence, thread, thread_cz, level_1, level_2, level_3, level_4) VALUES
-- Spotting Opportunities
('ideas', 'spotting_opportunities', 'identify_opportunities', 'Rozpoznání příležitostí',
  'Dokážu rozpoznat příležitosti k vytvoření hodnoty ve svém okolí',
  'Dokážu najít příležitosti k vytvoření hodnoty v různých kontextech',
  'Dokážu identifikovat a uchopit příležitosti k vytvoření hodnoty a reagovat na výzvy',
  'Dokážu aktivně hledat příležitosti a vytvářet hodnotu i v nepříznivých podmínkách'),
('ideas', 'spotting_opportunities', 'recognise_challenges', 'Rozpoznání výzev',
  'Dokážu rozpoznat výzvy, které je třeba řešit',
  'Dokážu rozpoznat výzvy ve svém okolí, které mohu řešit',
  'Dokážu proaktivně hledat výzvy a přeměnit je v příležitosti',
  'Dokážu předvídat výzvy a připravit se na ně předem'),

-- Creativity
('ideas', 'creativity', 'be_curious', 'Zvědavost',
  'Jsem zvědavý/á a otevřený/á novým zkušenostem',
  'Aktivně hledám nové zdroje inspirace',
  'Kombinuji znalosti a zdroje k vytváření nových nápadů',
  'Systematicky rozvíjím kreativní přístupy k řešení problémů'),
('ideas', 'creativity', 'develop_ideas', 'Rozvoj nápadů',
  'Dokážu vytvořit jednoduchý nápad',
  'Dokážu rozvíjet nápady ostatních i své vlastní',
  'Dokážu experimentovat s různými přístupy a testovat nápady',
  'Dokážu transformovat nápady do konkrétních řešení'),

-- Vision
('ideas', 'vision', 'imagine', 'Představivost',
  'Dokážu si představit jednoduchou budoucnost',
  'Dokážu si představit, jak by věci mohly být jinak',
  'Dokážu vytvořit vizi budoucnosti a sdílet ji s ostatními',
  'Dokážu inspirovat ostatní svou vizí a motivovat je k akci'),

-- Valuing Ideas
('ideas', 'valuing_ideas', 'recognise_value', 'Rozpoznání hodnoty',
  'Dokážu rozpoznat hodnotu jednoduchého nápadu',
  'Dokážu posoudit hodnotu nápadů z různých úhlů pohledu',
  'Dokážu vyhodnotit nápady podle jejich potenciálu a proveditelnosti',
  'Dokážu systematicky hodnotit a vybírat nejlepší nápady'),

-- Ethical Thinking
('ideas', 'ethical_thinking', 'behave_ethically', 'Etické jednání',
  'Rozumím základním pravidlům správného chování',
  'Dokážu posoudit důsledky svého jednání na ostatní',
  'Dokážu zvážit etické dopady svých rozhodnutí a nápadů',
  'Aktivně podporuji etické a udržitelné přístupy ve svém okolí');

-- SEED: Resources
INSERT INTO entrecomp_matrix (area, competence, thread, thread_cz, level_1, level_2, level_3, level_4) VALUES
('resources', 'self_awareness', 'follow_aspirations', 'Následování aspirací',
  'Dokážu rozpoznat své zájmy a silné stránky',
  'Dokážu pojmenovat své silné a slabé stránky',
  'Aktivně rozvíjím své silné stránky a pracuji na slabých',
  'Vědomě využívám své silné stránky k dosahování cílů'),
('resources', 'motivation', 'stay_driven', 'Vytrvalost',
  'Dokážu se pustit do nového úkolu',
  'Dokážu pokračovat i když je úkol těžký',
  'Dokážu překonat překážky a nevzdávat se',
  'Dokážu motivovat sebe i ostatní k vytrvalosti'),
('resources', 'mobilising_resources', 'manage_resources', 'Řízení zdrojů',
  'Dokážu identifikovat základní zdroje, které potřebuji',
  'Dokážu získat a organizovat potřebné zdroje',
  'Dokážu efektivně řídit různé typy zdrojů',
  'Dokážu optimalizovat využití zdrojů a hledat nové'),
('resources', 'financial_literacy', 'understand_finance', 'Porozumění financím',
  'Rozumím základním pojmům: cena, platba, spoření',
  'Dokážu plánovat jednoduché výdaje a příjmy',
  'Rozumím základům rozpočtování a investování',
  'Dokážu vytvořit finanční plán pro projekt'),
('resources', 'mobilising_others', 'inspire_others', 'Inspirace ostatních',
  'Dokážu požádat ostatní o pomoc',
  'Dokážu přesvědčit ostatní, aby se zapojili',
  'Dokážu motivovat tým a rozdělit úkoly',
  'Dokážu vést tým a inspirovat ho k dosažení cíle');

-- SEED: Into Action
INSERT INTO entrecomp_matrix (area, competence, thread, thread_cz, level_1, level_2, level_3, level_4) VALUES
('action', 'taking_initiative', 'take_up_challenges', 'Přijímání výzev',
  'Dokážu přijmout jednoduchou výzvu',
  'Dokážu se ujmout iniciativy v jednoduchých situacích',
  'Dokážu proaktivně vyhledávat a přijímat výzvy',
  'Dokážu vést ostatní při přijímání výzev'),
('action', 'planning', 'set_goals', 'Stanovení cílů',
  'Dokážu si stanovit jednoduchý cíl',
  'Dokážu naplánovat kroky k dosažení cíle',
  'Dokážu vytvořit detailní plán s milníky a termíny',
  'Dokážu přizpůsobit plán měnícím se podmínkám'),
('action', 'coping_with_uncertainty', 'deal_with_ambiguity', 'Zvládání nejistoty',
  'Dokážu zvládnout jednoduché nejisté situace',
  'Dokážu pracovat i když nemám všechny informace',
  'Dokážu přijmout riziko a učit se z neúspěchů',
  'Dokážu proměnit nejistotu v příležitost'),
('action', 'working_with_others', 'work_together', 'Spolupráce',
  'Dokážu spolupracovat v páru nebo malé skupině',
  'Dokážu aktivně přispívat k týmové práci',
  'Dokážu řešit konflikty a hledat kompromisy',
  'Dokážu vést různorodý tým k společnému cíli'),
('action', 'learning_through_experience', 'learn_by_doing', 'Učení praxí',
  'Dokážu se učit z vlastních zkušeností',
  'Dokážu reflektovat své zkušenosti a poučit se z nich',
  'Dokážu systematicky vyhodnocovat své učení',
  'Dokážu sdílet své zkušenosti a učit ostatní');

-- 4. SEED: RVP kompetence
INSERT INTO rvp_competences (competence, competence_cz, area, area_cz, level_1, level_2, level_3) VALUES
('k_uceni', 'K učení', 'uvedomele_uceni', 'Uvědomělé učení',
  'Žák se učí podle pokynů učitele',
  'Žák si volí vlastní strategie učení a plánuje své studium',
  'Žák reflektuje svůj pokrok a přizpůsobuje strategie učení'),
('komunikacni', 'Komunikační', 'vyjadrování', 'Vyjadřování',
  'Žák se vyjadřuje jednoduchými větami',
  'Žák formuluje své myšlenky jasně a srozumitelně',
  'Žák přizpůsobuje komunikaci publiku a kontextu'),
('komunikacni', 'Komunikační', 'naslouchani', 'Aktivní naslouchání',
  'Žák naslouchá základním instrukcím',
  'Žák aktivně naslouchá a klade doplňující otázky',
  'Žák analyzuje argumenty a reaguje konstruktivně'),
('osobnostni', 'Osobnostní a sociální', 'sebepoznani', 'Sebepojetí',
  'Žák rozpozná své základní pocity',
  'Žák pojmenuje své silné stránky a oblasti k rozvoji',
  'Žák vědomě rozvíjí svou osobnost a odolnost'),
('osobnostni', 'Osobnostní a sociální', 'empatie', 'Empatie',
  'Žák rozpozná emoce ostatních',
  'Žák projevuje empatii a respekt k odlišnostem',
  'Žák aktivně podporuje wellbeing skupiny'),
('k_reseni_problemu', 'K řešení problémů', 'kriticke_mysleni', 'Kritické myšlení',
  'Žák identifikuje jednoduchý problém',
  'Žák analyzuje problém z více úhlů pohledu',
  'Žák navrhuje a testuje kreativní řešení problémů'),
('k_podnikavosti', 'K podnikavosti', 'napady', 'Nápady a realizace',
  'Žák přichází s jednoduchými nápady',
  'Žák plánuje a realizuje jednoduché projekty v týmu',
  'Žák vede projektový tým a dotahuje nápady do konce'),
('digitalni', 'Digitální', 'digitalni_gramotnost', 'Digitální gramotnost',
  'Žák používá základní digitální nástroje',
  'Žák kriticky hodnotí informace z digitálních zdrojů',
  'Žák tvoří digitální obsah a řeší problémy pomocí technologií');
