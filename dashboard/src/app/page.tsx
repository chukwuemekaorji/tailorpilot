import Image from "next/image"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* header */}
      <header className="mx-auto max-w-5xl px-6 pt-8">
        <Image
          src="/tailorpilot.png"
          alt="TailorPilot"
          width={80}
          height={70}
          priority
        />
      </header>

      {/* hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20 text-center">
        <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight">
          tailor your cv to <span className="text-tangerine">every</span> job posting
        </h1>
        <p className="mt-6 text-lg text-umber max-w-2xl mx-auto">
          stop rewriting your cv by hand for every application. tailorpilot reads
          the posting and matches your cv to it in seconds, without inventing
          experience you don&apos;t have.
        </p>

        {/* the signature: messy job posting text stitched into a clean cv bullet */}
        <div className="mt-14 flex flex-col md:flex-row items-center justify-center gap-4">
          <div className="font-mono text-sm bg-umber text-ivory rounded-lg px-5 py-4 text-left max-w-xs">
            &quot;...looking for someone w/ strong etl background, 3+ yrs python,
            comfortable w/ airflow &amp; aws...&quot;
          </div>

          <svg width="60" height="24" viewBox="0 0 60 24" className="hidden md:block">
            <line
              x1="0" y1="12" x2="60" y2="12"
              stroke="#E8791F" strokeWidth="2"
              className="stitch-line"
            />
          </svg>

          <div className="font-mono text-sm bg-espresso text-ivory rounded-lg px-5 py-4 text-left max-w-xs border border-tangerine">
            built etl pipelines in python using airflow, deployed on aws
          </div>
        </div>

        <div className="mt-14 flex items-center justify-center gap-4">
          <a
            href="#"
            className="bg-tangerine text-ivory font-semibold px-6 py-3 rounded-lg hover:bg-amber transition-colors"
          >
            install the extension
          </a>
          <a
            href="https://github.com/chukwuemekaorji/tailorpilot"
            className="border border-umber text-umber font-semibold px-6 py-3 rounded-lg hover:bg-umber hover:text-ivory transition-colors"
          >
            view on github
          </a>
        </div>
      </section>

      {/* the pipeline - numbered because it's a real, ordered sequence */}
      <section className="bg-espresso text-ivory py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="font-display text-3xl font-bold text-center mb-14">
            how it works
          </h2>

          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <p className="font-mono text-tangerine text-sm mb-2">01 — read</p>
              <p className="text-ivory/80">
                pulls out what actually matters from the job posting - the title,
                required skills, seniority, and core responsibilities.
              </p>
            </div>
            <div>
              <p className="font-mono text-tangerine text-sm mb-2">02 — tailor</p>
              <p className="text-ivory/80">
                rewrites your cv to match, reorders what&apos;s relevant, and drafts
                a cover letter for that specific role.
              </p>
            </div>
            <div>
              <p className="font-mono text-tangerine text-sm mb-2">03 — verify</p>
              <p className="text-ivory/80">
                checks every claim against your real cv. anything that can&apos;t
                be backed up gets removed before you see it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* the trust section */}
      <section className="py-20 text-center px-6">
        <h2 className="font-display text-3xl font-bold mb-4">nothing gets invented</h2>
        <p className="text-umber max-w-xl mx-auto">
          verification isn&apos;t a prompt asking the model to behave - it&apos;s
          an independent check, run locally, that confirms every claim before
          it ever reaches you.
        </p>
      </section>

      {/* bring your own key */}
      <section className="bg-amber/20 py-20 px-6 text-center">
        <h2 className="font-display text-3xl font-bold mb-4">bring your own key</h2>
        <p className="text-umber max-w-xl mx-auto mb-8">
          use whichever model you already trust. no vendor lock-in, no default.
        </p>
        <div className="flex justify-center gap-6 font-mono text-sm text-umber flex-wrap">
          <span>claude</span>
          <span>gemini</span>
          <span>openai</span>
          <span>groq</span>
        </div>
      </section>

      <footer className="py-10 text-center font-mono text-sm text-umber">
        open source
      </footer>
    </main>
  )
}