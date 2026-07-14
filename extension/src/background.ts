import browser, { type Runtime } from "webextension-polyfill"

// job-detector.ts (a content script) reports whether the current tab
// looks like a job posting - this is what actually sets the badge, since
// content scripts can't touch the toolbar icon themselves
browser.runtime.onMessage.addListener((message: any, sender: Runtime.MessageSender) => {
  if (message?.type !== "job-page-detected") return

  const tabId = sender.tab?.id
  if (tabId === undefined) return

  if (message.isJobPage) {
    browser.action.setBadgeText({ tabId, text: "•" })
    browser.action.setBadgeBackgroundColor({ tabId, color: "#E8791F" })
  } else {
    browser.action.setBadgeText({ tabId, text: "" })
  }
})
