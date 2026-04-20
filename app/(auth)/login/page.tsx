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
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Login — GAMERY",
  description: "Sign in to your GAMERY forecasting account",
}

export default function LoginPage() {
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
              Welcome Back
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>

          <CardPanel>
            <LoginForm />
          </CardPanel>

          <CardFooter className="justify-center pt-0">
            <p className="text-sm text-muted-foreground">
              No account?{" "}
              <Link
                href="/signup"
                className="text-brand-cyan hover:text-brand-cyan/80 transition-colors font-medium"
              >
                Sign up free
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
