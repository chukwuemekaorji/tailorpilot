import { createBrowserClient } from "@supabase/ssr"

/**
 * supabase client for use in client components - anything with "use client"
 * at the top. this runs in the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}