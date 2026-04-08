import { supabase } from "./supabase";
import type { GroupWithMembers } from "@/types";

interface StudentLite {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: string;
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Split N students into chunks of `teamSize`. The remainder (if N % teamSize != 0)
 * is distributed by joining the smallest residual to existing groups (so groups
 * may end up size = teamSize or teamSize+1). For teamSize=2 with odd N this gives
 * one trio. For teamSize=3 with N=10 this gives 3+3+4.
 */
export function chunkStudents(students: StudentLite[], teamSize: number): StudentLite[][] {
  const shuffled = shuffle([...students]);
  if (teamSize <= 0 || shuffled.length === 0) return [];
  if (shuffled.length <= teamSize) return [shuffled];

  const fullGroups = Math.floor(shuffled.length / teamSize);
  const remainder = shuffled.length % teamSize;
  const groups: StudentLite[][] = [];
  for (let i = 0; i < fullGroups; i++) {
    groups.push(shuffled.slice(i * teamSize, (i + 1) * teamSize));
  }
  // Distribute remainder one-by-one into earliest groups
  for (let i = 0; i < remainder; i++) {
    groups[i % groups.length].push(shuffled[fullGroups * teamSize + i]);
  }
  return groups;
}

/**
 * Wipe existing groups for the session and write fresh ones from the layout.
 * `layout` is array of arrays of student ids (one inner array per group).
 */
export async function persistGroups(sessionId: string, layout: string[][]): Promise<void> {
  // Delete all existing groups for this session (cascade removes members)
  await supabase.from("session_groups").delete().eq("session_id", sessionId);

  if (layout.length === 0) return;

  // Insert groups
  const groupRows = layout.map((_, idx) => ({
    session_id: sessionId,
    group_index: idx + 1,
  }));
  const { data: insertedGroups, error } = await supabase
    .from("session_groups")
    .insert(groupRows)
    .select("id, group_index");

  if (error || !insertedGroups) throw error || new Error("Failed to insert groups");

  // Insert members
  const memberRows: { group_id: string; student_id: string; slot_index: number }[] = [];
  for (const g of insertedGroups) {
    const studentIds = layout[g.group_index - 1];
    studentIds.forEach((sid, slot) => {
      memberRows.push({ group_id: g.id, student_id: sid, slot_index: slot });
    });
  }
  if (memberRows.length > 0) {
    await supabase.from("session_group_members").insert(memberRows);
  }
}

/**
 * Load all groups for a session with their hydrated members.
 */
export async function loadGroups(sessionId: string): Promise<GroupWithMembers[]> {
  const { data: groups } = await supabase
    .from("session_groups")
    .select("id, group_index, group_name")
    .eq("session_id", sessionId)
    .order("group_index");
  if (!groups || groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);
  const { data: members } = await supabase
    .from("session_group_members")
    .select("group_id, student_id, slot_index, students(id, display_name, avatar_emoji, avatar_color)")
    .in("group_id", groupIds)
    .order("slot_index");

  const byGroup = new Map<string, GroupWithMembers["members"]>();
  for (const m of members || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (m as any).students;
    if (!st) continue;
    const arr = byGroup.get(m.group_id) || [];
    arr.push({
      student_id: st.id,
      display_name: st.display_name,
      avatar_emoji: st.avatar_emoji || "🦊",
      avatar_color: st.avatar_color || "#00D4FF",
      slot_index: m.slot_index,
    });
    byGroup.set(m.group_id, arr);
  }

  return groups.map((g) => ({
    id: g.id,
    group_index: g.group_index,
    group_name: g.group_name,
    members: byGroup.get(g.id) || [],
  }));
}

/** Find the group that contains a given student (or null). */
export async function findStudentGroup(sessionId: string, studentId: string): Promise<GroupWithMembers | null> {
  const all = await loadGroups(sessionId);
  return all.find((g) => g.members.some((m) => m.student_id === studentId)) || null;
}

/** Move a student from one group to another within the same session. */
export async function moveStudent(fromGroupId: string, toGroupId: string, studentId: string): Promise<void> {
  await supabase.from("session_group_members").delete().eq("group_id", fromGroupId).eq("student_id", studentId);
  // Append to new group at end
  const { count } = await supabase
    .from("session_group_members")
    .select("student_id", { count: "exact", head: true })
    .eq("group_id", toGroupId);
  await supabase.from("session_group_members").insert({
    group_id: toGroupId,
    student_id: studentId,
    slot_index: count || 0,
  });
}
