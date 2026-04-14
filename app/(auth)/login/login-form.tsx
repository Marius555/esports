"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toastManager } from "@/components/ui/toast"
import { login } from "@/app/actions/auth"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginValues) {
    const fd = new FormData()
    fd.set("email", data.email)
    fd.set("password", data.password)

    const result = await login(fd)

    // result is only received when login fails (success triggers server-side redirect)
    if (result && !result.success) {
      toastManager.add({
        title: "Login failed",
        description: result.error ?? "Invalid credentials",
        type: "error",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field>
        <FieldLabel className="text-neutral-300 text-sm font-medium">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          placeholder="player@example.com"
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
          className="bg-[#16162a] border-white/10 text-white placeholder:text-neutral-600 focus:border-[#a855f7]/60 h-11"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
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
        {isSubmitting ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  )
}
