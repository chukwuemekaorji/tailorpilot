import type { Metadata } from "next"
import { Baloo_2, Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

// display face - the rounded, friendly one that echoes the logo's own
// bubbly lettering. used sparingly, just for headlines.
const displayFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"]
})

// body face - does the actual reading work, stays out of the way
const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body"
})

// utility face - for anything technical: provider names, code, schema bits
const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
})

export const metadata: Metadata = {
  title: "TailorPilot",
  description: "tailors your cv and cover letter to any job posting, right where you're applying."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} font-body bg-ivory text-espresso`}>
        {children}
      </body>
    </html>
  )
}