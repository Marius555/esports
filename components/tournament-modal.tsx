"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Dialog, DialogPortal, DialogBackdrop } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Question } from "@/app/api/tournament/[game]/route";

const QUESTION_TIME = Math.max(
  5,
  parseInt(process.env.NEXT_PUBLIC_TIME_BETWEEN_QUESTIONS ?? "10", 10)
);

interface SwipeAnswer {
  questionId: string;
  answer: boolean;
  timeTaken: number;
}

export interface TournamentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess?: (nextRoundAvailableAt: string) => void;
  questions: Question[];
  knowledgeCount: number;
  tournamentId: string;
  roundNumber: number;
  roundType: "skill" | "esports";
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
  timeLeft,
}: {
  question: Question;
  onAnswer: (yes: boolean) => void;
  accent: string;
  flyDir: "left" | "right" | "timeout" | null;
  logoUrl: string;
  timeLeft: number;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgErrorB, setImgErrorB] = useState(false);
  const startXRef = useRef<number>(0);

  const isKnowledge = question.referenceType === "knowledge";
  const hasImage = !!question.referenceImageUrl && !imgError && !isKnowledge;
  const hasImageB = !!question.referenceImageUrlB && !imgErrorB && !isKnowledge;
  const isVsQuestion = hasImage && hasImageB;

  const cardStyle: CSSProperties = flyDir === "timeout"
    ? { opacity: 0, transform: "scale(0.92) translateY(16px)", transition: "all 0.35s ease-out", pointerEvents: "none" }
    : flyDir
    ? {
        transform: flyDir === "right" ? "translateX(140%) rotate(28deg)" : "translateX(-140%) rotate(-28deg)",
        opacity: 0,
        transition: "transform 0.38s ease-in, opacity 0.22s ease-in",
        pointerEvents: "none",
      }
    : {
        transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      };

  const yesOpacity = !flyDir && dragX > 0 ? Math.min(dragX / 80, 1) : 0;
  const noOpacity  = !flyDir && dragX < 0 ? Math.min(Math.abs(dragX) / 80, 1) : 0;

  const commit = (dx: number) => {
    setIsDragging(false);
    setDragX(0);
    if (dx > 90) onAnswer(true);
    else if (dx < -90) onAnswer(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (flyDir) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (!isDragging || flyDir) return; setDragX(e.clientX - startXRef.current); };
  const onPointerUp   = (e: React.PointerEvent) => { if (!isDragging) return; commit(e.clientX - startXRef.current); };
  const onTouchStart  = (e: React.TouchEvent)   => { if (flyDir) return; startXRef.current = e.touches[0].clientX; setIsDragging(true); };
  const onTouchMove   = (e: React.TouchEvent)   => { if (!isDragging || flyDir) return; setDragX(e.touches[0].clientX - startXRef.current); };
  const onTouchEnd    = (e: React.TouchEvent)   => { if (!isDragging) return; commit(e.changedTouches[0].clientX - startXRef.current); };

  const timerPct   = (timeLeft / QUESTION_TIME) * 100;
  const timerColor = timerPct > 50 ? "#22c55e" : timerPct > 20 ? "#eab308" : "#ef4444";

  const typeBadge = isKnowledge
    ? "Knowledge"
    : question.referenceType === "player"   ? "Player Question"
    : question.referenceType === "team"     ? "Team Question"
    : question.referenceType === "match"    ? "Match Outcome"
    : "Tournament";

  return (
    <div
      style={cardStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => { if (isDragging) commit(e.clientX - startXRef.current); }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative rounded-2xl border border-border bg-card text-card-foreground shadow-xl overflow-hidden select-none"
    >
      {/* Timer bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted/40 z-20">
        <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>

      <div
        className="absolute top-3 right-4 z-20 text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
        style={{ color: timerColor, background: `${timerColor}22` }}
      >
        {timeLeft}s
      </div>

      <div className="pointer-events-none absolute left-4 top-5 z-10 rounded-xl border-4 border-green-500 px-3 py-1 rotate-[-12deg]" style={{ opacity: yesOpacity }}>
        <span className="text-green-400 font-black text-2xl tracking-wider">YES</span>
      </div>
      <div className="pointer-events-none absolute right-4 top-5 z-10 rounded-xl border-4 border-red-500 px-3 py-1 rotate-[12deg]" style={{ opacity: noOpacity }}>
        <span className="text-red-400 font-black text-2xl tracking-wider">NO</span>
      </div>

      <div className="relative h-52 bg-muted flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at center, ${accent}44 0%, transparent 70%)` }} />
        {isVsQuestion ? (
          <div className="relative z-10 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={question.referenceImageUrl} alt={question.referenceName} className="h-20 w-20 object-contain drop-shadow-lg" draggable={false} onError={() => setImgError(true)} />
            <span className="text-[10px] font-black text-muted-foreground/50 tracking-[0.25em]">VS</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={question.referenceImageUrlB} alt="" className="h-20 w-20 object-contain drop-shadow-lg" draggable={false} onError={() => setImgErrorB(true)} />
          </div>
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={question.referenceImageUrl} alt={question.referenceName} className="relative z-10 h-36 w-36 object-contain drop-shadow-lg" draggable={false} onError={() => setImgError(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="game logo" className="relative z-10 h-24 w-24 object-contain" style={{ filter: `drop-shadow(0 0 12px ${accent})`, opacity: 0.85 }} draggable={false} />
        )}
      </div>

      <div className="px-6 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: isKnowledge ? "#a78bfa" : accent }}>
          {typeBadge}
        </p>
        <p className="text-base font-semibold leading-snug text-foreground text-center">{question.questionText}</p>
        <p className="text-xs text-muted-foreground text-center mt-2 truncate">{question.referenceName}</p>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/50 mt-1 mb-3">
        Swipe right = YES · Swipe left = NO · {QUESTION_TIME}s limit
      </p>

      <div className="flex gap-3 px-6 pb-5">
        <Button variant="outline" size="lg" className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 font-bold tracking-wide" onClick={() => onAnswer(false)}>✗ NO</Button>
        <Button variant="outline" size="lg" className="flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 font-bold tracking-wide" onClick={() => onAnswer(true)}>✓ YES</Button>
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
  knowledgeCount,
  tournamentId,
  roundNumber,
  roundType,
  accent,
  logoUrl,
}: TournamentModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flyDir, setFlyDir] = useState<"left" | "right" | "timeout" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);

  const answersRef = useRef<SwipeAnswer[]>([]);
  const flyingRef  = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef   = useRef<number>(Date.now());
  const handleTimeoutRef   = useRef<() => void>(() => {});

  const isSkill    = roundType === "skill";
  const roundLabel = isSkill ? `Round ${roundNumber} · Knowledge` : `Round ${roundNumber} · Forecasting`;
  const roundColor = isSkill ? "#a78bfa" : accent;

  const submitAnswers = async (finalAnswers: SwipeAnswer[]) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/tournament/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, roundNumber, answers: finalAnswers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data = await res.json() as { nextRoundAvailableAt?: string };
      setDone(true);
      onSubmitSuccess?.(data.nextRoundAvailableAt ?? new Date(Date.now() + 3600000).toISOString());
    } catch (err) {
      console.error("Failed to submit answers:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswer = useCallback(
    (answer: boolean) => {
      if (flyingRef.current) return;
      flyingRef.current = true;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const timeTaken = Math.min(Date.now() - questionStartRef.current, QUESTION_TIME * 1000);
      setFlyDir(answer ? "right" : "left");
      const idx = currentIndex;
      const qId = questions[idx].$id;
      const newAnswers = [...answersRef.current, { questionId: qId, answer, timeTaken }];
      answersRef.current = newAnswers;
      setTimeout(() => {
        setFlyDir(null);
        flyingRef.current = false;
        if (idx + 1 < questions.length) { setCurrentIndex(idx + 1); }
        else { submitAnswers(newAnswers); }
      }, 400);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, questions, tournamentId, roundNumber]
  );

  const handleTimeout = useCallback(() => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    setFlyDir("timeout");
    const idx = currentIndex;
    setTimeout(() => {
      setFlyDir(null);
      flyingRef.current = false;
      if (idx + 1 < questions.length) { setCurrentIndex(idx + 1); }
      else {
        if (answersRef.current.length > 0) { submitAnswers(answersRef.current); }
        else { setDone(true); }
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, questions.length]);

  useEffect(() => { handleTimeoutRef.current = handleTimeout; }, [handleTimeout]);

  useEffect(() => {
    if (done || submitting) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIME);
    questionStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; handleTimeoutRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [currentIndex, done, submitting]);

  const progressPct = questions.length > 0 ? Math.round((currentIndex / questions.length) * 100) : 0;
  const currentQuestion = questions[currentIndex];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogPortal>
        <DialogBackdrop className="bg-black/80 backdrop-blur-md" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup className="relative w-full max-w-sm outline-none">
            {submitError ? (
              <div className="rounded-2xl border border-destructive/40 bg-card text-card-foreground shadow-xl flex flex-col items-center gap-4 py-10 px-6 text-center">
                <div className="text-5xl">⚠️</div>
                <h3 className="font-heading text-xl font-bold text-foreground">Submission Failed</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{submitError}</p>
                <Button variant="outline" size="lg" className="w-full mt-2 border-destructive/40 text-destructive" onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : done ? (
              <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl flex flex-col items-center gap-4 py-10 px-6 text-center">
                <div className="text-6xl">🎯</div>
                <h3 className="font-heading text-2xl font-bold text-foreground">Round Complete!</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Your {answersRef.current.length} answer{answersRef.current.length !== 1 ? "s" : ""} for Round {roundNumber} are locked in.
                  Your next round unlocks in 1 hour.
                </p>
                <Button variant="default" size="lg" className="w-full mt-2" style={{ background: accent, borderColor: accent }} onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : submitting ? (
              <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-xl flex flex-col items-center gap-4 py-10 px-6 text-center">
                <div className="h-12 w-12 rounded-full border-4 animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
                <p className="text-muted-foreground text-sm">Saving your answers…</p>
              </div>
            ) : currentQuestion ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: roundColor }}>
                      {roundLabel}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Question <span style={{ color: roundColor }}>{currentIndex + 1}</span>
                      <span className="text-muted-foreground"> / {questions.length}</span>
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={onClose}>Exit</Button>
                </div>

                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: roundColor }} />
                </div>

                <div key={currentIndex} style={{ animation: "card-enter 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
                  <SwipeCard
                    question={currentQuestion}
                    onAnswer={handleAnswer}
                    accent={roundColor}
                    flyDir={flyDir}
                    logoUrl={logoUrl}
                    timeLeft={timeLeft}
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
