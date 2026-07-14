"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

type Settings = {
  provider: string
  model_name: string
  api_key: string
}

type ContactInfo = {
  full_name: string
  contact_email: string
  phone: string
  location: string
}

const CUSTOM_MODEL = "__custom__"
const MAX_CVS = 5

// curated per-provider model lists - anthropic's are the current lineup,
// the others are the best-known defaults. providers add/rename models
// often enough that "custom" is always an option below, not a dead end.
const MODELS_BY_PROVIDER: Record<string, { label: string; value: string }[]> = {
  anthropic: [
    { label: "sonnet 5", value: "claude-sonnet-5" },
    { label: "opus 4.8", value: "claude-opus-4-8" },
    { label: "haiku 4.5", value: "claude-haiku-4-5-20251001" },
    { label: "fable 5", value: "claude-fable-5" }
  ],
  google: [
    { label: "gemini 2.0 flash", value: "gemini-2.0-flash" },
    { label: "gemini 2.0 flash-lite", value: "gemini-2.0-flash-lite" },
    { label: "gemini 2.0 pro", value: "gemini-2.0-pro-exp" }
  ],
  openai: [
    { label: "gpt-4o", value: "gpt-4o" },
    { label: "gpt-4o mini", value: "gpt-4o-mini" }
  ],
  groq: [
    { label: "llama 3.3 70b", value: "llama-3.3-70b-versatile" },
    { label: "mixtral 8x7b", value: "mixtral-8x7b-32768" }
  ]
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "gemini",
  anthropic: "claude",
  openai: "openai",
  groq: "groq"
}

type HistoryItem = {
  id: string
  job_title: string
  company: string | null
  created_at: string
}

type CV = {
  id: string
  name: string
  cv_text: string
  created_at: string
}

/**
 * the main dashboard - lets the user set their provider/model/api key once,
 * and shows a list of their past tailoring runs. this is the page the
 * extension's login points people to for setup.
 */
export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    full_name: "",
    contact_email: "",
    phone: "",
    location: ""
  })
  const [contactSaveStatus, setContactSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [settings, setSettings] = useState<Settings>({
    provider: "google",
    model_name: "gemini-2.0-flash",
    api_key: ""
  })
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [useCustomModel, setUseCustomModel] = useState(false)

  const [cvs, setCvs] = useState<CV[]>([])
  const [newCvName, setNewCvName] = useState("")
  const [newCvText, setNewCvText] = useState("")
  const [addingCv, setAddingCv] = useState(false)
  const [editingCvId, setEditingCvId] = useState<string | null>(null)
  const [editCvName, setEditCvName] = useState("")
  const [editCvText, setEditCvText] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    // load whatever's already saved, if anything, so the form isn't
    // blank every time someone revisits the page
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      setUserEmail(userData.user.email ?? null)

      const { data: existingContactInfo } = await supabase
        .from("user_settings")
        .select("full_name, contact_email, phone, location")
        .eq("id", userData.user.id)
        .single<ContactInfo>()

      if (existingContactInfo) {
        setContactInfo({
          full_name: existingContactInfo.full_name ?? "",
          contact_email: existingContactInfo.contact_email ?? "",
          phone: existingContactInfo.phone ?? "",
          location: existingContactInfo.location ?? ""
        })
      }

      // only the columns this page actually manages - cv_text now lives
      // in the extension, and pulling it in here via select("*") would
      // make handleSave's upsert silently overwrite it with a stale,
      // page-load-time copy every time settings are saved
      const { data: existingSettings } = await supabase
        .from("user_settings")
        .select("provider, model_name, api_key")
        .eq("id", userData.user.id)
        .single<Settings>()

      if (existingSettings) {
        setSettings(existingSettings)

        // saved models that aren't in our curated list (renamed, deprecated,
        // or just never added here) still need to show up - as "custom"
        const knownModels = MODELS_BY_PROVIDER[existingSettings.provider] ?? []
        const isKnown = knownModels.some((m) => m.value === existingSettings.model_name)
        setUseCustomModel(!isKnown)
      }

      const { data: historyData } = await supabase
        .from("tailoring_history")
        .select("*")
        .order("created_at", { ascending: false })

      setHistory(historyData ?? [])

      const { data: cvData } = await supabase
        .from("cvs")
        .select("*")
        .order("created_at", { ascending: false })

      setCvs(cvData ?? [])
    }

    loadData()
  }, [])

  const refreshCvs = async () => {
    const { data } = await supabase.from("cvs").select("*").order("created_at", { ascending: false })
    setCvs(data ?? [])
  }

  // pdf/docx text extraction happens server-side (see api/parse-cv) - the
  // browser just uploads the file and gets text back
  const parseFile = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/parse-cv", { method: "POST", body: formData })
    const body = await response.json()

    if (!response.ok) {
      throw new Error(body.error ?? "couldn't read that file")
    }

    return body.text
  }

  const handleNewCvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError(null)
    setParsingFile(true)
    try {
      const text = await parseFile(file)
      setNewCvText(text)
      if (!newCvName) setNewCvName(file.name.replace(/\.[^.]+$/, ""))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "couldn't read that file")
    }
    setParsingFile(false)
  }

  const handleEditCvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError(null)
    setParsingFile(true)
    try {
      const text = await parseFile(file)
      setEditCvText(text)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "couldn't read that file")
    }
    setParsingFile(false)
  }

  const handleAddCv = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cvs.length >= MAX_CVS) return
    setAddingCv(true)

    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await supabase.from("cvs").insert({
        user_id: userData.user.id,
        name: newCvName,
        cv_text: newCvText
      })
      await refreshCvs()
      setNewCvName("")
      setNewCvText("")
    }

    setAddingCv(false)
  }

  const handleDeleteCv = async (id: string) => {
    await supabase.from("cvs").delete().eq("id", id)
    await refreshCvs()
  }

  const startEditingCv = (cv: CV) => {
    setEditingCvId(cv.id)
    setEditCvName(cv.name)
    setEditCvText(cv.cv_text)
  }

  const handleSaveEditCv = async () => {
    if (!editingCvId) return
    setSavingEdit(true)

    await supabase
      .from("cvs")
      .update({ name: editCvName, cv_text: editCvText })
      .eq("id", editingCvId)

    await refreshCvs()
    setSavingEdit(false)
    setEditingCvId(null)
  }

  const handleSaveContactInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setContactSaveStatus("saving")

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    await supabase.from("user_settings").upsert({
      id: userData.user.id,
      ...contactInfo
    })

    setContactSaveStatus("saved")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus("saving")

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    // upsert - insert if this is the user's first time saving settings,
    // update if they're changing an existing row
    await supabase.from("user_settings").upsert({
      id: userData.user.id,
      ...settings
    })

    setSaveStatus("saved")
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <main className="min-h-screen bg-ivory">
      <header className="border-b border-umber/10 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <a href="/">
            <Image src="/tailorpilot.png" alt="TailorPilot" width={100} height={88} priority />
          </a>
          <div className="flex items-center gap-4">
            {userEmail && <span className="text-sm text-umber hidden sm:inline">{userEmail}</span>}
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-umber hover:text-espresso transition-colors"
            >
              log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-espresso mb-10">dashboard</h1>

        <section className="mb-8 bg-white rounded-2xl border border-umber/10 shadow-sm p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-espresso mb-4">
            your details
          </h2>
          <p className="text-sm text-umber mb-6">
            goes at the top of every cv and cover letter you export - not your
            login email, just whatever you want on the actual document.
          </p>

          <form onSubmit={handleSaveContactInfo} className="space-y-4">
            <input
              type="text"
              placeholder="full name"
              value={contactInfo.full_name}
              onChange={(e) => setContactInfo({ ...contactInfo, full_name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            />
            <input
              type="email"
              placeholder="email"
              value={contactInfo.contact_email}
              onChange={(e) => setContactInfo({ ...contactInfo, contact_email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            />
            <input
              type="text"
              placeholder="phone"
              value={contactInfo.phone}
              onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            />
            <input
              type="text"
              placeholder="location (e.g. Lisbon, Portugal)"
              value={contactInfo.location}
              onChange={(e) => setContactInfo({ ...contactInfo, location: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            />

            <button
              type="submit"
              className="bg-tangerine text-ivory font-semibold px-6 py-3 rounded-lg hover:bg-amber transition-colors"
            >
              {contactSaveStatus === "saving" ? "saving..." : "save details"}
            </button>
            {contactSaveStatus === "saved" && <p className="text-sm text-umber">saved.</p>}
          </form>
        </section>

        <section className="mb-8 bg-white rounded-2xl border border-umber/10 shadow-sm p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-espresso mb-4">
            model settings
          </h2>
          <p className="text-sm text-umber mb-6">
            pick whichever provider you already have a key for. this gets used every
            time you tailor a cv from the extension - saved here once, not typed
            in again each time.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <select
              aria-label="model provider"
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value
                const firstModel = MODELS_BY_PROVIDER[provider]?.[0]?.value ?? ""
                setSettings({ ...settings, provider, model_name: firstModel })
                setUseCustomModel(false)
              }}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            >
              {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="model"
              value={useCustomModel ? CUSTOM_MODEL : settings.model_name}
              onChange={(e) => {
                if (e.target.value === CUSTOM_MODEL) {
                  setUseCustomModel(true)
                } else {
                  setUseCustomModel(false)
                  setSettings({ ...settings, model_name: e.target.value })
                }
              }}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            >
              {(MODELS_BY_PROVIDER[settings.provider] ?? []).map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
              <option value={CUSTOM_MODEL}>custom / other...</option>
            </select>

            {useCustomModel && (
              <input
                type="text"
                placeholder="exact model name (e.g. gemini-2.5-flash)"
                value={settings.model_name}
                onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
              />
            )}

            <input
              type="password"
              placeholder="api key"
              value={settings.api_key}
              onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
            />

            <button
              type="submit"
              className="bg-tangerine text-ivory font-semibold px-6 py-3 rounded-lg hover:bg-amber transition-colors"
            >
              {saveStatus === "saving" ? "saving..." : "save settings"}
            </button>
            {saveStatus === "saved" && (
              <p className="text-sm text-umber">saved.</p>
            )}
          </form>
        </section>

        <section className="mb-8 bg-white rounded-2xl border border-umber/10 shadow-sm p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-espresso mb-4">
            your cvs
            <span className="text-sm font-normal text-umber ml-2">
              ({cvs.length}/{MAX_CVS})
            </span>
          </h2>
          <p className="text-sm text-umber mb-6">
            save a few versions - "project manager cv", "software engineer cv" -
            and pick whichever fits when you're tailoring from the extension.
            up to {MAX_CVS} at a time.
          </p>

          {cvs.length > 0 && (
            <ul className="space-y-3 mb-6">
              {cvs.map((cv) =>
                editingCvId === cv.id ? (
                  <li key={cv.id} className="border border-umber/20 rounded-lg px-4 py-3 space-y-3">
                    <input
                      type="text"
                      placeholder="cv name"
                      value={editCvName}
                      onChange={(e) => setEditCvName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
                    />
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleEditCvFile}
                      className="w-full px-4 py-2 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
                    />
                    {parsingFile && <p className="text-sm text-umber">reading file...</p>}
                    {parseError && <p className="text-sm text-red-600">{parseError}</p>}
                    <textarea
                      value={editCvText}
                      onChange={(e) => setEditCvText(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-2 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveEditCv}
                        disabled={!editCvName || !editCvText || savingEdit}
                        className="bg-tangerine text-ivory font-semibold px-4 py-2 rounded-lg hover:bg-amber transition-colors"
                      >
                        {savingEdit ? "saving..." : "save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCvId(null)}
                        className="text-umber font-semibold px-4 py-2"
                      >
                        cancel
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={cv.id}
                    className="border border-umber/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4 hover:border-tangerine/40 transition-colors"
                  >
                    <span className="font-medium text-espresso">{cv.name}</span>
                    <div className="flex gap-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditingCv(cv)}
                        className="text-sm text-umber underline"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCv(cv.id)}
                        className="text-sm text-umber underline"
                      >
                        delete
                      </button>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}

          {cvs.length >= MAX_CVS ? (
            <p className="text-sm text-umber">
              you've reached the {MAX_CVS} cv limit - delete one above to add another.
            </p>
          ) : (
            <form onSubmit={handleAddCv} className="space-y-4">
              <input
                type="text"
                placeholder="cv name (e.g. software engineer cv)"
                value={newCvName}
                onChange={(e) => setNewCvName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
              />
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleNewCvFile}
                className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
              />
              {parsingFile && <p className="text-sm text-umber">reading file...</p>}
              {parseError && <p className="text-sm text-red-600">{parseError}</p>}

              {newCvText && (
                <textarea
                  value={newCvText}
                  onChange={(e) => setNewCvText(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-umber/30 bg-white focus:outline-none focus:ring-2 focus:ring-tangerine/30 focus:border-tangerine transition-shadow"
                />
              )}

              <button
                type="submit"
                disabled={!newCvName || !newCvText || addingCv}
                className="bg-tangerine text-ivory font-semibold px-6 py-3 rounded-lg hover:bg-amber transition-colors"
              >
                {addingCv ? "adding..." : "add cv"}
              </button>
            </form>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-umber/10 shadow-sm p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-espresso mb-4">
            history
          </h2>

          {history.length === 0 ? (
            <p className="text-sm text-umber">
              nothing here yet - tailor a cv from the extension and it'll show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="border border-umber/20 rounded-lg px-4 py-3 flex justify-between hover:border-tangerine/40 transition-colors"
                >
                  <span className="font-medium text-espresso">
                    {item.job_title}
                    {item.company && <span className="text-umber"> · {item.company}</span>}
                  </span>
                  <span className="text-sm text-umber font-mono">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}