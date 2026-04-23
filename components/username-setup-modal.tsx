"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons"
import { setupUsername } from "@/app/actions/auth"

interface UsernameSetupModalProps {
  open: boolean
  userId: string
  onSuccess: (userId: string) => void
}

const schema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(20, "At most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
})

type FormValues = z.infer<typeof schema>

export function UsernameSetupModal({ open, userId, onSuccess }: UsernameSetupModalProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const currentValue = watch("username") ?? ""

  async function onSubmit(data: FormValues) {
    setServerError(null)
    const result = await setupUsername(userId, data.username)
    if (!result.success) {
      setServerError(result.error)
    } else {
      onSuccess(result.userId)
    }
  }

  return (
    <Dialog open={open}>
      <DialogPopup showCloseButton={false} bottomStickOnMobile={false} className="overflow-hidden border-brand-cyan/25 p-0 gap-0">

        {/* ── Decorative header (cyan theme) ──────────────────── */}
        <div className="relative flex flex-col items-center justify-center gap-3 px-8 pt-9 pb-7">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_140%_at_50%_-10%,rgb(34_211_238/14%),transparent_70%)]" />
          <div className="absolute inset-0 bg-grid-purple opacity-[0.25] pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/25 to-transparent" />
          <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-brand-cyan/50 rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-brand-cyan/50 rounded-tr-2xl" />

          {/* icon */}
          <div className="relative z-10">
            <div className="absolute inset-0 rounded-xl bg-brand-cyan/20 blur-xl scale-[1.8]" />
            <div className="relative size-14 rounded-xl bg-gradient-to-br from-brand-cyan/20 to-brand-cyan/5 border border-brand-cyan/35 flex items-center justify-center shadow-[0_0_20px_rgb(34_211_238/20%)]">
              <HugeiconsIcon icon={UserAdd01Icon} size={24} className="text-brand-cyan" />
            </div>
          </div>

          <div className="relative z-10 text-center space-y-1.5 mt-0.5">
            <DialogTitle className="font-heading font-black text-[1.5rem] uppercase tracking-tight leading-none text-foreground">
              Pick Your Tag
            </DialogTitle>
            <DialogDescription className="text-[0.8rem] text-muted-foreground leading-relaxed max-w-[20rem]">
              Your public identity across all tournaments.
              Choose wisely — this can&apos;t be changed later.
            </DialogDescription>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────── */}
        <div className="px-6 py-5">
          <form id="username-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

            {/* input with @ prefix */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm font-mono select-none pointer-events-none">
                  @
                </span>
                <Input
                  id="username-input"
                  type="text"
                  placeholder="your_tag"
                  autoFocus
                  className="h-12 pl-8 font-mono text-sm tracking-wide"
                  aria-invalid={!!errors.username || !!serverError}
                  {...register("username")}
                />
                {/* character counter */}
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.65rem] tabular-nums text-muted-foreground/40 pointer-events-none">
                  {currentValue.length}/20
                </span>
              </div>

              {/* validation */}
              {errors.username ? (
                <FieldError className="text-xs">{errors.username.message}</FieldError>
              ) : serverError ? (
                <FieldError className="text-xs">{serverError}</FieldError>
              ) : (
                <p className="text-[0.7rem] text-muted-foreground/50">
                  3–20 characters · letters, numbers, and underscores
                </p>
              )}
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full h-12 font-semibold gap-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/15 hover:border-brand-cyan/50 transition-colors"
            >
              {!isSubmitting && (
                <>
                  Set Username
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </>
              )}
              {isSubmitting && "Setting username…"}
            </Button>
          </form>
        </div>

      </DialogPopup>
    </Dialog>
  )
}
