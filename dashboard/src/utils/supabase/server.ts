import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * supabase client for use in server components and route handlers.
 * this one needs access to cookies directly since that's how the session
 * gets read on the server side - the browser client above doesn't need this.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // this can be safely ignored if you have middleware refreshing
            // sessions - happens when this is called from a server component
          }
        }
      }
    }
  )
}