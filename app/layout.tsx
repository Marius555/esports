import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ToastProvider, AnchoredToastProvider } from "@/components/ui/toast";

const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GAMERY — Esports Forecasting",
  description:
    "Predict CS2 & LoL match outcomes. Earn points. Compete for the €50 monthly prize.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full dark antialiased",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
        interHeading.variable,
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AnchoredToastProvider>{children}</AnchoredToastProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
