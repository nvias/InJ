"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Lesson, Activity, LessonActivityWithActivity } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPE_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  quiz: { emoji: "🎯", label: "Kvíz", color: "bg-accent/20 text-accent border-accent/40" },
  open: { emoji: "✍️", label: "Brainstorm", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
  peer_review: { emoji: "🗳️", label: "Hlasování", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
  group_work: { emoji: "👥", label: "Skupinová práce", color: "bg-green-400/20 text-green-300 border-green-400/40" },
  photo_upload: { emoji: "📸", label: "Foto", color: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40" },
  video_upload: { emoji: "🎥", label: "Video", color: "bg-rose-400/20 text-rose-300 border-rose-400/40" },
  ab_decision: { emoji: "⚖️", label: "AB Decision", color: "bg-blue-400/20 text-blue-300 border-blue-400/40" },
  ab_with_explanation: { emoji: "📝", label: "AB + Vysvětlení", color: "bg-blue-400/20 text-blue-300 border-blue-400/40" },
  scale: { emoji: "📊", label: "Škála", color: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40" },
  team_forge: { emoji: "🛡️", label: "Team Forge", color: "bg-purple-400/20 text-purple-300 border-purple-400/40" },
  pitch_duel: { emoji: "🎤", label: "Pitch Duel", color: "bg-pink-400/20 text-pink-300 border-pink-400/40" },
};

function badgeFor(type: string) {
  return TYPE_BADGE[type] ?? { emoji: "📦", label: type, color: "bg-primary/20 text-foreground/60 border-primary/40" };
}

function durationOf(la: LessonActivityWithActivity): number {
  return la.custom_duration_min ?? la.activity.default_duration_min ?? 0;
}

export default function LessonEditorPage({ params }: { params: { id: string } }) {
  const [authorized, setAuthorized] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [items, setItems] = useState<LessonActivityWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: lRow }, { data: laRows }] = await Promise.all([
      supabase.from("lessons").select("*").eq("id", params.id).single(),
      supabase
        .from("lesson_activities")
        .select("*, activity:activities(*)")
        .eq("lesson_id", params.id)
        .order("order_index", { ascending: true }),
    ]);
    if (lRow) {
      setLesson(lRow);
      setTitleDraft(lRow.title);
    }
    setItems((laRows ?? []) as LessonActivityWithActivity[]);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (localStorage.getItem("ucitel-auth") !== "true") {
      router.replace("/ucitel");
      return;
    }
    setAuthorized(true);
    load();
  }, [router, load]);

  async function persistOrder(newItems: LessonActivityWithActivity[]) {
    setSavingOrder(true);
    const updates = newItems.map((it, idx) =>
      supabase.from("lesson_activities").update({ order_index: idx + 1 }).eq("id", it.id)
    );
    await Promise.all(updates);
    setSavingOrder(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx).map((it, i) => ({ ...it, order_index: i + 1 }));
    setItems(next);
    persistOrder(next);
  }

  function moveBy(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const next = arrayMove(items, idx, target).map((it, i) => ({ ...it, order_index: i + 1 }));
    setItems(next);
    persistOrder(next);
  }

  async function removeItem(linkId: string) {
    if (!confirm("Odebrat aktivitu z lekce? (Aktivita zůstane v knihovně.)")) return;
    await supabase.from("lesson_activities").delete().eq("id", linkId);
    const next = items.filter((it) => it.id !== linkId).map((it, i) => ({ ...it, order_index: i + 1 }));
    setItems(next);
    persistOrder(next);
  }

  async function openAddPicker() {
    const { data } = await supabase.from("activities").select("*").order("title");
    setAllActivities((data ?? []) as Activity[]);
    setShowAddPicker(true);
  }

  async function addActivity(activityId: string) {
    const nextOrder = items.length + 1;
    const { data, error } = await supabase
      .from("lesson_activities")
      .insert({
        lesson_id: params.id,
        activity_id: activityId,
        order_index: nextOrder,
        is_optional: false,
      })
      .select("*, activity:activities(*)")
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as LessonActivityWithActivity]);
    }
    setShowAddPicker(false);
  }

  async function saveTitle() {
    if (!lesson) return;
    if (titleDraft.trim().length === 0) return;
    await supabase.from("lessons").update({ title: titleDraft.trim() }).eq("id", lesson.id);
    setLesson({ ...lesson, title: titleDraft.trim() });
    setEditingTitle(false);
  }

  async function togglePublished() {
    if (!lesson) return;
    const next = !lesson.is_published;
    await supabase.from("lessons").update({ is_published: next }).eq("id", lesson.id);
    setLesson({ ...lesson, is_published: next });
  }

  async function deleteLesson() {
    if (!lesson) return;
    if (!confirm(`Opravdu smazat lekci „${lesson.title}"? Aktivity zůstanou v knihovně.`)) return;
    await supabase.from("lessons").delete().eq("id", lesson.id);
    router.push("/ucitel/lekce");
  }

  if (!authorized || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground/60">Načítání...</p>
      </main>
    );
  }
  if (!lesson) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div>
          <p className="text-foreground/60 mb-4">Lekce nenalezena.</p>
          <Link href="/ucitel/lekce" className="text-accent hover:underline">← Zpět na knihovnu</Link>
        </div>
      </main>
    );
  }

  const totalDuration = items.reduce((s, it) => s + durationOf(it), 0);
  const inLessonIds = new Set(items.map((it) => it.activity_id));

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-primary/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/ucitel/dashboard" className="text-xl font-bold text-accent">Cesta inovátora</Link>
          <Link href="/ucitel/lekce" className="text-sm text-foreground/60 hover:text-foreground transition-colors">
            &larr; Knihovna lekcí
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Header / meta */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {lesson.lesson_number != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-mono">
                L{lesson.lesson_number}
              </span>
            )}
            {lesson.phase != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300">
                Fáze {lesson.phase}
              </span>
            )}
            <button
              onClick={togglePublished}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                lesson.is_published
                  ? "bg-green-400/20 text-green-300 hover:bg-green-400/30"
                  : "bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30"
              }`}
            >
              {lesson.is_published ? "Publikováno" : "Koncept (skryto)"}
            </button>
          </div>

          {editingTitle ? (
            <div className="flex gap-2 mb-3">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(lesson.title); setEditingTitle(false); } }}
                autoFocus
                className="flex-1 text-3xl font-bold bg-background border-2 border-accent/40 rounded-xl px-4 py-2 text-white outline-none"
              />
              <button onClick={saveTitle} className="px-4 py-2 bg-accent text-background font-bold rounded-xl">Uložit</button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1
                onClick={() => setEditingTitle(true)}
                className="text-3xl font-bold text-white cursor-pointer hover:text-accent transition-colors flex-1"
                title="Kliknutím přejmenuj"
              >
                {lesson.title}
              </h1>
              <Link
                href={`/ucitel/session/nova?lesson=${lesson.id}`}
                className="flex-shrink-0 px-5 py-2.5 bg-accent hover:bg-accent/80 text-background font-bold rounded-xl transition-colors text-sm"
              >
                ▶ Spustit pro třídu
              </Link>
            </div>
          )}

          {lesson.learning_goal && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
              <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Cíl lekce</div>
              <p className="text-sm text-foreground/80">{lesson.learning_goal}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background/50 border border-primary/20 rounded-lg p-3">
              <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Aktivit</div>
              <div className="text-white font-bold mt-1">{items.length}</div>
            </div>
            <div className="bg-background/50 border border-primary/20 rounded-lg p-3">
              <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Celková délka</div>
              <div className="text-white font-bold mt-1">{lesson.total_duration_min ?? totalDuration} min</div>
            </div>
            <div className="bg-background/50 border border-primary/20 rounded-lg p-3">
              <div className="text-foreground/40 uppercase tracking-wider text-[10px]">Stav</div>
              <div className="text-white font-bold mt-1">{savingOrder ? "Ukládám…" : "✓"}</div>
            </div>
          </div>
        </div>

        {/* Aktivity v lekci */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Aktivity v lekci</h2>
            <div className="flex gap-2">
              <button
                onClick={openAddPicker}
                className="px-3 py-1.5 text-sm bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors font-medium"
              >
                + Přidat z knihovny
              </button>
              <Link
                href="/ucitel/aktivity"
                className="px-3 py-1.5 text-sm border border-primary/40 text-foreground/70 hover:text-white rounded-lg transition-colors"
              >
                Nová aktivita
              </Link>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-primary/30 rounded-xl">
              <p className="text-foreground/40">Lekce zatím nemá žádnou aktivitu.</p>
              <button
                onClick={openAddPicker}
                className="mt-3 px-4 py-2 bg-accent text-background font-semibold rounded-lg"
              >
                + Přidat první aktivitu
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <SortableRow
                      key={it.id}
                      item={it}
                      index={idx}
                      total={items.length}
                      onMoveUp={() => moveBy(idx, -1)}
                      onMoveDown={() => moveBy(idx, 1)}
                      onRemove={() => removeItem(it.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        {/* Smazat lekci */}
        <div className="mt-12 pt-6 border-t border-primary/20 flex justify-end">
          <button
            onClick={deleteLesson}
            className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
          >
            Smazat lekci
          </button>
        </div>
      </div>

      {/* Activity picker modal */}
      {showAddPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddPicker(false)}>
          <div className="bg-background border border-primary/40 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Přidat aktivitu z knihovny</h2>
              <button onClick={() => setShowAddPicker(false)} className="text-foreground/40 hover:text-white">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {allActivities.length === 0 && (
                <p className="text-foreground/40 text-sm">Knihovna je prázdná.</p>
              )}
              {allActivities.map((a) => {
                const inLesson = inLessonIds.has(a.id);
                const badge = badgeFor(a.type);
                return (
                  <button
                    key={a.id}
                    disabled={inLesson}
                    onClick={() => addActivity(a.id)}
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      inLesson
                        ? "border-primary/20 bg-primary/5 opacity-50 cursor-not-allowed"
                        : "border-primary/30 hover:border-accent/50 hover:bg-accent/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider whitespace-nowrap ${badge.color}`}>
                        {badge.emoji} {badge.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium">{a.title}</div>
                        {a.description && <div className="text-foreground/50 text-xs mt-0.5 line-clamp-2">{a.description}</div>}
                        <div className="text-foreground/40 text-[10px] mt-1">
                          {a.default_duration_min ? `${a.default_duration_min} min · ` : ""}
                          {a.questions?.length ? `${a.questions.length} otázek` : ""}
                          {inLesson && " · již v lekci"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SortableRow({
  item, index, total, onMoveUp, onMoveDown, onRemove,
}: {
  item: LessonActivityWithActivity;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const badge = badgeFor(item.activity.type);
  const dur = durationOf(item);

  return (
    <li ref={setNodeRef} style={style} className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="hidden md:flex flex-shrink-0 w-6 h-10 items-center justify-center text-foreground/30 hover:text-foreground/70 cursor-grab active:cursor-grabbing"
        title="Tažením změň pořadí"
        aria-label="Tažením změň pořadí"
      >
        ⋮⋮
      </button>

      {/* Order number */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-sm">
        {index + 1}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.color}`}>
            {badge.emoji} {badge.label}
          </span>
          {dur > 0 && <span className="text-[10px] text-foreground/50">⏱ {dur} min</span>}
          {item.is_optional && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300">volitelné</span>}
        </div>
        <Link
          href={`/ucitel/aktivita/${item.activity.id}`}
          className="text-white font-semibold hover:text-accent transition-colors block truncate"
        >
          {item.activity.title}
        </Link>
        {item.teacher_note && (
          <p className="text-xs text-foreground/40 mt-0.5 italic truncate">📝 {item.teacher_note}</p>
        )}
      </div>

      {/* Mobile arrows + remove */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="md:hidden p-2 text-foreground/40 hover:text-white disabled:opacity-30"
          aria-label="Posunout nahoru"
        >▲</button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="md:hidden p-2 text-foreground/40 hover:text-white disabled:opacity-30"
          aria-label="Posunout dolů"
        >▼</button>
        <button
          onClick={onRemove}
          className="p-2 text-foreground/40 hover:text-red-400 transition-colors"
          title="Odebrat z lekce"
          aria-label="Odebrat aktivitu z lekce"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
