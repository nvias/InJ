"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { GroupWorkSubActivity } from "@/types";
import { verifyPhoto, type VerifyResult } from "@/lib/photo-verify";

interface PhotoStepProps {
  subActivity: GroupWorkSubActivity;
  studentId: string;
  sessionId: string;
  onComplete: (xpGained: number) => void;
}

type Phase = "upload" | "preview" | "verifying" | "verified" | "rejected";

const STORAGE_BUCKET = "question-images";
const STORAGE_PREFIX = "tree-photos";

export default function PhotoStep({ subActivity, studentId, sessionId, onComplete }: PhotoStepProps) {
  const router = useRouter();
  const xp = subActivity.xp_complete ?? 200;

  const [phase, setPhase] = useState<Phase>("upload");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${STORAGE_PREFIX}/${studentId}_${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Upload error:", error);
      alert("Chyba uploadu: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    setPhotoUrl(urlData.publicUrl);
    setPhase("preview");
    setUploading(false);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadFile(file);
        return;
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleSubmit() {
    if (!photoUrl) return;
    setPhase("verifying");

    const result = await verifyPhoto(photoUrl, {
      prompt: subActivity.ai_verification?.prompt,
      checks: subActivity.ai_verification?.checks,
    });

    setVerifyResult(result);

    await supabase.from("student_events").insert({
      student_id: studentId,
      session_id: sessionId,
      question_id: subActivity.id,
      event_type: "photo_upload",
      answer: JSON.stringify({
        photo_url: photoUrl,
        verified: result.verified,
        feedback: result.feedback,
        checks: result.checks,
      }),
      is_correct: result.verified,
      attempt_no: 1,
      duration_ms: 0,
    });

    if (result.verified) {
      setPhase("verified");
      onComplete(xp);
    } else {
      setPhase("rejected");
    }
  }

  function handleRetry() {
    setPhotoUrl("");
    setVerifyResult(null);
    setPhase("upload");
  }

  if (phase === "verified") {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="text-7xl mb-4">🎉</div>
        <div className="text-5xl font-bold text-accent mb-3 animate-xp-pop">+{xp} XP</div>
        <h2 className="text-3xl font-bold text-white mb-3">Lekce splněna!</h2>
        <p className="text-foreground/70 mb-2">{verifyResult?.feedback || "Strom vypadá skvěle!"}</p>
        <p className="text-foreground/50 text-sm mb-8">Tvůj Strom příležitosti je v pořádku.</p>
        <button
          onClick={() => router.push("/zak/profil")}
          className="px-8 py-4 bg-accent text-background font-bold rounded-xl hover:bg-accent/90 transition-colors"
        >
          Zobrazit můj profil →
        </button>
      </div>
    );
  }

  if (phase === "rejected") {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="text-6xl mb-4">🤔</div>
        <h2 className="text-2xl font-bold text-yellow-300 mb-3">Zkus to znovu</h2>
        <p className="text-foreground/70 mb-2">{verifyResult?.feedback}</p>
        <p className="text-foreground/50 text-sm mb-6">Zkus nahrát foto celého plakátu — kořeny, kmen i koruna by měly být vidět.</p>
        <button
          onClick={handleRetry}
          className="px-6 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-colors"
        >
          Nahrát znovu
        </button>
      </div>
    );
  }

  if (phase === "verifying") {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h2 className="text-xl font-bold text-white mb-2">Kontroluji tvůj strom...</h2>
        <p className="text-foreground/50 text-sm">Hledám kořeny, kmen a korunu</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-2">Nafoť váš Strom příležitosti</h2>
      <p className="text-foreground/60 mb-5">
        {subActivity.deliverable.description || "Foto A3 plakátu se třemi částmi: kořeny, kmen, koruna."}
      </p>

      {phase === "upload" && (
        <div
          tabIndex={0}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer outline-none focus:border-accent ${
            dragOver ? "border-accent bg-accent/10" : "border-primary/40 hover:border-primary/70"
          }`}
        >
          {uploading ? (
            <div className="py-8">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-foreground/50">Nahrávám foto...</p>
            </div>
          ) : (
            <div className="py-6">
              <div className="text-5xl mb-3">📸</div>
              <p className="text-foreground/80 font-semibold mb-1">
                <span className="hidden md:inline">Přetáhni foto, vlož přes Ctrl+V</span>
                <span className="md:hidden">Klikni a vyber foto</span>
              </p>
              <p className="text-foreground/40 text-sm">nebo klikni pro výběr</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
        </div>
      )}

      {phase === "preview" && photoUrl && (
        <div className="animate-fade-in">
          <div className="relative rounded-2xl overflow-hidden border-2 border-accent/40 mb-4">
            <img src={photoUrl} alt="Strom příležitosti" className="w-full max-h-[400px] object-contain bg-black/40" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 py-3 border border-primary/40 text-foreground/70 hover:text-white rounded-xl transition-colors"
            >
              Nahrát jiné
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 bg-accent text-background font-bold rounded-xl hover:bg-accent/90 transition-colors"
            >
              Odeslat k ověření
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
