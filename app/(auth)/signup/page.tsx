import Link from "next/link"
import {
  Card,
  CardHeader,
  CardPanel,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { ZapIcon } from "@hugeicons/core-free-icons"
import { SignupForm } from "./signup-form"

export const metadata = {
  title: "Sign Up — GAMERY",
  description: "Create your free GAMERY forecasting account",
}

export default function SignupPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-purple opacity-50 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgb(168_85_247/15%),transparent)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <HugeiconsIcon icon={ZapIcon} size={24} className="text-brand-purple" />
          <span className="font-heading text-2xl font-black tracking-widest text-brand-purple text-glow-purple uppercase">
            Gamery
          </span>
        </div>

        <Card className="bg-card border border-brand-purple/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-purple/60 to-transparent" />
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-heading text-2xl font-black text-foreground uppercase">
              Join the Arena
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Create your free account and start competing
            </CardDescription>
          </CardHeader>

          <CardPanel>
            <SignupForm />
          </CardPanel>

          <CardFooter className="justify-center pt-0">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-brand-cyan hover:text-brand-cyan/80 transition-colors font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          By signing up, you agree to our{" "}
          <Link href="#" className="underline hover:text-muted-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="underline hover:text-muted-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
