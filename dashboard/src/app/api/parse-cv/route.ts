import path from "path"
import { pathToFileURL } from "url"
import { NextResponse } from "next/server"
import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"

// needs real node apis (Buffer, and pdf-parse/mammoth's file parsing) -
// won't run on the edge runtime
export const runtime = "nodejs"

// pdf-parse loads pdfjs-dist's worker via a bundler-relative path, which
// turbopack doesn't emit as a real chunk - pointing it at the actual file
// on disk sidesteps that entirely instead of going through the bundler
PDFParse.setWorker(
  pathToFileURL(path.join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs")).href
)

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  try {
    let text: string

    if (name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text
    } else if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (name.endsWith(".txt")) {
      text = buffer.toString("utf-8")
    } else {
      return NextResponse.json(
        { error: "unsupported file type - upload a pdf, docx, or txt file" },
        { status: 400 }
      )
    }

    return NextResponse.json({ text })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "couldn't read that file - try a different one" },
      { status: 500 }
    )
  }
}
