import { Document, HeadingLevel, Packer, Paragraph } from "docx"
import { jsPDF } from "jspdf"
import type { ContactInfo, TailoredCV } from "./types"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// the cv's saved name (e.g. "software_engineer_cv") is meant for the
// dropdown, not as a document title - clean it up before it goes on the page
function displayTitle(name: string) {
  return name.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function safeFilename(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || "document"
  )
}

// full name if they've filled in "your details" on the dashboard,
// otherwise fall back to the cv's own label so this never renders blank
function resolveTitle(contactInfo: ContactInfo, cvName: string): string {
  return contactInfo.full_name?.trim() || displayTitle(cvName)
}

function contactLine(contactInfo: ContactInfo): string | null {
  const parts = [contactInfo.contact_email, contactInfo.phone, contactInfo.location]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join("  ·  ") : null
}

// styled to read like a clean latex resume - serif type, a title rule,
// tight section headers and bullet spacing. jsPDF's built-in "times" font
// gets that look without embedding a real latex font for a close copy
function newPdfDoc() {
  const doc = new jsPDF({ unit: "pt", format: "letter" })
  return { doc, marginX: 54, pageWidth: doc.internal.pageSize.getWidth(), pageHeight: doc.internal.pageSize.getHeight() }
}

// name (+ contact line, if any) as the header block every export starts
// with, then a rule under it - returns the y position to continue from
function writeHeader(doc: jsPDF, title: string, contactInfo: ContactInfo, marginX: number, pageWidth: number, y: number) {
  doc.setFont("times", "bold")
  doc.setFontSize(20)
  doc.text(title, marginX, y)
  y += 20

  const contact = contactLine(contactInfo)
  if (contact) {
    doc.setFont("times", "normal")
    doc.setFontSize(10)
    doc.text(contact, marginX, y)
    y += 14
  }

  doc.setLineWidth(1)
  doc.line(marginX, y, pageWidth - marginX, y)
  return y + 24
}

function writeSectionHeader(doc: jsPDF, text: string, x: number, y: number, pageWidth: number, marginX: number) {
  doc.setFont("times", "bold")
  doc.setFontSize(11)
  doc.text(text, x, y)
  doc.setLineWidth(0.5)
  doc.line(marginX, y + 4, pageWidth - marginX, y + 4)
  return y + 20
}

function writeWrappedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  contentWidth: number,
  pageHeight: number,
  marginX: number
) {
  doc.setFont("times", "normal")
  doc.setFontSize(11)
  const lines = doc.splitTextToSize(text, contentWidth)
  for (const line of lines) {
    if (y > pageHeight - marginX) {
      doc.addPage()
      y = 60
    }
    doc.text(line, x, y)
    y += 14
  }
  return y
}

export function exportCvToPdf(cvName: string, cv: TailoredCV, contactInfo: ContactInfo) {
  const { doc, marginX, pageWidth, pageHeight } = newPdfDoc()
  const contentWidth = pageWidth - marginX * 2
  let y = 60

  y = writeHeader(doc, resolveTitle(contactInfo, cvName), contactInfo, marginX, pageWidth, y)

  y = writeSectionHeader(doc, "SUMMARY", marginX, y, pageWidth, marginX)
  y = writeWrappedParagraph(doc, cv.summary, marginX, y, contentWidth, pageHeight, marginX)
  y += 16

  y = writeSectionHeader(doc, "EXPERIENCE", marginX, y, pageWidth, marginX)
  for (const bullet of cv.bullets) {
    y = writeWrappedParagraph(doc, `•  ${bullet.text}`, marginX, y, contentWidth, pageHeight, marginX)
    y += 6
  }

  doc.save(`${safeFilename(cvName)}.pdf`)
}

export function exportCoverLetterToPdf(cvName: string, coverLetterText: string, contactInfo: ContactInfo) {
  const { doc, marginX, pageWidth, pageHeight } = newPdfDoc()
  const contentWidth = pageWidth - marginX * 2
  let y = 60

  y = writeHeader(doc, resolveTitle(contactInfo, cvName), contactInfo, marginX, pageWidth, y)

  const paragraphs = coverLetterText.split(/\n+/).filter(Boolean)
  for (const para of paragraphs) {
    y = writeWrappedParagraph(doc, para, marginX, y, contentWidth, pageHeight, marginX)
    y += 12
  }

  doc.save(`${safeFilename(cvName)}-cover-letter.pdf`)
}

// times new roman as the document default so every paragraph below just
// inherits it, rather than setting font on every single run
const docxStyles = {
  default: {
    document: {
      run: { font: "Times New Roman", size: 22 }
    }
  }
}

function docxHeaderParagraphs(title: string, contactInfo: ContactInfo): Paragraph[] {
  const paragraphs = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })]

  const contact = contactLine(contactInfo)
  if (contact) {
    paragraphs.push(new Paragraph({ text: contact, spacing: { after: 200 } }))
  }

  return paragraphs
}

export async function exportCvToDocx(cvName: string, cv: TailoredCV, contactInfo: ContactInfo) {
  const doc = new Document({
    styles: docxStyles,
    sections: [
      {
        children: [
          ...docxHeaderParagraphs(resolveTitle(contactInfo, cvName), contactInfo),
          new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
          new Paragraph({ text: cv.summary }),
          new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
          ...cv.bullets.map((b) => new Paragraph({ text: b.text, bullet: { level: 0 } }))
        ]
      }
    ]
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${safeFilename(cvName)}.docx`)
}

export async function exportCoverLetterToDocx(cvName: string, coverLetterText: string, contactInfo: ContactInfo) {
  const paragraphs = coverLetterText.split(/\n+/).filter(Boolean)

  const doc = new Document({
    styles: docxStyles,
    sections: [
      {
        children: [
          ...docxHeaderParagraphs(resolveTitle(contactInfo, cvName), contactInfo),
          ...paragraphs.map((p) => new Paragraph({ text: p, spacing: { after: 200 } }))
        ]
      }
    ]
  })

  const blob = await Packer.toBlob(doc)
  downloadBlob(blob, `${safeFilename(cvName)}-cover-letter.docx`)
}
