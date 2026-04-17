"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TournamentSummary } from "@/app/api/user/tournaments/route";

const GAME_LABEL: Record<string, string> = {
  dota2: "Dota 2",
  leagueoflegends: "League of Legends",
  counterstrike: "CS2",
};

const GAME_COLOR: Record<string, string> = {
  dota2: "#e84c21",
  leagueoflegends: "#C89B3C",
  counterstrike: "#f5a623",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TournamentsTable({ userId }: { userId: string }) {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/user/tournaments");
      if (!res.ok) return;
      const data = (await res.json()) as { tournaments: TournamentSummary[] };
      setTournaments(data.tournaments);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/user/tournaments/refresh", { method: "POST" });
      await fetchTournaments();
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false);
    }
  };

  const handleRowClick = (tournamentId: string) => {
    router.push(`/auth/${userId}/dashboard/${tournamentId}`);
  };

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div>
          <h2 className="font-heading font-bold text-base tracking-tight">
            My Tournaments
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click a row to view your results
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing}
          className="gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Results
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2 p-5 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-4">
          <p className="text-muted-foreground text-sm">
            You haven&apos;t entered any tournaments yet.
          </p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Enter a tournament from the cards above to get started.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tournament</TableHead>
              <TableHead>Game</TableHead>
              <TableHead className="text-center">Questions</TableHead>
              <TableHead className="text-center text-green-500">Correct</TableHead>
              <TableHead className="text-center text-red-500">Wrong</TableHead>
              <TableHead className="text-center text-muted-foreground">Pending</TableHead>
              <TableHead>Resolves</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tournaments.map((t) => {
              const accent = GAME_COLOR[t.game] ?? "#888";
              return (
                <TableRow
                  key={t.tournamentId}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => handleRowClick(t.tournamentId)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: accent, boxShadow: `0 0 5px ${accent}` }}
                      />
                      <span className="font-mono text-xs text-foreground font-medium">
                        {t.tournamentId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: accent + "22", color: accent }}
                    >
                      {GAME_LABEL[t.game] ?? t.game}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {t.answeredQuestions}/{t.totalQuestions}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-500 font-bold text-sm tabular-nums">
                      {t.correctAnswers}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-red-500 font-bold text-sm tabular-nums">
                      {t.wrongAnswers}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {t.pending}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(t.resolveBy)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
