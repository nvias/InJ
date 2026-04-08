"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Student } from "@/types";
import { AVATAR_EMOJIS } from "@/lib/avatars";

export default function TridaDetailPage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("🦊");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, params.id]);

  async function loadData() {
    const [clsRes, stuRes] = await Promise.all([
      supabase.from("classes").select("name").eq("id", params.id).single(),
      supabase.from("students").select("*").eq("class_id", params.id).order("created_at"),
    ]);
    if (clsRes.data) setClassName(clsRes.data.name);
    if (stuRes.data) setStudents(stuRes.data);
  }

  function exportCSV() {
    const header = "Cislo,Kod zaka,Jmeno\n";
    const rows = students.map((s, i) => `${i + 1},${s.student_code},${s.display_name}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className}-kody.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startEdit(s: Student) {
    setEditingStudent(s);
    setEditName(s.display_name === "Anonym" || s.display_name?.startsWith("Žák ") ? "" : s.display_name || "");
    setEditEmoji(s.avatar_emoji || "🦊");
  }

  function cancelEdit() { setEditingStudent(null); }

  async function saveEdit() {
    if (!editingStudent || editName.trim().length < 2) return;
    setSaving(true);
    await supabase
      .from("students")
      .update({ display_name: editName.trim(), avatar_emoji: editEmoji })
      .eq("id", editingStudent.id);
    await loadData();
    setSaving(false);
    setEditingStudent(null);
  }

  if (!authorized) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/dashboard" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
            &larr; Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-white">{className}</h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportCSV} className="px-4 py-2 text-sm border border-accent/40 text-accent rounded-lg hover:bg-accent/10 transition-colors">
              📄 CSV
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 text-sm border border-primary/40 text-foreground/60 rounded-lg hover:text-white transition-colors">
              🖨 Tisk kódů
            </button>
            <Link
              href={`/ucitel/trida/${params.id}/karticky`}
              target="_blank"
              className="px-4 py-2 text-sm border border-cyan-400 text-cyan-400 rounded-lg hover:bg-cyan-400/10 transition-colors font-bold"
            >
              🎴 Tisk QR kartiček
            </Link>
          </div>
        </div>

        <p className="text-foreground/50 text-sm mb-4">{students.length} žáků · klikni na řádek pro úpravu jména a avataru</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/20">
                <th className="py-2 px-3 text-left text-foreground/50">#</th>
                <th className="py-2 px-3 text-left text-foreground/50"></th>
                <th className="py-2 px-3 text-left text-foreground/50">Kód žáka</th>
                <th className="py-2 px-3 text-left text-foreground/50">Jméno</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => startEdit(s)}
                  className="border-b border-primary/10 hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 text-foreground/40">{i + 1}</td>
                  <td className="py-2 px-3 text-2xl">{s.avatar_emoji || "🦊"}</td>
                  <td className="py-2 px-3 font-mono font-bold text-accent tracking-wider">{s.student_code}</td>
                  <td className="py-2 px-3 text-foreground/70">{s.display_name || <span className="italic text-foreground/30">— upravit —</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editingStudent && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={cancelEdit}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-background border border-primary/40 rounded-2xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-white mb-1">Upravit žáka</h3>
            <p className="text-foreground/40 text-xs font-mono mb-5">{editingStudent.student_code}</p>

            <label className="block text-foreground/70 text-sm mb-1.5">Jméno (min. 2 znaky)</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={50}
              autoFocus
              className="w-full py-3 px-4 bg-primary/5 border border-primary/40 focus:border-accent rounded-xl text-white outline-none mb-5"
              placeholder="Tomáš Novák"
            />

            <label className="block text-foreground/70 text-sm mb-2">Avatar</label>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setEditEmoji(emoji)}
                  className={`aspect-square text-2xl rounded-xl transition-all ${editEmoji === emoji ? "bg-accent/20 border-2 border-accent scale-110" : "bg-primary/10 border-2 border-transparent hover:border-primary/40"}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={cancelEdit} className="px-5 py-2.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white/70">
                Zrušit
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || editName.trim().length < 2}
                className="px-5 py-2.5 text-sm rounded-lg bg-accent text-background font-bold disabled:opacity-30 hover:shadow-[0_0_15px_rgba(0,212,255,0.4)]"
              >
                {saving ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
