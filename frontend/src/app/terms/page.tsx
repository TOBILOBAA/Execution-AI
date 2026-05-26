import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { termsSections } from "@/lib/legalContent";

export const metadata: Metadata = {
  title: "Terms of Use | Execution AI",
  description: "The rules and responsibilities for using Execution AI.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms of Use"
      title="The rules for using Execution AI."
      intro="These Terms explain the responsibilities, limitations, and expectations that apply when you use Execution AI and its AI-assisted planning features."
      sections={termsSections}
      aside={
        <div className="rounded-2xl bg-white px-4 py-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#6b7c75" }}>
            Key reminder
          </p>
          <p className="mt-2 text-sm leading-7" style={{ color: "#475569" }}>
            AI outputs can support clarity and execution, but they do not replace your judgment and are not professional advice.
          </p>
        </div>
      }
    />
  );
}
