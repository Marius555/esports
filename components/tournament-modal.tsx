"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Dialog, DialogPortal, DialogBackdrop } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Question } from "@/app/api/tournament/[game]/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwipeAnswer {
  questionId: string;
  answer: boolean;
}

export interface TournamentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
  questions: Question[];
  tournamentId: string;
  accent: string;
  logoUrl: string;
}

// ─── SwipeCard ────────────────────────────────────────────────────────────────


function SwipeCard({
  question,
  onAnswer,
  accent,
  flyDir,
  logoUrl,
}: {
  question: Question;
  onAnswer: (yes: boolean) => void;
  accent: string;
  flyDir: "left" | "right" | null;
  logoUrl: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const startXRef = useRef<number>(0);

  const hasImage = !!question.referenceImageUrl && !imgError;

  // While flying out, override the drag transform with exit transform
  const cardStyle: CSSProperties = flyDir
    ? {
        transform:
          flyDir === "right"
            ? "translateX(140%) rotate(28deg)"
            : "translateX(-140%) rotate(-28deg)",
        opacity: 0,
        transition: "transform 0.38s ease-in, opacity 0.22s ease-in",
        pointerEvents: "none",
      }
    : {
        transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
        transition: isDragging
          ? "none"
          : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      };

  const yesOpacity = !flyDir && dragX > 0 ? Math.min(dragX / 80, 1) : 0;
  const noOpacity = !flyDir && dragX < 0 ? Math.min(Math.abs(dragX) / 80, 1) : 0;

  const commit = (dx: number) => {
    setIsDragging(false);
    setDragX(0);
    if (dx > 90) onAnswer(true);
    else if (dx < -90) onAnswer(false);
  };

  // ── Pointer events (desktop) ──
  const onPointerDown = (e: React.PointerEvent) => {
    // Don't capture pointer when clicking a button — that breaks button clicks
    if ((e.target as HTMLElement).closest("button")) return;
    if (flyDir) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || flyDir) return;
    setDragX(e.clientX - startXRef.current);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    commit(e.clientX - startXRef.current);
  };

  // ── Touch events (mobile) ──
  const onTouchStart = (e: React.TouchEvent) => {
    if (flyDir) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || flyDir) return;
    setDragX(e.touches[0].clientX - startXRef.current);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    commit(e.changedTouches[0].clientX - startXRef.current);
  };

  return (
    <div
      style={cardStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        if (isDragging) commit(e.clientX - startXRef.current);
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative rounded-2xl border border-border bg-card text-card-foreground shadow-xl overflow-hidden select-none"
    >
      {/* YES indicator */}
      <div
        className="pointer-events-none absolute left-4 top-5 z-10 rounded-xl border-4 border-green-500 px-3 py-1 rotate-[-12deg]"
        style={{ opacity: yesOpacity }}
      >
        <span className="text-green-400 font-black text-2xl tracking-wider">YES</span>
      </div>

      {/* NO indicator */}
      <div
        className="pointer-events-none absolute right-4 top-5 z-10 rounded-xl border-4 border-red-500 px-3 py-1 rotate-[12deg]"
        style={{ opacity: noOpacity }}
      >
        <span className="text-red-400 font-black text-2xl tracking-wider">NO</span>
      </div>

      {/* Image */}
      <div className="relative h-52 bg-muted flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at center, ${accent}44 0%, transparent 70%)`,
          }}
        />
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.referenceImageUrl}
            alt={question.referenceName}
            className="relative z-10 h-36 w-36 object-contain drop-shadow-lg"
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="game logo"
            className="relative z-10 h-24 w-24 object-contain"
            style={{ filter: `drop-shadow(0 0 12px ${accent})`, opacity: 0.85 }}
            draggable={false}
          />
        )}
      </div>

      {/* Content */}
      <div className="px-6 pt-5 pb-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
          style={{ color: accent }}
        >
          {question.referenceType === "player"
            ? "Player Question"
            : question.referenceType === "team"
            ? "Team Question"
            : question.referenceType === "match"
            ? "Match Outcome"
            : "Tournament"}
        </p>
        <p className="text-base font-semibold leading-snug text-foreground text-center">
          {question.questionText}
        </p>
        <p className="text-xs text-muted-foreground text-center mt-2 truncate">
          {question.referenceName}
        </p>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/50 mt-1 mb-3">
        Swipe right = YES · Swipe left = NO
      </p>

      {/* Buttons — pointer-down on buttons is excluded from drag capture above */}
      <div className="flex gap-3 px-6 pb-5">
        <Button
          variant="outline"
          size="lg"
          className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 font-bold tracking-wide"
          onClick={() => onAnswer(false)}
        >
          ✗ NO
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 font-bold tracking-wide"
          onClick={() => onAnswer(true)}
        >
          ✓ YES
        </Button>
      </div>
    </div>
  );
}

// ─── TournamentModal ──────────────────────────────────────────────────────────

export function TournamentModal({
  open,
  onClose,
  onSubmitSuccess,
  questions,
  tournamentId,
  accent,
  logoUrl,
}: TournamentModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flyDir, setFlyDir] = useState<"left" | "right" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Use refs to avoid stale closures inside setTimeout
  const answersRef = useRef<SwipeAnswer[]>([]);
  const flyingRef = useRef(false);

  const submitAnswers = async (finalAnswers: SwipeAnswer[]) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournament/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, answers: finalAnswers }),
      });
      if (!res.ok) throw new Error("Submission failed");
      onSubmitSuccess?.();
    } catch (err) {
      console.error("Failed to submit answers:", err);
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  };

  const handleAnswer = useCallback(
    (answer: boolean) => {
      // Guard: ignore if animation already in progress
      if (flyingRef.current) return;
      flyingRef.current = true;

      // Trigger exit animation
      setFlyDir(answer ? "right" : "left");

      // Capture values now (currentIndex is stable for this render)
      const idx = currentIndex;
      const qId = questions[idx].$id;
      const newAnswers = [...answersRef.current, { questionId: qId, answer }];
      answersRef.current = newAnswers;

      setTimeout(() => {
        setFlyDir(null);
        flyingRef.current = false;

        if (idx + 1 < questions.length) {
          setCurrentIndex(idx + 1);
        } else {
          submitAnswers(newAnswers);
        }
      }, 400); // matches animation duration
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, questions, tournamentId]
  );

  const progressPct =
    questions.length > 0
      ? Math.round((currentIndex / questions.length) * 100)
      : 0;

  const currentQuestion = questions[currentIndex];

  return (
    <Dialog
      open={open}
      onOpenChange={() => {}}
    >
      <DialogPortal>
        <DialogBackdrop className="bg-black/80 backdrop-blur-md" />

        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-sm outline-none">
            {done ? (
              /* ── Done screen ── */
              <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl flex flex-col items-center gap-4 py-10 px-6 text-center">
                <div className="text-6xl">🎯</div>
                <h3 className="font-heading text-2xl font-bold text-foreground">
                  Forecasts Submitted!
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your {questions.length} predictions have been locked in. Check
                  back after matches complete to see your score.
                </p>
                <Button
                  variant="default"
                  size="lg"
                  className="w-full mt-2"
                  style={{ background: accent, borderColor: accent }}
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            ) : submitting ? (
              /* ── Submitting screen ── */
              <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl flex flex-col items-center gap-4 py-10 px-6 text-center">
                <div
                  className="h-12 w-12 rounded-full border-4 animate-spin"
                  style={{ borderColor: accent, borderTopColor: "transparent" }}
                />
                <p className="text-muted-foreground text-sm">
                  Saving your forecasts…
                </p>
              </div>
            ) : currentQuestion ? (
              /* ── Question cards ── */
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-foreground">
                    Question{" "}
                    <span style={{ color: accent }}>{currentIndex + 1}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {questions.length}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={onClose}
                  >
                    Exit
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%`, background: accent }}
                  />
                </div>

                {/*
                  key=currentIndex ensures the div remounts on each question,
                  triggering the card-enter animation defined in globals.css
                */}
                <div
                  key={currentIndex}
                  style={{
                    animation: "card-enter 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <SwipeCard
                    question={currentQuestion}
                    onAnswer={handleAnswer}
                    accent={accent}
                    flyDir={flyDir}
                    logoUrl={logoUrl}
                  />
                </div>
              </div>
            ) : null}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPortal>
    </Dialog>
  );
}
