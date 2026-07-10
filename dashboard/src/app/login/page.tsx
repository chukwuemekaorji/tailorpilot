"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

/**
 * one page handles both login and signup - toggled by the mode state.
 * keeping it simple for now, styling pass comes once the flow actually works.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ivory px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold text-espresso mb-8 text-center">
          {mode === "login" ? "log in" : "create an account"}
        </h1>

        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-4 py-3 rounded-lg border border-umber/30 bg-white"
          required
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-3 rounded-lg border border-umber/30 bg-white"
          required
        />

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          className="w-full bg-tangerine text-ivory font-semibold py-3 rounded-lg hover:bg-amber transition-colors"
        >
          {mode === "login" ? "log in" : "sign up"}
        </button>

        <p className="text-center text-sm text-umber mt-6">
          {mode === "login" ? "no account yet? " : "already have one? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-tangerine underline"
          >
            {mode === "login" ? "sign up" : "log in"}
          </button>
        </p>
      </form>
    </main>
  )
}