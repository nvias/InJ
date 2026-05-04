# InJ - Inovátorova Journey (Playwise platforma)
Vzdělávací platforma pro rozvoj a měření kompetencí žáků.
Tagline: "Hraj si chytře" / "Think better, live better"

## Kontext a strategie
- Fáze 1 (teď): Cesta inovátora (15 lekcí, fyzický program nvias) = první pilot InJ
- Fáze 2: Playwise MVP - platforma s prvními 3 misemi, gamifikace, dashboard
- Fáze 3: Flutter/Unity mobilní app, B2B prodej školám
- Cesta inovátora je první "mise" v budoucí Playwise platformě

## Cílová skupina
- Žáci 6. třídy ZŠ (13 let)
- Učitelé (netechnické prostředí, potřebují jednoduchost)
- B2B: školy, B2C: rodiče

---

## CORE FILOZOFIE - Unikátnost každého žáka
Platforma NIKDY nehodnotí žáka jako celkově dobrého nebo špatného.
Cílem je najít a pojmenovat v čem je každý žák unikátně dobrý.
Každý žák může být "nejlepší" v jiné kategorii.

## Growth Mindset jako designový princip (Carol Dweck)
Každý prvek UI musí podporovat growth mindset.
NIKDY neříkáme: "Špatně", "Chyba", "Nevíš", "Nesprávně"
VŽDY říkáme: "Zkus to jinak", "Zajímavý přístup, co kdybys...", "Blížíš se!", "Mozek právě roste!"

### Growth mindset zprávy po chybě (náhodně vybírat):
- "Mozek roste nejvíc když se něco nedaří 🧠"
- "Zkus to jinak! Blížíš se!"
- "Tohle je přesně ten moment kdy se učíš nejvíc"
- "Blížíš se! Ještě jeden pokus?"
- "Každý expert byl jednou začátečník"
- "Další bude lepší!"
- "Hlavu vzhůru, to dáš!"

### Growth mindset zprávy po opravě (chyba → správně):
- "TOHLE je growth mindset v akci! 🚀"
- "Mozek se právě posílil! +100 XP"
- "Takhle se učí ti nejúspěšnější lidé"
- "Nevzdal/a jsi to = superpower 💪"
- "Skvělá oprava! Tak se to dělá!"
- "Super comeback! Oprava = síla!"

### Growth mindset zprávy po správné odpovědi:
- "Výborně! Jistá odpověď"
- "Paráda! Máš to!"
- "Super práce! Tak držet!"
- "Jedničkář/ka! Bezchybně!"

---

## Kompetencní frameworky (KLÍČOVÉ)
Primární: RVP ZV + EntreComp

### RVP ZV - 8 klíčových kompetencí:
- K učení (uvědomělé učení, smysluplné učení)
- Komunikační (porozumění, vyjadřování, aktivní naslouchání, vícejazyčnost)
- Osobnostní a sociální (sebepojetí, empatie, vztahy, odolnost, wellbeing)
- K občanství a udržitelnosti
- K řešení problémů (badatelské dovednosti, kritické myšlení)
- K podnikavosti (nápady, zdroje, týmová práce, realizace)
- Digitální
- Kulturní

### EntreComp - 3 oblasti, 15 kompetencí, 8 úrovní (1=Discover → 8=Transform):
Žáci 6. třídy = úrovně 1-3

OBLAST 1: IDEAS & OPPORTUNITIES (barva: #7C3AED fialová)
- Spotting Opportunities, Creativity, Vision, Valuing Ideas, Ethical & Sustainable Thinking

OBLAST 2: RESOURCES (barva: #0F6E56 zelená)
- Self-Awareness & Self-Efficacy, Motivation & Perseverance, Mobilising Resources, Financial & Economic Literacy, Mobilising Others

OBLAST 3: INTO ACTION (barva: #1A3BE8 modrá)
- Taking the Initiative, Planning & Management, Coping with Uncertainty, Working with Others, Learning Through Experience

### Vizualizace - 3 úrovně drill-down:
- Úroveň 1: Donut chart 3 oblastí s průměrným skóre → klik na oblast
- Úroveň 2: 5 kompetencí oblasti s progress bary a úrovněmi → klik na kompetenci
- Úroveň 3: Detail kompetence - aktuální úroveň (1-8), 8-stupňový progress, evidence

### 8 úrovní EntreComp (4 skupiny):
FOUNDATION: 1=Discover (0 XP), 2=Explore (150 XP)
INTERMEDIATE: 3=Experiment (400 XP), 4=Dare (800 XP)
ADVANCED: 5=Improve (1400 XP), 6=Reinforce (2200 XP)
EXPERT: 7=Expand (3200 XP), 8=Transform (4500 XP)

### Competence XP scoring:
- Kvíz správně napoprvé: +10 XP × weight do kompetence
- Chyba → oprava: +15 XP × weight (growth mindset bonus)
- Špatně: +3 XP × weight (za pokus)
- Open odpověď: +20 XP, AB s vysvětlením: +25 XP
- Po jednom kvízu max ~150 XP do jedné kompetence

### Etalon pro InJ (6.-9. třída):
- 6. třída: Lv.1 Discover (výchozí)
- 7. třída: Lv.2 Explore
- 8. třída: Lv.2-3
- 9. třída: Lv.3-4 Dare (cíl)
- Výjimeční: Lv.5-6

### Etalon indikátory v učitelském dashboardu:
- ✅ Na úrovni (±1 od etalonu)
- ⭐ Nad etalonem (+2 a více)
- ⚠️ Pod etalonem (-2 a více)

---

## Datový model - filozofie
VŠE je event log. Sbíráme chování, ne jen odpovědi.

### Tabulka student_events (univerzální):
- id, student_id, session_id, question_id
- event_type: 'answer' | 'join' | 'skip' | 'timeout' | 'text_submit' | 'photo_upload' | 'decision' | 'peer_rating'
- answer, is_correct, attempt_no, duration_ms
- created_at

### Behaviorální signály (duration_ms + attempt_no + is_correct):
- Rychlá správná = jistota → typ: Vůdce/Iniciátor
- Rychlá špatná + oprava = učení v akci → typ: growth mindset
- Pomalá správná = hluboké přemýšlení → typ: Analytik
- Špatná bez opravy = potřebuje podporu
- Skip = behaviorální indikátor (ne penalizace)

---

## Scoring systém — DUAL-SKILL filozofie

XP body jsou **vždy stejné** — rozdíl mezi „správně napoprvé" a „chyba → oprava" se NEprojevuje v bodech, ale ve **dvou nezávislých skill counterech**:

| Outcome                     | XP   | Skill counter             | Zpráva žákovi                              |
|-----------------------------|------|---------------------------|--------------------------------------------|
| Správně napoprvé            | 100  | `skill_presnost +1`       | „💎 Přesná odpověď! Skill Přesnost +1"     |
| Chyba → oprava → správně    | 100  | `skill_prace_s_chybou +1` | „🔄 Skvělá oprava! Skill Práce s chybou +1" |
| Špatně bez opravy           | 30   | (žádný)                   | „Příště to zkus znovu 💪"                  |
| Skip                        | 0    | (žádný)                   | „Přeskočeno, vrátíme se k tomu"            |
| Timeout                     | 0    | (žádný)                   | „Čas vypršel!"                             |

Konstanty v `src/types/index.ts`: `XP_CORRECT_FIRST_TRY`, `XP_CORRECTED`, `XP_WRONG`. Helper `classifyOutcome()` + `computeSkillCounters()` (agregát z `student_events`).

**Mapování skill → kompetence** (v `SKILL_TO_COMPETENCE`):
- `presnost` → `rvp_reseni_problemu`
- `prace_s_chybou` → `entrecomp_learning_through_experience`

Oba skilly jsou **pozitivní indikátory různých kompetencí**. V učitelském dashboardu se zobrazují vedle sebe: `[💎 Přesnost: 12] [🔄 Práce s chybou: 8]`.

### Režim kvízu (`sessions.activity_mode`)
Toggle při spouštění session: **🎓 Procvičování** (learning) vs **📊 Test** (assessment). Mixed režim je k dispozici jen pro single-activity session.

#### LEARNING (procvičování)
- Sokratovské hinty zachovány, okamžitá zpětná vazba
- Po odpovědi: skill zpráva + XP popup + per-question vysvětlení
- Učitelský dashboard: live výsledky (Kahoot bary, per-žák správnost, dual-skill countery)

#### ASSESSMENT (test)
- **Žádné** hinty, **žádné** opravy během testu
- Po odpovědi: jen „Odpověď uložena ✓" — bez hodnocení, bez XP popup, bez vysvětlení
- Žák **nevidí** XP počítadlo během testu
- **Učitel vidí jen completion count** („12/25 dokončilo"), žádnou správnost, žádný leaderboard
- Po dokončení (auto / manuálně) → výsledky se zpřístupní (správnost otázek, dual-skill countery, XP)

---

## Socratic feedback (KLÍČOVÉ - jen v learning mode)
NIKDY přímá odpověď napoprvé.
- hint_level_1: návodná otázka ("Přečti si znovu zadání...")
- hint_level_2: konkrétnější nápověda
- hint_level_3: správná odpověď + vysvětlení + growth mindset zpráva
feedback_type: 'socratic' | 'direct' | 'ai_generated'

### Skip jako behaviorální indikátor (ne penalizace):
- Skip se NEPENALIZUJE bodově ale ukládá do student_events
- Žákovi: "Přeskočeno, vrátíme se k tomu"
- Učiteli: "Žák potřebuje podporu v oblasti X" (skip_interpretation z otázky)

---

## Práce s chybou - kompletní systém

### GrowthFeedback komponenta:
- Animovaná zpráva po každé odpovědi (3s result → waiting screen)
- Různé sady zpráv: correct / corrected / wrong / skip / timeout
- Při opravě chyby: speciální animace (raketa/mozek) + "TOHLE je growth mindset!"
- Na waiting screenu: jedna hláška per otázku z příslušné sady

---

## Žebříčky - dvouvrstvý systém

### Vrstva 1 - Rychlá motivace (Kahoot-style, 30 sekund):
- Klasický leaderboard podle XP v této lekci
- Postupné odhalení: 3. → 2. → 1. místo (automatická sekvence)
- Cena za práci s chybou (top opraváři)
- Účel: okamžitá odměna, dopamin

### Vrstva 2 - Hloubkový osobní pohled (po leaderboardu):
- Kompetence třídy (RVP + EntreComp progress bary)
- Přepínatelné záložky: Pořadí | Práce s chybou | Kompetence
- "Tvoje silné stránky v této lekci"
- Srovnání s minulou lekcí

### Speciální žebříčky (kategorické, nikdy globální):
- 🧠 "Největší growth mindset" - nejvíc oprav chyb
- ⚡ "Nejrychlejší správné odpovědi"
- 🎯 "Nejpřesnější" - nejvyšší % správně
- 🤔 "Nejhlubší přemýšlení" - správně ale pomalu
- 🚀 "Největší posun od minulé lekce"
- Každý žák se MUSÍ objevit aspoň na jednom žebříčku

---

## Profil žáka - Multi-dimenzionální pohled (/zak/profil)

### 5 přepínatelných záložek:
1. **"Já"** - avatar, jméno, celkové XP, SWOT jako 4 barevné kvadranty
2. **"Dovednosti"** - radar chart EntreComp (5 os: Ideas, Resources, Action, Communication, Ethics)
3. **"Tým"** - detekovaná role s popisem a ikonou
4. **"Růst"** - timeline kompetencí + growth mindset score jako "síla mozku"
5. **"RVP"** - 8 klíčových kompetencí pro školu

### Role v týmu - detekce z chování (event logu):
- Kdo odpovídá první = Vůdce/Iniciátor (leader)
- Kdo opravuje chyby = Analytik (analyst)
- Kdo vymýšlí alternativy = Kreativec (creative)
- Kdo čeká na konsensus = Mediátor (mediator)
- Kdo dokončuje nejspolehlivěji = Realizátor (executor)

---

## Učitelský dashboard - Hvězdy třídy
- Každá kompetence má svého lídra
- Každý žák se musí objevit aspoň jednou
- Zobrazení na dashboardu po lekci

---

## Typy aktivit
1. Kvíz (kahoot-style) - otázky s časovačem, okamžitá zpětná vazba
2. Reflexe (otevřená odpověď) - text, sledujeme délku a revize
3. Skupinová práce - role, peer hodnocení
4. Foto upload - důkaz fyzické aktivity, AI verifikace
5. Video/audio - nahrávka prezentace, AI analýza projevu
6. Rozhodnutí v simulaci - volba v příběhu, odráží hodnoty

## Typy otázek (question_type)
- click: klasický výběr z A/B/C/D možností
- ab_decision: dvě karty (A/B) s fialovým pozadím, diamant ikony
- ab_with_explanation: AB + žák napíše proč si vybral (text se uloží pro AI/učitele)
- scale: škálové hodnocení (1-5, souhlas/nesouhlas)
- open: otevřená textová odpověď
- logic_trap: logický chyták (testuje kritické myšlení)
- pattern: hledání vzoru/souvislosti
- peer_review: žák napíše → AI anonymizuje → žáci hodnotí navzájem

### AB Decision vizuál:
- Fialové pozadí karet (#6B21A8)
- Diamant ikona před A a B
- Správná: zelené ohraničení + zelený diamant
- Špatná: červené ohraničení + červený diamant
- Responsive: na mobilu pod sebou, na desktopu vedle sebe

### Peer Review (budoucí fáze):
- Fáze 1: Žák napíše odpověď
- Fáze 2: AI anonymizuje
- Fáze 3: Hodnocení 2-3 spolužáků (👍/🤔/👎)
- Fáze 4: Žák vidí hodnocení své odpovědi

### Obrázky v otázkách:
- QuestionOption.image_url (volitelné)
- Supabase Storage bucket 'question-images'

### Nástroj pro tvorbu otázek: /ucitel/otazky/nova
- Výběr typu, obtížnosti, režimu
- Obsah: text + možnosti (4 pro click, 2 pro AB)
- Kompetence mapping: checkboxy RVP + EntreComp
- Feedback: explanation, hint_level_1-3, skip_interpretation

---

## AI hodnocení - human-in-the-loop pipeline
Žák odevzdá → AI analýza → Učitel review → Žák zpětná vazba
Kvízy = automaticky. Citlivá hodnocení = vždy přes učitele.

## Přihlášení - Progressive Authentication
- Žák: 8místný osobní KÓD → profil → aktivní lekce auto-detekce
- Záložní: 6místný kód lekce pro pozdě příchozí
- **QR kartičky**: žák naskenuje vytištěnou kartičku → URL `/?code=ZAK00001` → auto-přihlášení
- Učitel: /ucitel s heslem (pilot: "inj2025")
- Budoucnost: Google SSO + Microsoft Azure AD

## QR kartičky pro tisk
- Stránka: `/ucitel/trida/[id]/karticky` (nový tab přes tlačítko „🎴 Tisk QR kartiček")
- Layout: 8 kartiček na A4 (2×4 grid), bílé pozadí, černý text, čárkované okraje pro vystřižení
- Obsah kartičky: jméno žáka (nebo prázdná linka), QR kód (140px), avatar emoji + 8místný kód, branding nvias
- QR kóduje plnou URL `<origin>/?code=<student_code>` → po naskenování telefonem hned přihlášení
- Print CSS: `@media print` skryje toolbar, ponechá jen `#qr-cards`, `@page A4 margin 0`
- Knihovna: `qrcode.react` (QRCodeSVG), level M

## Editace profilu žáka
- **Učitel**: `/ucitel/trida/[id]` — klikni na řádek žáka → modal s polem jméno + grid 4×5 emoji → uložit
- **Žák**: při prvním přihlášení (display_name = „Anonym" nebo „Žák ...") se zobrazí onboarding modal s povinným jménem (min. 2 znaky) + výběrem avataru
- Sdílená paleta: `src/lib/avatars.ts` — 20 emoji, 4×5 grid (zvířata, symboly, energie, sport)
- DB: `students.display_name`, `students.avatar_emoji`, `students.avatar_color` (migration `supabase-students-update.sql` jako idempotentní guard)

## Peer feedback
- Skupinový výstup: 40%, Individuální: 40%, Peer hodnocení: 20%

---

## Session lifecycle
- active: učitel je přítomen, žáci hrají
- paused: učitel odešel (heartbeat > 15s), žáci redirectnuti na profil
- closed: kvíz dokončen, finále sekvence
- Teacher heartbeat každých 5s
- Jen jedna active session per třída

---

## Vizuální styl (Playwise)
- Pozadí: #0A0F2E (tmavě modrá)
- Primární: #1A3BE8 (modrá)
- Akcent: #00D4FF (cyan)
- Text: #FFFFFF
- Inspirace: Fortnite, Arcane, Pixar, Castle Clash (2.5D styl)
- Mobile-first (žáci na mobilu)
- Gamifikace: XP animace, progress bar, okamžitá zpětná vazba, leaderboard

## Dvouúrovňová struktura: Lekce → Aktivity

Od migrace v12 jsou **lekce** a **aktivity** dvě oddělené entity propojené přes junction tabulku.

### Datový model
- **`lessons`** — kontejner: `title`, `description`, `lesson_number`, `phase`, `learning_goal`, `total_duration_min`, `is_published`, `created_by`
- **`activities`** — atomická jednotka: `title`, `type` (`quiz`/`open`/`peer_review`/`photo_upload`/`group_work`/`team_forge`/`pitch_duel`/...), `default_duration_min`, `assessment_mode`, `competence_weights`, `instructions`, `config` JSONB (typ-specifická konfigurace), `is_public`. Quiz drží otázky v `questions` JSONB; ostatní typy konfiguraci v `config`.
- **`lesson_activities`** — junction: `lesson_id`, `activity_id`, `order_index` (1..N), `is_optional`, `custom_duration_min`, `teacher_note`. Unikátní `(lesson_id, order_index)`.
- **`sessions`** — rozšířeno o: `lesson_id` (NULL = single-activity flow), `current_activity_index`, `completed_activity_ids` (JSONB array). `activity_id` zůstává (pro zpětnou kompat ukazuje na první aktivitu lekce).

### Routing (učitel)
- `/ucitel/lekce` — knihovna lekcí (list)
- `/ucitel/lekce/[id]` — editor lekce s drag & drop pořadí (`@dnd-kit/sortable`) + šipky ↑↓ jako mobilní fallback
- `/ucitel/lekce/nova` — vytvoří prázdnou lekci a přesměruje do editoru
- `/ucitel/aktivity` — knihovna aktivit s filtry (typ, délka, fulltext)
- `/ucitel/aktivita/[id]` — detail/editor jedné aktivity
- `/ucitel/session/[id]` — běžící session (QR kód)
- `/ucitel/session/[id]/vysledky` — živé výsledky session
- `/ucitel/session/[id]/prezentace` — projektor view
- `/ucitel/session/nova` — spuštění session (toggle: lekce / aktivita)

### Žákovský flow `/lekce/[code]` (lockstep s učitelem)
Lekce běží **postupně pod vedením učitele** — žádný self-paced režim. Server-side stav je zdrojem pravdy:

- `sessions.lesson_id` ≠ NULL → flow řízený `current_activity_index` + `current_question`
  - Žák čte session přes polling (3 s interval) a sleduje **`current_activity_index`**: změna indexu → reset všech klientských stavů, překlopení na novou aktivitu.
  - **Quiz aktivita uvnitř lekce** = klasický Kahoot (učitel řídí `current_question`).
  - **Non-quiz aktivita** (open / peer_review / photo_upload / group_work) = žák vyplní formulář, odešle, pak vidí „Aktivita dokončena, čeká, až učitel spustí další aktivitu".
- `sessions.lesson_id` = NULL → původní single-activity flow (klasický kvíz, team_forge, pitch_duel, legacy multi_activity).

### Spuštění lekce z editoru
V `/ucitel/lekce/[id]` (editor lekce) je tlačítko **„▶ Spustit pro třídu"** → vede na `/ucitel/session/nova?lesson=<id>` s předvyplněnou lekcí. Učitel tedy může lekci upravit a hned ji spustit.

### Per-session přeskočení aktivit (skipped_activity_ids)
V launch screenu `/ucitel/session/nova` se po vybrání lekce zobrazí **checklist všech aktivit** s krátkým popisem. Učitel může odškrtnout aktivity, které pro tuto session vyhodit (např. méně času → vypustit kvíz nebo focení). Šablona lekce zůstane beze změny — skip se ukládá do `sessions.skipped_activity_ids` JSONB array (lesson_activity ID).

LessonRunner (žák) i `handleNextLessonActivity` (učitel) přeskakují tyto ID při iteraci. Progress bar zobrazuje jen non-skipped aktivity.

### Závislosti aktivit (requires_lesson_activity_ids)
`lesson_activities.requires_lesson_activity_ids` (JSONB array) deklaruje, které **jiné** lesson_activities z stejné lekce tato aktivita vyžaduje. Když učitel v launch checklistu odškrtne X, **cascade auto-odškrtne** všechny aktivity Y, které X vyžadují (tranzitivně). Žlutý label „Auto-vypnuto (vyžaduje předchozí aktivitu)" vysvětluje proč.

L5 dependency graph: Hlasování → Brainstorm; Sestavení → Hlasování + Volba role; Strom → Sestavení. Standalone: Kvíz, Brainstorm, Volba role.

### Učitelské ovládání lekce — `/ucitel/session/[id]/vysledky`
- Nahoře je **postup lekcí** (progress dots přes všechny aktivity).
- Pro **quiz aktivitu** v lekci: standardní Kahoot ovládání + tlačítko **„Spustit další aktivitu →"** místo „Dokončit kvíz" (na poslední otázce). Na poslední otázce poslední aktivity: **„Dokončit lekci"** (zavře session).
- Pro **non-quiz aktivitu**: zjednodušený panel (počet připojených, počet odevzdání) + tlačítko **„Spustit další aktivitu →"** / **„Dokončit lekci"**.
- `handleNextLessonActivity()` inkrementuje `current_activity_index`, resetuje `current_question=0` a `answering_open=true`, synchronizuje legacy `activity_id`. Po poslední aktivitě → `status='closed'`.

### Adaptéry
`src/lib/lesson-adapters.ts` mapuje `Activity` (nový dvouúrovňový tvar) → `SubActivity` (legacy tvar) pro reuse step komponent (`BrainstormStep`, `VotingStep`, `PhotoStep`). Helper `isQuizLikeActivity(type)` rozlišuje quiz typy (`quiz`, `ab_decision`, `ab_with_explanation`, `scale`) od non-quiz (`open`, `peer_review`, `photo_upload`, `group_work`).

### Hledání příležitostí (dvouúrovňová verze, 5. lekce programu)
Lesson `a5e50001-…-005`, lesson_number=5, fáze 1, ~115 min. **6 atomických aktivit:**
1. **Kvíz: Inovátor vs. Stěžovatel** (`quiz`, 15 min, 10 AB otázek, learning) — rétorika „Vidím, že..." vs „Štve mě..."
2. **Brainstorm: Moje příležitost** (`open`, 20 min, **1 textové pole, min 20 slov**, AI feedback, learner review)
3. **Představení příležitostí a hlasování** (`peer_review`, **15 min, requires_grouping=true, team_size=4**) — group flow:
   - **Lobby** (učitel rozdělí třídu)
   - **Sekvenční prezentace**: random pořadí presenterů. Žák během celé prezentační fáze vidí **jen svůj vlastní nápad** (ostatní jsou skryté ať se soustředí na poslouchání mluvčího). Když je řada na něm, zobrazí se mu „Pozor, ty budeš prezentovat" gate s tlačítkem **„Jdu na to ▶"**. Po kliku se spustí countdown (default `per_speaker_ms = 60000`). Ostatní mezi tím vidí „[Anna] se připravuje…", po kliku jen „Anna prezentuje" + sdílený timer + „Poslouchej, co mluvčí říká…" (text nápadu vidí jen sám presenter). Presenter má pod kartou tlačítko **„✓ Hotovo, posunout dál"** pro skip dřív než vyprší limit. Po doběhnutí timeru se auto-advancuje (idempotent přes `session_groups.state`, last write wins).
   - **Hlasování** (až po dokončení všech prezentací): anonymně, max 2 hlasy, ne pro vlastní nápad. Vítěz = „týmová příležitost"
4. **Volba role v týmu** (`role_selection`, 5 min) — žák si vybere 1 z 5 týmových rolí (🎨 Designér / ⚙️ Technik / 📢 Komunikátor / 💡 Inovátor / 📋 Manažer); uloží do `students.team_role`; po odeslání vidí rozložení rolí třídy
5. **Sestavení týmů** (`team_assembly`, 15 min) — 4-fázový flow:
   - **A)** Server označí lídry = vlastníky vítězných příležitostí z hlasování (jeden lídr per session_group)
   - **B)** Ostatní žáci vidí seznam příležitostí a vyberou si tým
   - **C)** Lídr vidí složení s rolemi + indikátor diverzity (≥3 různé role = ideální), klikne „Potvrdit tým"
   - **D)** Učitel v `/ucitel/session/[id]/vysledky` schvaluje každý tým, může přesouvat žáky mezi týmy. Tlačítko „Spustit další aktivitu" je odemčené teprve když jsou schválené všechny týmy.
6. **Strom příležitosti** (`photo_upload`, 45 min, AI verifikace 4 částí stromu)

Kompetence (lekce): EntreComp Spotting Opportunities (0.9), Creativity (0.7), Vision (0.6), Working with Others (0.6), Self Awareness (0.5) + RVP K podnikavosti (0.8).

Seedy:
- **`seed-L5-aktivity.sql`** (canonical, 6 aktivit) — vyžaduje `migration-v12-lessons-activities.sql` + `migration-v13-teams.sql`
- `seed-L5-dvouurovnova.sql` superseded (4 aktivity, ponecháno pro historii)

### Týmové role (taxonomie)
Žák volí v aktivitě `role_selection`, ukládá se do `students.team_role` (VARCHAR(20)). Konstanty v `src/types/index.ts`:

| Role           | Emoji | Tagline                                       |
|----------------|-------|-----------------------------------------------|
| `designer`     | 🎨    | „Mám rád vizuál a kreativitu"                  |
| `engineer`     | ⚙️    | „Mám rád analýzu a realizaci"                  |
| `communicator` | 📢    | „Mám rád prezentování a diplomacii"            |
| `innovator`    | 💡    | „Mám rád nápady a vize"                        |
| `manager`      | 📋    | „Mám rád organizaci a plánování"               |

Helper: `TEAM_ROLE_INFO[role]` (label/emoji/tagline/description), `ALL_TEAM_ROLES`. Předchozí behaviorální taxonomie (leader/analyst/creative/mediator/executor) byla nahrazena — `detectTeamRole()` je no-op stub.

### Tabulka `teams` (migration v13)
Sestavený tým z `team_assembly`:
- `id`, `session_id`, `lesson_id`, `activity_id`
- `opportunity_text` (vítězná příležitost), `source_event_id`
- `leader_student_id` (FK na students), `member_ids` JSONB (array studentových id včetně lídra)
- `roles_summary` JSONB ({ "designer": 2, ... })
- `is_leader_confirmed`, `is_approved`, `approved_by`, `approved_at`
- Unique constraint `(session_id, leader_student_id)` — jeden tým per lídr na session

Liší se od `session_groups` (generický grouping pro voting/team_forge/pitch_duel) — `teams` je výsledek role-aware self-organizace.

## Tech stack
- Next.js 14 + TypeScript + Tailwind CSS
- Supabase (databáze PostgreSQL + auth + storage)
- Supabase URL: https://ggsccbdrvnfopmpirrsi.supabase.co
- Deployment: Vercel (napojeno na GitHub)
- Budoucnost: Flutter/Unity pro mobilní app

## Aktuální stav MVP
- Dashboard učitele ✅
- Kahoot-style prezentace s reveal + leaderboard ✅
- Learning/Assessment/Mixed režimy ✅
- Žákovský profil s kompetencemi ✅
- Timer (volitelný) ✅
- Dvouvrstvé finále (pořadí → opravy → kompetence) ✅
- Session lifecycle (active/paused/closed + heartbeat) ✅
- Celkové XP napříč kvízy ✅
- Nedokončené kvízy na profilu ✅
- Growth mindset messaging ✅
- Radar chart kompetencí (žák + třída) ✅
- Hvězdy třídy + kompetence přehled učitel ✅
- AB Decision otázky (ab_decision, ab_with_explanation) ✅
- Nástroj pro tvorbu otázek (/ucitel/otazky/nova) ✅
- Peer reviews tabulka (prepared) ✅
- SWOT profil žáka + team role detection ✅
- Lekce L5 — Hledání příležitosti (multi_activity seed, legacy) ✅
- Dvouúrovňová struktura Lekce → Aktivity (migration v12) ✅
- Knihovna lekcí + editor s drag & drop (@dnd-kit) ✅
- Knihovna aktivit s filtry ✅
- Dual-mode žákovský flow (lesson_id vs single-activity) ✅
- L5 přepsaná do dvouúrovňové struktury (seed-L5-dvouurovnova.sql) ✅
