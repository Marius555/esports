"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Dialog, DialogPortal, DialogBackdrop } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerPopup,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Crown02Icon,
  LockIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useIsMobile } from "@/hooks/use-mobile";

type Tier = "free" | "pro" | "max";

const UPGRADE_PLANS: {
  tier: "pro" | "max";
  name: string;
  price: string;
  highlight: string;
  color: string;
  buttonStyle: React.CSSProperties;
  border: string;
  panelBg: string;
  icon: React.ReactNode;
  perks: string[];
}[] = [
  {
    tier: "pro",
    name: "Oracle",
    price: "$20/mo",
    highlight: "2 simultaneous tournaments",
    color: "text-brand-purple",
    buttonStyle: { background: "var(--brand-purple)", color: "white", border: "none" },
    border: "border-brand-purple/30",
    panelBg: "rgba(168,85,247,0.06)",
    icon: <HugeiconsIcon icon={SparklesIcon} size={15} />,
    perks: ["2 active tournaments at once", "AI win probability", "Tactical team breakdowns"],
  },
  {
    tier: "max",
    name: "Legend",
    price: "$35/mo",
    highlight: "3 simultaneous tournaments",
    color: "text-amber-400",
    buttonStyle: { background: "#f59e0b", color: "#000", border: "none" },
    border: "border-amber-500/30",
    panelBg: "rgba(245,158,11,0.06)",
    icon: <HugeiconsIcon icon={Crown02Icon} size={15} />,
    perks: ["3 active tournaments at once", "Priority AI processing", "Early access to features"],
  },
];

const TIER_LIMITS: Record<Tier, number> = { free: 1, pro: 2, max: 3 };

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgradeSuccess: () => void;
  currentTier: Tier;
}

// ─── Shared inner content ─────────────────────────────────────────────────────

function ModalContent({
  currentTier,
  onClose,
  onUpgradeSuccess,
}: {
  currentTier: Tier;
  onClose: () => void;
  onUpgradeSuccess: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<"limit" | "upgrade">("limit");
  const [upgrading, setUpgrading] = useState<"pro" | "max" | null>(null);
  const [upgraded, setUpgraded] = useState<"pro" | "max" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limit = TIER_LIMITS[currentTier];

  const availablePlans = UPGRADE_PLANS.filter((p) =>
    currentTier === "free" ? true : currentTier === "pro" && p.tier === "max"
  );

  const handleUpgrade = async (tier: "pro" | "max") => {
    setUpgrading(tier);
    setError(null);
    try {
      const res = await fetch("/api/user/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Upgrade failed");
      }
      setUpgraded(tier);
      router.refresh();
      setTimeout(() => {
        onUpgradeSuccess();
        onClose();
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setUpgrading(null);
    }
  };

  return (
    // Overflow-hidden wrapper so the slide stays contained
    <div className="overflow-hidden">
      {/* Two-panel slider — 200% wide, slides left on upgrade view */}
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{
          width: "200%",
          transform: view === "upgrade" ? "translateX(-50%)" : "translateX(0)",
        }}
      >
        {/* ── View 1: limit info ── */}
        <div className="w-1/2 flex-shrink-0 flex flex-col items-center gap-8 px-8 py-10 text-center justify-center">
          {/* Icon */}
          <div className="size-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <HugeiconsIcon icon={LockIcon} size={30} className="text-destructive" />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-xl font-bold text-foreground">
              Tournament Limit Reached
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              Your{" "}
              <span className="text-foreground font-semibold capitalize">{currentTier}</span>{" "}
              plan allows{" "}
              <span className="text-foreground font-semibold">
                {limit} active tournament{limit !== 1 ? "s" : ""}
              </span>{" "}
              at a time. Wait for one to resolve or upgrade to compete in more.
            </p>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-border/60" />

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            {availablePlans.length > 0 && (
              <Button
                className="flex-1 bg-brand-purple hover:bg-brand-purple-hover text-foreground border-0"
                onClick={() => setView("upgrade")}
              >
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>

        {/* ── View 2: upgrade options ── */}
        <div className="w-1/2 flex-shrink-0 flex flex-col gap-5 px-6 py-6">
          {/* Back + title */}
          <div className="flex items-center gap-3">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("limit"); setError(null); }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
            </button>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Choose Your Plan
            </h3>
          </div>

          {upgraded ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="size-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={28} className="text-green-500" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base">
                  Upgraded to {upgraded === "pro" ? "Oracle" : "Legend"}!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can now join more tournaments.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {availablePlans.map((plan) => (
                  <div
                    key={plan.tier}
                    className={`rounded-xl border ${plan.border} p-4 flex flex-col gap-3`}
                    style={{ background: plan.panelBg }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`flex items-center gap-1.5 mb-0.5 font-heading font-black text-base uppercase ${plan.color}`}>
                          {plan.icon}
                          {plan.name}
                        </div>
                        <span className="text-xs text-muted-foreground">{plan.highlight}</span>
                      </div>
                      <span className={`font-heading font-black text-lg ${plan.color}`}>
                        {plan.price}
                      </span>
                    </div>

                    <ul className="flex flex-col gap-1.5">
                      {plan.perks.map((perk) => (
                        <li key={perk} className={`flex items-center gap-2 text-xs text-muted-foreground`}>
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} className={plan.color} />
                          {perk}
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="sm"
                      className="w-full font-bold"
                      style={plan.buttonStyle}
                      loading={upgrading === plan.tier}
                      disabled={upgrading !== null || upgraded !== null}
                      onClick={() => handleUpgrade(plan.tier)}
                    >
                      Upgrade to {plan.name}
                    </Button>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}

              <p className="text-[10px] text-muted-foreground/50 text-center pb-1">
                Stripe & Bitcoin payments coming soon — updates instantly.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Responsive wrapper ───────────────────────────────────────────────────────

export function LimitReachedModal({ open, onClose, onUpgradeSuccess, currentTier }: Props) {
  const isMobile = useIsMobile();

  // Key forces ModalContent to remount (reset state) when modal reopens
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) setKey((k) => k + 1);
  }, [open]);

  const content = (
    <ModalContent
      key={key}
      currentTier={currentTier}
      onClose={onClose}
      onUpgradeSuccess={onUpgradeSuccess}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()} position="bottom">
        <DrawerPopup showBar>
          {content}
        </DrawerPopup>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogPortal>
        <DialogBackdrop className="bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup className="w-full max-w-sm outline-none rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            {content}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPortal>
    </Dialog>
  );
}
