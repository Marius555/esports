"use client";

import { useState } from "react";
import { GameCard } from "@/components/game-card";
import { TournamentsTable } from "@/components/tournaments-table";

export function DashboardContent({ userId }: { userId: string }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="grid gap-4 md:grid-cols-3 items-start">
        <GameCard game="dota2" onTournamentEntered={() => setRefreshTrigger((n) => n + 1)} />
        <GameCard game="leagueoflegends" onTournamentEntered={() => setRefreshTrigger((n) => n + 1)} />
        <GameCard game="counterstrike" onTournamentEntered={() => setRefreshTrigger((n) => n + 1)} />
      </div>
      <TournamentsTable userId={userId} refreshTrigger={refreshTrigger} />
    </div>
  );
}
