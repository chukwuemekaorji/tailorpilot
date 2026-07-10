import { useState } from "react"
import "./popup.css"

/**
 * this is the whole popup ui for now - just enough to prove the extension
 * can scrape the current page and hit our backend. login, history, and
 * proper styling come once the dashboard/auth pieces exist.
 */
function IndexPopup() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<string | null>(null)

  const handleTailorClick = async () => {
    setStatus("loading")

    try {
      // grab the current tab's visible text - this is a placeholder approach,
      // we'll refine what actually gets scraped once we're testing on real
      // job sites in a later section
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const [{ result: pageText }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: () => document.body.innerText
      })

      // note: this is calling a placeholder - real request wiring
      // (with the user's saved provider/key/cv) comes in a later section
      console.log("scraped page text length:", pageText.length)

      setStatus("done")
      setResult(`scraped ${pageText.length} characters from the page`)
    } catch (err) {
      console.error(err)
      setStatus("error")
    }
  }

  return (
    <div className="popup">
      <h2 className="popup__title">tailorpilot</h2>

      <button className="popup__button" onClick={handleTailorClick} disabled={status === "loading"}>
        {status === "loading" ? "scanning page..." : "tailor my cv"}
      </button>

      {result && <p className="popup__message">{result}</p>}
      {status === "error" && (
        <p className="popup__message popup__message--error">
          something went wrong - check the console
        </p>
      )}
    </div>
  )
}

export default IndexPopup