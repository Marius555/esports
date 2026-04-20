"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toastManager } from "@/components/ui/toast"
import { signUp } from "@/app/actions/auth"
import { GoogleAuthDialog } from "@/components/google-auth-dialog"

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type SignUpValues = z.infer<typeof signUpSchema>

export function SignupForm() {
  const [googleOpen, setGoogleOpen] = useState(false)
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
        <FieldLabel className="text-sm font-medium">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          placeholder="player@example.com"
          autoComplete="email"
          className="h-11"
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
        <FieldLabel className="text-sm font-medium">Password</FieldLabel>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          className="h-11"
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
                      : "bg-border"
                  }`}
                />
              ))}
            </div>
            {passwordStrength > 0 && (
              <p className="text-xs text-muted-foreground">
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
        className="w-full h-11 font-semibold glow-purple mt-1"
      >
        {isSubmitting ? "Creating account..." : "Create Free Account"}
      </Button>

      <div className="flex items-center gap-3 my-1">
        <hr className="flex-1 border-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <hr className="flex-1 border-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-2 font-medium"
        onClick={() => setGoogleOpen(true)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
        </svg>
        Continue with Google
      </Button>

      <GoogleAuthDialog open={googleOpen} onOpenChange={setGoogleOpen} />
    </form>
  )
}
