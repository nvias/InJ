"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import type { Student } from "@/types";

// ═══════════════════════════════════════════════
// Tisk QR kartiček — 8 kartiček na A4 (2×4)
// Bílé pozadí, černý text, friendly pro tiskárnu.
// QR kóduje URL: <origin>/?code=<student_code>
// po naskenování telefonem se žák auto-přihlásí.
// ═══════════════════════════════════════════════

export default function QRCardsPage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [origin, setOrigin] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") { router.replace("/ucitel"); return; }
    setAuthorized(true);
    setOrigin(window.location.origin);
    Promise.all([
      supabase.from("classes").select("name").eq("id", params.id).single(),
      supabase.from("students").select("*").eq("class_id", params.id).order("created_at"),
    ]).then(([clsRes, stuRes]) => {
      if (clsRes.data) setClassName(clsRes.data.name);
      if (stuRes.data) setStudents(stuRes.data);
    });
  }, [router, params.id]);

  if (!authorized) return null;

  return (
    <>
      {/* Toolbar — skryto při tisku */}
      <div className="no-print bg-background text-white p-4 border-b border-primary/30 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">QR kartičky — {className}</h1>
          <p className="text-xs text-foreground/50">{students.length} žáků · 8 kartiček na A4</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.back()} className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white/70">
            ← Zpět
          </button>
          <button onClick={() => window.print()} className="px-5 py-2 text-sm rounded-lg bg-cyan-400 text-black font-bold hover:shadow-[0_0_15px_#00D4FF]">
            🖨 Vytisknout
          </button>
        </div>
      </div>

      {/* QR cards — viditelné jak na obrazovce, tak při tisku */}
      <div id="qr-cards" className="qr-page bg-white text-black">
        {students.map((s) => {
          const qrUrl = `${origin}/?code=${s.student_code}`;
          const hasName = s.display_name && s.display_name !== "Anonym" && !s.display_name.startsWith("Žák ");
          return (
            <div key={s.id} className="qr-card">
              {/* Jméno (display_name nebo prázdná linka) */}
              <div className="qr-card-name">
                {hasName ? (
                  <span className="qr-card-name-text">{s.display_name}</span>
                ) : (
                  <span className="qr-card-name-blank"></span>
                )}
              </div>

              {/* QR kód */}
              <div className="qr-card-qr">
                <QRCodeSVG value={qrUrl} size={140} level="M" includeMargin={false} />
              </div>

              {/* Patička: emoji + kód */}
              <div className="qr-card-footer">
                <span className="qr-card-emoji">{s.avatar_emoji || "🦊"}</span>
                <span className="qr-card-code">{s.student_code}</span>
              </div>
              <div className="qr-card-brand">InJ — Cesta inovátora · nvias</div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        /* Layout pro obrazovku i tisk */
        .qr-page {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8mm;
          padding: 10mm;
          max-width: 210mm;
          margin: 0 auto;
        }

        .qr-card {
          break-inside: avoid;
          page-break-inside: avoid;
          border: 1px dashed #bbb;
          border-radius: 6px;
          padding: 10mm 8mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #ffffff;
          color: #000000;
          min-height: 90mm;
        }

        .qr-card-name {
          width: 100%;
          min-height: 18mm;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          margin-bottom: 4mm;
        }

        .qr-card-name-text {
          font-size: 16pt;
          font-weight: 700;
          color: #000;
          font-family: Arial, sans-serif;
        }

        .qr-card-name-blank {
          display: block;
          width: 60mm;
          border-bottom: 1.5px dotted #999;
          height: 1px;
        }

        .qr-card-qr {
          background: #fff;
          padding: 3mm;
          border: 1px solid #eee;
          border-radius: 4px;
          margin: 2mm 0;
        }

        .qr-card-footer {
          display: flex;
          align-items: center;
          gap: 6mm;
          margin-top: 4mm;
        }

        .qr-card-emoji {
          font-size: 18pt;
        }

        .qr-card-code {
          font-family: 'Courier New', monospace;
          font-size: 14pt;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #000;
        }

        .qr-card-brand {
          font-size: 8pt;
          color: #888;
          margin-top: 2mm;
          font-family: Arial, sans-serif;
        }

        /* Tiskový mód */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html, body {
            background: #ffffff !important;
            color: #000 !important;
            margin: 0;
            padding: 0;
          }
          body * { visibility: hidden; }
          #qr-cards, #qr-cards * { visibility: visible; }
          #qr-cards {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print { display: none !important; }
          .qr-card {
            border: 1px dashed #aaa !important;
          }
        }
      `}</style>
    </>
  );
}
