"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [studentCode, setStudentCode] = useState("");
  const [lessonCode, setLessonCode] = useState("");
  const [showLessonCode, setShowLessonCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-login z QR kódu (?code=ZAK00001)
  useEffect(() => {
    const codeFromUrl = searchParams?.get("code");
    if (!codeFromUrl) return;
    const clean = codeFromUrl.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    if (clean.length !== 8) return;
    setStudentCode(clean);
    // Auto-submit po krátkém okamžiku
    (async () => {
      setLoading(true);
      const { data: student } = await supabase
        .from("students").select("*, classes(*)").eq("student_code", clean).single();
      if (!student) { setError("Neplatný kód žáka v odkazu"); setLoading(false); return; }
      localStorage.setItem("inj-student", JSON.stringify({
        studentId: student.id,
        classId: student.class_id,
        code: student.student_code,
        displayName: student.display_name,
        avatarEmoji: student.avatar_emoji,
        avatarColor: student.avatar_color,
      }));
      router.push("/zak/profil");
    })();
  }, [searchParams, router]);

  function handleCodeChange(value: string) {
    const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    setStudentCode(clean);
    setError("");
  }

  function handleLessonCodeChange(value: string) {
    const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    setLessonCode(clean);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (studentCode.length !== 8) {
      setError("Zadej 8místný osobní kód");
      return;
    }
    setLoading(true);

    const { data: student } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("student_code", studentCode)
      .single();

    if (!student) {
      setError("Neplatný kód žáka");
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "inj-student",
      JSON.stringify({
        studentId: student.id,
        classId: student.class_id,
        code: student.student_code,
        displayName: student.display_name,
        avatarEmoji: student.avatar_emoji,
        avatarColor: student.avatar_color,
      })
    );

    router.push("/zak/profil");
  }

  async function handleLessonSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lessonCode.length !== 6) {
      setError("Zadej 6místný kód lekce");
      return;
    }

    const stored = localStorage.getItem("inj-student");
    if (!stored) {
      setError("Nejprve zadej svůj osobní kód");
      setShowLessonCode(false);
      return;
    }

    setLoading(true);
    const { studentId } = JSON.parse(stored);

    const { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("code", lessonCode)
      .eq("is_active", true)
      .single();

    if (!session) {
      setError("Lekce nenalezena nebo není aktivní");
      setLoading(false);
      return;
    }

    localStorage.setItem(
      "inj-session",
      JSON.stringify({ sessionId: session.id, sessionCode: session.code })
    );

    router.push(`/lekce/${lessonCode}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
      <div className="flex flex-col items-center max-w-sm w-full">
        <h1 className="text-5xl font-bold mb-2">
          <span className="text-accent">Cesta inovátora</span>
        </h1>
        <p className="text-foreground/60 mb-12 text-lg">Přihlas se svým kódem</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-6 animate-fade-in">
          <div className="w-full">
            <label htmlFor="student-code" className="block text-foreground/80 text-sm mb-2 text-center">
              Tvůj osobní kód
            </label>
            <input
              id="student-code"
              type="text"
              inputMode="text"
              value={studentCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABCD1234"
              className="w-full text-center text-3xl tracking-[0.3em] font-mono py-4 px-6 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors placeholder:text-foreground/20 uppercase"
              autoFocus
            />
          </div>
          {error && !showLessonCode && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-accent hover:bg-accent/80 disabled:opacity-50 text-background text-lg font-bold rounded-xl transition-colors"
          >
            {loading ? "Ověřuji..." : "Přihlásit se"}
          </button>
        </form>

        {/* Záložní vstup přes kód lekce */}
        <div className="mt-8 w-full">
          {!showLessonCode ? (
            <button
              onClick={() => setShowLessonCode(true)}
              className="text-sm text-foreground/30 hover:text-foreground/50 transition-colors w-full text-center"
            >
              Mám kód lekce &rarr;
            </button>
          ) : (
            <form onSubmit={handleLessonSubmit} className="animate-fade-in flex flex-col items-center gap-3">
              <p className="text-foreground/50 text-sm">Zadej kód lekce od učitele</p>
              <input
                type="text"
                inputMode="text"
                value={lessonCode}
                onChange={(e) => handleLessonCodeChange(e.target.value)}
                placeholder="ABC123"
                className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3 px-6 bg-background border-2 border-primary/50 focus:border-accent rounded-xl text-white outline-none transition-colors placeholder:text-foreground/20 uppercase"
              />
              {error && showLessonCode && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                Připojit se k lekci
              </button>
              <button
                type="button"
                onClick={() => { setShowLessonCode(false); setError(""); setLessonCode(""); }}
                className="text-sm text-foreground/30 hover:text-foreground/50 transition-colors"
              >
                &larr; Zpět
              </button>
            </form>
          )}
        </div>

        {/* Link pro učitele */}
        <div className="mt-12">
          <a href="/ucitel" className="text-foreground/20 text-xs hover:text-foreground/40 transition-colors">
            Učitelský přístup
          </a>
        </div>
      </div>
    </main>
  );
}
