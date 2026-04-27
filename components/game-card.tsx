"use client";

const GAME_CONFIG = {
  dota2: {
    label: "Dota 2",
    banner: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
    gradientFrom: "#1a0a00",
    gradientTo: "#6b1a0e",
    accent: "#e84c21",
    logo: "/logos/dota2.svg",
  },
  valorant: {
    label: "Valorant",
    banner: "https://cdn.cloudflare.steamstatic.com/steam/apps/2694490/header.jpg",
    gradientFrom: "#0d0000",
    gradientTo: "#2a0008",
    accent: "#FF4655",
    logo: "/logos/valorant.svg",
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

export function GameCard({
  game,
  selected,
  onSelect,
}: {
  game: GameKey;
  selected: boolean;
  onSelect: () => void;
}) {
  const cfg = GAME_CONFIG[game];

  return (
    <div
      className={[
        "rounded-2xl border bg-card text-card-foreground overflow-hidden cursor-pointer transition-all duration-200 card-gamery",
        selected ? "accent-outline accent-glow scale-[1.01]" : "accent-outline-none",
      ].join(" ")}
      onClick={onSelect}
      role="button"
      aria-pressed={selected}
    >
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
            className="h-5 w-5 object-contain accent-drop-shadow"
          />
          <h2 className="font-heading font-black text-base tracking-widest uppercase text-white drop-shadow">
            {cfg.label}
          </h2>
        </div>
        {selected && (
          <div className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded accent-bg-subtle accent-text">
            Selected
          </div>
        )}
      </div>
    </div>
  );
}
