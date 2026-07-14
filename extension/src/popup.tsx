import { useEffect, useState } from "react"
import browser from "webextension-polyfill"
import { exportCoverLetterToDocx, exportCoverLetterToPdf, exportCvToDocx, exportCvToPdf } from "./lib/export"
import { supabase } from "./lib/supabase"
import type { CV, ContactInfo, Settings, TailoredCV } from "./lib/types"

/**
 * the real popup - checks if the user's logged in, and if so, lets them
 * pick from the cvs they saved on the dashboard, scrapes the current job
 * posting, and calls the backend to tailor that cv to it. the result is
 * editable directly, or you can type an instruction and have the ai
 * revise it, before saving it as a pdf or docx. the cover letter is a
 * separate, on-demand step with the same edit/revise/export flow - most
 * tailoring runs don't need one, so it isn't generated automatically.
 */
function IndexPopup() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)

  const [cvs, setCvs] = useState<CV[]>([])
  const [selectedCvId, setSelectedCvId] = useState("")
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    full_name: null,
    contact_email: null,
    phone: null,
    location: null
  })

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [tailorError, setTailorError] = useState<string | null>(null)
  const [tailoredResult, setTailoredResult] = useState<TailoredCV | null>(null)
  const [lastPageText, setLastPageText] = useState<string | null>(null)

  const [reviseInstruction, setReviseInstruction] = useState("")
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState<string | null>(null)

  const [coverLetterStatus, setCoverLetterStatus] = useState<"idle" | "loading" | "error">("idle")
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null)

  const [letterReviseInstruction, setLetterReviseInstruction] = useState("")
  const [revisingLetter, setRevisingLetter] = useState(false)
  const [letterReviseError, setLetterReviseError] = useState<string | null>(null)

  useEffect(() => {
    // check if there's already a saved session before showing the login form
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  useEffect(() => {
    if (!session) return

    // the cvs the user saved on the dashboard - this is what they pick
    // from here rather than pasting/uploading anything in the popup
    supabase
      .from("cvs")
      .select("id, name, cv_text")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCvs(data ?? [])
        if (data && data.length > 0) setSelectedCvId(data[0].id)
      })

    // name/contact block for exported pdfs/docx - fetched once up front so
    // the export buttons (plain onClick, not async flows) already have it
    supabase
      .from("user_settings")
      .select("full_name, contact_email, phone, location")
      .eq("id", session.user.id)
      .single<ContactInfo>()
      .then(({ data }) => {
        if (data) setContactInfo(data)
      })
  }, [session])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError(error.message)
      return
    }
    setSession(data.session)
  }

  const selectedCv = cvs.find((cv) => cv.id === selectedCvId)

  const MIN_PAGE_TEXT_LENGTH = 200

  // job descriptions are sometimes rendered inside an embedded ats widget
  // (an iframe), which the top frame alone won't pick up - check every
  // frame on the page and use whichever one actually has the posting in
  // it, rather than assuming it's always the top frame
  const scrapeCurrentPage = async (): Promise<string> => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id!, allFrames: true },
      func: () => document.body?.innerText ?? ""
    })

    const longest = results.reduce((best, r) => {
      const text = typeof r.result === "string" ? r.result : ""
      return text.length > best.length ? text : best
    }, "")

    if (longest.trim().length < MIN_PAGE_TEXT_LENGTH) {
      throw new Error(
        "couldn't find much text on this page - make sure the job posting has finished loading and try again"
      )
    }

    return longest
  }

  // shared by tailor/cover-letter/revise requests - fetches the user's
  // provider/model/key and resolves the cv text for whichever cv is
  // selected right now. page text is handled separately (see
  // scrapeCurrentPage) since only "tailor my cv" should ever re-scrape -
  // revise/cover-letter reuse whatever the last tailor call already read
  const gatherRequestInputs = async () => {
    const { data: settingsRow } = await supabase
      .from("user_settings")
      .select("*")
      .eq("id", session.user.id)
      .single<Settings>()

    if (!settingsRow || !settingsRow.api_key) {
      throw new Error("no provider/api key found - set those up on the dashboard first")
    }

    if (!selectedCv) {
      throw new Error("pick a cv above first - add one on the dashboard if the list is empty")
    }

    return { settingsRow, cvText: selectedCv.cv_text }
  }

  const callBackend = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`${process.env.PLASMO_PUBLIC_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      // the backend sends back { detail: { error, message } } for
      // situations it recognizes (bad key, no credit, rate limited) -
      // fall back to a generic message for anything else
      const errBody = await response.json().catch(() => null)
      throw new Error(errBody?.detail?.message ?? `backend returned ${response.status}`)
    }

    return response.json()
  }

  const handleTailorClick = async () => {
    setStatus("loading")
    setTailorError(null)
    setTailoredResult(null)
    setCoverLetter(null)
    setCoverLetterStatus("idle")

    try {
      // always scrape fresh here - this is the one action that's
      // supposed to read whatever's on the tab right now
      const pageText = await scrapeCurrentPage()
      setLastPageText(pageText)

      const { settingsRow, cvText } = await gatherRequestInputs()

      const result = await callBackend("/tailor", {
        raw_job_posting: pageText,
        original_cv_text: cvText,
        provider: settingsRow.provider,
        model_name: settingsRow.model_name,
        api_key: settingsRow.api_key
      })

      // save a history entry - fire and forget, this doesn't need to block
      // showing the result to the user. job_title/company come straight
      // from the parser, not a placeholder
      supabase.from("tailoring_history").insert({
        user_id: session.user.id,
        job_title: result.job_title,
        company: result.company
      })

      setStatus("done")
      setTailoredResult(result.tailored_cv)
    } catch (err) {
      console.error(err)
      setStatus("error")
      setTailorError(err instanceof Error ? err.message : "something went wrong - check the console")
    }
  }

  const handleReviseCv = async () => {
    if (!tailoredResult || !reviseInstruction) return
    setRevising(true)
    setReviseError(null)

    try {
      const { settingsRow, cvText } = await gatherRequestInputs()

      const revised = await callBackend("/revise-cv", {
        tailored_cv: tailoredResult,
        instruction: reviseInstruction,
        original_cv_text: cvText,
        provider: settingsRow.provider,
        model_name: settingsRow.model_name,
        api_key: settingsRow.api_key
      })

      setTailoredResult(revised)
      setReviseInstruction("")
    } catch (err) {
      console.error(err)
      setReviseError(err instanceof Error ? err.message : "something went wrong - check the console")
    }
    setRevising(false)
  }

  const updateSummary = (value: string) => {
    if (!tailoredResult) return
    setTailoredResult({ ...tailoredResult, summary: value })
  }

  const updateBulletText = (index: number, value: string) => {
    if (!tailoredResult) return
    const bullets = tailoredResult.bullets.map((b, i) => (i === index ? { ...b, text: value } : b))
    setTailoredResult({ ...tailoredResult, bullets })
  }

  const deleteBullet = (index: number) => {
    if (!tailoredResult) return
    setTailoredResult({ ...tailoredResult, bullets: tailoredResult.bullets.filter((_, i) => i !== index) })
  }

  const handleGenerateCoverLetter = async () => {
    setCoverLetterStatus("loading")
    setCoverLetterError(null)

    try {
      // reuses whatever "tailor my cv" last scraped, rather than
      // re-reading the tab - this only ever shows up after a successful
      // tailor, so lastPageText is always set by this point
      if (!lastPageText) throw new Error("tailor your cv first")
      const { settingsRow, cvText } = await gatherRequestInputs()

      const result = await callBackend("/cover-letter", {
        raw_job_posting: lastPageText,
        original_cv_text: cvText,
        provider: settingsRow.provider,
        model_name: settingsRow.model_name,
        api_key: settingsRow.api_key
      })

      setCoverLetterStatus("idle")
      setCoverLetter(result.text)
    } catch (err) {
      console.error(err)
      setCoverLetterStatus("error")
      setCoverLetterError(err instanceof Error ? err.message : "something went wrong - check the console")
    }
  }

  const handleReviseCoverLetter = async () => {
    if (!coverLetter || !letterReviseInstruction) return
    setRevisingLetter(true)
    setLetterReviseError(null)

    try {
      const { settingsRow, cvText } = await gatherRequestInputs()

      const revised = await callBackend("/revise-cover-letter", {
        cover_letter: { text: coverLetter },
        instruction: letterReviseInstruction,
        original_cv_text: cvText,
        provider: settingsRow.provider,
        model_name: settingsRow.model_name,
        api_key: settingsRow.api_key
      })

      setCoverLetter(revised.text)
      setLetterReviseInstruction("")
    } catch (err) {
      console.error(err)
      setLetterReviseError(err instanceof Error ? err.message : "something went wrong - check the console")
    }
    setRevisingLetter(false)
  }

  // not logged in - show a simple login form
  if (!session) {
    return (
      <div style={{ padding: 16, width: 300, fontFamily: "sans-serif" }}>
        <h2 style={{ marginTop: 0 }}>tailorpilot</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 8, padding: 8 }}
          />
          {loginError && <p style={{ color: "red", fontSize: 12 }}>{loginError}</p>}
          <button type="submit" style={{ width: "100%", padding: 8 }}>
            log in
          </button>
        </form>
        <p style={{ fontSize: 12, marginTop: 12 }}>
          no account? sign up on the dashboard first.
        </p>
      </div>
    )
  }

  // logged in - the real tailoring ui
  return (
    <div style={{ padding: 16, width: 340, fontFamily: "sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>tailorpilot</h2>

      {cvs.length === 0 ? (
        <p style={{ fontSize: 12, marginBottom: 12 }}>
          no cvs saved yet - add one on the dashboard, then come back here.
        </p>
      ) : (
        <select
          aria-label="cv"
          value={selectedCvId}
          onChange={(e) => setSelectedCvId(e.target.value)}
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        >
          {cvs.map((cv) => (
            <option key={cv.id} value={cv.id}>
              {cv.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={handleTailorClick}
        disabled={status === "loading" || cvs.length === 0}
        style={{ width: "100%", padding: 10 }}
      >
        {status === "loading" ? "tailoring..." : "tailor my cv"}
      </button>

      {tailorError && <p style={{ marginTop: 12, fontSize: 12, color: "red" }}>{tailorError}</p>}

      {tailoredResult && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>summary</p>
          <textarea
            value={tailoredResult.summary}
            onChange={(e) => updateSummary(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 6, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
          />

          <p style={{ fontSize: 12, fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>bullets</p>
          {tailoredResult.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <textarea
                value={b.text}
                onChange={(e) => updateBulletText(i, e.target.value)}
                rows={2}
                style={{ flex: 1, padding: 6, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => deleteBullet(i)}
                title="remove bullet"
                style={{ padding: "0 8px" }}
              >
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <input
              type="text"
              placeholder="tell it what to change..."
              value={reviseInstruction}
              onChange={(e) => setReviseInstruction(e.target.value)}
              style={{ flex: 1, padding: 6, fontSize: 12 }}
            />
            <button onClick={handleReviseCv} disabled={!reviseInstruction || revising} style={{ padding: "0 10px" }}>
              {revising ? "..." : "revise"}
            </button>
          </div>
          {reviseError && <p style={{ marginTop: 4, fontSize: 12, color: "red" }}>{reviseError}</p>}

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={() => selectedCv && exportCvToPdf(selectedCv.name, tailoredResult, contactInfo)}
              style={{ flex: 1, padding: 6 }}
            >
              save as pdf
            </button>
            <button
              onClick={() => selectedCv && exportCvToDocx(selectedCv.name, tailoredResult, contactInfo)}
              style={{ flex: 1, padding: 6 }}
            >
              save as docx
            </button>
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #ddd", paddingTop: 12 }}>
            <button
              onClick={handleGenerateCoverLetter}
              disabled={coverLetterStatus === "loading"}
              style={{ width: "100%", padding: 8 }}
            >
              {coverLetterStatus === "loading" ? "writing cover letter..." : "generate cover letter"}
            </button>

            {coverLetterError && <p style={{ marginTop: 8, fontSize: 12, color: "red" }}>{coverLetterError}</p>}

            {coverLetter && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={8}
                  style={{ width: "100%", padding: 6, fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }}
                />

                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="tell it what to change..."
                    value={letterReviseInstruction}
                    onChange={(e) => setLetterReviseInstruction(e.target.value)}
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                  />
                  <button
                    onClick={handleReviseCoverLetter}
                    disabled={!letterReviseInstruction || revisingLetter}
                    style={{ padding: "0 10px" }}
                  >
                    {revisingLetter ? "..." : "revise"}
                  </button>
                </div>
                {letterReviseError && <p style={{ marginTop: 4, fontSize: 12, color: "red" }}>{letterReviseError}</p>}

                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => selectedCv && exportCoverLetterToPdf(selectedCv.name, coverLetter, contactInfo)}
                    style={{ flex: 1, padding: 6 }}
                  >
                    save as pdf
                  </button>
                  <button
                    onClick={() => selectedCv && exportCoverLetterToDocx(selectedCv.name, coverLetter, contactInfo)}
                    style={{ flex: 1, padding: 6 }}
                  >
                    save as docx
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default IndexPopup
