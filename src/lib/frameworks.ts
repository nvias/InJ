import { supabase } from "./supabase";

// ---- EntreComp Matrix ----

export interface EntreCompThread {
  thread: string;
  threadCZ: string;
  levels: Record<number, string>; // level 1-8 → description text
}

export interface EntreCompMatrixEntry {
  area: string;
  competence: string;
  threads: EntreCompThread[];
}

let entrecompCache: EntreCompMatrixEntry[] | null = null;

export async function getEntreCompMatrix(): Promise<EntreCompMatrixEntry[]> {
  if (entrecompCache) return entrecompCache;

  const { data } = await supabase
    .from("entrecomp_matrix")
    .select("*")
    .order("area")
    .order("competence")
    .order("thread");

  if (!data) return [];

  // Group by area+competence
  const map = new Map<string, EntreCompMatrixEntry>();
  for (const row of data) {
    const key = `${row.area}:${row.competence}`;
    if (!map.has(key)) {
      map.set(key, { area: row.area, competence: row.competence, threads: [] });
    }
    map.get(key)!.threads.push({
      thread: row.thread,
      threadCZ: row.thread_cz,
      levels: {
        1: row.level_1,
        2: row.level_2,
        3: row.level_3,
        4: row.level_4,
        5: row.level_5 || "",
        6: row.level_6 || "",
        7: row.level_7 || "",
        8: row.level_8 || "",
      },
    });
  }

  entrecompCache = Array.from(map.values());
  return entrecompCache;
}

/** Get level descriptions for a specific competence */
export async function getEntreCompLevel(competenceKey: string, level: number): Promise<{ threads: { name: string; description: string }[] }> {
  const matrix = await getEntreCompMatrix();
  const entry = matrix.find((m) => m.competence === competenceKey);
  if (!entry) return { threads: [] };

  return {
    threads: entry.threads
      .map((t) => ({
        name: t.threadCZ,
        description: t.levels[level] || "",
      }))
      .filter((t) => t.description),
  };
}

// ---- RVP Competences ----

export interface RVPCompetenceEntry {
  competence: string;
  competenceCZ: string;
  area: string;
  areaCZ: string;
  levels: Record<number, string>; // level 1-3
}

let rvpCache: RVPCompetenceEntry[] | null = null;

export async function getRVPCompetences(): Promise<RVPCompetenceEntry[]> {
  if (rvpCache) return rvpCache;

  const { data } = await supabase
    .from("rvp_competences")
    .select("*")
    .order("competence")
    .order("area");

  if (!data) return [];

  rvpCache = data.map((row) => ({
    competence: row.competence,
    competenceCZ: row.competence_cz,
    area: row.area,
    areaCZ: row.area_cz,
    levels: {
      1: row.level_1,
      2: row.level_2,
      3: row.level_3,
    },
  }));

  return rvpCache;
}

/** Get level description for a specific RVP competence */
export async function getRVPLevel(competenceKey: string, level: number): Promise<{ areas: { name: string; description: string }[] }> {
  const all = await getRVPCompetences();
  const entries = all.filter((e) => e.competence === competenceKey);

  return {
    areas: entries
      .map((e) => ({
        name: e.areaCZ,
        description: e.levels[Math.min(level, 3)] || "",
      }))
      .filter((a) => a.description),
  };
}

// Clear cache (for testing)
export function clearFrameworkCache() {
  entrecompCache = null;
  rvpCache = null;
}
