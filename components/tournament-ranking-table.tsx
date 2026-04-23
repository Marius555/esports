"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TournamentModal } from "@/components/tournament-modal";
import { LimitReachedModal } from "@/components/limit-reached-modal";
import type { Question, TournamentResponse, TournamentWaitingResponse, TournamentExpiredResponse, TournamentStatusResponse } from "@/app/api/tournament/[game]/route";
import type { RankingEntry, RankingsResponse } from "@/app/api/tournament/[game]/rankings/route";

type Tier = "free" | "pro" | "max";

const PRIZES = ["€25", "€15", "€10"];

const GAME_CONFIG = {
  dota2:        { label: "Dota 2",   accent: "#e84c21", logo: "/logos/dota2.svg"        },
  valorant:     { label: "Valorant", accent: "#FF4655", logo: "/logos/valorant.svg"     },
  counterstrike:{ label: "CS2",      accent: "#f5a623", logo: "/logos/counterstrike.svg" },
} as const;

type GameKey = keyof typeof GAME_CONFIG;

const RANK_LABELS = ["🥇", "🥈", "🥉"];
const RANK_STYLES = [
  { bg: "from-yellow-500/[0.12]", border: "border-l-2 border-yellow-500/40" },
  { bg: "from-slate-400/[0.10]",  border: "border-l-2 border-slate-400/40"  },
  { bg: "from-amber-700/[0.10]",  border: "border-l-2 border-amber-700/40"  },
];

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

function useCountdown(targetIso: string | null) {
  const [ms, setMs] = useState<number>(() =>
    targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0
  );

  useEffect(() => {
    if (!targetIso) { setMs(0); return; }
    const update = () => setMs(Math.max(0, new Date(targetIso).getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── State machine ────────────────────────────────────────────────────────────

type BtnState = "loading" | "ended" | "enter" | "continue" | "waiting" | "start" | "limit";

interface BtnConfig {
  state: BtnState;
  line1: string;
  line2?: string;        // countdown or round type label
  disabled: boolean;
  onClick?: () => void;
}

function resolveButtonConfig(
  status: TournamentStatusResponse | null,
  entering: boolean,
  countdown: string | null,
  onEnter: () => void,
  onGetRound: () => void,
): BtnConfig {
  if (entering || !status) {
    return { state: "loading", line1: "Loading…", disabled: true };
  }
  if (status.isExpired) {
    return { state: "ended", line1: "Ended", disabled: true };
  }
  if (status.planLimitExceeded) {
    return { state: "limit", line1: "Plan limit reached", line2: "Upgrade to continue", disabled: true };
  }
  if (!status.hasEntered) {
    return { state: "enter", line1: "Enter Tournament", disabled: false, onClick: onEnter };
  }

  const round = status.latestRound;

  if (!round || !round.completedAt) {
    return {
      state: "continue",
      line1: "Continue",
      line2: `Round ${round?.roundNumber ?? 1}`,
      disabled: false,
      onClick: onGetRound,
    };
  }

  if (countdown) {
    return {
      state: "waiting",
      line1: "Next round in",
      line2: countdown,
      disabled: true,
    };
  }

  const nextRound = round.roundNumber + 1;
  return {
    state: "start",
    line1: `Start Round ${nextRound}`,
    line2: nextRound % 2 === 0 ? "Esports" : "Skill",
    disabled: false,
    onClick: onGetRound,
  };
}

// ─── Tournament action button ─────────────────────────────────────────────────

function TournamentButton({
  status,
  entering,
  accent,
  onEnter,
  onGetRound,
}: {
  status: TournamentStatusResponse | null;
  entering: boolean;
  accent: string;
  onEnter: () => void;
  onGetRound: () => void;
}) {
  const nextRoundAt = status?.latestRound?.completedAt && !status?.isExpired
    ? (status.latestRound.nextRoundAvailableAt ?? null)
    : null;
  const countdown = useCountdown(nextRoundAt);

  const cfg = resolveButtonConfig(status, entering, countdown, onEnter, onGetRound);

  // ── "Ended" badge ──────────────────────────────────────────────────────────
  if (cfg.state === "ended") {
    return (
      <span
        key="ended"
        className="btn-content-in text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded border"
        style={{ color: accent, borderColor: `${accent}40`, background: `${accent}11` }}
      >
        Ended
      </span>
    );
  }

  // ── Shared button shell — always rendered; content inside animates ─────────
  const isAccent  = cfg.state === "enter" || cfg.state === "continue" || cfg.state === "start";
  const isWaiting = cfg.state === "waiting";
  const isLoading = cfg.state === "loading";
  const isLimit   = cfg.state === "limit";

  const shellStyle: React.CSSProperties = {
    transition: "background-color 280ms ease, border-color 280ms ease, color 280ms ease, box-shadow 280ms ease, opacity 280ms ease",
    ...(isAccent
      ? { background: accent, borderColor: accent, color: "#fff",
          boxShadow: `0 0 14px ${accent}44` }
      : isWaiting
      ? { background: "transparent", borderColor: `${accent}55`, color: accent }
      : isLimit
      ? { background: "transparent", borderColor: "rgba(161,161,170,0.3)", color: "var(--muted-foreground)", opacity: 0.7 }
      : { background: "transparent", borderColor: "transparent", color: "var(--muted-foreground)", opacity: 0.6 }
    ),
  };

  return (
    <button
      disabled={cfg.disabled}
      onClick={cfg.disabled ? undefined : cfg.onClick}
      className="relative h-8 min-w-[148px] rounded-md border px-3 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 overflow-hidden"
      style={shellStyle}
    >
      {/* Inner content — keyed on state so it animates in on each state change */}
      <span
        key={cfg.state}
        className="btn-content-in flex items-center justify-center gap-1.5 whitespace-nowrap"
      >
        {isLoading && (
          <span
            className="inline-block h-3 w-3 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: "currentColor", borderTopColor: "transparent" }}
          />
        )}

        {isWaiting || isLimit ? (
          /* Waiting / Limit: two-line stacked layout */
          <span className="flex flex-col items-center leading-none gap-0.5">
            <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">{cfg.line1}</span>
            <span className={isLimit ? "text-[9px] font-semibold tracking-wide" : "text-xs font-mono font-black tabular-nums tracking-tight"}>{cfg.line2}</span>
          </span>
        ) : cfg.state === "continue" || cfg.state === "start" ? (
          /* Continue / Start: primary label + dimmed sub-label */
          <span className="flex items-center gap-1.5">
            <span>{cfg.line1}</span>
            {cfg.line2 && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}
              >
                {cfg.line2}
              </span>
            )}
          </span>
        ) : (
          /* Enter / Loading */
          <span>{cfg.line1}</span>
        )}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TournamentRankingTable({
  game,
  userId,
  tier = "free",
  onTournamentEntered,
}: {
  game: GameKey;
  userId: string;
  tier?: Tier;
  onTournamentEntered?: () => void;
}) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveBy, setResolveBy] = useState("");
  const [resolved, setResolved] = useState(false);
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  const [status, setStatus] = useState<TournamentStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [modalTournamentId, setModalTournamentId] = useState<string | null>(null);
  const [modalRoundNumber, setModalRoundNumber] = useState(1);
  const [modalRoundType, setModalRoundType] = useState<"skill" | "esports">("skill");
  const [showModal, setShowModal] = useState(false);
  const [entering, setEntering] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const cfg = GAME_CONFIG[game];

  // Track nextRoundAvailableAt so we can re-check when countdown ends
  const nextRoundAtRef = useRef<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setRankings([]);
    setTournamentId(null);
    setResolveBy("");
    setResolved(false);
    try {
      const res = await fetch(`/api/tournament/${game}/rankings`);
      if (!res.ok) return;
      const data = (await res.json()) as RankingsResponse;
      setRankings(data.rankings);
      setTournamentId(data.tournamentId);
      setResolveBy(data.resolveBy ?? "");
      setResolved(data.resolved ?? false);
    } catch { /* silently ignore */ }
    finally { setLoading(false); }
  }, [game]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/tournament/${game}`);
      if (!res.ok) return;
      const data = (await res.json()) as TournamentStatusResponse;
      setStatus(data);
      nextRoundAtRef.current = data.latestRound?.nextRoundAvailableAt ?? null;
    } catch { /* silently ignore */ }
    finally { setStatusLoading(false); }
  }, [game]);

  useEffect(() => {
    fetchRankings();
    fetchStatus();
  }, [fetchRankings, fetchStatus]);

  // When countdown ends, re-fetch status to show the "Start Round" button
  useEffect(() => {
    const target = status?.latestRound?.nextRoundAvailableAt;
    if (!target) return;
    const ms = new Date(target).getTime() - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(() => fetchStatus(), ms + 500);
    return () => clearTimeout(id);
  }, [status?.latestRound?.nextRoundAvailableAt, fetchStatus]);

  const loadRoundQuestions = async () => {
    setEntering(true);
    try {
      const res = await fetch(`/api/tournament/${game}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; limitReached?: boolean };
        if (body.limitReached) { setShowLimitModal(true); return; }
        throw new Error(body.error ?? "Failed");
      }
      const body = await res.json() as TournamentResponse | TournamentWaitingResponse | TournamentExpiredResponse;

      if ("waiting" in body) {
        // Refresh status — countdown will show
        await fetchStatus();
        return;
      }
      if ("expired" in body) {
        await fetchStatus();
        return;
      }

      const resp = body as TournamentResponse;
      setQuestions(resp.questions);
      setKnowledgeCount(resp.knowledgeCount ?? 0);
      setModalTournamentId(resp.tournamentId);
      setModalRoundNumber(resp.roundNumber);
      setModalRoundType(resp.roundType);
      setShowModal(true);
      // Optimistically update status
      await fetchStatus();
    } catch (e) {
      console.error("Failed to load round:", e);
    } finally {
      setEntering(false);
    }
  };

  const handleSubmitSuccess = async (nextRoundAvailableAt: string) => {
    setQuestions(null);
    setKnowledgeCount(0);
    setModalTournamentId(null);
    onTournamentEntered?.();
    // Update status with completed round info
    setStatus((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hasEntered: true,
        latestRound: {
          roundNumber: modalRoundNumber,
          roundType: modalRoundType,
          completedAt: new Date().toISOString(),
          nextRoundAvailableAt,
        },
      };
    });
    fetchRankings();
  };

  const winner = resolved && rankings.length > 0 ? rankings[0] : null;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.logo} alt={cfg.label} className="h-5 w-5 object-contain shrink-0" style={{ filter: `drop-shadow(0 0 5px ${cfg.accent})` }} />
          <div>
            <h2 className="font-heading font-bold text-base tracking-tight">{cfg.label} Tournament Standings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tournamentId
                ? resolved
                  ? `Ended ${formatDate(resolveBy)}`
                  : `Resolves ${formatDate(resolveBy)}`
                : "No active tournament"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {resolved ? (
            <span
              className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border"
              style={{ color: cfg.accent, borderColor: `${cfg.accent}40`, background: `${cfg.accent}11` }}
            >
              Ended
            </span>
          ) : (
            <TournamentButton
              status={statusLoading ? null : status}
              entering={entering}
              accent={cfg.accent}
              onEnter={loadRoundQuestions}
              onGetRound={loadRoundQuestions}
            />
          )}
        </div>
      </div>

      {/* Winner banner */}
      {winner && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/60" style={{ background: `${cfg.accent}0d` }}>
          <span className="text-2xl">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tournament Winner</p>
            <p className="text-sm font-bold text-foreground truncate">
              {winner.displayName}
              <span className="text-muted-foreground font-normal ml-2">{winner.correctAnswers} correct / {winner.totalAnswers} answered</span>
            </p>
          </div>
          {winner.userId === userId && (
            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `${cfg.accent}33`, color: cfg.accent }}>You!</span>
          )}
        </div>
      )}

      {/* Prize banner */}
      <div className="flex items-center gap-5 px-5 py-2.5 border-b border-border/40" style={{ background: `${cfg.accent}11` }}>
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Prize Pool</span>
        <div className="flex items-center gap-4">
          {PRIZES.map((prize, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs">
              <span>{RANK_LABELS[i]}</span>
              <span className="font-bold" style={{ color: cfg.accent }}>{prize}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Round progress indicator for current user */}
      {status?.hasEntered && status.latestRound && (
        <div className="px-5 py-2 border-b border-border/30 flex items-center justify-between" style={{ background: `${cfg.accent}08` }}>
          <span className="text-xs text-muted-foreground">
            Your progress · Round {status.latestRound.roundNumber}
            {" "}
            <span style={{ color: status.latestRound.roundType === "skill" ? "#a78bfa" : cfg.accent }} className="font-semibold uppercase text-[10px] tracking-wider">
              {status.latestRound.roundType}
            </span>
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {status.latestRound.completedAt ? "Completed" : "In progress"}
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2 p-5 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted/60" />)}
        </div>
      ) : rankings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-4">
          <p className="text-muted-foreground text-sm">No participants yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Be the first to enter the {cfg.label} tournament!</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-center text-green-500">Correct</TableHead>
              <TableHead className="text-center">Answered</TableHead>
              <TableHead className="text-center">Rounds</TableHead>
              <TableHead className="text-center text-muted-foreground">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankings.map((entry) => {
              const rankIdx = entry.rank - 1;
              const isTopThree   = rankIdx < 3;
              const isCurrentUser = entry.userId === userId;
              const rankStyle    = isTopThree ? RANK_STYLES[rankIdx] : null;

              return (
                <TableRow
                  key={entry.userId}
                  className={[
                    rankStyle ? `bg-gradient-to-r ${rankStyle.bg} to-transparent ${rankStyle.border}` : "",
                    isCurrentUser ? "font-semibold" : "",
                    "transition-all",
                  ].filter(Boolean).join(" ")}
                >
                  <TableCell className="w-12 text-center">
                    {isTopThree
                      ? <span className="text-xl leading-none">{RANK_LABELS[rankIdx]}</span>
                      : <span className="text-sm tabular-nums text-muted-foreground font-mono">{entry.rank}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isCurrentUser ? "text-foreground" : "text-muted-foreground"}`}>{entry.displayName}</span>
                      {isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" style={{ background: `${cfg.accent}22`, color: cfg.accent }}>You</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-500 font-bold text-sm tabular-nums">{entry.correctAnswers}</span>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {entry.totalAnswers}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                    {entry.roundsCompleted}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground text-sm tabular-nums">{entry.pending}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {showModal && questions && modalTournamentId && (
        <TournamentModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSubmitSuccess={handleSubmitSuccess}
          questions={questions}
          knowledgeCount={knowledgeCount}
          tournamentId={modalTournamentId}
          roundNumber={modalRoundNumber}
          roundType={modalRoundType}
          accent={cfg.accent}
          logoUrl={cfg.logo}
        />
      )}

      <LimitReachedModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        onUpgradeSuccess={() => { setShowLimitModal(false); fetchRankings(); }}
        currentTier={tier}
      />
    </div>
  );
}
