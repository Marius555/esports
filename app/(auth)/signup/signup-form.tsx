"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toastManager } from "@/components/ui/toast"
import { signUp } from "@/app/actions/auth"

const signUpSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignUpValues = z.infer<typeof signUpSchema>

export function SignupForm() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  })

  const passwordValue = watch("password") ?? ""
  const passwordStrength = Math.min(Math.floor(passwordValue.length / 3), 4)
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500"]
  const strengthLabels = ["Too short", "Weak", "Fair", "Strong"]

  async function onSubmit(data: SignUpValues) {
    const fd = new FormData()
    fd.set("username", data.username)
    fd.set("email", data.email)
    fd.set("password", data.password)

    const result = await signUp(fd)

    if (!result.success) {
      toastManager.add({
        title: "Sign up failed",
        description: result.error ?? "Something went wrong",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field>
        <FieldLabel className="text-neutral-300 text-sm font-medium">Username</FieldLabel>
        <Input
          id="username"
          type="text"
          placeholder="your_gamer_tag"
          autoComplete="username"
          className="bg-[#16162a] border-white/10 text-white placeholder:text-neutral-600 focus:border-[#a855f7]/60 h-11"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
        {errors.username ? (
          <FieldError className="text-red-400 text-xs mt-1">
            {errors.username.message}
          </FieldError>
        ) : (
          <FieldDescription className="text-neutral-600 text-xs mt-1">
            Letters, numbers, and underscores only (3–20 chars)
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel className="text-neutral-300 text-sm font-medium">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          placeholder="player@example.com"
          autoComplete="email"
          className="bg-[#16162a] border-white/10 text-white placeholder:text-neutral-600 focus:border-[#a855f7]/60 h-11"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <FieldError className="text-red-400 text-xs mt-1">
            {errors.email.message}
          </FieldError>
        )}
      </Field>

      <Field>
        <FieldLabel className="text-neutral-300 text-sm font-medium">Password</FieldLabel>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          className="bg-[#16162a] border-white/10 text-white placeholder:text-neutral-600 focus:border-[#a855f7]/60 h-11"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {/* Password strength bar */}
        {passwordValue.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i < passwordStrength
                      ? strengthColors[passwordStrength - 1]
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            {passwordStrength > 0 && (
              <p className="text-xs text-neutral-500">
                {strengthLabels[passwordStrength - 1]}
              </p>
            )}
          </div>
        )}
        {errors.password && (
          <FieldError className="text-red-400 text-xs mt-1">
            {errors.password.message}
          </FieldError>
        )}
      </Field>

      <Button
        type="submit"
        loading={isSubmitting}
        className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white border-0 h-11 font-semibold glow-purple mt-1"
      >
        {isSubmitting ? "Creating account..." : "Create Free Account"}
      </Button>
    </form>
  )
}
