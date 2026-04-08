"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LekceDetailPage({ params }: { params: { id: string } }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthenticated(true);

    supabase
      .from("sessions")
      .select("code")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) setSessionCode(data.code);
        setLoading(false);
      });
  }, [router, params.id]);

  if (loading || !authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }

  const lessonUrl = typeof window !== "undefined" ? `${window.location.origin}/lekce/${sessionCode}` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(lessonUrl)}&bgcolor=0A0F2E&color=00D4FF`;

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

      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Lekce</h1>
        <p className="text-foreground/50 mb-10">Sdílejte kód se studenty</p>

        <div className="flex flex-col items-center gap-8">
          <div className="border border-primary/30 rounded-xl p-8 flex flex-col items-center gap-6">
            <p className="text-foreground/60 text-sm">QR kód pro studenty</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`QR kód pro lekci ${sessionCode}`} width={280} height={280} className="rounded-lg" />
            <div className="text-center">
              <p className="text-foreground/50 text-xs mb-1">Kód lekce</p>
              <p className="text-4xl font-mono font-bold tracking-[0.3em] text-accent">{sessionCode}</p>
            </div>
          </div>

          <Link
            href={`/ucitel/lekce/${params.id}/vysledky`}
            className="px-6 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
          >
            Zobrazit výsledky
          </Link>
        </div>
      </div>
    </main>
  );
}
