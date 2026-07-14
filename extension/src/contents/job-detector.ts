import type { PlasmoCSConfig } from "plasmo"
import browser from "webextension-polyfill"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*"]
}

// there's no api that lets an extension pop its own toolbar popup open -
// browsers block that on purpose. the closest real substitute is badging
// the icon so it's obvious when to click it, which is what this does.
const JOB_SIGNAL_PHRASES = [
  "responsibilities",
  "qualifications",
  "requirements",
  "job description",
  "about the role",
  "what you'll do",
  "apply now",
  "years of experience"
]

const JOB_HOST_PATTERNS = [
  "linkedin.com/jobs",
  "indeed.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "ashbyhq.com"
]

function looksLikeJobPosting(): boolean {
  const url = window.location.href.toLowerCase()
  if (JOB_HOST_PATTERNS.some((pattern) => url.includes(pattern))) return true

  const text = document.body?.innerText?.toLowerCase() ?? ""
  const matches = JOB_SIGNAL_PHRASES.filter((phrase) => text.includes(phrase))
  return matches.length >= 3
}

function report() {
  browser.runtime.sendMessage({ type: "job-page-detected", isJobPage: looksLikeJobPosting() })
}

// give the page a moment to actually render its content before checking
setTimeout(report, 1500)

// job boards are often spa-style and swap content without a full page
// reload - re-check whenever the url actually changes
let lastUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href === lastUrl) return
  lastUrl = window.location.href
  setTimeout(report, 1000)
})
observer.observe(document.body, { childList: true, subtree: true })
