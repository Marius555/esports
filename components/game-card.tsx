"use client";

import { useState } from "react";
import type { Question } from "@/app/api/tournament/[game]/route";
import { TournamentModal } from "@/components/tournament-modal";
import { Button } from "@/components/ui/button";

const GAME_CONFIG = {
  dota2: {
    label: "Dota 2",
    banner: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
    gradientFrom: "#1a0a00",
    gradientTo: "#6b1a0e",
    accent: "#e84c21",
    logo: "/logos/dota2.svg",
  },
  leagueoflegends: {
    label: "League of Legends",
    banner: "https://static.lolesports.com/leagues/1592594612171_WorldsDark.png",
    gradientFrom: "#0a0e1a",
    gradientTo: "#1a2a0e",
    accent: "#C89B3C",
    logo: "/logos/leagueoflegends.svg",
  },
  counterstrike: {
    label: "CS2",
    banner: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
    gradientFrom: "#0a0f1a",
    gradientTo: "#0e1f2e",
    accent: "#f5a623",
    logo: "/logos/counterstrike.svg",
  },
} as const;

type GameKey = keyof typeof GAME_CONFIG;

export function GameCard({ game, onTournamentEntered }: { game: GameKey; onTournamentEntered?: () => void }) {
  const [showTournament, setShowTournament] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  const handleEnterTournament = async () => {
    if (questions && tournamentId) {
      setShowTournament(true);
      return;
    }
    setEntering(true);
    setEnterError(null);
    try {
      const res = await fetch(`/api/tournament/${game}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load tournament"
        );
      }
      const body = (await res.json()) as {
        tournamentId: string;
        questions: Question[];
      };
      setQuestions(body.questions);
      setTournamentId(body.tournamentId);
      setShowTournament(true);
    } catch (e) {
      setEnterError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setEntering(false);
    }
  };

  const cfg = GAME_CONFIG[game];

  return (
    <div className="rounded-2xl border bg-card text-card-foreground overflow-hidden flex flex-col shadow-sm">
      {/* Banner */}
      <div
        className="relative h-40 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cfg.gradientFrom}, ${cfg.gradientTo})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cfg.banner}
          alt={cfg.label}
          className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cfg.logo}
            alt={cfg.label}
            className="h-5 w-5 object-contain"
            style={{ filter: `drop-shadow(0 0 4px ${cfg.accent})` }}
          />
          <h2 className="font-heading font-bold text-lg tracking-tight text-white drop-shadow">
            {cfg.label}
          </h2>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4">
        <Button
          variant="default"
          size="lg"
          className="w-full font-bold tracking-wide"
          style={{ background: cfg.accent, borderColor: cfg.accent }}
          loading={entering}
          onClick={handleEnterTournament}
        >
          Enter Tournament
        </Button>
        {enterError && (
          <p className="text-xs text-destructive mt-1.5 px-1">{enterError}</p>
        )}
      </div>

      {showTournament && questions && tournamentId && (
        <TournamentModal
          open={showTournament}
          onClose={() => setShowTournament(false)}
          onSubmitSuccess={onTournamentEntered}
          questions={questions}
          tournamentId={tournamentId}
          accent={cfg.accent}
          logoUrl={cfg.logo}
        />
      )}
    </div>
  );
}
