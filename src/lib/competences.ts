// Všechny sledované kompetence - seed pro radar chart
// Pokud žák nemá data, zobrazí se 0

export interface CompetenceDef {
  key: string;
  label: string;
  shortLabel: string;
  framework: "RVP" | "EntreComp";
}

export const ALL_COMPETENCES: CompetenceDef[] = [
  // RVP - 8 klíčových
  { key: "rvp_k_uceni", label: "K učení", shortLabel: "Učení", framework: "RVP" },
  { key: "rvp_komunikacni", label: "Komunikační", shortLabel: "Komunik.", framework: "RVP" },
  { key: "rvp_osobnostni", label: "Osobnostní a sociální", shortLabel: "Osobnost.", framework: "RVP" },
  { key: "rvp_obcanske", label: "K občanství", shortLabel: "Občanské", framework: "RVP" },
  { key: "rvp_k_reseni_problemu", label: "K řešení problémů", shortLabel: "Řeš. probl.", framework: "RVP" },
  { key: "rvp_k_podnikavosti", label: "K podnikavosti", shortLabel: "Podnikav.", framework: "RVP" },
  { key: "rvp_digitalni", label: "Digitální", shortLabel: "Digitální", framework: "RVP" },
  { key: "rvp_kulturni", label: "Kulturní", shortLabel: "Kulturní", framework: "RVP" },

  // EntreComp - vybrané hlavní
  { key: "entrecomp_creativity", label: "Kreativita", shortLabel: "Kreativ.", framework: "EntreComp" },
  { key: "entrecomp_self_awareness", label: "Sebeuvědomění", shortLabel: "Sebe-uv.", framework: "EntreComp" },
  { key: "entrecomp_motivation", label: "Motivace", shortLabel: "Motivace", framework: "EntreComp" },
  { key: "entrecomp_mobilising_others", label: "Mobilizace ostatních", shortLabel: "Mobil.", framework: "EntreComp" },
  { key: "entrecomp_taking_initiative", label: "Iniciativa", shortLabel: "Iniciativa", framework: "EntreComp" },
  { key: "entrecomp_planning", label: "Plánování", shortLabel: "Plánování", framework: "EntreComp" },
  { key: "entrecomp_working_with_others", label: "Spolupráce", shortLabel: "Spolupráce", framework: "EntreComp" },
  { key: "entrecomp_ethical_thinking", label: "Etické myšlení", shortLabel: "Etika", framework: "EntreComp" },
  { key: "entrecomp_coping_with_uncertainty", label: "Zvládání nejistoty", shortLabel: "Nejistota", framework: "EntreComp" },
  { key: "entrecomp_learning_through_experience", label: "Učení zkušeností", shortLabel: "Zkušenost", framework: "EntreComp" },
  { key: "entrecomp_spotting_opportunities", label: "Hledání příležitostí", shortLabel: "Příležit.", framework: "EntreComp" },
  { key: "entrecomp_valuing_ideas", label: "Hodnocení nápadů", shortLabel: "Hod. náp.", framework: "EntreComp" },
  { key: "entrecomp_financial_literacy", label: "Finanční gramotnost", shortLabel: "Finance", framework: "EntreComp" },
];

// Separate by framework for different views
export const RVP_COMPETENCES = ALL_COMPETENCES.filter((c) => c.framework === "RVP");
export const ENTRECOMP_COMPETENCES = ALL_COMPETENCES.filter((c) => c.framework === "EntreComp");
