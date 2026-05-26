import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED, type LegalSection } from "@/lib/legalContent";

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  aside?: ReactNode;
};

export function LegalDocument({ eyebrow, title, intro, sections, aside }: LegalDocumentProps) {
  return (
    <div className="min-h-screen" style={{ background: "#f4f6f4" }}>
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 rounded-[28px] px-6 py-6 sm:px-8" style={{ background: "#0d1f18" }}>
          <div className="flex items-center justify-between gap-4">
            <Link href="/auth" className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-opacity hover:opacity-80">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to sign in
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(133,248,196,0.12)" }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: "#85f8c4" }}>
                bolt
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "#85f8c4" }}>
                Execution AI
              </span>
            </div>
          </div>

          <div className="max-w-3xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: "#85f8c4" }}>
              {eyebrow}
            </p>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-7 sm:text-base" style={{ color: "rgba(255,255,255,0.72)" }}>
              {intro}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Last updated {LEGAL_LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="rounded-[28px] bg-white px-6 py-7 shadow-sm sm:px-8" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="space-y-8">
              {sections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <h2 className="font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                    {section.title}
                  </h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 sm:text-[15px]" style={{ color: "#475569" }}>
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="space-y-2.5 pt-1">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm leading-7 sm:text-[15px]" style={{ color: "#475569" }}>
                          <span className="mt-2 h-2 w-2 rounded-full shrink-0" style={{ background: "#006c4a" }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>

          <aside className="h-fit rounded-[28px] px-6 py-6 sm:px-7" style={{ background: "#e8f3ee", border: "1px solid rgba(0,108,74,0.1)" }}>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#006c4a" }}>
                  Why this matters
                </p>
                <p className="mt-2 text-sm leading-7" style={{ color: "#425466" }}>
                  These pages explain how Execution AI handles user data, platform use, AI-assisted features, and account responsibilities.
                </p>
              </div>

              <div className="rounded-2xl bg-white px-4 py-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#6b7c75" }}>
                  Contact
                </p>
                <a href="mailto:hello@executionai.me" className="mt-2 block text-sm font-semibold transition-opacity hover:opacity-80" style={{ color: "#006c4a" }}>
                  hello@executionai.me
                </a>
              </div>

              {aside}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
