"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface ImageDropZoneProps {
  value: string; // current image URL
  onChange: (url: string) => void;
  label: string; // "A" or "B"
}

export default function ImageDropZone({ value, onChange, label }: ImageDropZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `q_${Date.now()}_${label}.${ext}`;

    const { data, error } = await supabase.storage
      .from("question-images")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("Upload error:", error);
      alert("Chyba uploadu: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("question-images")
      .getPublicUrl(data.path);

    onChange(urlData.publicUrl);
    setUploading(false);
  }, [label, onChange]);

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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleRemove() {
    onChange("");
  }

  // Has image
  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-primary/20">
        <img src={value} alt={`Obrázek ${label}`} className="w-full h-40 object-cover" />
        <button onClick={handleRemove}
          className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors">
          &times;
        </button>
      </div>
    );
  }

  // Upload zone
  return (
    <div
      ref={zoneRef}
      tabIndex={0}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      className={`relative rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer outline-none focus:border-accent ${
        dragOver ? "border-accent bg-accent/10" : "border-primary/30 hover:border-primary/50"
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      {uploading ? (
        <div className="py-4">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-foreground/40 text-xs">Nahrávám...</p>
        </div>
      ) : (
        <div className="py-3">
          <p className="text-foreground/40 text-sm mb-1">
            <span className="hidden md:inline">Přetáhni obrázek nebo Ctrl+V</span>
            <span className="md:hidden">Klikni pro výběr foto</span>
          </p>
          <p className="text-foreground/20 text-xs">nebo klikni pro výběr souboru</p>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
    </div>
  );
}
