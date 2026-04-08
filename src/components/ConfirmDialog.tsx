"use client";

// ═══════════════════════════════════════════════
// Styled confirm dialog — náhrada native window.confirm
// ═══════════════════════════════════════════════

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Potvrdit",
  cancelLabel = "Zrušit",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-pink-500 hover:bg-pink-400 text-white"
      : "bg-[#00D4FF] hover:bg-cyan-300 text-black";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0A0F2E] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-[0_0_60px_rgba(0,212,255,0.15)]"
      >
        <h3 className="text-xl font-black tracking-wider text-white mb-2">{title}</h3>
        {message && <p className="text-sm text-white/60 mb-6 leading-relaxed">{message}</p>}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm tracking-wider rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-bold"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm tracking-wider rounded-lg font-bold transition ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
