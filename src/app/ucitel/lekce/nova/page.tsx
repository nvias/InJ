"use client";

// Tato stránka je redirect — vytvoří prázdnou lekci a přejde na editor.
// (Forma „nová lekce" je samotný editor s defaultním titulkem; samostatný
// formulář pro pojmenování zde nedává smysl.)

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NovaLekcePage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("lessons")
        .insert({ title: "Nová lekce", description: null, is_published: false })
        .select("id")
        .single();
      if (error || !data) {
        alert("Chyba při vytváření lekce: " + (error?.message ?? ""));
        router.replace("/ucitel/lekce");
        return;
      }
      router.replace(`/ucitel/lekce/${data.id}`);
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-foreground/60">Vytvářím novou lekci...</p>
    </main>
  );
}
