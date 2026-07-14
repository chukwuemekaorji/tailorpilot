import { createClient } from "@supabase/supabase-js"
import browser from "webextension-polyfill"

// the popup's js context gets torn down every time it closes, so session
// persistence has to go through chrome.storage.local (survives that) -
// the default localStorage-based persistence supabase-js normally uses
// isn't reliable across popup open/close in a browser extension
const extensionStorage = {
  getItem: async (key: string) => {
    const result = await browser.storage.local.get(key)
    return (result[key] as string | undefined) ?? null
  },
  setItem: async (key: string, value: string) => {
    await browser.storage.local.set({ [key]: value })
  },
  removeItem: async (key: string) => {
    await browser.storage.local.remove(key)
  }
}

// same supabase project as the dashboard - the extension just needs its
// own client instance since it's a completely separate app context
export const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: extensionStorage,
      persistSession: true,
      autoRefreshToken: true
    }
  }
)