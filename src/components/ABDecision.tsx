"use client";

import { useState } from "react";

interface ABOption {
  key: string;
  text: string;
  image_url?: string;
}

interface ABDecisionProps {
  options: ABOption[];
  correct: string;
  selected: string | null;
  phase: "answering" | "explaining" | "hint" | "result" | "waiting-next";
  attempt: number;
  requiresExplanation?: boolean;
  explanationPrompt?: string;
  onSelect: (key: string) => void;
  onExplanationSubmit?: (text: string) => void;
}

const Diamond = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" className="inline-block mr-1.5">
    <path d="M8 0 L16 8 L8 16 L0 8 Z" fill={color} />
  </svg>
);

export default function ABDecision({
  options,
  correct,
  selected,
  phase,
  attempt,
  requiresExplanation,
  explanationPrompt,
  onSelect,
  onExplanationSubmit,
}: ABDecisionProps) {
  const [explanation, setExplanation] = useState("");
  const [explanationSent, setExplanationSent] = useState(false);
  const [lastAttempt, setLastAttempt] = useState(attempt);

  // Reset explanation state when attempt changes (retry)
  if (attempt !== lastAttempt) {
    setLastAttempt(attempt);
    setExplanation("");
    setExplanationSent(false);
  }
  const isAnswering = phase === "answering";
  const isExplaining = phase === "explaining";
  const showResult = phase === "result";

  function handleExplanationSubmit() {
    if (explanation.trim().split(/\s+/).length < 3) return; // min 3 slova
    onExplanationSubmit?.(explanation.trim());
    setExplanationSent(true);
  }

  return (
    <div>
      {/* AB Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((opt) => {
          const isSelected = selected === opt.key;
          const isCorrect = opt.key === correct;
          let borderColor = "border-transparent";
          let diamondColor = "#6B21A8";

          if (showResult) {
            if (isCorrect) {
              borderColor = "border-green-400";
              diamondColor = "#4ade80";
            } else if (isSelected && !isCorrect) {
              borderColor = "border-red-400";
              diamondColor = "#f87171";
            }
          } else if (isSelected) {
            borderColor = "border-accent";
            diamondColor = "#00D4FF";
          }

          return (
            <button
              key={opt.key}
              onClick={() => isAnswering && !isExplaining && onSelect(opt.key)}
              disabled={!isAnswering && !isExplaining}
              className={`relative rounded-2xl p-6 text-left transition-all duration-300 border-2 ${borderColor} ${
                isAnswering && !isExplaining ? "hover:border-accent/60 hover:scale-[1.02] cursor-pointer" : ""
              } ${isSelected && !showResult ? "scale-[1.02]" : ""}`}
              style={{ backgroundColor: "#6B21A8" + (isSelected ? "ff" : "cc") }}
            >
              {/* Diamond + label */}
              <div className="flex items-center gap-2 mb-3">
                <Diamond color={diamondColor} />
                <span className="text-white/60 text-sm font-bold">{opt.key}</span>
                {showResult && isCorrect && (
                  <span className="ml-auto text-green-400 text-sm font-bold">Správná odpověď</span>
                )}
              </div>

              {/* Image */}
              {opt.image_url && (
                <div className="mb-3 rounded-xl overflow-hidden">
                  <img src={opt.image_url} alt={`Možnost ${opt.key}`} className="w-full h-40 object-cover" />
                </div>
              )}

              {/* Text */}
              <p className="text-white text-lg leading-relaxed">{opt.text}</p>

              {/* Selection indicator */}
              {isSelected && !showResult && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation field - zobrazí se v "explaining" fázi, čeká na odeslání před vyhodnocením */}
      {requiresExplanation && selected && !explanationSent && (isExplaining || isAnswering) && (
        <div className="mt-4 p-4 bg-primary/10 rounded-xl border border-primary/20 animate-fade-in">
          <p className="text-foreground/70 text-sm mb-2">
            {explanationPrompt || "Proč sis vybral/a tuto možnost?"}
          </p>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Napiš svůj důvod..."
            rows={3}
            className="w-full py-3 px-4 bg-background border border-primary/30 rounded-xl text-white outline-none resize-none focus:border-accent transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-foreground/30 text-xs">
              {explanation.trim().split(/\s+/).filter(Boolean).length} slov
            </span>
            <button
              onClick={handleExplanationSubmit}
              disabled={explanation.trim().split(/\s+/).filter(Boolean).length < 3}
              className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-30 text-background font-semibold rounded-lg text-sm transition-colors"
            >
              Odeslat
            </button>
          </div>
        </div>
      )}

      {explanationSent && (
        <div className="mt-4 p-3 bg-green-400/10 rounded-xl text-center animate-fade-in">
          <p className="text-green-400 text-sm font-medium">Tvoje vysvětlení bylo odesláno</p>
        </div>
      )}
    </div>
  );
}
