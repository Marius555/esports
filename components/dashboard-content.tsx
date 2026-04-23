"use client";

import { useState } from "react";
import { GameCard } from "@/components/game-card";
import { TournamentRankingTable } from "@/components/tournament-ranking-table";

type GameKey = "dota2" | "valorant" | "counterstrike";
type Tier = "free" | "pro" | "max";

export function DashboardContent({ userId, tier = "free" }: { userId: string; tier?: Tier }) {
  const [selectedGame, setSelectedGame] = useState<GameKey>("dota2");

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="grid gap-4 md:grid-cols-3 items-start">
        <GameCard
          game="dota2"
          selected={selectedGame === "dota2"}
          onSelect={() => setSelectedGame("dota2")}
        />
        <GameCard
          game="valorant"
          selected={selectedGame === "valorant"}
          onSelect={() => setSelectedGame("valorant")}
        />
        <GameCard
          game="counterstrike"
          selected={selectedGame === "counterstrike"}
          onSelect={() => setSelectedGame("counterstrike")}
        />
      </div>
      <TournamentRankingTable game={selectedGame} userId={userId} tier={tier} />
    </div>
  );
}
